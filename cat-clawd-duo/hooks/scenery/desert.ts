// Desert: mesas far off and dunes near, drifting at the turn's pace, by day or
// under the stars, a few saguaros and a tumbleweed bouncing by. Clawd is out in
// a head wrap; a sandstorm blows while a tool runs and he digs, the pile
// growing beside him; a camel caravan crosses while Claude writes.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const TIMES = [
  { top: 0x3f8fd6, bottom: 0xffd27a, mesa: 0xb4683a, sand: 0xe9c46a, shade: 0xc9a24a, cactus: 0x4a8c3f, light: 0xfff3a0 }, // day
  { top: 0x070b24, bottom: 0x3a2a5a, mesa: 0x3a2a40, sand: 0x6a5a4a, shade: 0x4e4236, cactus: 0x2f4f33, light: 0xe8e8f0 }, // night
] as const
const CLOTH = 0xf1e3c6
const CORD = 0x1a1a1a
const STEEL = 0x9aa3ad
const WOOD = 0x7a4a24
const WEED = 0xa98a5a
const TUMBLE = ['.ww.', 'w..w', 'w..w', '.ww.']
const CAMEL = ['.n.......', 'nn..hh...', '.hhhhhhh.', '.hhhhhhh.', '.h.h..h.h', '.h.h..h.h']
const CAMEL_STEP = ['.n.......', 'nn..hh...', '.hhhhhhh.', '.hhhhhhh.', '..h.h.h.h', '..h.h.h.h']

/** A saguaro: a trunk two wide with an arm each side. */
function saguaro(c: Canvas, x: number, h: number, colour: number) {
  rect(c, x, PH - 3 - h, 2, h, colour)
  rect(c, x - 2, PH - 3 - h + 3, 1, 3, colour)
  put(c, x - 1, PH - 3 - h + 5, colour)
  rect(c, x + 3, PH - 3 - h + 2, 1, 3, colour)
  put(c, x + 2, PH - 3 - h + 4, colour)
}

/** A head wrap: cloth about his head, a cord round it, a tail down his back. */
function headWrap(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 2, y - 2, 10, 2, CLOTH)
  rect(c, x + 3, y - 1, 8, 1, CORD)
  rect(c, x + 3, y - 3, 8, 1, CLOTH)
  const back = v.facing > 0 ? x + 1 : x + 12
  rect(c, back, y - 1, 1, 4, CLOTH)
}

/** The shovel in his hand, the hole at his feet and the pile beside him, growing while a tool runs. */
function digging(c: Canvas, v: Visit, m: Moment, sand: number, shade: number) {
  if (v.pose !== 'hammer') return
  const isUp = m.t % 700 < 450
  const [sx, sy] = handle(c, v.hand, v.facing, isUp ? 0 : 1, 2, WOOD)
  rect(c, sx + (v.facing > 0 ? 0 : -1), sy, 2, 2, STEEL)
  const front = v.x + (v.facing > 0 ? 15 : -2)
  rect(c, front - 1, PH - 2, 3, 1, shade)
  const h = Math.min(4, 1 + Math.floor((m.t % 8000) / 2000))
  const px = v.x + (v.facing > 0 ? 21 : -8)
  for (let r = 0; r < h; r++) rect(c, px - (h - r - 1), PH - 3 - r, (h - r) * 2 - 1, 1, r % 2 ? mix(shade, 0x000000, 0.2) : shade)
  if (!isUp) put(c, px + Math.round(Math.sin(m.t / 90) * 2), PH - 4 - h, shade)
}

/** A caravan: three camels crossing right to left, stepping, each with a saddle. */
function caravan(c: Canvas, m: Moment) {
  const head = c.W - mod(Math.floor(m.t * 0.014), c.W + 40)
  for (let i = 0; i < 3; i++) {
    const art = Math.floor(m.t / 180 + i) % 2 ? CAMEL : CAMEL_STEP
    sprite(c, art, { h: 0xc69c6d, n: 0xc69c6d }, head + i * 12, PH - 9 + Math.round(Math.sin(m.t / 300 + i)))
    put(c, head + i * 12 + 5, PH - 9 + Math.round(Math.sin(m.t / 300 + i)), i ? 0x2a9d8f : 0xe63946)
  }
}

export const desert: Scene = (c, m) => {
  const time = TIMES[pick(m.seed, 1, 3) === 2 ? 1 : 0]!
  const isNight = time === TIMES[1]
  const isStorm = m.state === 'tool'
  const outfit: Outfit = { job: 'hammer', dress: (c, v, m) => (headWrap(c, v), digging(c, v, m, time.sand, time.shade)) }
  gradient(c, isStorm ? mix(time.top, time.sand, 0.5) : time.top, isStorm ? mix(time.bottom, time.sand, 0.5) : time.bottom)

  // Stars at night; the sun or moon.
  if (isNight && !isStorm) {
    for (let i = 0; i < c.W / 3; i++) put(c, Math.floor(rnd(m.seed, 100 + i) * c.W), Math.floor(rnd(m.seed, 200 + i) * 8), mix(0x40445a, 0xffffff, wave(m.t + i * 397, 1800)))
  }
  const lx = Math.floor(c.W * (0.55 + rnd(m.seed, 3) * 0.35))
  if (!isStorm) {
    if (m.state === 'say') disc(c, lx, 4, 4, mix(time.light, time.bottom, 0.6))
    disc(c, lx, 4, isNight ? 2 : 3, time.light)
  }

  // Mesas far off: flat tops with sloped sides, slow, with gaps between.
  for (let x = 0; x < c.W; x++) {
    const u = x + Math.floor(m.dist * 0.3)
    const b = Math.floor(u / 16)
    const col = u - b * 16
    const top = pick(m.seed, 1000 + b, 3) + 2
    const w = 7 + pick(m.seed, 1010 + b, 6)
    if (col >= w) continue
    const h = Math.max(0, top - Math.max(0, 2 - col) - Math.max(0, col - (w - 3)))
    rect(c, x, PH - 5 - h, 1, h + 1, time.mesa)
  }

  // Dunes, at the turn's pace, the lee side shaded.
  rect(c, 0, PH - 4, c.W, 4, time.sand)
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist
    const h = 3 + Math.round(2 * Math.sin(u / 11 + m.seed) + Math.sin(u / 4))
    const lee = Math.cos(u / 11 + m.seed) < 0
    rect(c, x, PH - 2 - h, 1, h, lee ? time.shade : time.sand)
  }

  // Saguaros, up to three, scrolling with the dunes.
  for (let i = 0; i < pick(m.seed, 2, 4); i++) {
    const x = mod(Math.floor(rnd(m.seed, 300 + i) * c.W * 2 - m.dist), c.W + 8) - 4
    saguaro(c, x, 6 + pick(m.seed, 310 + i, 4), time.cactus)
  }

  // A tumbleweed bouncing by while Claude thinks.
  if (m.state === 'think') {
    const x = mod(Math.floor(rnd(m.seed, 4) * c.W - m.t * 0.02), c.W + 8) - 4
    sprite(c, TUMBLE, { w: WEED }, x, PH - 6 - Math.round(Math.abs(Math.sin(m.t / 350)) * 3))
  }

  // The caravan while Claude writes, passing behind Clawd.
  if (m.state === 'say') caravan(c, m)

  // Clawd, out on the sand.
  visitor(c, m, outfit)

  // The storm: sand streaking across while a tool runs.
  if (isStorm) {
    const grain = mix(time.sand, 0xffffff, 0.3)
    for (let i = 0; i < c.W * 0.7; i++) {
      const y = Math.floor(rnd(m.seed, 500 + i) * PH)
      const x = mod(Math.floor(rnd(m.seed, 510 + i) * c.W + m.t * (0.05 + rnd(m.seed, 520 + i) * 0.04)), c.W + 4) - 2
      put(c, x, y, grain)
      put(c, x + 1, y, mix(grain, time.sand, 0.5))
    }
  }
}
