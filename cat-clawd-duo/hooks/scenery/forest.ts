// Forest: pines in two depths drifting at the turn's pace, by day, dusk or
// night (fireflies then), Clawd in a ranger's hat; he chops a log while a tool
// runs, chips flying, and a deer crosses the clearing while Claude writes.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const TIMES = [
  { top: 0x7ec8ff, bottom: 0xdff3ff, far: 0x3f7a4e, near: [0x2a6b3a, 0x338a47], trunk: 0x5a3a22, ground: 0x2f5f2f, light: 0xfff3a0 }, // day
  { top: 0x3b2a5a, bottom: 0xf0905a, far: 0x2f4a3a, near: [0x244a30, 0x2e5c3a], trunk: 0x4a3020, ground: 0x23402a, light: 0xff9e3d }, // dusk
  { top: 0x050a14, bottom: 0x12213a, far: 0x0f2218, near: [0x14301e, 0x1b3d26], trunk: 0x2b1d12, ground: 0x10261a, light: 0xe8e8f0 }, // night
] as const
const FELT = 0x6b4f2a
const BAND = 0x3d2b14
const STEEL = 0x9aa3ad
const CHIP = 0xd9b98a
const DEER_BODY = ['.......aa.', '......ddd.', '.ddddddd..', 'dddddddd..', 'd.d..d.d..']
const DEER_STEP = ['.......aa.', '......ddd.', '.ddddddd..', 'dddddddd..', '.d.d.d.d..']
const FIREFLY = 0xd9ff4f

/** A pine: a trunk two wide, and a canopy that widens to a column, rows alternating in shade. */
function pine(c: Canvas, bx: number, h: number, near: readonly [number, number] | readonly number[], trunk: number) {
  const top = PH - 2 - h
  rect(c, bx - 1, PH - 4, 2, 2, trunk)
  for (let j = 0; j < h - 2; j++) {
    const half = Math.min(4, 1 + Math.floor(j / 2))
    rect(c, bx - half, top + j, half * 2, 1, near[j % 2]!)
  }
}

/** A campaign hat: a wide brim and a dented crown. */
function rangerHat(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 1, y - 1, 12, 1, FELT)
  rect(c, x + 3, y - 2, 8, 1, BAND)
  rect(c, x + 3, y - 3, 3, 1, FELT)
  rect(c, x + 8, y - 3, 3, 1, FELT)
}

/** The axe in his hand and the log he is splitting while a tool runs; chips fly on the down-stroke. */
function chopping(c: Canvas, v: Visit, m: Moment, trunk: number) {
  if (v.pose !== 'hammer') return
  const isUp = m.t % 700 < 450
  const [ax, ay] = handle(c, v.hand, v.facing, isUp ? -1 : 0, 2, trunk)
  rect(c, ax, ay - 1, 2, 2, STEEL)
  put(c, ax + v.facing, ay - 1, mix(STEEL, 0xffffff, 0.4))
  const lx = v.x + (v.facing > 0 ? 16 : -8)
  rect(c, lx, PH - 4, 6, 2, trunk)
  put(c, lx + (v.facing > 0 ? 5 : 0), PH - 4, CHIP)
  put(c, lx + (v.facing > 0 ? 5 : 0), PH - 3, CHIP)
  if (!isUp) {
    const k = (m.t % 700 - 450) / 250
    for (let i = 0; i < 3; i++) put(c, lx + 2 + i * 2 + Math.round(rnd(m.seed, 800 + i) * 3 * k), PH - 5 - Math.round(k * (2 + i)), CHIP)
  }
}

/** A deer crossing right to left, stepping. */
function deer(c: Canvas, m: Moment) {
  const x = c.W - mod(Math.floor(m.t * 0.018), c.W + 14) + 2
  const art = Math.floor(m.t / 160) % 2 ? DEER_BODY : DEER_STEP
  sprite(c, art, { d: 0x8b5a2b, a: 0x5a3a22 }, x, PH - 7)
  put(c, x + 8, PH - 5, 0xf1e3c6) // the white tail
}

export const forest: Scene = (c, m) => {
  const time = TIMES[pick(m.seed, 1, 3)]!
  const isNight = time === TIMES[2]
  const outfit: Outfit = { job: 'hammer', dress: (c, v, m) => (rangerHat(c, v), chopping(c, v, m, time.trunk)) }
  gradient(c, time.top, time.bottom)

  // The sun or moon, low behind the trees; it glows while Claude writes.
  const lx = Math.floor(c.W * (0.5 + rnd(m.seed, 3) * 0.4))
  if (m.state === 'say') disc(c, lx, 4, 4, mix(time.light, time.bottom, 0.6))
  disc(c, lx, 4, 2, time.light)

  // The far treeline: spiky silhouettes, slow.
  for (let x = 0; x < c.W; x++) {
    const u = x + Math.floor(m.dist * 0.3)
    const b = Math.floor(u / 5)
    const h = 5 + pick(m.seed, 1000 + b, 4) - Math.abs((u - b * 5) - 2) * 2
    rect(c, x, PH - 2 - h, 1, h, time.far)
  }

  // Near pines, at the turn's pace, every nine pixels or so.
  const off = Math.floor(m.dist)
  for (let b = Math.floor(off / 9) - 1; b <= Math.floor((off + c.W) / 9) + 1; b++) {
    const bx = b * 9 + pick(m.seed, 2000 + b, 5) - off
    pine(c, bx, 9 + pick(m.seed, 2100 + b, 5), time.near, time.trunk)
  }

  // The ground, with grass blades.
  rect(c, 0, PH - 2, c.W, 2, time.ground)
  for (let x = 0; x < c.W; x++) if (mod(x + off, 3) === 0) put(c, x, PH - 3, time.near[1]!)

  // Clawd in the clearing.
  visitor(c, m, outfit)

  // A deer crosses while Claude writes.
  if (m.state === 'say') deer(c, m)

  // Fireflies at night, winking, drifting; by day, the sun dapples through.
  if (isNight) {
    for (let i = 0; i < c.W / 5; i++) {
      const x = mod(Math.floor(rnd(m.seed, 100 + i) * c.W + Math.sin(m.t / 900 + i) * 3), c.W)
      const y = 4 + Math.floor(rnd(m.seed, 110 + i) * (PH - 7)) + Math.round(Math.sin(m.t / 700 + i * 2))
      const glow = wave(m.t + i * 530, 1400)
      if (glow > 0.45) put(c, x, y, mix(0x5a6b20, FIREFLY, glow))
    }
  } else if (m.state !== 'tool') {
    for (let x = 0; x < c.W; x++) if (mod(x + Math.floor(m.dist * 0.2), 13) < 2) for (let y = 0; y < 4; y++) put(c, x, y, mix(c.px[y * c.W + x]!, 0xffffff, 0.12))
  }
}
