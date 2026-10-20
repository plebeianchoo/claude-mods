// Ocean: underwater, kelp swaying over the sand and fish drifting at the
// turn's pace; a school darts past and the bubbles stream while a tool runs;
// a whale or a jellyfish swims through while Claude writes. Clawd is down on
// the sand in a diving mask and snorkel, bubbles rising; while a tool runs he
// sweeps a net through the water and now and then has a fish in it.
import { gradient, mix, mod, PH, pick, put, rect, rnd, sprite, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const WATERS = [
  [0x0a3d62, 0x1e7fb5],
  [0x0b4d4a, 0x2a9d8f],
  [0x1b1f4a, 0x3a5ba0],
] as const
const FISH = ['.ff..', 'fffft', '.ff..']
const FISH_COLOURS = [0xffb703, 0xfb8500, 0xe63946, 0x8ecae6]
const WHALE = [
  '.....wwwwwww...',
  '..wwwwwwwwwwww.',
  '.wewwwwwwwwwwww',
  'wwwwwwwwwwwwwwt',
  '.bbbbbbbbbbb.tt',
]
const JELLY = ['.jjj.', 'jjjjj', 'j.j.j', '.j.j.']
const GLASS = 0xbde0fe
const RUBBER = 0x1d3557

/** A diving mask over his eyes and a snorkel up past his head, with his breath bubbling away. */
function mask(c: Canvas, v: Visit, m: Moment) {
  const { x, y } = v.head
  const at = (i: number) => (v.facing > 0 ? x + i : x + 13 - i)
  for (let i = 3; i <= 10; i++) put(c, at(i), y + 1, i === 4 || i === 9 ? GLASS : RUBBER)
  put(c, at(4), y + 2, GLASS)
  put(c, at(9), y + 2, GLASS)
  for (let j = -2; j <= 1; j++) put(c, at(12), y + j, RUBBER)
  put(c, at(11), y - 2, RUBBER)
  const rise = Math.floor(m.t / 180) % 7
  if (rise < 5) put(c, at(12) + (rise % 2), y - 3 - rise, mix(GLASS, 0xffffff, 0.5))
}

/** A net swept through the water while a tool runs; every other sweep a fish is in it. */
function net(c: Canvas, v: Visit, m: Moment) {
  if (v.pose !== 'pan') return
  const sweep = Math.round(Math.sin(m.t / 400) * 2)
  const [nx, ny] = handle(c, v.hand, v.facing, 0, 3, 0x7a4a24)
  const x0 = nx + (v.facing > 0 ? 1 : -5)
  const y0 = ny - 3 + sweep
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 4 || j === 0 || j === 4) put(c, x0 + i, y0 + j, 0xdfe7ff)
  if (Math.floor(m.t / 1500) % 2) sprite(c, FISH, { f: FISH_COLOURS[pick(m.seed, 5, FISH_COLOURS.length)]!, t: 0xffffff }, x0, y0 + 1)
}

const DIVER: Outfit = { job: 'pan', dress: (c, v, m) => (mask(c, v, m), net(c, v, m)) }

export const ocean: Scene = (c, m) => {
  const [deep, shallow] = WATERS[pick(m.seed, 1, WATERS.length)]!
  gradient(c, shallow, deep)

  // Light rays near the surface, drifting slowly.
  for (let x = 0; x < c.W; x++) if (mod(x + Math.floor(m.dist * 0.2), 11) < 2) rect(c, x, 0, 1, 3, mix(shallow, 0xffffff, 0.15))

  // Sand, and kelp swaying from it.
  rect(c, 0, PH - 2, c.W, 2, 0xc2a36b)
  const kelps = Math.floor(c.W / (6 + pick(m.seed, 2, 6)))
  for (let i = 0; i < kelps; i++) {
    const base = mod(Math.floor(rnd(m.seed, 100 + i) * c.W * 2 - m.dist * 0.6), c.W + 4) - 2
    const h = 5 + pick(m.seed, 110 + i, 8)
    for (let j = 0; j < h; j++) put(c, base + Math.sin(m.t / 700 + j / 2 + i) * (j / h) * 1.5, PH - 2 - j, j % 3 ? 0x2d6a4f : 0x40916c)
  }

  // Fish, drifting left at the turn's pace, bobbing.
  const fishes = 3 + pick(m.seed, 3, 3)
  for (let i = 0; i < fishes; i++) {
    const x = mod(Math.floor(rnd(m.seed, 200 + i) * c.W - m.dist * (0.8 + rnd(m.seed, 210 + i))), c.W + 8) - 4
    const y = 3 + pick(m.seed, 220 + i, PH - 8) + Math.round(Math.sin(m.t / 500 + i))
    sprite(c, FISH, { f: FISH_COLOURS[pick(m.seed, 230 + i, FISH_COLOURS.length)]!, t: 0xffffff }, x, y)
  }

  // Clawd down on the sand, in front of the kelp and the fish.
  visitor(c, m, DIVER)

  // A school darts past while a tool runs.
  if (m.state === 'tool') {
    const sx = c.W - mod(Math.floor(m.t * 0.06), c.W + 20)
    for (let i = 0; i < 9; i++) put(c, sx + (i % 3) * 3 + (i > 2 ? 1 : 0), 6 + Math.floor(i / 3) * 2, 0xdfe7ff)
  }

  // Bubbles rising, faster while a tool runs.
  const rise = m.state === 'tool' ? 0.012 : 0.004
  for (let i = 0; i < c.W / 6; i++) {
    const x = Math.floor(rnd(m.seed, 300 + i) * c.W)
    const y = mod(Math.floor(rnd(m.seed, 310 + i) * PH - m.t * rise * (0.6 + rnd(m.seed, 320 + i))), PH)
    put(c, x, y, mix(shallow, 0xffffff, 0.6))
  }

  // A whale or a jellyfish while Claude writes.
  if (m.state === 'say') {
    const x = c.W - mod(Math.floor(m.t * 0.012), c.W + 20)
    if (pick(m.seed, 4, 2) === 0) sprite(c, WHALE, { w: 0x4a6fa5, b: 0xdfe7ff, e: 0x111111, t: 0x4a6fa5 }, x, 4)
    else sprite(c, JELLY, { j: 0xff8fab }, x, 3 + Math.round(Math.sin(m.t / 400) * 2))
  }
}
