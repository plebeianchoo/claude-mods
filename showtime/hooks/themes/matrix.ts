// Theme: matrix. Its scene, its words and its pet.
//
// The scene: digital rain across both rows, a drop a column falling at one of three speeds with a
// bright head, a green body and a dim trail, its glyphs re-rolled every third frame (every frame while
// bash runs); every third column keeps a dim residue glyph that never drains, re-rolled slowly. Now and
// then a column glitches: a white block on both rows fading through `▓▒░`. A console `⟦……⟧` sits at the
// left of the bottom row and shows what the turn is doing: a tape of glyphs rolling by while thinking, the
// tool's mark with a progress bar sweeping to and fro (`$` for bash), a `?` with a blinking cursor asking,
// a prompt typing out a line of code when it talks, a dot walking the dots while waiting; when the act or
// tool changes the readout decodes over four frames from white noise, left to right, with the brackets lit.
// Tasks are a row of bits at the top right (`0` pending, `1` done), left of the agent figures
// (withReactions), the newest bit blinking and all rolling colours when the last lands; a glitch greets
// each new agent. A failed test greys the rain and reads `×fail×` under the shake; a passed test whitens
// the heads, storms the glitches and flashes `★pass★`; a commit turns the rain gold and reads `commit`
// under the spark burst; bash churns the glyphs every frame, doubles the glitches and shows `$`.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start more
// than one column from a run start in the frame before (same or adjacent row). Rain lighting a cell
// whose left neighbour is dark, or draining one whose right neighbour is lit, starts a run anywhere; so
// every third column is an anchor: on one row (alternating, row 0 where the console covers row 1) its
// cell is never dark (rain or residue) and the cell before it is never lit, which makes it a run start
// in every frame, and every column of the band lies within a cell of one. Everything else is then free:
// a rain cell, a glitch (in the free columns between an anchor and the next gap) or a console cell may
// light or drain at will. Nothing slides sideways through the rain: a mover crossing an anchor's gap
// would hide that anchor's run start for a frame. The console is one solid run from column 0 in every
// frame (its filler is `·` or `░`, never a space), so the readout inside it may change freely.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid, Style } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const GREEN = '#52b788'
const BRIGHT = '#d8f3dc'
const DIM = '#2d6a4f'
const PALE = '#95d5b2'
const WHITE = '#ffffff'
const GREY = '#9a9a9a'
const GOLD = '#ffd166'
const PALETTE = [GREEN, BRIGHT, DIM, PALE]
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ﾊﾋﾌﾍﾎ'
/** The console `⟦……⟧` at the left of the bottom row: its width and the cells inside the brackets. */
const CONSOLE_W = 8
const INNER_W = CONSOLE_W - 2
/** A drop's cycle down its column in frames, and the head ages that keep a cell lit behind it. */
const DROP_CYCLE = 14
const TRAIL = 6
/** Anchors sit every ANCHOR_GAP columns; glitches in the free column after each. */
const ANCHOR_GAP = 3
/** Four metronome drops in the free columns from BEAT_X: speed one, phased two frames apart, so that some
 * cell lights or drains in every frame even when the band is narrow. */
const BEAT_X = CONSOLE_W + 2
const BEATS = 4
const GLITCH = ['█', '▓', '▒', '░']
const GLITCH_EVERY = 48
const GLITCH_STORM = 8
/** The thinking tape, rolled a cell every two frames: a 24-frame cycle. */
const THINK_TAPE = 'ｱ1ｳ0ｶ1ｷ0ｹ1ｻ0'
const CURSOR = ['▌', '_']
const SAY_CYCLE = 16
const DECODE_FRAMES = 4
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** `IDLE_SIGNALS.actAge`: an age this large means no change is known. */
const IDLE_AGE = 999
type Cell = { ch: string; style: Style }
/** Per act: the readout inside the brackets at frame `f` since the act began. */
type ActArt = { readout: (f: number, mark: string) => Cell[] }
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

const filler = (ch: string): Cell => ({ ch, style: { c: DIM, d: true } })
const glyphAt = (n: number): string => GLYPHS[Math.floor(noise(n) * GLYPHS.length)]!
/** Position `n` of a head sweeping to and fro over `k` cells. */
function bounce(n: number, k: number): number {
  const m = mod(n, 2 * k - 2)
  return m < k ? m : 2 * k - 2 - m
}

const ACTS: Record<Act, ActArt> = {
  // The tape rolls left a cell every two frames, its newest glyph bright.
  think: {
    readout: f => Array.from({ length: INNER_W }, (_, i) => {
      const ch = THINK_TAPE[mod(i + (f >> 1), THINK_TAPE.length)]!
      return { ch, style: i === INNER_W - 1 ? { c: BRIGHT, b: true } : { c: GREEN } }
    }),
  },
  // The tool's mark, then a bar whose head sweeps to and fro over five cells, a cell every two frames.
  tool: {
    readout: (f, mark) => {
      const head = bounce(f >> 1, INNER_W - 1)
      const bar = Array.from({ length: INNER_W - 1 }, (_, i) => {
        if (i === head) return { ch: '▓', style: { c: GREEN, b: true } }
        return Math.abs(i - head) === 1 ? { ch: '▒', style: { c: GREEN } } : filler('░')
      })
      return [{ ch: mark, style: { c: BRIGHT, b: true } }, ...bar]
    },
  },
  // A question mark and a cursor blinking on a twelve-frame cycle.
  ask: {
    readout: f => [
      { ch: '?', style: { c: BRIGHT, b: true } },
      { ch: frame(CURSOR, Math.floor(f / 6)), style: { c: GREEN } },
      ...Array.from({ length: INNER_W - 2 }, () => filler('·')),
    ],
  },
  // A prompt typing a line of code, a glyph every two frames, then the cursor blinking; a new line each cycle.
  say: {
    readout: f => {
      const typed = Math.min(INNER_W - 2, mod(f, SAY_CYCLE) >> 1)
      const line = Math.floor(f / SAY_CYCLE)
      return Array.from({ length: INNER_W }, (_, i) => {
        if (i === 0) return { ch: '>', style: { c: GREEN } }
        if (i <= typed) return { ch: glyphAt(line * 7 + i), style: { c: BRIGHT } }
        if (i === typed + 1) return { ch: frame(CURSOR, f >> 1), style: { c: GREEN } }
        return filler('·')
      })
    },
  },
  // A bright dot walking the row of dots, a cell every two frames.
  wait: {
    readout: f => Array.from({ length: INNER_W }, (_, i) =>
      i === mod(f >> 1, INNER_W) ? { ch: '•', style: { c: GREEN } } : filler('·'),
    ),
  },
}

/** The row an anchor column keeps lit: alternating, but never under the console. */
function anchorRow(a: number): number {
  const row = (a / ANCHOR_GAP) % 2 ? 0 : 1
  return row === 1 && a < CONSOLE_W ? 0 : row
}
const isAnchor = (x: number, y: number): boolean => x % ANCHOR_GAP === 0 && anchorRow(x) === y
const isGap = (x: number, y: number): boolean => (x + 1) % ANCHOR_GAP === 0 && anchorRow(x + 1) === y

export function matrixScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  const age = Math.min(s.actAge, s.toolAge)
  const since = age < IDLE_AGE ? age : t
  // Layer 1: the rain. A drop a column at one of three speeds (four metronome columns at speed one); the
  // head bright, two cells of body, a dim trail; glyphs re-rolled every third frame (every frame on bash).
  // Anchor cells keep a residue glyph between drops, re-rolled every eighth frame; gap cells stay dark;
  // the console covers its own cells.
  const roll = bash ? t : Math.floor(t / 3)
  for (let x = 0; x < w; x++) {
    const beat = (x - BEAT_X) / ANCHOR_GAP
    const metronome = Number.isInteger(beat) && beat >= 0 && beat < BEATS
    const speed = metronome ? 1 : 1 + Math.floor(noise(x) * 3)
    const phase = metronome ? beat * 2 : Math.floor(noise(x + 50) * DROP_CYCLE)
    const head = mod(Math.floor(t / speed) + phase, DROP_CYCLE)
    for (let y = 0; y < 2; y++) {
      if ((y === 1 && x < CONSOLE_W) || isGap(x, y)) continue
      const drop = head - y
      if (drop < 0 || drop > TRAIL) {
        if (isAnchor(x, y)) put(g, x, y, glyphAt(x * 17 + (t >> 3)), { c: failing ? GREY : DIM, d: true })
        continue
      }
      const body = failing ? GREY : committing ? GOLD : passing ? BRIGHT : GREEN
      const style: Style = drop === 0
        ? { c: failing ? GREY : committing ? GOLD : passing ? WHITE : BRIGHT, b: !failing }
        : { c: drop < 3 ? body : failing ? GREY : committing ? GOLD : DIM, d: failing && drop >= 3 }
      put(g, x, y, glyphAt(x * 31 + y + roll), style)
    }
  }
  // Layer 2: glitches. A free column flashes a white block on both rows and fades over four frames, each
  // column on its own phase; twice as often on bash, a storm on a passed test, none on a failed one.
  const every = passing ? GLITCH_STORM : bash ? GLITCH_EVERY / 2 : GLITCH_EVERY
  for (let x = CONSOLE_W + 1; x < w; x++) {
    if (failing || x % ANCHOR_GAP !== 1) continue
    const k = mod(t + Math.floor(noise(x + 90) * every), every)
    if (k >= GLITCH.length) continue
    const c = k === 0 ? WHITE : committing ? GOLD : BRIGHT
    for (let y = 0; y < 2; y++) put(g, x, y, GLITCH[k]!, { c, b: true, d: k === GLITCH.length - 1 })
  }
  // Layer 3: the console. Its readout per act, cycling from the act change (from `t` when none is known);
  // over the four frames after the act or tool changes it decodes from white noise, left to right, with
  // the brackets lit. `×fail×` grey on a failed test, `★pass★` flashing on a passed one, `commit` gold.
  const mark = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : '✦'
  let cells = act.readout(bash ? since * 2 : since, mark)
  let bracket: Style = { c: BRIGHT, b: s.act !== 'wait', d: s.act === 'wait' }
  if (age < DECODE_FRAMES) {
    cells = cells.map((cell, i) => (i < age * 2 ? cell : { ch: glyphAt(t * 31 + i), style: { c: WHITE, b: true } }))
    bracket = { c: WHITE, b: true }
  }
  const word = (text: string, c: string): Cell[] => [...text].map(ch => ({ ch, style: { c, b: true } }))
  if (failing) [cells, bracket] = [word('×fail×', GREY), { c: GREY }]
  else if (passing) [cells, bracket] = [word('★pass★', frame([WHITE, BRIGHT], t >> 1)), { c: WHITE, b: true }]
  else if (committing) [cells, bracket] = [word('commit', GOLD), { c: GOLD, b: true }]
  put(g, 0, 1, '⟦', bracket)
  cells.forEach((cell, i) => put(g, 1 + i, 1, cell.ch, cell.style))
  put(g, CONSOLE_W - 1, 1, '⟧', bracket)
  // Tasks: a row of bits at the top right, left of the agents, `done` of them `1` (floor-scaled when more
  // than fit), the newest blinking; all roll colours when the last lands.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW - (CONSOLE_W + 2)))
  const lit = s.total > count ? Math.floor((s.done * count) / s.total) : Math.min(s.done, count)
  const x0 = w - 1 - agentsW - count
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const on = i < lit
    const newest = on && i === lit - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '▮' : on ? '1' : '0'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '▮' ? WHITE : on ? BRIGHT : GREEN
    put(g, x0 + i, 0, glyph, { c, b: on, d: !on })
  }
  // A new agent: a glitch greeting on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    const row = mod(t + i * 3, 8) < 4 ? 0 : 1
    put(g, w - 2 - i * 2, row, frame(['▒', '░'], s.agentsAge >> 1), { c: BRIGHT, b: true })
  }
  return withReactions(g, t, s, GREEN)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: GREEN, L: GREEN, D: GREEN }, lid: GREEN }

export const MATRIX: Theme = {
  name: 'matrix',
  rows: 2,
  sleep: '⟦IDLE⟧',
  color: GREEN,
  accent: BRIGHT,
  sprite: {
    think: ['ｱ1ｳ0', '1ｳ0ｶ', 'ｳ0ｶ1', '0ｶ1ｱ'].map(s => `⟦${s}⟧`),
    tool: ['⟦▓▒░ ⟧', '⟦ ▓▒░⟧', '⟦░ ▓▒⟧', '⟦▒░ ▓⟧'],
    say: ['⟦>_  ⟧', '⟦>_▌ ⟧', '⟦>__▌⟧'],
    wait: ['⟦·   ⟧', '⟦··  ⟧', '⟦··· ⟧'],
  },
  happy: '⟦ OK ⟧',
  sad: '⟦ ^C ⟧',
  dead: '⟦ERR!⟧',
  confetti: ['ｱ', '0', '1', 'ﾊ', '·'],
  palette: PALETTE,
  scene: matrixScene,
  pet: PET,
}
