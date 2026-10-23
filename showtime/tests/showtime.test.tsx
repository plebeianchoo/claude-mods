import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseCommand } from '../hooks/command'
import { busyLabel, formatDuration, levelOf, newsOf, toolLabel } from '../hooks/pet'
import { FINALE_MS, IDLE_SIGNALS, SPRITE_MS, STAGE_MS, THEMES, THEME_NAMES, finaleScene, nextTheme, petRow, pickRandom, segments, textWidth } from '../hooks/themes'
import type { Act } from '../hooks/themes'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const SPINNER = {
  component: 'Spinner',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
} as const

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

const IDLE = { ...BAND, props: { ...BAND.props, isWorking: false } }

const DONE = { turnId: 't1', reason: 'answer', answer: 'done', durationMs: 12_400, isAborted: false } as const

/** The band's own text (the pet's stats and bubble), as text to search. */
async function said(ui: { findAll: (query: { type: string }) => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.findAll({ type: 'Text' }))
}

/** What a Client's module last drew, as text to search. */
async function drawn(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }, key: string): Promise<string> {
  return JSON.stringify(await ui.drawn({ in: key }))
}

// The /config rows the plugin wrote, as `[key, value]`.
let rows: [string, unknown][] = []
// What the AskUserQuestion dialog answers (`/showtime theme`); null: dismissed.
let asked: { question: string; options: string[] } | null = null
let answer: string | null = null
// The id of the last tool call the host ran, for a check about it.
let lastCallId = ''
// Ids the host's task tools hand out.
let taskSeq = 0
// How a call the host runs ends: denied, or run with or without an error.
let ends: 'deny' | 'ok' | 'fail' = 'deny'
// What the engine's check says to a call. The engine now settles an ask itself when no person can
// answer (the call is refused before the host runs it), so calls go through on `allow`; a test of
// the permission prompt asks its question straight with `$.tool.check` under `ask`. Under `deny`
// the engine refuses the call itself: the host never runs it, and the plugin's `next` answers
// `{ isError, text }` with no `result`.
let verdict: 'allow' | 'ask' | 'deny' = 'allow'

function host(on: On, stored: Record<string, unknown> = {}) {
  rows = []
  asked = null
  answer = null
  ends = 'deny'
  verdict = 'allow'
  taskSeq = 0
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, stored)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('tool.check', () => ({ decision: verdict }))
  on('agent.spawn', ($, e) => ({ model: 'test', agentId: `a-${e.tool_use_id}` }))
  on('tool.call', async ($, e) => {
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(++taskSeq), subject: (e as { subject: string }).subject } }, text: 'ok' }
    if (e.tool === 'TaskUpdate') {
      const u = e as { taskId: string; status?: 'pending' | 'in_progress' | 'completed' }
      return { result: { success: true, taskId: u.taskId, updatedFields: ['status'], statusChange: { from: 'pending', to: u.status ?? 'pending' } }, text: 'ok' }
    }
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0]!
      asked = { question: q.question, options: q.options.map(o => o.label) }
      if (answer === null) return { deny: 'dismissed' }
      return { result: { questions: e.questions, answers: { [q.question]: answer } }, text: answer }
    }
    lastCallId = e.tool_use_id
    await clock.sleep(1000)
    if (ends === 'deny') return { deny: 'test' }
    return ends === 'fail' ? { result: 'out', text: 'out', isError: true } : { result: 'out', text: 'out' }
  })
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box key="core">
        <Text>Sauteing…</Text>
      </Box>
    )
  })
  return clock
}

test('every scene, finale and companion row fills exactly its width, every frame', async () => {
  const acts: Act[] = ['think', 'tool', 'ask', 'say']
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    for (const w of [16, 37, 80, 160]) {
      for (let t = 0; t < 150; t += 7) {
        const scene = theme.scene(t, w, { ...IDLE_SIGNALS, act: acts[t % 4]! })
        expect(scene).toHaveLength(theme.rows)
        const rows = [
          ...scene,
          ...finaleScene(theme, 'answer', '完成 · 12s', t, w),
          ...finaleScene(theme, 'error', 'x', t, w),
          ...petRow(theme, { state: acts[t % 4]!, bubble: t % 2 ? 'Bash: npm test' : '', stats: 'Lv.3 ♥12' }, t, w, t % 3),
          ...petRow(theme, { state: 'sleep', bubble: 'Zzz…', stats: 'Lv.1 ♥0' }, t, w, 0),
        ]
        for (const row of rows) {
          expect(textWidth(segments(row).map(s => s.text).join(''))).toBe(w)
        }
      }
    }
    for (const frames of Object.values(theme.sprite)) expect(frames.length).toBeGreaterThan(0)
  }
})

test('a theme row from before 1.0 naming audio loads as random', { options: { theme: 'audio' } }, async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const text = (await $.command.run({ command: 'showtime', args: '', ...RUN })).text
  expect(text).toContain('random')
  expect(text).not.toContain('audio')
})

test('helpers', async () => {
  expect(formatDuration(12_400)).toBe('12s')
  expect(formatDuration(185_000)).toBe('3m 05s')
  expect(formatDuration(3_720_000)).toBe('1h 02m')
  for (let i = 0; i < 50; i++) expect(THEME_NAMES).toContain(pickRandom(i))
  expect([0, 1, 2, 8, 18].map(levelOf)).toEqual([1, 1, 2, 3, 4])
  expect(toolLabel({ tool: 'Bash', command: 'npm test\nnpm run lint' })).toBe('Bash: npm test')
  expect(toolLabel({ tool: 'Edit', file_path: '/a/b/themes.ts' })).toBe('Edit: themes.ts')
  expect(toolLabel({ tool: 'mcp__github__create_issue' })).toBe('create_issue')
  expect(newsOf('npm test', false)).toBe('testPass')
  expect(newsOf('cd a && CI=1 pytest -q', true)).toBe('testFail')
  expect(newsOf('go test ./...', false)).toBe('testPass')
  expect(newsOf('git -C repo commit -m "x"', false)).toBe('commit')
  expect(newsOf('git commit -m x', true)).toBe(null)
  expect(newsOf('git commit --dry-run', false)).toBe(null)
  expect(newsOf('cat test.log', false)).toBe(null)
  expect(newsOf('npm run lint', false)).toBe(null)
  expect(toolLabel({ tool: 'Agent', description: 'Study HUD mods', prompt: '…' })).toBe('Agent: Study HUD mods')
  expect(busyLabel(['Agent: a', 'Agent: b', 'Agent: c'])).toBe('Agent ×3')
  expect(busyLabel(['Read: a.ts', 'Agent: b'])).toBe('Agent: b')
  expect(busyLabel([])).toBe(undefined)
})

test('one mascot: in the companion row, or in front of the engine line without it', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'showtime', args: 'cat' })
  const plain = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...SPINNER })
  expect(await plain.findAll({ type: 'Client' })).toHaveLength(0)
  await plain.unmount()

  await $.command.run({ ...RUN, command: 'showtime', args: 'companion off' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'showtime', surface, ...SPINNER })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=)   ')
    await ui.advance(SPRITE_MS * 3)
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=) ?!')
    await ui.unmount()
  }
})

test('band plays the scene and the companion while working, keeps other bands', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'showtime', args: 'dino' })
  await $.turn.start({ text: 'hi', turnId: 't1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'showtime', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'work')).toContain('HI 00000')
    expect(await said(ui)).toContain('Lv.1 ♥0')
    expect(await ui.findAll({ type: 'Client' })).toHaveLength(2)
    // Thinking is the engine's line to say; the bubble stays quiet.
    expect(await ui.findAll({ type: 'Text' })).toHaveLength(2)
    await ui.advance(STAGE_MS * 5)
    expect(await drawn(ui, 'work')).toContain('HI 00005')
    await ui.unmount()
  }

  await $.command.run({ ...RUN, command: 'showtime', args: 'stage off' })
  const off = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await off.findAll({ type: 'Client' })).toHaveLength(1)
  expect(await said(off)).toContain('Lv.1 ♥0')
  await off.unmount()
})

test('a short band gets the pet in one row', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND, props: { ...BAND.props, maxRows: 2 } })
  expect(await ui.findAll({ type: 'Client' })).toHaveLength(0)
  expect(await said(ui)).toContain('Lv.1 ♥0')
  await ui.unmount()
})

test('reduced motion draws one still frame', { options: { reducedMotion: true } }, async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'showtime', args: 'dino' })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await drawn(ui, 'work')).toContain('HI 00000')
  await ui.advance(STAGE_MS * 5)
  expect(await drawn(ui, 'work')).toContain('HI 00000')
  await ui.unmount()
})

test('the companion follows tool calls and permission prompts', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })

  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('Bash: npm test')
  await ui.unmount()

  // The check asks; the pet says so only once the ask has stood a moment.
  verdict = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'npm test' }, tool_use_id: lastCallId } as never)
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('等你确认')
  await ui.unmount()
  await clock.advance(600)
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('等你确认一下～')
  await ui.unmount()

  await clock.advance(1000)
  await call
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('Bash: npm test')
  expect(await said(ui)).not.toContain('等你确认')
  await ui.unmount()
})

test('tests and commits Claude runs: a word from the pet, xp for good news', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  ends = 'ok'
  const pass = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(1000)
  await pass
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('测试通过啦！')
  expect(await said(ui)).toContain('Lv.1 ♥0')
  await ui.unmount()
  ends = 'fail'
  const fail = $.tool.call({ tool: 'Bash', command: 'pytest' })
  await clock.advance(1000)
  await fail
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('测试没过')
  await ui.unmount()
  await clock.advance(4000)
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('测试没过')
  await ui.unmount()
  // One xp for the tests that passed, none for those that failed.
  expect((await $.command.run({ ...RUN, command: 'showtime', args: '' })).text).toContain('经验 1 ·')
})

test('an ask the mode settles at once never reaches the pet', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  // A query (no call id) and a call already over: neither is the person's to answer.
  verdict = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  await clock.advance(1000)
  await call
  verdict = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'npm test' }, tool_use_id: lastCallId } as never)
  await clock.advance(600)
  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('等你确认')
  await ui.unmount()
})

test('a finished turn plays the finale, then the companion waits; a click pats it', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(DONE)

  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await drawn(ui, 'finale-t1')).toContain('完成 · 12s')
  await ui.unmount()

  await clock.advance(FINALE_MS)
  const idle = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await idle.findAll({ type: 'Client' })).toHaveLength(1)
  expect(await said(idle)).toContain('做完啦，快看看！')
  expect(await said(idle)).toContain('Lv.1 ♥0')
  await idle.post({ pat: true }, { in: 'pet' })
  expect(await said(idle)).toContain('Lv.1 ♥1')
  // A pat floats pixel hearts over the pet.
  expect(await drawn(idle, 'pet')).toMatch(/#ff6b9d|#ff8fab/)
  await idle.unmount()

  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'pet' })).text).toContain('♥2')

  await $.command.run({ ...RUN, command: 'showtime', args: 'companion off' })
  const none = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await none.findAll({ type: 'Client' })).toHaveLength(0)
  await none.unmount()
})

test('/showtime switches, hides and reports', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()

  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'thunder' })).text).toBe('已切换到 thunder')
  const status = (await $.command.run({ ...RUN, command: 'showtime', args: '' })).text
  expect(status).toContain('当前主题：thunder')
  expect(status).toContain('thunder · Lv.1 · 经验 0 · ♥0')
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'nyancat' })).text).toContain('没有叫 nyancat 的主题')
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'random' })).text).toContain('每个会话随机一个主题')

  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'off' })).text).toBe('运行动画已关闭')
  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...SPINNER })
  expect(await ui.findAll({ type: 'Text' })).toHaveLength(1)
  await ui.unmount()
  const band = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  await band.unmount()
})

test('/showtime theme asks which: an offered option, one typed under Other, or dismissed', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'showtime', args: 'cat' })

  answer = 'random'
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'theme' })).text).toContain('每个会话随机一个主题')
  expect(asked?.question).toContain('换哪个主题')
  expect(asked?.options).toHaveLength(4)
  expect(asked?.options[0]).toBe('random')

  answer = ' Ocean '
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'theme' })).text).toBe('已切换到 ocean')
  expect(asked?.options).not.toContain('ocean')
  expect(rows).toEqual([
    ['showtime.theme', 'cat'],
    ['showtime.theme', 'random'],
    ['showtime.theme', 'ocean'],
  ])

  answer = 'nyancat'
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'theme' })).text).toContain('没有叫 nyancat 的主题')

  answer = null
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'theme' })).text).toContain('当前主题：ocean')
  expect(rows).toHaveLength(3)
})

test('a subagent\'s permission ask shows too, until its call ends', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const call = $.tool.call({ tool: 'Bash', command: 'rm -rf build', agentId: 'a1' } as never)
  await clock.settle()
  verdict = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' }, tool_use_id: lastCallId } as never)
  await clock.advance(600)
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('等你确认一下～')
  await ui.unmount()
  await clock.advance(1000)
  await call
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('等你确认')
  await ui.unmount()
})

test('/showtime arguments', async () => {
  expect(parseCommand('')).toEqual({ kind: 'status' })
  expect(parseCommand(' OFF ')).toEqual({ kind: 'visible', isOn: false })
  expect(parseCommand('stage on')).toEqual({ kind: 'stage', isOn: true })
  expect(parseCommand('stage')).toEqual({ kind: 'unknown', name: 'stage' })
  expect(parseCommand('companion off')).toEqual({ kind: 'companion', isOn: false })
  expect(parseCommand('feed off')).toEqual({ kind: 'feed', isOn: false })
  expect(parseCommand('feed')).toEqual({ kind: 'unknown', name: 'feed' })
  expect(parseCommand('preview')).toEqual({ kind: 'preview', theme: null })
  expect(parseCommand('preview neon')).toEqual({ kind: 'preview', theme: 'neon' })
  expect(parseCommand('preview x')).toEqual({ kind: 'unknown', name: 'x' })
  expect(parseCommand('Random')).toEqual({ kind: 'theme', theme: 'random' })
  expect(parseCommand('cat')).toEqual({ kind: 'theme', theme: 'cat' })
  expect(parseCommand('theme')).toEqual({ kind: 'pick' })
  expect(parseCommand('theme neon')).toEqual({ kind: 'theme', theme: 'neon' })
  expect(parseCommand('theme random')).toEqual({ kind: 'theme', theme: 'random' })
  expect(parseCommand('theme x')).toEqual({ kind: 'unknown', name: 'x' })
})

test('/showtime writes its /config rows, once per change', { options: { theme: 'dino' } }, async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'showtime', args: 'neon' })
  await $.command.run({ ...RUN, command: 'showtime', args: 'stage off' })
  await $.command.run({ ...RUN, command: 'showtime', args: 'stage off' })
  await $.command.run({ ...RUN, command: 'showtime', args: 'companion off' })
  await $.command.run({ ...RUN, command: 'showtime', args: 'off' })
  expect(rows).toEqual([
    ['showtime.theme', 'neon'],
    ['showtime.stage', false],
    ['showtime.companion', false],
    ['showtime.visible', false],
  ])
})

test('settings older versions kept in the store move to /config rows', async ($, on) => {
  const clock = host(on, { theme: 'cat', isStageOff: true, isCompanionOff: false, isHidden: false })
  await $.session.start(START)
  await clock.settle()
  expect(rows).toEqual([
    ['showtime.theme', 'cat'],
    ['showtime.visible', true],
    ['showtime.stage', false],
    ['showtime.companion', true],
  ])
  expect((await $.command.run({ ...RUN, command: 'showtime', args: '' })).text).toContain('当前主题：cat')
  // A reload (a row changed) keeps the session's theme; the store holds nothing to move again.
  await $.session.start(START)
  await clock.settle()
  expect(rows).toHaveLength(4)
})

test('random keeps the theme it drew this session across a reload', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const first = (await $.command.run({ ...RUN, command: 'showtime', args: '' })).text?.split('\n')[0]
  await clock.advance(12_345)
  await $.session.start(START)
  await clock.settle()
  expect((await $.command.run({ ...RUN, command: 'showtime', args: '' })).text?.split('\n')[0]).toBe(first)
})

test('the footer button turns the animations off and on, keeping the modes beneath it', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const footer = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', component: 'SessionMode', props: { modes: ['focus'] } })
  expect(await footer.find({ type: 'Button', key: 'showtime-toggle' })).toBeDefined()
  await footer.press({ key: 'showtime-toggle' })
  const band = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  await band.unmount()
  await footer.press({ key: 'showtime-toggle' })
  expect(rows).toEqual([
    ['showtime.visible', false],
    ['showtime.visible', true],
  ])
  await footer.unmount()
})

// A session resumed or cleared gets no session.start, and starts with nothing written.
test('a resumed session follows the rows', { options: { visible: false } }, async ($, on) => {
  host(on)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const band = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  await band.unmount()
})

test('a resumed session picks its theme on its first turn', { options: { theme: 'dino' } }, async ($, on) => {
  host(on)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const band = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await drawn(band, 'work')).toContain('HI 00000')
  await band.unmount()
})

// `rotate`: a random start, then the next theme each turn, in order.
test('nextTheme walks the drawable themes in order and wraps', () => {
  const pool = THEME_NAMES
  expect(nextTheme(pool[0]!)).toBe(pool[1]!)
  expect(nextTheme(pool[pool.length - 1]!)).toBe(pool[0]!)
})

test('rotate moves to the next theme on each turn', { options: { theme: 'rotate' } }, async ($, on) => {
  host(on)
  await $.session.start(START)
  const themeNow = async () => /当前主题：(\w+)/.exec((await $.command.run({ ...RUN, command: 'showtime', args: '' })).text ?? '')![1]!
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const first = await themeNow()
  await $.turn.complete({ ...DONE, turnId: 't1' })
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(await themeNow()).toBe(nextTheme(first as never))
})

test('/showtime rotate switches to rotating and persists the row', async ($, on) => {
  host(on)
  await $.session.start(START)
  expect(parseCommand('rotate')).toEqual({ kind: 'theme', theme: 'rotate' })
  expect(parseCommand('theme rotate')).toEqual({ kind: 'theme', theme: 'rotate' })
  expect((await $.command.run({ ...RUN, command: 'showtime', args: 'rotate' })).text).toContain('每轮换一个主题')
  expect(rows).toContainEqual(['showtime.theme', 'rotate'])
})

test('every theme has its own pet with eyes inside its body', () => {
  for (const name of THEME_NAMES) {
    const pet = THEMES[name].pet
    expect(pet.body).toHaveLength(5)
    for (const row of pet.body) expect(row.length).toBeLessThanOrEqual(12)
    for (const x of pet.eyes) expect(pet.body[pet.eyeRow]![x]).not.toBe('.')
  }
})

test('a call the engine itself refuses is no news: no "tests failed" from the pet', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  ends = 'ok'
  verdict = 'deny'
  const refused = await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(refused.isError).toBe(true)
  const ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('测试没过')
  await ui.unmount()
})

test('tasks show beside the pet: progress on the stats row, the task under it; cleared when the turn ends', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write the feed', description: 'd' } as never)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Draw the rows', description: 'd' } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  let text = await said(ui)
  expect(text).toContain('0/2')
  expect(text).toContain('▸ Write the feed')
  await ui.unmount()
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('1/2')
  await ui.unmount()
  await $.turn.complete(DONE)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  text = await said(ui)
  expect(text).not.toContain('1/2')
  expect(text).not.toContain('Write the feed')
  expect(text).toContain('Lv.')
  await ui.unmount()
})

test('subagents get a row under the band, counted past what fits, gone when they finish', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 'c1', prompt: 'p', description: 'review the diff', subagentType: 'reviewer', provider: { kind: 'plugin', plugin: 'test' } } as never)
  await $.agent.spawn({ tool_use_id: 'c2', prompt: 'p', description: 'run the tests', subagentType: 'checker', provider: { kind: 'plugin', plugin: 'test' } } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  let text = await said(ui)
  expect(text).toContain('⤷ reviewer · review the diff')
  expect(text).toContain('checker · run the tests')
  await ui.unmount()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 40 } })
  expect(await said(ui)).toContain('+1 个')
  await ui.unmount()
  // One finishes: its part goes; the companion off takes the row with it.
  await $.turn.complete({ ...DONE, agentId: 'a-c1' } as never)
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  text = await said(ui)
  expect(text).not.toContain('reviewer')
  expect(text).toContain('⤷ checker · run the tests')
  await ui.unmount()
  await $.command.run({ ...RUN, command: 'showtime', args: 'companion off' })
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).not.toContain('⤷')
  await ui.unmount()
  await $.command.run({ ...RUN, command: 'showtime', args: 'companion on' })
  await $.turn.complete(DONE)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await said(ui)).not.toContain('⤷')
  await ui.unmount()
})

test('a narrow band keeps done/total on its one line; /showtime feed off hides the feed, not the pet', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'One', description: 'd' } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 50 } })
  expect(await said(ui)).toContain('Lv.1 ♥0 0/1')
  await ui.unmount()
  expect((await $.command.run({ command: 'showtime', args: 'feed off', ...RUN })).text).toContain('已隐藏')
  expect(rows).toContainEqual(['showtime.feed', false])
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  const text = await said(ui)
  expect(text).not.toContain('0/1')
  expect(text).toContain('Lv.')
  expect(await drawn(ui, 'pet')).toContain('▀')
  await ui.unmount()
  expect((await $.command.run({ ...RUN, command: 'showtime', args: '' })).text).toContain('已隐藏')
  expect((await $.command.run({ command: 'showtime', args: 'feed on', ...RUN })).text).toContain('已显示')
  expect(rows).toContainEqual(['showtime.feed', true])
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('0/1')
  await ui.unmount()
})
