import { expect, test } from 'claude-code/testing'

import { IDLE_SIGNALS, THEMES } from '../hooks/themes'
import type { Signals } from '../hooks/themes'
import { dragonScene } from '../hooks/themes/dragon'
import { changed } from './motion'
import { jump, sigs } from './motion'
import { EVENT_LEN, EVENT_KINDS, EGG_KINDS } from '../hooks/themes/dragon'
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

test('the sheet showcases every set piece and egg', () => {
  const show = THEMES.dragon.showcase?.(80) ?? []
  expect(show).toHaveLength(EVENT_KINDS + EGG_KINDS)
})
