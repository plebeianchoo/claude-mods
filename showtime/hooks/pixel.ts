// The 16-bit kit the 2.0 themes share: materials shaded in four tones, keyed sprites that face either way, a sky
// gradient, and paths that move at most a pixel a frame.
import { plot } from './cells'
import type { Canvas } from './cells'

/** `a` blended toward `b` by `k` (clamped to 0..1), both `#rrggbb`. */
export function mix(a: string, b: string, k: number): string {
  const q = Math.max(0, Math.min(1, k))
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * q).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

const COOL = '#1b1f3b'
const WARM = '#fff6d5'

/** A material in four tones keyed by the four characters of `keys`: highlight, base, shadow, outline. Shadows lean
 * cool and highlights warm, the way 16-bit palettes shade. */
export function paint(keys: string, base: string): Record<string, string> {
  const [h, b, s, o] = [...keys] as [string, string, string, string]
  return { [h]: mix(base, WARM, 0.45), [b]: base, [s]: mix(base, COOL, 0.35), [o]: mix(base, COOL, 0.65) }
}

/** Draws `art` (rows of keys, `.` or an unknown key clear) with its left edge at `x`, mirrored when `face` is -1;
 * each colour passes through `ink` (for fades and flashes). */
export function sprite(cv: Canvas, x: number, y: number, art: readonly string[], keys: Record<string, string>,
  face: 1 | -1 = 1, ink: (c: string) => string = c => c): void {
  const w = Math.max(...art.map(r => r.length))
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = keys[row[i]!]
      if (c) plot(cv, face > 0 ? x + i : x + w - 1 - i, y + j, ink(c))
    }
  })
}

/** Fills pixel rows `from`..`to` (inclusive, clipped to the canvas) with a vertical gradient, `top` to `bottom`. */
export function sky(cv: Canvas, top: string, bottom: string, from: number, to: number): void {
  const [a, b] = [Math.max(0, from), Math.min(cv.h - 1, to)]
  for (let y = a; y <= b; y++) {
    const c = mix(top, bottom, b === a ? 0 : (y - a) / (b - a))
    for (let x = 0; x < cv.w; x++) plot(cv, x, y, c)
  }
}

/** Smoothstep: 0 below 0, 1 above 1, easing in and out between. */
export function ease(u: number): number {
  return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u)
}

export type Waypoint = { x: number; y: number; at: number }

/** Where a path is at `age`: straight legs between waypoints (sorted by `at`), holding the first before it and the
 * last after it. A leg moves at most a pixel a frame when its duration is at least its longest axis distance. */
export function along(points: readonly Waypoint[], age: number): { x: number; y: number } {
  const first = points[0]!
  if (age <= first.at) return { x: first.x, y: first.y }
  for (let i = 1; i < points.length; i++) {
    const [p, q] = [points[i - 1]!, points[i]!]
    if (age <= q.at) {
      const u = q.at === p.at ? 1 : (age - p.at) / (q.at - p.at)
      return { x: Math.round(p.x + (q.x - p.x) * u), y: Math.round(p.y + (q.y - p.y) * u) }
    }
  }
  const last = points[points.length - 1]!
  return { x: last.x, y: last.y }
}
