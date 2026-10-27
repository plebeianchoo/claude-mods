import { expect, test } from 'claude-code/testing'

import { withReactions } from '../hooks/reactions'
import { IDLE_SIGNALS, blank, put, THEMES, THEME_NAMES, segments, textWidth } from '../hooks/themes'
import { jump, sigs } from './motion'
import type { Act, NewsKind, Signals } from '../hooks/themes'

/** The sweeps walk all 38 themes at many widths: ~4 s on a 16-core box, ~12 s on a 4-core NUC. */
const SWEEP_MS = 60_000
const ACTS: Act[] = ['think', 'tool', 'ask', 'say']
const NEWS: NewsKind[] = ['testPass', 'testFail', 'commit']
/** Themes that meet the motion rules already (each polish task adds its own). */
const POLISHED = new Set<string>(['clawd', 'thunder', 'chomp', 'sparky', 'bluecat', 'nyan', 'cat', 'bunny', 'sakura', 'mecha', 'neon', 'dino', 'ocean', 'matrix', 'stack', 'plumber', 'snake', 'launch', 'frogger', 'kitchen', 'railway', 'garden', 'racetrack', 'aquarium', 'submarine', 'orchestra', 'roomba', 'coffee', 'penguins', 'ufo', 'dragon', 'samurai', 'warp', 'volcano', 'dungeon', 'mage', 'tavern', 'necromancer'])

function sig(over: Partial<Signals>): Signals {
  return { ...IDLE_SIGNALS, ...over }
}

test('every scene fills its rows and width under every signal, and never throws', { timeoutMs: SWEEP_MS }, () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    const cases: Signals[] = [
      ...ACTS.map(act => sig({ act, actAge: 0 })),
      ...ACTS.map(act => sig({ act, actAge: 30 })),
      sig({ agents: 2, agentsAge: 0 }), sig({ agents: 5, agentsAge: 40 }),
      sig({ done: 0, total: 0 }), sig({ done: 3, total: 7, doneAge: 0 }), sig({ done: 7, total: 7, doneAge: 2 }), sig({ done: 2, total: 40 }),
      ...NEWS.flatMap(news => [0, 1, 3, 7, 8, 20, 60].map(newsAge => sig({ news, newsAge }))),
      sig({ act: 'tool', tool: 'bash' }), sig({ act: 'tool', tool: 'edit' }), sig({ act: 'tool', tool: 'search' }),
      sig({ act: 'tool', tool: 'bash', toolAge: 0 }), sig({ act: 'tool', tool: 'bash', toolAge: 30 }),
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

const W = 80

test('polished scenes never hold a frame and never jump a shape more than a cell', { timeoutMs: SWEEP_MS }, () => {
  for (const name of THEME_NAMES) {
    if (!POLISHED.has(name)) continue
    const theme = THEMES[name]
    const opaque = theme.opaque === true
    for (const act of ACTS) {
      let last = sigs(theme.scene(0, W, sig({ act, actAge: 30 })), opaque)
      for (let t = 1; t < 60; t++) {
        const now = sigs(theme.scene(t, W, sig({ act, actAge: 30 + t })), opaque)
        expect(now.map(r => r.join('')).join('\n')).not.toBe(last.map(r => r.join('')).join('\n'))
        const j = jump(last, now, opaque)
        expect(j, `${name} ${act} t=${t} row ${j?.row} edge at ${j?.x} jumped`).toBeNull()
        last = now
      }
    }
  }
})

test('opaque scenes paint every cell', { timeoutMs: SWEEP_MS }, () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    if (!theme.opaque) continue
    for (const w of [16, 40, 80, 160]) {
      for (const s of [sig({}), sig({ act: 'ask', actAge: 5 }), sig({ act: 'tool', tool: 'bash', actAge: 9 }), sig({ news: 'testPass', newsAge: 8 })]) {
        for (const t of [0, 77, 1234]) {
          theme.scene(t, w, s).forEach((row, r) => row.forEach((c, x) => {
            expect(c.c !== undefined || c.bg !== undefined, `${name} w=${w} t=${t} cell ${x},${r} is bare`).toBe(true)
          }))
        }
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
