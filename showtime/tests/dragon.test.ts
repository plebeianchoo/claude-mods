import { expect, test } from 'claude-code/testing'

import { IDLE_SIGNALS, THEME_NAMES, THEMES } from '../hooks/themes'
import type { Signals } from '../hooks/themes'
import { DRAGON_SEED, dragonScene, EGG_CHANCE, EGG_KINDS, EVENT_KINDS, EVENT_LEN, posesAt } from '../hooks/themes/dragon'
import { changed, jump, sigs } from './motion'
import { eggSlot, slotAt } from '../hooks/events'
import type { Slot } from '../hooks/events'

const sig = (over: Partial<Signals>): Signals => ({ ...IDLE_SIGNALS, ...over })

test('dragon is a 6-row opaque scene', () => {
  expect(THEMES.dragon.rows).toBe(6)
  expect(THEMES.dragon.opaque).toBe(true)
  expect(dragonScene(40, 80, sig({}), { slot: null })).toHaveLength(6)
})

test('dragon reacts to every signal it promises', () => {
  const base = (s: Partial<Signals>) => dragonScene(200, 80, sig(s), { slot: null })
  const idle = base({ act: 'think', actAge: 30 })
  expect(changed(base({ act: 'tool', tool: 'bash', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ act: 'tool', tool: 'search', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'ask', actAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'say', actAge: 31 }), idle)).toBeGreaterThanOrEqual(2)
  expect(changed(base({ agents: 2, agentsAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ done: 3, total: 5, doneAge: 30 }), base({ done: 0, total: 5, doneAge: 30 }))).toBeGreaterThanOrEqual(3)
})

/** Slot `index` forced to set piece `kind` (or egg `egg`) at `age`. */
const forced = (kind: number, egg: number, age: number, index = 3): Slot => ({ index, age, len: EVENT_LEN, kind, egg })
const pieces = [
  ...Array.from({ length: EVENT_KINDS }, (_, k) => ({ kind: k, egg: -1, name: `piece ${k}` })),
  ...Array.from({ length: EGG_KINDS }, (_, e) => ({ kind: 0, egg: e, name: `egg ${e}` })),
]

test('every set piece and egg shows', () => {
  for (const p of pieces) {
    const t = 3 * EVENT_LEN + EVENT_LEN / 2
    const on = dragonScene(t, 80, sig({}), { slot: forced(p.kind, p.egg, EVENT_LEN / 2) })
    const off = dragonScene(t, 80, sig({}), { slot: null })
    expect(changed(on, off), p.name).toBeGreaterThanOrEqual(20)
  }
})

test('every set piece starts and ends with everyone home', () => {
  for (const w of [44, 80, 160]) {
    for (const p of pieces) {
      for (const age of [0, EVENT_LEN - 1]) {
        const t = 3 * EVENT_LEN + age
        const on = dragonScene(t, w, sig({}), { slot: forced(p.kind, p.egg, age) })
        const off = dragonScene(t, w, sig({}), { slot: null })
        expect(changed(on, off), `${p.name} w=${w} age=${age}`).toBe(0)
      }
    }
  }
})

test('set pieces never jump, frame by frame', { timeoutMs: 60_000 }, () => {
  for (const p of pieces) {
    const at = (age: number) => sigs(dragonScene(3 * EVENT_LEN + age, 80, sig({}), { slot: forced(p.kind, p.egg, age) }), true)
    let last = at(0)
    for (let age = 1; age < EVENT_LEN; age++) {
      const now = at(age)
      const j = jump(last, now, true)
      expect(j, `${p.name} age=${age} row ${j?.row} edge ${j?.x}`).toBeNull()
      last = now
    }
  }
})

/** Set-piece and egg actors' sizes (columns, rows), for telling when one is past an edge; 1×1 if not listed. */
const SIZES: Record<string, [number, number]> = {
  sheep: [4, 3], bale: [4, 3], horse: [9, 4], hatchling: [6, 4], bird: [3, 2], boulder: [3, 3], princess: [3, 6],
}
/** Whether an actor last at `p` (and at `q` the frame before) may be gone the next frame: one step from being past
 * the left, right or top edge; or ending where it is by design: the bale bursting and the boulder and catapult arm
 * settling, each once still, the princess back in at her window, an arrow in the grass, a dazed star as the daze
 * clears. */
function mayGo(who: string, p: [number, number], q: [number, number] | undefined, w: number): boolean {
  const kind = who.replace(/\d+$/, '')
  const [cols, rows] = SIZES[kind] ?? [1, 1]
  const [x, y] = p
  if (x >= w - 1 || x <= 1 - cols || y <= 1 - rows) return true
  const still = q !== undefined && q[0] === x && q[1] === y
  if (['bale', 'boulder', 'arm', 'princess'].includes(kind)) return still
  return (kind === 'arrow' && y >= 9) || kind === 'star'
}

test('nothing moves more than a pixel a frame or vanishes on screen, on the real schedule, at any width', { timeoutMs: 60_000 }, () => {
  // Four rounds of slots from the start (every piece four times), and the slots around each egg's first showing.
  const spans = [[0, 4 * EVENT_KINDS * EVENT_LEN], ...Array.from({ length: EGG_KINDS }, (_, e) => {
    const t0 = eggSlot(e, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE)
    return [t0 - EVENT_LEN, t0 + 2 * EVENT_LEN]
  })] as const
  // The first time each actor moves too far, or (by kind) vanishes while still on screen.
  const bad = new Map<string, string>()
  const gone = new Map<string, string>()
  // The breath changes no one's place, so bash is walked at fewer widths, to keep this cheap.
  for (const [s, step] of [[sig({ act: 'think', actAge: 30 }), 6], [sig({ act: 'tool', tool: 'bash', actAge: 30, toolAge: 30 }), 36]] as const) {
    for (let w = 24; w <= 260; w += step) {
      for (const [from, to] of spans) {
        let [before, last] = [posesAt(from - 2, w, s), posesAt(from - 1, w, s)]
        for (let t = from; t < to; t++) {
          const now = posesAt(t, w, s)
          for (const [who, [x, y]] of Object.entries(now)) {
            const p = last[who]
            if (p && Math.max(Math.abs(x - p[0]), Math.abs(y - p[1])) > 1 && !bad.has(who)) {
              bad.set(who, `${s.act} w=${w} t=${t} (${x - p[0]}, ${y - p[1]})`)
            }
          }
          for (const who in last) {
            if (now[who] || who === 'dragon' || who === 'knight' || who === 'wyvern') continue
            const [kind, p] = [who.replace(/\d+$/, ''), last[who]!]
            if (!gone.has(kind) && !mayGo(who, p, before[who], w)) {
              gone.set(kind, `${s.act} w=${w} age=${t % EVENT_LEN} last at (${p[0]}, ${p[1]})`)
            }
          }
          ;[before, last] = [last, now]
        }
      }
    }
  }
  expect(Object.fromEntries(bad)).toEqual({})
  expect(Object.fromEntries(gone)).toEqual({})
})

test('the epoch moves the dragon schedule on by whole slots and changes no other theme', () => {
  for (const epoch of [1, 7, 4095]) {
    for (const t of [0, 100, 777]) {
      const on = THEMES.dragon.scene(t, 80, sig({ epoch }))
      expect(changed(on, dragonScene(t + EVENT_LEN * epoch, 80, sig({}))), `epoch ${epoch} t=${t}`).toBe(0)
    }
  }
  // So a turn doesn't always open on the same set piece.
  const first = (epoch: number) => slotAt(EVENT_LEN * epoch, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE).kind
  expect(new Set(Array.from({ length: 12 }, (_, e) => first(e))).size).toBe(EVENT_KINDS)
  for (const name of THEME_NAMES.filter(n => n !== 'dragon')) {
    for (const t of [0, 333]) {
      expect(changed(THEMES[name].scene(t, 80, sig({ epoch: 9 })), THEMES[name].scene(t, 80, sig({}))), `${name} t=${t}`).toBe(0)
    }
  }
})

test('the sheet showcases every set piece and egg', () => {
  const show = THEMES.dragon.showcase?.(80) ?? []
  expect(show).toHaveLength(EVENT_KINDS + EGG_KINDS)
})

const MIN = { testPass: 40, testFail: 15, commit: 25 } as const

test('reactions are clearly visible', () => {
  for (const news of ['testPass', 'testFail', 'commit'] as const) {
    for (const t of [40, 200, 777]) {
      for (const newsAge of [4, 8, 12, 16, 20]) {
        const on = THEMES.dragon.scene(t, 80, sig({ news, newsAge }))
        const off = THEMES.dragon.scene(t, 80, sig({}))
        expect(changed(on, off), `${news} t=${t} age=${newsAge}`).toBeGreaterThanOrEqual(MIN[news])
      }
    }
  }
  const on = THEMES.dragon.scene(200, 40, sig({ news: 'testFail', newsAge: 8 }))
  expect(changed(on, THEMES.dragon.scene(200, 40, sig({})))).toBeGreaterThanOrEqual(6)
})

test('reactions are over by newsAge 30, so clearing the news never snaps', () => {
  for (const news of ['testPass', 'testFail', 'commit'] as const) {
    for (const t of [40, 200, 777]) {
      for (const newsAge of [30, 35, 39]) {
        const on = THEMES.dragon.scene(t, 80, sig({ news, newsAge }))
        expect(changed(on, THEMES.dragon.scene(t, 80, sig({}))), `${news} t=${t} age=${newsAge}`).toBe(0)
      }
    }
  }
})

test('reactions stay opaque, never jump and clear cleanly at every width', { timeoutMs: 30_000 }, () => {
  // t0 40 starts in the strafe; 777 and 9001 in the charge's walk home; 1234 elsewhere.
  for (const w of [16, 30, 44, 80, 152]) {
    for (const news of ['testPass', 'testFail', 'commit'] as const) {
      for (const t0 of [40, 777, 1234, 9001]) {
        let last = sigs(THEMES.dragon.scene(t0 - 1, w, sig({})), true)
        for (let newsAge = 0; newsAge <= 41; newsAge++) {
          const g = THEMES.dragon.scene(t0 + newsAge, w, sig({ news, newsAge }))
          const at = `${news} w=${w} t0=${t0} age=${newsAge}`
          g.forEach((row, r) => row.forEach((c, x) => {
            if (c.c === undefined && c.bg === undefined) expect(`${at} cell ${x},${r}`).toBe('painted')
          }))
          const now = sigs(g, true)
          const j = jump(last, now, true)
          expect(j, `${at} row ${j?.row} edge ${j?.x}`).toBeNull()
          if (newsAge === 30 || newsAge === 35 || newsAge === 39) {
            expect(changed(g, THEMES.dragon.scene(t0 + newsAge, w, sig({}))), at).toBe(0)
          }
          last = now
        }
      }
    }
  }
})
