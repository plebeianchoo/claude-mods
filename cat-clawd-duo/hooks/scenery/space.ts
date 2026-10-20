// Space: stars in three depths drifting at the turn's pace, stretched into
// warp streaks while a tool runs, a ship bobbing among them, and a planet
// rising with a comet overhead while Claude writes. Clawd floats out there in
// a helmet; while a tool runs he has a wrench on a satellite, sparks flying.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const NEBULAE = [0x2a0f3d, 0x0f2a3d, 0x3d1a0f]
const PLANETS = [0xe9c46a, 0x8ecae6, 0xe76f51]
const SHIP = [
  '..aa....',
  '.sssss..',
  'fsswwsss',
  '.sssss..',
  '..aa....',
]

const SHELL = 0xdfe7ff
const PANEL = 0x3a5ba0

/** A helmet dome over his head, its visor catching the light. */
function helmet(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 2, y - 1, 10, 1, SHELL)
  rect(c, x + 3, y - 2, 8, 1, SHELL)
  rect(c, x + 5, y - 2, 4, 1, mix(SHELL, 0x8ecae6, 0.5))
  put(c, x + 1, y, SHELL)
  put(c, x + 12, y, SHELL)
}

/** The satellite he is fixing while a tool runs, and the wrench in his hand. */
function repair(c: Canvas, v: Visit, m: Moment) {
  if (v.pose !== 'hammer') return
  const isUp = m.t % 700 < 450
  const [wx, wy] = handle(c, v.hand, v.facing, isUp ? -1 : 0, 2, 0xc0c7d4)
  put(c, wx, wy - 1, 0xc0c7d4)
  put(c, wx + v.facing, wy - 1, 0xc0c7d4)
  const sx = v.x + (v.facing > 0 ? 17 : -8)
  const sy = v.head.y + 1
  rect(c, sx, sy, 4, 4, 0x9aa0a6)
  put(c, sx + 1, sy + 1, 0xff4b3e)
  rect(c, sx - 5, sy + 1, 5, 2, PANEL)
  rect(c, sx + 4, sy + 1, 5, 2, PANEL)
  put(c, sx + 2, sy - 2, 0xc0c7d4)
  put(c, sx + 2, sy - 1, 0xc0c7d4)
  if (!isUp) for (let k = 0; k < 2; k++) put(c, wx + v.facing * (1 + k), wy + k, Math.floor(m.t / 83) % 2 ? 0xffd54f : 0xff4b3e)
}

const SPACEMAN: Outfit = {
  job: 'hammer',
  idle: 'float',
  stroll: 'float',
  lift: m => 5 + Math.round(Math.sin(m.t / 900) * 2),
  dress: (c, v, m) => (helmet(c, v), repair(c, v, m)),
}

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

  // A planet rising from the moment Claude starts writing, and a comet overhead.
  if (m.state === 'say') {
    const tint = PLANETS[pick(m.seed, 2, PLANETS.length)]!
    const px = Math.floor(c.W * 0.7)
    const py = PH + 2 - Math.min(10, Math.floor(m.since / 250))
    disc(c, px, py, 7, tint)
    disc(c, px - 2, py - 2, 3, mix(tint, 0xffffff, 0.35))
    const cx = mod(Math.floor(m.t * 0.03), c.W + 12) - 6
    for (let k = 0; k < 6; k++) put(c, cx - k, 2 + Math.floor(k / 3), mix(0xffffff, nebula, k / 6))
  }

  // Clawd adrift, among the stars.
  visitor(c, m, SPACEMAN)

  // The ship, bobbing, its flame flickering; it surges ahead while warping.
  const sx = Math.floor(c.W * 0.25) + (isWarping ? 4 : 0) + Math.round(Math.sin(m.t / 1500) * 2)
  const sy = 6 + Math.round(Math.sin(m.t / 600))
  sprite(c, SHIP, { s: 0xc0c7d4, w: 0x8ecae6, a: 0xe63946, f: Math.floor(m.t / 120) % 2 ? 0xffb703 : 0xff4b3e }, sx, sy)
  if (isWarping) for (let k = 1; k <= 4; k++) put(c, sx - k, sy + 2, mix(0xffb703, nebula, k / 5))
}
