// Renders a theme as PNGs without a terminal, a browser or ffmpeg: each cell of
// the scene becomes SCALE×(2·SCALE) pixels (half blocks are two pixels, a glyph
// a dimmed block of its color), labels in a 3×5 pixel font.
//   bun scripts/shots.ts --theme <name>   → assets/<name>.png, assets/review/<name>.png
//   bun scripts/shots.ts --gallery        → assets/gallery.png (every theme's still)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { IDLE_SIGNALS, THEMES, THEME_NAMES, isThemeName } from '../hooks/themes'
import type { Act, Signals, Theme } from '../hooks/themes'
import { PET_ROWS, PET_W, petFrame } from '../hooks/pets'
import type { Grid } from '../hooks/cells'

const OUT = join(import.meta.dir, '../assets')
const SCALE = 4
const W = 48
const STILL_W = 80
const BACK = [0x1a, 0x1a, 0x1e] as const
const GAP = 6

type Img = { w: number; h: number; px: Uint8Array }
const image = (w: number, h: number): Img => {
  const px = new Uint8Array(w * h * 3)
  for (let i = 0; i < w * h; i++) px.set(BACK, i * 3)
  return { w, h, px }
}
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const dot = (img: Img, x: number, y: number, c: [number, number, number]) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return
  img.px.set(c, (y * img.w + x) * 3)
}
const rect = (img: Img, x: number, y: number, w: number, h: number, c: [number, number, number]) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dot(img, x + i, y + j, c)
}

/** A grid of cells onto the image at (ox, oy): `▀▄█` as pixels, any other glyph as a dimmed block. */
function blit(img: Img, g: Grid, ox: number, oy: number): void {
  g.forEach((row, r) => {
    row.forEach((cell, x) => {
      if (cell.ch === ' ' || cell.ch === '') return
      const fg = cell.c ? hex(cell.c) : ([0xb8, 0xb8, 0xbe] as [number, number, number])
      const bg = cell.bg ? hex(cell.bg) : null
      const X = ox + x * SCALE
      const Y = oy + r * SCALE * 2
      if (cell.ch === '█') rect(img, X, Y, SCALE, SCALE * 2, fg)
      else if (cell.ch === '▀') {
        rect(img, X, Y, SCALE, SCALE, fg)
        if (bg) rect(img, X, Y + SCALE, SCALE, SCALE, bg)
      } else if (cell.ch === '▄') {
        rect(img, X, Y + SCALE, SCALE, SCALE, fg)
        if (bg) rect(img, X, Y, SCALE, SCALE, bg)
      } else {
        const dim = fg.map(v => Math.round(v * (cell.d ? 0.4 : 0.7))) as [number, number, number]
        rect(img, X + 1, Y + 1, SCALE - 2, SCALE * 2 - 2, dim)
      }
    })
  })
}

// A 3×5 font for the labels: a-z, 0-9, space, / and :.
const FONT: Record<string, string[]> = {
  a: ['010', '101', '111', '101', '101'], b: ['110', '101', '110', '101', '110'], c: ['011', '100', '100', '100', '011'], d: ['110', '101', '101', '101', '110'],
  e: ['111', '100', '110', '100', '111'], f: ['111', '100', '110', '100', '100'], g: ['011', '100', '101', '101', '011'], h: ['101', '101', '111', '101', '101'],
  i: ['111', '010', '010', '010', '111'], j: ['001', '001', '001', '101', '010'], k: ['101', '110', '100', '110', '101'], l: ['100', '100', '100', '100', '111'],
  m: ['101', '111', '111', '101', '101'], n: ['110', '101', '101', '101', '101'], o: ['010', '101', '101', '101', '010'], p: ['110', '101', '110', '100', '100'],
  q: ['010', '101', '101', '011', '001'], r: ['110', '101', '110', '101', '101'], s: ['011', '100', '010', '001', '110'], t: ['111', '010', '010', '010', '010'],
  u: ['101', '101', '101', '101', '011'], v: ['101', '101', '101', '010', '010'], w: ['101', '101', '111', '111', '101'], x: ['101', '010', '010', '010', '101'],
  y: ['101', '101', '010', '010', '010'], z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], ' ': ['000', '000', '000', '000', '000'], '/': ['001', '001', '010', '100', '100'],
  ':': ['000', '010', '000', '010', '000'], '=': ['000', '111', '000', '111', '000'], '-': ['000', '000', '111', '000', '000'],
}
function label(img: Img, text: string, x: number, y: number): void {
  let cx = x
  for (const ch of text.toLowerCase()) {
    const rows = FONT[ch] ?? FONT[' ']!
    rows.forEach((bits, j) => [...bits].forEach((b, i) => b === '1' && rect(img, cx + i * 2, y + j * 2, 2, 2, [0xdd, 0xdd, 0xdd])))
    cx += 8
  }
}

// PNG: 8-bit RGB, unfiltered scanlines, one IDAT.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = (b: Uint8Array) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ -1) >>> 0 }
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b }
function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length)
  body.set(new TextEncoder().encode(type)); body.set(data, 4)
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc(body))])
}
function png(img: Img): Uint8Array {
  const stride = img.w * 3 + 1
  const raw = new Uint8Array(img.h * stride)
  for (let y = 0; y < img.h; y++) raw.set(img.px.subarray(y * img.w * 3, (y + 1) * img.w * 3), y * stride + 1)
  const ihdr = new Uint8Array([...u32(img.w), ...u32(img.h), 8, 2, 0, 0, 0])
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(deflateSync(raw))), ...chunk('IEND', new Uint8Array())])
}

const sig = (over: Partial<Signals>): Signals => ({ ...IDLE_SIGNALS, ...over })

/** The review sheet's strips: a label and twelve consecutive frames each. */
function strips(theme: Theme): { name: string; frames: Grid[] }[] {
  const acts: Act[] = ['think', 'tool', 'ask', 'say']
  const twelve = (f: (i: number) => Signals, t0 = 40) => Array.from({ length: 12 }, (_, i) => theme.scene(t0 + i, W, f(i)))
  const out = acts.map(act => ({ name: act, frames: twelve(i => sig({ act, actAge: 30 + i })) }))
  out.push({ name: 'agents 2', frames: twelve(i => sig({ agents: 2, agentsAge: i })) })
  out.push({ name: 'done 3/7', frames: twelve(i => sig({ done: 3, total: 7, doneAge: i })) })
  out.push({ name: 'done 7/7', frames: twelve(i => sig({ done: 7, total: 7, doneAge: i })) })
  for (const news of ['testFail', 'commit'] as const) for (const age of [0, 8, 20]) out.push({ name: `${news} ${age}`, frames: twelve(i => sig({ news, newsAge: age + i })) })
  out.push({ name: 'tool bash', frames: twelve(i => sig({ act: 'tool', tool: 'bash', actAge: 30 + i })) })
  return out
}

function sheet(theme: Theme): Img {
  const rows = strips(theme)
  const cellH = theme.rows * SCALE * 2
  const petH = PET_ROWS * SCALE * 2
  const stripH = 14 + cellH + GAP
  const petStripH = 14 + petH + GAP
  const img = image(12 * (W * SCALE + GAP) + GAP, rows.length * stripH + 4 * petStripH + GAP)
  rows.forEach((strip, r) => {
    const y = r * stripH
    label(img, `${theme.name} ${strip.name}`, GAP, y + 2)
    strip.frames.forEach((g, i) => blit(img, g, GAP + i * (W * SCALE + GAP), y + 14))
  })
  const y = rows.length * stripH
  const states = ['think', 'tool', 'ready', 'sleep'] as const
  states.forEach((state, k) => {
    const py = y + k * petStripH
    label(img, `pet ${state}`, GAP, py + 2)
    for (let i = 0; i < 12; i++) blit(img, petFrame(theme.pet, state, i * 2), GAP + i * (PET_W * SCALE + GAP), py + 14)
  })
  return img
}

function still(theme: Theme): Img {
  const g = theme.scene(40, STILL_W, sig({ act: 'tool', tool: 'bash', done: 3, total: 7, agents: 1 }))
  const img = image(STILL_W * SCALE, theme.rows * SCALE * 2)
  blit(img, g, 0, 0)
  return img
}

const args = process.argv.slice(2)
mkdirSync(join(OUT, 'review'), { recursive: true })
if (args[0] === '--theme' && isThemeName(args[1])) {
  const theme = THEMES[args[1]]
  writeFileSync(join(OUT, `${theme.name}.png`), png(still(theme)))
  writeFileSync(join(OUT, 'review', `${theme.name}.png`), png(sheet(theme)))
  console.log(`assets/${theme.name}.png assets/review/${theme.name}.png`)
} else if (args[0] === '--gallery') {
  const rowH = 14 + 4 * SCALE * 2 + GAP
  const img = image(STILL_W * SCALE, THEME_NAMES.length * rowH)
  THEME_NAMES.forEach((name, i) => {
    label(img, name, 0, i * rowH + 2)
    blit(img, THEMES[name].scene(40, STILL_W, sig({ act: 'tool', tool: 'bash', done: 3, total: 7, agents: 1 })), 0, i * rowH + 14)
  })
  writeFileSync(join(OUT, 'gallery.png'), png(img))
  console.log('assets/gallery.png')
} else {
  console.error(`usage: bun scripts/shots.ts --theme <${THEME_NAMES.join('|')}> | --gallery`)
  process.exit(2)
}
