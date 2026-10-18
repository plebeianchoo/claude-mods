import { describe, expect, test } from 'claude-code/testing'

import { canvas, DEF, PH, put, ROWS, toCells, type Moment, type Scene, type State } from '../hooks/scenery/pixels'
import { H } from '../hooks/rig'

// A frame's Raster cells, as words: [codePoint, fg, bg] per cell.
const words = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), ch => ch.charCodeAt(0)).buffer)
const draw = (scene: Scene, columns: number, m: Moment) => {
  const c = canvas(columns)
  scene(c, m)
  return toCells(c)
}
const at = (state: State, t = 6000, seed = 7): Moment => ({ t, dist: t * 0.008, state, seed })

// What every scene must do: fill its raster, at any width and seed, the same
// way for the same moment, and look different while a tool runs.
export function sceneSuite(name: string, scene: Scene) {
  describe(`the ${name} scene`, () => {
    test('fills every cell of its raster at any width and seed', () => {
      for (const columns of [44, 60, 90, 200]) {
        for (let seed = 0; seed < 12; seed++) {
          for (const state of ['think', 'tool', 'say'] as const) {
            const w = words(draw(scene, columns, at(state, 6000, seed)))
            expect(w.length).toBe(columns * ROWS * 3)
            for (let i = 0; i < w.length; i += 3) expect(w[i]).not.toBe(0x20)
          }
        }
      }
    })

    test('draws the same moment the same way', () => {
      expect(draw(scene, 60, at('say'))).toBe(draw(scene, 60, at('say')))
    })

    test('moves over time', () => {
      expect(draw(scene, 60, at('think', 2000))).not.toBe(draw(scene, 60, at('think', 9000)))
    })

    test('looks different while a tool runs than while Claude thinks', () => {
      expect(draw(scene, 60, at('tool'))).not.toBe(draw(scene, 60, at('think')))
    })
  })
}

describe('scenery pixels', () => {
  test('is as tall as the cat track, and starts clear', () => {
    expect(PH).toBe(H)
    expect(ROWS).toBe(H / 2)
    const c = canvas(5)
    expect(c.px.length).toBe(5 * PH)
    expect(c.px.every(p => p === DEF)).toBe(true)
  })

  test('puts pixels only inside the canvas, rounding to the nearest', () => {
    const c = canvas(4)
    put(c, -1, 0, 0xff0000)
    put(c, 4, 0, 0xff0000)
    put(c, 0, PH, 0xff0000)
    expect(c.px.every(p => p === DEF)).toBe(true)
    put(c, 1.4, 2.6, 0x00ff00)
    expect(c.px[3 * 4 + 1]).toBe(0x00ff00)
  })

  test('packs two pixels per cell as half blocks', () => {
    const c = canvas(4)
    put(c, 1, 0, 0x111111) // top only
    put(c, 2, 1, 0x222222) // bottom only
    put(c, 3, 0, 0x333333) // both
    put(c, 3, 1, 0x444444)
    const w = words(toCells(c))
    expect(w.length).toBe(4 * ROWS * 3)
    expect([...w.slice(0, 3)]).toEqual([0x20, DEF, DEF])
    expect([...w.slice(3, 6)]).toEqual([0x2580, 0x111111, DEF])
    expect([...w.slice(6, 9)]).toEqual([0x2584, 0x222222, DEF])
    expect([...w.slice(9, 12)]).toEqual([0x2580, 0x333333, 0x444444])
  })

  test('packs a whole row the same when every pixel is set', () => {
    const c = canvas(2)
    c.px.fill(0x123456)
    const w = words(toCells(c))
    for (let i = 0; i < w.length; i += 3) expect([...w.slice(i, i + 3)]).toEqual([0x2580, 0x123456, 0x123456])
  })
})
