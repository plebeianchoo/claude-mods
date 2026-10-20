// Cave: stalactites in two depths and stalagmites drifting at the turn's pace,
// crystals pulsing in amethyst, emerald or amber, drips falling into pools.
// Clawd is down here in a miner's helmet, its lamp lighting the rock about
// him; while a tool runs he picks at a face, sparks flying and a crystal
// popping loose; bats stream out while Claude writes.
import { gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Canvas, type Moment, type Scene } from './pixels'
import { CLAWD_W, handle, visitor, type Outfit, type Visit } from './visitor'

const GEMS = [
  { bright: 0xc77dff, dim: 0x5a3a7a }, // amethyst
  { bright: 0x4ff0a0, dim: 0x1f6a48 }, // emerald
  { bright: 0xffb703, dim: 0x7a5a10 }, // amber
] as const
const WALL_TOP = 0x1a1424
const WALL_BOTTOM = 0x2a2238
const FAR = 0x2f2740
const NEAR = 0x0e0a14
const EDGE = 0x3a3050
const FLOOR = 0x16111f
const POOL = 0x2a4a6a
const HELMET = 0xffb703
const LAMP = 0xffffff
const GLOW = 0xffe9a8
const STEEL = 0x9aa3ad
const WOOD = 0x7a4a24
const BAT_UP = ['b.b', 'bbb', '.b.']
const BAT_DOWN = ['...', 'bbb', 'b.b']

/** A crystal: a spike of the gem's colour, its tip bright. */
function crystal(c: Canvas, x: number, y: number, h: number, up: boolean, bright: number, dim: number, glow: number) {
  for (let j = 0; j < h; j++) {
    const half = Math.max(0, Math.floor((h - 1 - j) / 2))
    const yy = up ? y - j : y + j
    rect(c, x - half, yy, half * 2 + 1, 1, mix(dim, bright, glow * (0.4 + (0.6 * j) / h)))
  }
}

/** Lamp light on the rock in front of him, warm and fading with distance. */
function lamplight(c: Canvas, v: Visit) {
  const lx = v.facing > 0 ? v.x + 12 : v.x + 1
  const ly = v.head.y - 2
  for (let dy = -7; dy <= 9; dy++) {
    for (let i = -2; i <= 14; i++) {
      const x = lx + v.facing * i
      const y = ly + dy
      const d = Math.hypot(i, dy * 1.4)
      if (x < 0 || x >= c.W || y < 0 || y >= PH || d > 13) continue
      c.px[y * c.W + x] = mix(c.px[y * c.W + x]!, GLOW, 0.4 * (1 - d / 13))
    }
  }
}

/** A miner's helmet, its lamp at the front. */
function helmet(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 2, y - 1, 10, 1, HELMET)
  rect(c, x + 3, y - 2, 8, 1, HELMET)
  rect(c, x + 4, y - 3, 6, 1, HELMET)
  put(c, v.facing > 0 ? x + 12 : x + 1, y - 2, LAMP)
}

/** The pickaxe in his hand and the face he works while a tool runs; sparks on the stroke, a crystal popping loose now and then. */
function mining(c: Canvas, v: Visit, m: Moment, bright: number, dim: number) {
  if (v.pose !== 'hammer') return
  const isUp = m.t % 700 < 450
  const [px, py] = handle(c, v.hand, v.facing, isUp ? -1 : 0, 2, WOOD)
  rect(c, px - 1, py - 1, 3, 1, STEEL)
  put(c, px - 1, py, STEEL)
  put(c, px + 1, py, STEEL)
  const fx = v.x + (v.facing > 0 ? CLAWD_W + 3 : -8)
  rect(c, fx, PH - 10, 5, 8, NEAR)
  rect(c, fx, PH - 10, 5, 1, EDGE)
  put(c, v.facing > 0 ? fx : fx + 4, PH - 9, EDGE)
  crystal(c, fx + 2, PH - 7, 3, false, bright, dim, 0.8)
  if (!isUp) for (let k = 0; k < 2; k++) put(c, px + v.facing * (1 + k), py - 1 - k, Math.floor(m.t / 83 + k) % 2 ? 0xffd54f : 0xff4b3e)
  const loose = (m.t % 4000) / 4000
  if (loose < 0.2) {
    const k = loose / 0.2
    const gx = fx + 2 + v.facing * -Math.round(k * 6)
    const gy = PH - 7 - Math.round(Math.sin(k * Math.PI) * 4) + Math.round(k * 4)
    put(c, gx, gy, bright)
    put(c, gx, gy + 1, dim)
  }
}

export const cave: Scene = (c, m) => {
  const gem = GEMS[pick(m.seed, 1, 3)]!
  const outfit: Outfit = { job: 'hammer', dress: (c, v, m) => (lamplight(c, v), helmet(c, v), mining(c, v, m, gem.bright, gem.dim)) }
  gradient(c, WALL_TOP, WALL_BOTTOM)

  // Far stalactites, slow.
  for (let x = 0; x < c.W; x++) {
    const u = x + Math.floor(m.dist * 0.3)
    const b = Math.floor(u / 7)
    const h = 3 + pick(m.seed, 1000 + b, 4) - Math.abs(u - b * 7 - 3)
    if (h > 0) rect(c, x, 0, 1, h, FAR)
  }

  // Crystal clusters on the floor, scrolling with the near rock, each pulsing in its own time.
  const glowAll = m.state === 'think' ? 1 : 0.7
  for (let i = 0; i < c.W / 8; i++) {
    const x = mod(Math.floor(rnd(m.seed, 100 + i) * c.W * 2 - m.dist), c.W + 6) - 3
    const h = 3 + pick(m.seed, 120 + i, 3)
    const glow = glowAll * (0.3 + 0.7 * wave(m.t + i * 610, 1800))
    crystal(c, x, PH - 3, h, true, gem.bright, gem.dim, glow)
    crystal(c, x + (rnd(m.seed, 130 + i) < 0.5 ? -2 : 2), PH - 3, h - 1, true, gem.bright, gem.dim, glow * 0.8)
  }

  // Near stalactites and stalagmites, at the turn's pace, with a lit edge.
  for (let x = 0; x < c.W; x++) {
    const u = x + Math.floor(m.dist)
    const b = Math.floor(u / 11)
    const col = u - b * 11
    const down = 4 + pick(m.seed, 2000 + b, 5) - Math.abs(col - 5) * 2
    if (down > 0) {
      rect(c, x, 0, 1, down, NEAR)
      put(c, x, down - 1, EDGE)
    }
    const up = 2 + pick(m.seed, 2100 + b, 4) - Math.abs(col - 2) * 2
    if (up > 0) rect(c, x, PH - 2 - up, 1, up, NEAR)
  }

  // The floor, with pools that glint.
  rect(c, 0, PH - 2, c.W, 2, FLOOR)
  for (let i = 0; i < 3; i++) {
    const x = mod(Math.floor(rnd(m.seed, 300 + i) * c.W * 2 - m.dist), c.W + 10) - 5
    rect(c, x, PH - 2, 6 + pick(m.seed, 310 + i, 4), 1, POOL)
    if (wave(m.t + i * 700, 1500) > 0.8) put(c, x + 2 + pick(m.seed, 320 + i, 3), PH - 2, mix(POOL, 0xffffff, 0.6))
  }

  // Drips, falling from the roof into the floor, one every so often per spot.
  for (let i = 0; i < 4; i++) {
    const x = mod(Math.floor(rnd(m.seed, 400 + i) * c.W * 2 - m.dist), c.W)
    const k = ((m.t + i * 530) % 1400) / 1400
    if (k < 0.7) put(c, x, 2 + Math.round(k * k * (PH - 5) * 2), 0x8ecae6)
    else if (k < 0.85) rect(c, x - 1, PH - 2, 3, 1, mix(FLOOR, 0x8ecae6, 0.5))
  }

  // Clawd, lamp lit.
  visitor(c, m, outfit)

  // Bats streaming out to the right while Claude writes.
  if (m.state === 'say') {
    for (let b = 0; b < 5; b++) {
      const x = mod(Math.floor(m.t * 0.03) - b * 11 + pick(m.seed, 500 + b, 6), c.W + 10) - 5
      const y = 3 + pick(m.seed, 510 + b, 6) + Math.round(Math.sin(m.t / 150 + b) * 1.5)
      sprite(c, Math.floor(m.t / 120 + b) % 2 ? BAT_UP : BAT_DOWN, { b: 0x4a3f63 }, x, y)
      put(c, x + 1, y + 1, 0xff4b3e)
    }
  }
}
