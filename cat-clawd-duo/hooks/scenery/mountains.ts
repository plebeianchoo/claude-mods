// Mountains: snowy peaks far off and a ridge near, drifting at the turn's
// pace, under an aurora, a clear sky or low cloud, snow falling. Clawd is out
// in a beanie and scarf; a blizzard blows while a tool runs and he shovels, the
// pile growing; an eagle wheels overhead while Claude writes.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const SKIES = [
  { top: 0x05081a, bottom: 0x1a2a4a, peak: 0x2a3550, cap: 0x9aa8c0, snow: 0xcfd8e6, shade: 0x9aa8c0, light: 0xe8e8f0 }, // aurora night
  { top: 0x4f9fe8, bottom: 0xe8f4ff, peak: 0x7f93b0, cap: 0xffffff, snow: 0xf4f7fb, shade: 0xc4d1e0, light: 0xfff3a0 }, // clear day
  { top: 0x6e7786, bottom: 0xb8c0cc, peak: 0x5f6b80, cap: 0xe6ebf2, snow: 0xe6ebf2, shade: 0xb4bfcc, light: 0xdfe3ea }, // overcast
] as const
const AURORA = [0x4ff0a0, 0x7fd8ff, 0xc77dff]
const WOOL = 0xe63946
const WOOL_LIGHT = 0xff8fab
const STEEL = 0x9aa3ad
const WOOD = 0x7a4a24
const PINE = 0x1f3b2a
const EAGLE_UP = ['e.....e', '.ee.ee.', '..eWe..']
const EAGLE_DOWN = ['.......', '..eWe..', 'ee...ee']

/** A beanie with a pompom, and a scarf with its tail flying back. */
function woollens(c: Canvas, v: Visit, m: Moment) {
  const { x, y } = v.head
  rect(c, x + 2, y - 1, 10, 1, WOOL_LIGHT)
  rect(c, x + 3, y - 3, 8, 2, WOOL)
  rect(c, x + 5, y - 4, 4, 1, WOOL)
  put(c, x + 6, y - 5, 0xffffff)
  put(c, x + 7, y - 5, 0xffffff)
  rect(c, x + 2, y + 4, 10, 1, WOOL)
  const back = v.facing > 0 ? x + 1 : x + 12
  const flutter = m.state === 'tool' ? 2 : Math.round(wave(m.t, 1300))
  for (let i = 0; i <= flutter; i++) put(c, back - v.facing * i, y + 3 + (i === 0 ? 1 : 0), i % 2 ? WOOL_LIGHT : WOOL)
}

/** The shovel in his hand and the pile beside him, growing while a tool runs; a puff flies on the down-stroke. */
function shovelling(c: Canvas, v: Visit, m: Moment, snow: number, shade: number) {
  if (v.pose !== 'hammer') return
  const isUp = m.t % 700 < 450
  const [sx, sy] = handle(c, v.hand, v.facing, isUp ? 0 : 1, 2, WOOD)
  rect(c, sx + (v.facing > 0 ? 0 : -1), sy, 2, 2, STEEL)
  const h = Math.min(4, 1 + Math.floor((m.t % 8000) / 2000))
  const px = v.x + (v.facing > 0 ? 21 : -8)
  const edge = mix(shade, 0x000000, 0.2)
  for (let r = 0; r < h; r++) {
    const half = h - r - 1
    rect(c, px - half, PH - 3 - r, half * 2 + 1, 1, snow)
    put(c, px - half, PH - 3 - r, edge)
    put(c, px + half, PH - 3 - r, edge)
  }
  rect(c, px - h, PH - 2, h * 2 + 1, 1, shade)
  if (!isUp) put(c, px + Math.round(Math.sin(m.t / 90) * 2), PH - 4 - h, 0xffffff)
}

/** A small pine, snow on its tiers. */
function fir(c: Canvas, x: number, h: number, snow: number) {
  for (let j = 0; j < h; j++) {
    const half = Math.min(3, 1 + Math.floor(j / 2))
    rect(c, x - half, PH - 3 - h + j, half * 2 + 1, 1, j % 2 ? PINE : mix(PINE, snow, 0.5))
  }
}

/** An eagle wheeling in a slow ellipse, wings beating slowly. */
function eagle(c: Canvas, m: Moment) {
  const a = m.t / 2200
  const x = Math.floor(c.W * 0.55 + Math.cos(a) * c.W * 0.3)
  const y = 3 + Math.round(Math.sin(a) * 2)
  sprite(c, Math.floor(m.t / 450) % 2 ? EAGLE_UP : EAGLE_DOWN, { e: 0x3a2a1a, W: 0xffffff }, x - 3, y)
}

export const mountains: Scene = (c, m) => {
  const sky = SKIES[pick(m.seed, 1, 3)]!
  const isNight = sky === SKIES[0]
  const isBlizzard = m.state === 'tool'
  const outfit: Outfit = { job: 'hammer', dress: (c, v, m) => (woollens(c, v, m), shovelling(c, v, m, sky.snow, sky.shade)) }
  gradient(c, isBlizzard ? mix(sky.top, sky.snow, 0.4) : sky.top, isBlizzard ? mix(sky.bottom, sky.snow, 0.4) : sky.bottom)

  // Stars and the aurora at night: ribbons waving across the top; by day the sun, or a pale disc through cloud.
  if (isNight && !isBlizzard) {
    for (let i = 0; i < c.W / 3; i++) put(c, Math.floor(rnd(m.seed, 100 + i) * c.W), Math.floor(rnd(m.seed, 200 + i) * 9), mix(0x30344a, 0xffffff, wave(m.t + i * 397, 1800)))
    for (let r = 0; r < 3; r++) {
      const colour = AURORA[(r + pick(m.seed, 5, 3)) % 3]!
      for (let x = 0; x < c.W; x++) {
        const y = 1 + r * 2 + Math.round(Math.sin(x / 7 + m.t / 1400 + r) * 1.5 + Math.sin(x / 3 - m.t / 900))
        const glow = 0.35 + 0.35 * wave(m.t + x * 60 + r * 500, 2000)
        put(c, x, y, mix(c.px[y * c.W + x]!, colour, glow))
        put(c, x, y + 1, mix(c.px[(y + 1) * c.W + x]!, colour, glow * 0.4))
      }
    }
  } else if (!isBlizzard) {
    const lx = Math.floor(c.W * (0.55 + rnd(m.seed, 3) * 0.35))
    if (m.state === 'say') disc(c, lx, 4, 4, mix(sky.light, sky.bottom, 0.6))
    disc(c, lx, 4, 2, sky.light)
  }

  // Far peaks: tall triangles, snow-capped, slow, greyed in a blizzard.
  const peak = isBlizzard ? mix(sky.peak, sky.snow, 0.4) : sky.peak
  for (let x = 0; x < c.W; x++) {
    const u = x + Math.floor(m.dist * 0.3)
    const b = Math.floor(u / 18)
    const h = 8 + pick(m.seed, 1000 + b, 5) - Math.abs(u - b * 18 - 9)
    if (h <= 0) continue
    rect(c, x, PH - 3 - h, 1, h, peak)
    rect(c, x, PH - 3 - h, 1, Math.min(h, 2), sky.cap)
  }

  // The near ridge, at the turn's pace, in snow with a shaded flank, and firs along it.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist
    const h = 3 + Math.round(1.5 * Math.sin(u / 9 + m.seed) + Math.sin(u / 3.5))
    rect(c, x, PH - 3 - h, 1, h, Math.cos(u / 9 + m.seed) < 0 ? mix(sky.snow, sky.shade, 0.5) : sky.snow)
  }
  for (let i = 0; i < 4; i++) {
    const x = mod(Math.floor(rnd(m.seed, 300 + i) * c.W * 2 - m.dist), c.W + 8) - 4
    fir(c, x, 4 + pick(m.seed, 310 + i, 3), sky.snow)
  }
  rect(c, 0, PH - 3, c.W, 3, sky.snow)
  for (let x = 0; x < c.W; x++) if (mod(x + Math.floor(m.dist), 5) < 2) put(c, x, PH - 1, sky.shade)

  // Clawd, in the snow.
  visitor(c, m, outfit)

  // The eagle while Claude writes.
  if (m.state === 'say') eagle(c, m)

  // Snow: a few flakes drifting, or a blizzard slanting across while a tool runs.
  const flakes = Math.floor(c.W * (isBlizzard ? 0.9 : 0.25))
  for (let i = 0; i < flakes; i++) {
    const fall = m.t * (0.006 + rnd(m.seed, 500 + i) * 0.004)
    const y = mod(Math.floor(rnd(m.seed, 510 + i) * PH + fall), PH)
    const drift = isBlizzard ? fall * 1.5 : Math.sin(m.t / 600 + i) * 1.5
    const x = mod(Math.floor(rnd(m.seed, 520 + i) * c.W + drift), c.W)
    put(c, x, y, 0xffffff)
    if (isBlizzard) put(c, x - 1, y, mix(0xffffff, sky.snow, 0.5))
  }
}
