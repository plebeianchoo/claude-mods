import { describe, expect, test } from 'claude-code/testing'

import { canvas, DEF, gradient, PH, put, ROWS, toCells, type Moment, type Scene, type State } from '../hooks/scenery/pixels'
import { H } from '../hooks/rig'
import { CLAWD } from '../hooks/clawd/acts'
import { sky } from '../hooks/scenery/sky'
import { city } from '../hooks/scenery/city'
import { ocean } from '../hooks/scenery/ocean'
import { space } from '../hooks/scenery/space'
import { forest } from '../hooks/scenery/forest'
import { desert } from '../hooks/scenery/desert'
import { mountains } from '../hooks/scenery/mountains'
import { cave } from '../hooks/scenery/cave'
import { isSceneName, nextScene, PACE, SCENES, sceneryCells, stateOf } from '../hooks/scenery'

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
            let blanks = 0
            for (let i = 0; i < w.length; i += 3) if (w[i] === 0x20) blanks++
            expect(blanks).toBe(0)
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

  test('dithers a gradient so no row is one flat band, yet it still darkens row by row', () => {
    const c = canvas(16)
    gradient(c, 0xffffff, 0x000000)
    const row = (y: number) => [...c.px.subarray(y * 16, (y + 1) * 16)]
    const mean = (y: number) => row(y).reduce((a, p) => a + (p & 0xff), 0) / 16
    for (let y = 1; y < PH - 1; y++) expect(new Set(row(y)).size).toBeGreaterThan(1)
    for (let y = 1; y < PH; y++) expect(mean(y)).toBeLessThan(mean(y - 1))
    expect(c.px[0]).toBe(0xffffff)
    expect(c.px[(PH - 1) * 16 + 15]).toBe(0x000000)
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

sceneSuite('sky', sky)
sceneSuite('city', city)
sceneSuite('ocean', ocean)
sceneSuite('space', space)
sceneSuite('forest', forest)
sceneSuite('desert', desert)
sceneSuite('mountains', mountains)
sceneSuite('cave', cave)

describe('the scene rotation', () => {
  test('goes sky, city, ocean, space, and back to sky', () => {
    expect([...SCENES]).toEqual(['sky', 'city', 'ocean', 'space'])
    expect(nextScene('sky')).toBe('city')
    expect(nextScene('city')).toBe('ocean')
    expect(nextScene('ocean')).toBe('space')
    expect(nextScene('space')).toBe('sky')
  })

  test('starts a session on a random scene', () => {
    expect(nextScene(undefined, () => 0)).toBe('sky')
    expect(nextScene(undefined, () => 0.6)).toBe('ocean')
    expect(nextScene(undefined, () => 0.99)).toBe('space')
  })

  test('knows its scene names', () => {
    for (const name of SCENES) expect(isSceneName(name)).toBe(true)
    expect(isSceneName('cat')).toBe(false)
  })

  test('reads what Claude is doing: a running tool first, then thinking, else writing', () => {
    expect(stateOf(true, true)).toBe('tool')
    expect(stateOf(true, false)).toBe('tool')
    expect(stateOf(false, true)).toBe('think')
    expect(stateOf(false, false)).toBe('say')
    expect(PACE.think).toBeLessThan(PACE.say)
    expect(PACE.say).toBeLessThan(PACE.tool)
  })

  test('draws every scene as Raster cells the width asked', () => {
    for (const name of SCENES) expect(words(sceneryCells(name, 50, at('say'))).length).toBe(50 * ROWS * 3)
  })
})

describe('Clawd in the scenery', () => {
  // His orange, somewhere in the frame, whatever the state or weather.
  const hasClawd = (scene: Scene, state: State, seed: number) => {
    const c = canvas(60)
    scene(c, at(state, 3000, seed))
    return c.px.includes(CLAWD)
  }
  const visits = (name: string, scene: Scene) =>
    test(`visits the ${name} in every state and variant`, () => {
      for (let seed = 0; seed < 12; seed++) for (const state of ['think', 'tool', 'say'] as const) expect(hasClawd(scene, state, seed)).toBe(true)
    })
  visits('sky', sky)
  visits('city', city)
  visits('ocean', ocean)
  visits('space', space)
  visits('forest', forest)
  visits('desert', desert)
  visits('mountains', mountains)
  visits('cave', cave)
})
