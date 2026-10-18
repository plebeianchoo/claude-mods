// Space: stars in three depths drifting at the turn's pace, stretched into
// warp streaks while a tool runs, a ship bobbing among them, and a planet
// rising with a comet overhead while Claude writes.
import { disc, gradient, mix, mod, PH, pick, put, rnd, sprite, type Scene } from './pixels'

const NEBULAE = [0x2a0f3d, 0x0f2a3d, 0x3d1a0f]
const PLANETS = [0xe9c46a, 0x8ecae6, 0xe76f51]
const SHIP = [
  '..aa....',
  '.sssss..',
  'fsswwsss',
  '.sssss..',
  '..aa....',
]

export const space: Scene = (c, m) => {
  const nebula = NEBULAE[pick(m.seed, 1, NEBULAE.length)]!
  gradient(c, 0x02030a, nebula)
  const isWarping = m.state === 'tool'

  // Stars: nearer ones brighter and faster; streaks while warping.
  for (let i = 0; i < c.W * 0.8; i++) {
    const depth = 1 + (i % 3)
    const x = mod(Math.floor(rnd(m.seed, 100 + i) * c.W * 3 - m.dist * depth * 0.5), c.W)
    const y = Math.floor(rnd(m.seed, 110 + i) * PH)
    const colour = mix(0x30344a, 0xffffff, depth / 3)
    const length = isWarping ? depth * 2 : 1
    for (let k = 0; k < length; k++) put(c, x + k, y, mix(colour, nebula, k / length))
  }

  // A planet rising and a comet overhead while Claude writes.
  if (m.state === 'say') {
    const tint = PLANETS[pick(m.seed, 2, PLANETS.length)]!
    const px = Math.floor(c.W * 0.7)
    const py = PH + 2 - Math.min(10, Math.floor(m.t / 250))
    disc(c, px, py, 7, tint)
    disc(c, px - 2, py - 2, 3, mix(tint, 0xffffff, 0.35))
    const cx = mod(Math.floor(m.t * 0.03), c.W + 12) - 6
    for (let k = 0; k < 6; k++) put(c, cx - k, 2 + Math.floor(k / 3), mix(0xffffff, nebula, k / 6))
  }

  // The ship, bobbing, its flame flickering; it surges ahead while warping.
  const sx = Math.floor(c.W * 0.25) + (isWarping ? 4 : 0) + Math.round(Math.sin(m.t / 1500) * 2)
  const sy = 6 + Math.round(Math.sin(m.t / 600))
  sprite(c, SHIP, { s: 0xc0c7d4, w: 0x8ecae6, a: 0xe63946, f: Math.floor(m.t / 120) % 2 ? 0xffb703 : 0xff4b3e }, sx, sy)
  if (isWarping) for (let k = 1; k <= 4; k++) put(c, sx - k, sy + 2, mix(0xffb703, nebula, k / 5))
}
