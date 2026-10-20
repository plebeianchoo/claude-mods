import { describe, expect, test } from 'claude-code/testing'

import { canvas, DEF, PH, type Canvas, type Moment } from '../hooks/scenery/pixels'
import { handle, visitor, type Outfit } from '../hooks/scenery/visitor'

const at = (state: Moment['state'], t = 3000, seed = 7): Moment => ({ t, since: t, dist: t * 0.008, state, seed })
const plain: Outfit = { job: 'hammer' }

// The rows that hold any drawn pixel: on an empty canvas, all of them are his.
const rowsOf = (c: Canvas) => {
  const rows = new Set<number>()
  c.px.forEach((p, i) => p !== DEF && rows.add(Math.floor(i / c.W)))
  return [...rows].sort((a, b) => a - b)
}

describe('the scene visitor', () => {
  test('stands on the scenery ground, one clear row below his legs', () => {
    const c = canvas(60)
    visitor(c, at('think'), plain)
    const rows = rowsOf(c)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[rows.length - 1]).toBe(PH - 2) // his legs
    expect(c.px.subarray((PH - 1) * 60).every(p => p === DEF)).toBe(true)
  })

  test('picks his spot from the seed and stays there while Claude thinks', () => {
    const a = visitor(canvas(60), at('think', 1000, 3), plain)
    const b = visitor(canvas(60), at('think', 9000, 3), plain)
    const other = visitor(canvas(60), at('think', 1000, 4), plain)
    expect(a.x).toBe(b.x)
    expect(a.x).not.toBe(other.x)
    expect(a.pose).toBe('idle')
  })

  test('works with the outfit\'s job while a tool runs, at the same spot', () => {
    const v = visitor(canvas(60), at('tool'), plain)
    expect(v.pose).toBe('hammer')
    expect(v.x).toBe(visitor(canvas(60), at('think'), plain).x)
  })

  test('strolls right across the whole width while Claude writes, and comes round again', () => {
    const xs = Array.from({ length: 200 }, (_, i) => visitor(canvas(60), at('say', i * 90), plain))
    expect(xs.every(v => v.pose === 'walk' && v.facing === 1)).toBe(true)
    expect(Math.min(...xs.map(v => v.x))).toBeLessThan(0)
    expect(Math.max(...xs.map(v => v.x))).toBeGreaterThan(45)
    expect(xs[1]!.x - xs[0]!.x).toBeGreaterThanOrEqual(0)
  })

  test('keeps his spot inside any canvas wide enough for the row', () => {
    for (const W of [44, 60, 90, 200]) {
      for (let seed = 0; seed < 20; seed++) {
        const v = visitor(canvas(W), at('think', 0, seed), plain)
        expect(v.x).toBeGreaterThanOrEqual(0)
        expect(v.x + 14).toBeLessThanOrEqual(W)
      }
    }
  })

  test('hands the outfit his head and hand so it can dress him', () => {
    const seen: { head: { x: number; y: number }; hand: [number, number] }[] = []
    const outfit: Outfit = { job: 'hammer', dress: (_c, v) => seen.push({ head: v.head, hand: v.hand }) }
    const v = visitor(canvas(60), at('tool'), outfit)
    expect(seen.length).toBe(1)
    expect(seen[0]!.head.x).toBe(v.x)
    expect(seen[0]!.head.y).toBe(PH - 3 - 4) // his top row: 5 rows of body ending at PH - 3
  })

  test('takes the outfit\'s own idle and stroll poses, and hovers by its lift', () => {
    const space: Outfit = { job: 'hammer', idle: 'float', stroll: 'float', lift: m => 3 + (m.t > 1000 ? 1 : 0) }
    expect(visitor(canvas(60), at('think'), space).pose).toBe('float')
    expect(visitor(canvas(60), at('say'), space).pose).toBe('float')
    const low = canvas(60)
    visitor(low, at('think', 500), space)
    const high = canvas(60)
    visitor(high, at('think', 1500), space)
    expect(rowsOf(low)[rowsOf(low).length - 1]).toBe(PH - 2 - 3)
    expect(rowsOf(high)[rowsOf(high).length - 1]).toBe(PH - 2 - 4)
  })
})

describe('a handle in his hand', () => {
  test('runs from the hand in a direction for its length and tells where it ends', () => {
    const c = canvas(20)
    const end = handle(c, [5, 10], 1, -1, 3, 0x123456)
    expect(end).toEqual([8, 7])
    expect(c.px[9 * 20 + 6]).toBe(0x123456)
    expect(c.px[8 * 20 + 7]).toBe(0x123456)
    expect(c.px[7 * 20 + 8]).toBe(0x123456)
    expect(c.px.filter(p => p !== DEF).length).toBe(3)
  })
})
