import { expect, test } from 'claude-code/testing'

import { withReactions } from '../hooks/reactions'
import { IDLE_SIGNALS, blank, put, THEMES, THEME_NAMES, segments, textWidth } from '../hooks/themes'
import type { Act, NewsKind, Signals } from '../hooks/themes'

const ACTS: Act[] = ['think', 'tool', 'ask', 'say']
const NEWS: NewsKind[] = ['testPass', 'testFail', 'commit']
/** Themes that meet the motion rules already (each polish task adds its own). */
const POLISHED = new Set<string>(['clawd', 'thunder', 'chomp', 'sparky', 'bluecat'])

function sig(over: Partial<Signals>): Signals {
  return { ...IDLE_SIGNALS, ...over }
}

test('every scene fills its rows and width under every signal, and never throws', () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    const cases: Signals[] = [
      ...ACTS.map(act => sig({ act, actAge: 0 })),
      ...ACTS.map(act => sig({ act, actAge: 30 })),
      sig({ agents: 2, agentsAge: 0 }), sig({ agents: 5, agentsAge: 40 }),
      sig({ done: 0, total: 0 }), sig({ done: 3, total: 7, doneAge: 0 }), sig({ done: 7, total: 7, doneAge: 2 }), sig({ done: 2, total: 40 }),
      ...NEWS.flatMap(news => [0, 1, 3, 7, 8, 20, 60].map(newsAge => sig({ news, newsAge }))),
      sig({ act: 'tool', tool: 'bash' }), sig({ act: 'tool', tool: 'edit' }), sig({ act: 'tool', tool: 'search' }),
    ]
    for (const w of [16, 40, 80, 160]) {
      for (const s of cases) {
        for (const t of [0, 1, 7, 50, 333]) {
          const g = theme.scene(t, w, s)
          expect(g).toHaveLength(theme.rows)
          for (const row of g) expect(textWidth(segments(row).map(x => x.text).join(''))).toBe(w)
        }
      }
    }
  }
})

/** The foreground cells of a row as a string, for comparing frames. */
function ink(g: ReturnType<(typeof THEMES)['clawd']['scene']>): string[] {
  return g.map(row => row.map(c => (c.ch === ' ' ? ' ' : 'x')).join(''))
}

/** The first column of each run of non-space cells, to spot a shape jumping. */
function edges(line: string): number[] {
  const out: number[] = []
  for (let x = 0; x < line.length; x++) if (line[x] === 'x' && (x === 0 || line[x - 1] !== 'x')) out.push(x)
  return out
}

const W = 80

test('polished scenes never hold a frame and never jump a shape more than a cell', () => {
  for (const name of THEME_NAMES) {
    if (!POLISHED.has(name)) continue
    const theme = THEMES[name]
    for (const act of ACTS) {
      let last = ink(theme.scene(0, W, sig({ act, actAge: 30 })))
      for (let t = 1; t < 60; t++) {
        const now = ink(theme.scene(t, W, sig({ act, actAge: 30 + t })))
        expect(now.join('\n')).not.toBe(last.join('\n'))
        for (let r = 0; r < now.length; r++) {
          const b = edges(now[r]!)
          // Each edge in the new frame is within a cell of one in the old, in the same row or the one
          // above or below (a sprite may hop a cell row); shapes that appear count once, at the edges.
          const a = [last[r - 1], last[r], last[r + 1]].flatMap(line => (line ? edges(line) : []))
          for (const x of b) {
            const near = a.some(y => Math.abs(y - x) <= 1) || x <= 1 || x >= W - 2
            expect(near, `${name} ${act} t=${t} row ${r} edge at ${x} jumped`).toBe(true)
          }
        }
        last = now
      }
    }
  }
})

test('the failed-test shake keeps rows exactly w cells with wide characters at the edges', () => {
  const w = 20
  for (const newsAge of [1, 2]) {
    const g = blank(w, 2)
    for (let r = 0; r < 2; r++) {
      put(g, 0, r, '猫')
      put(g, w - 2, r, '猫')
    }
    const out = withReactions(g, 5, { ...IDLE_SIGNALS, news: 'testFail', newsAge }, '#fff')
    expect(out).toHaveLength(2)
    for (const row of out) {
      expect(row).toHaveLength(w)
      expect(textWidth(segments(row).map(x => x.text).join(''))).toBe(w)
    }
  }
})
