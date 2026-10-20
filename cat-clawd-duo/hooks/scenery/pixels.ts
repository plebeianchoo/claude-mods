// The left half's scenes, as pixels: a canvas as tall as the cat's track
// (PH px, ROWS cells), packed into Raster cells the way the cat's track is:
// two pixels per cell as half blocks, DEF where nothing is drawn.
import { mix, rnd, wave } from '../clawd/acts'
import { H } from '../rig'

export { mix, rnd, wave }

export const PH = H
export const ROWS = H / 2
export const DEF = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

/** What Claude is doing, as a scene shows it. */
export type State = 'think' | 'tool' | 'say'

/**
 * One frame's inputs: ms since the turn began, px the layers have scrolled
 * (cat.tsx advances it at a pace that eases toward the state's), what Claude
 * is doing and for how long (`since`, ms in that state, so what a state
 * starts can start when it does), and the turn's seed, which picks the
 * scene's variant.
 */
export type Moment = { t: number; since: number; dist: number; state: State; seed: number }

export type Canvas = { W: number; px: Uint32Array }
export type Scene = (c: Canvas, m: Moment) => void

export const canvas = (W: number): Canvas => ({ W, px: new Uint32Array(W * PH).fill(DEF) })

export const mod = (n: number, m: number) => ((n % m) + m) % m

/** A variant picked by the seed: 0 to n - 1, the same all turn. */
export const pick = (seed: number, salt: number, n: number) => Math.floor(rnd(seed, salt) * n)

export function put(c: Canvas, x: number, y: number, colour: number) {
  x = Math.round(x)
  y = Math.round(y)
  if (x >= 0 && x < c.W && y >= 0 && y < PH) c.px[y * c.W + x] = colour
}

export function rect(c: Canvas, x: number, y: number, w: number, h: number, colour: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(c, x + i, y + j, colour)
}

// A 4x4 Bayer matrix: each pixel's threshold, 0 to 15, in a pattern that repeats without visible seams.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const

/**
 * Rows from `top` down to `bottom`, blended, over rows `from` to `to`. With
 * only 18 rows a plain blend shows as flat bands, so each pixel is nudged up to
 * half a row either way by the Bayer pattern: the bands' edges break up and the
 * sweep reads as smooth, while the first and last rows stay the pure colours.
 */
export function gradient(c: Canvas, top: number, bottom: number, from = 0, to = PH) {
  const span = Math.max(1, to - from - 1)
  for (let y = from; y < to; y++) {
    for (let x = 0; x < c.W; x++) {
      const nudge = (BAYER[y & 3]![x & 3]! + 0.5) / 16 - 0.5
      const k = y === from ? 0 : y === to - 1 ? 1 : (y - from + nudge) / span
      put(c, x, y, mix(top, bottom, k))
    }
  }
}

export function disc(c: Canvas, cx: number, cy: number, r: number, colour: number) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) put(c, cx + dx, cy + dy, colour)
}

/** Pixel art: one letter per pixel, keyed in `pal`; `.` is clear. */
export function sprite(c: Canvas, art: readonly string[], pal: Record<string, number>, x: number, y: number) {
  art.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && pal[ch] !== undefined && put(c, x + i, y + j, pal[ch]!)))
}

/** The canvas as Raster cells (base64 of [codePoint, fg, bg] words), ROWS tall. */
export function toCells(c: Canvas): string {
  const words = new Uint32Array(c.W * ROWS * 3)
  for (let row = 0; row < ROWS; row++) {
    for (let x = 0; x < c.W; x++) {
      const top = c.px[2 * row * c.W + x]!
      const bottom = c.px[(2 * row + 1) * c.W + x]!
      const at = (row * c.W + x) * 3
      if (top === DEF && bottom === DEF) words.set([0x20, DEF, DEF], at)
      else if (top === DEF) words.set([LOWER_HALF, bottom, DEF], at)
      else words.set([UPPER_HALF, top, bottom], at)
    }
  }
  const bytes = new Uint8Array(words.buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
