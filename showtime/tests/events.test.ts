import { expect, test } from 'claude-code/testing'

import { eggSlot, firstSlot, slotAt } from '../hooks/events'

test('a slot knows its index and age, for negative t too', () => {
  for (let t = -500; t < 2000; t += 7) {
    const s = slotAt(t, 160, 6, 3)
    expect(s.age).toBeGreaterThanOrEqual(0)
    expect(s.age).toBeLessThan(160)
    expect(s.index * 160 + s.age).toBe(t)
    expect(s.len).toBe(160)
  }
})

test('every round plays each kind once, and no kind plays twice in a row', () => {
  for (let kinds = 2; kinds <= 9; kinds++) {
    let prev = -1
    for (let i = 0; i < 2000; i++) {
      const k = slotAt(i * 10, 10, kinds, 5).kind
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(kinds)
      expect(k).not.toBe(prev)
      prev = k
    }
    if (kinds >= 3) {
      for (let r = 0; r < 50; r++) {
        const round = Array.from({ length: kinds }, (_, j) => slotAt((r * kinds + j) * 10, 10, kinds, 5).kind)
        expect([...round].sort((a, b) => a - b)).toEqual(Array.from({ length: kinds }, (_, j) => j))
      }
    }
  }
})

test('eggs are rare, never back to back, and -1 when there are none', () => {
  let n = 0
  let prev = -1
  for (let i = 0; i < 20000; i++) {
    const e = slotAt(i * 10, 10, 6, 9, 3, 1 / 40).egg
    expect(e).toBeLessThan(3)
    if (e >= 0) {
      n++
      expect(prev).toBe(-1)
    }
    prev = e
  }
  expect(n / 20000).toBeGreaterThanOrEqual(1 / 70)
  expect(n / 20000).toBeLessThanOrEqual(1 / 25)
  expect(slotAt(123, 10, 6, 9).egg).toBe(-1)
})

test('the same t always gives the same slot', () => {
  expect(slotAt(4321, 160, 6, 2, 3, 1 / 40)).toEqual(slotAt(4321, 160, 6, 2, 3, 1 / 40))
})

test('firstSlot and eggSlot find a slot start where that kind or egg plays', () => {
  for (let k = 0; k < 6; k++) {
    const t = firstSlot(k, 160, 6, 2, 3, 1 / 40)
    const s = slotAt(t, 160, 6, 2, 3, 1 / 40)
    expect(s.age).toBe(0)
    expect(s.kind).toBe(k)
    expect(s.egg).toBe(-1)
  }
  for (let e = 0; e < 3; e++) {
    const t = eggSlot(e, 160, 6, 2, 3, 1 / 40)
    const s = slotAt(t, 160, 6, 2, 3, 1 / 40)
    expect(s.age).toBe(0)
    expect(s.egg).toBe(e)
  }
})
