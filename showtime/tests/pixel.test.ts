import { expect, test } from 'claude-code/testing'

import { canvas } from '../hooks/cells'
import { along, ease, mix, paint, sky, sprite } from '../hooks/pixel'

test('mix blends two colours and clamps k', () => {
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  expect(mix('#102030', '#ffffff', 0)).toBe('#102030')
  expect(mix('#102030', '#ffffff', 2)).toBe('#ffffff')
})

test('paint keys a material as highlight, base, shadow, outline', () => {
  const k = paint('HBSO', '#e63946')
  expect(k.B).toBe('#e63946')
  expect(Object.keys(k)).toEqual(['H', 'B', 'S', 'O'])
  expect(k.H).not.toBe(k.B)
  expect(k.O).not.toBe(k.S)
})

test('sprite draws keyed art and mirrors it facing left', () => {
  const cv = canvas(4, 1)
  sprite(cv, 0, 0, ['AB'], { A: '#111111', B: '#222222' }, 1)
  expect(cv.px.slice(0, 2)).toEqual(['#111111', '#222222'])
  const cv2 = canvas(4, 1)
  sprite(cv2, 0, 0, ['AB'], { A: '#111111', B: '#222222' }, -1)
  expect(cv2.px.slice(0, 2)).toEqual(['#222222', '#111111'])
})

test('sky paints every pixel of its rows, top colour first', () => {
  const cv = canvas(3, 2)
  sky(cv, '#000000', '#ffffff', 0, 3)
  for (let i = 0; i < 12; i++) expect(cv.px[i]).toBeDefined()
  expect(cv.px[0]).toBe('#000000')
  expect(cv.px[3 * 3]).toBe('#ffffff')
  expect(cv.px[0]).toBe(cv.px[2])
})

test('ease runs 0 to 1, flat at the ends', () => {
  expect(ease(-1)).toBe(0)
  expect(ease(0)).toBe(0)
  expect(ease(0.5)).toBe(0.5)
  expect(ease(1)).toBe(1)
  expect(ease(3)).toBe(1)
})

test('along walks waypoints at most one pixel a frame and holds the ends', () => {
  const pts = [{ x: 0, y: 0, at: 0 }, { x: 10, y: 4, at: 12 }, { x: 10, y: 4, at: 20 }, { x: -5, y: 0, at: 40 }]
  let last = along(pts, -3)
  expect(last).toEqual({ x: 0, y: 0 })
  for (let a = -2; a <= 45; a++) {
    const p = along(pts, a)
    expect(Math.abs(p.x - last.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(p.y - last.y)).toBeLessThanOrEqual(1)
    last = p
  }
  expect(along(pts, 40)).toEqual({ x: -5, y: 0 })
  expect(along(pts, 99)).toEqual({ x: -5, y: 0 })
})
