// The scene layers shared by the pixel themes: a far layer drifting slowly, a
// middle one, the ground scrolling at speed, and where the hero strolls.
import { draw, mod, noise, plot, put } from './cells'
import type { Canvas, Grid } from './cells'

export const SCENE_ROWS = 4

// ---- layers -------------------------------------------------------------------

/** Stars as small glyphs over the cells (finer than a pixel): only where nothing is drawn. */
export function glyphStars(g: Grid, t: number, count: number, speed: number, glyphs: readonly string[], colors: readonly string[], seed = 0): void {
  const w = g[0]!.length
  for (let i = 0; i < count; i++) {
    const x = mod(Math.floor(noise(i + seed) * w * 3) - Math.floor(t * speed * (0.5 + noise(i + seed + 7))), w)
    const row = Math.floor(noise(i + seed + 3) * g.length)
    const cell = g[row]![x]!
    if (cell.ch !== ' ') continue
    const twinkle = mod(t + i * 5, 24)
    put(g, x, row, twinkle < 2 ? glyphs[1] ?? glyphs[0]! : glyphs[0]!, { c: colors[i % colors.length], d: twinkle >= 2 })
  }
}

/** A ridge of hills, filled from its crest down to `base`, scrolling at `speed`. */
export function ridge(cv: Canvas, t: number, base: number, height: number, speed: number, color: string, seed: number): void {
  const off = t * speed
  for (let x = 0; x < cv.w; x++) {
    const u = x + off
    const h = height * (0.55 + 0.3 * Math.sin(u * 0.09 + seed) + 0.15 * Math.sin(u * 0.23 + seed * 2))
    for (let y = Math.round(base - h); y <= base; y++) plot(cv, x, y, color)
  }
}

/** The ground's top row: `colors` in a pattern that scrolls at `speed`. */
export function ground(cv: Canvas, t: number, y: number, speed: number, colors: readonly string[]): void {
  const off = Math.floor(t * speed)
  for (let x = 0; x < cv.w; x++) plot(cv, x, y, colors[mod(Math.floor((x + off) / 2), colors.length)]!)
}

/** Clouds: soft lumps drifting at `speed`. */
export function clouds(cv: Canvas, t: number, count: number, speed: number, color: string, maxY: number, seed: number): void {
  const LUMP = ['.CCC..', 'CCCCCC']
  for (let i = 0; i < count; i++) {
    const x = mod(Math.floor(noise(i + seed) * (cv.w + 8)) - Math.floor(t * speed), cv.w + 8) - 6
    draw(cv, x, Math.floor(noise(i + seed + 1) * maxY), LUMP, { C: color })
  }
}

/** Where a hero strolls: in from the left, a stop mid-way to work, then out; eased so it never pops in. */
export function stroll(t: number, w: number, width: number, stop: number): { x: number; isWalking: boolean } {
  const lap = w + width
  const p = mod(t, lap + stop)
  const mid = Math.floor(lap / 2)
  const ease = (u: number) => (u < 8 ? Math.round(u * u / 8) : u)   // the first eight frames accelerate
  if (p < mid) return { x: ease(p) - width, isWalking: true }
  if (p < mid + stop) return { x: mid - width, isWalking: false }
  return { x: p - stop - width, isWalking: true }
}
