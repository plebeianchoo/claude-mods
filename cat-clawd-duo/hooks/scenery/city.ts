// City: a skyline in two depths scrolling at the turn's pace, windows lighting
// up (and flickering faster) while tools run, traffic on the street, and
// fireworks over the roofs while Claude writes. Clawd is on the pavement in a
// hard hat; while a tool runs he hammers at roadworks behind a striped barrier.
import { gradient, mix, mod, PH, pick, put, rect, rnd, type Canvas, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const WINDOWS = [
  [0xffd166, 0xffe9a8],
  [0x8ecae6, 0xd0f4ff],
  [0xff8fab, 0xffc2d1],
] as const
const CARS = [0xe63946, 0xf1faee, 0x457b9d, 0xffb703]
const SPARKS = [0xff4b3e, 0xffd54f, 0x8ecae6, 0xc77dff]
const STREET = 3
const HAT = 0xffb703
const WOOD = 0x7a4a24
const STEEL = 0x8a919b

/** A hard hat: a domed crown and a short brim. */
function hardHat(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 2, y - 1, 10, 1, HAT)
  rect(c, x + 3, y - 2, 8, 1, HAT)
  rect(c, x + 4, y - 3, 6, 1, HAT)
}

/** His hammer, and the barrier and spark of the roadworks while a tool runs. */
function roadworks(c: Canvas, v: Visit, t: number) {
  if (v.pose !== 'hammer') return
  const isUp = t % 700 < 450
  const [hx, hy] = handle(c, v.hand, v.facing, isUp ? -1 : 0, 2, WOOD)
  rect(c, hx, hy - 1, 2, 2, STEEL)
  const bx = v.x + v.facing * 17
  for (let i = 0; i < 5; i++) rect(c, bx + i, PH - STREET - 3, 1, 2, i % 2 ? 0xf1faee : 0xf77f00)
  put(c, bx, PH - STREET - 1, STEEL)
  put(c, bx + 4, PH - STREET - 1, STEEL)
  if (!isUp) put(c, hx + v.facing, hy + 1, Math.floor(t / 83) % 2 ? 0xffd54f : 0xff4b3e)
}

const WORKER: Outfit = { job: 'hammer', dress: (c, v, m) => (hardHat(c, v), roadworks(c, v, m.t)) }

export const city: Scene = (c, m) => {
  // Night twice as often as day: the windows are the show.
  const isNight = pick(m.seed, 1, 3) > 0
  const lit = WINDOWS[pick(m.seed, 2, 3)]!
  gradient(c, isNight ? 0x0b1026 : 0x5aa0e0, isNight ? 0x2a2350 : 0xcde8ff, 0, PH - STREET)

  // The far skyline: flat silhouettes, slow.
  const farOff = Math.floor(m.dist * 0.3)
  for (let x = 0; x < c.W; x++) {
    const b = Math.floor((x + farOff) / 5)
    const h = 4 + pick(m.seed, 1000 + b, 6)
    rect(c, x, PH - STREET - h, 1, h, isNight ? 0x1a1d33 : 0x8fa3b8)
  }

  // Near buildings, 7 px wide with a 1 px gap, windows on every other column.
  const off = Math.floor(m.dist)
  const share = m.state === 'tool' ? 0.7 : m.state === 'say' ? 0.45 : 0.2
  const flick = m.state === 'tool' ? 300 : 1500
  for (let x = 0; x < c.W; x++) {
    const u = x + off
    const b = Math.floor(u / 8)
    const col = u - b * 8
    if (col === 7) continue
    const h = 6 + pick(m.seed, 2000 + b, 8)
    const top = PH - STREET - h
    rect(c, x, top, 1, h, isNight ? 0x22263d : 0x5b6b80)
    if (col % 2 === 1) {
      for (let y = top + 1; y < PH - STREET - 1; y += 2) {
        if (rnd(b * 31 + y, col + Math.floor(m.t / flick)) < share) put(c, x, y, rnd(b, y) < 0.5 ? lit[0] : lit[1])
      }
    }
  }

  // The street, its lane marks moving, and the cars.
  rect(c, 0, PH - STREET, c.W, STREET, 0x2b2b2f)
  for (let x = 0; x < c.W; x += 4) put(c, mod(x - Math.floor(m.dist * 2), c.W), PH - 2, 0x6c6c70)
  const isBusy = m.state === 'tool'
  for (let i = 0; i < (isBusy ? 5 : 2); i++) {
    const speed = (isBusy ? 0.04 : 0.015) * (0.7 + rnd(m.seed, 600 + i) * 0.6)
    const x = mod(Math.floor(rnd(m.seed, 610 + i) * c.W + m.t * speed), c.W + 4) - 2
    rect(c, x, PH - 2, 3, 1, CARS[pick(m.seed, 620 + i, CARS.length)]!)
    put(c, x + 3, PH - 2, 0xfff3a0)
  }

  // Clawd on the pavement, in front of the traffic.
  visitor(c, m, WORKER)

  // Fireworks while Claude writes: a burst every 1.2 s, somewhere over the roofs.
  if (m.state === 'say') {
    const n = Math.floor(m.t / 1200)
    const k = (m.t % 1200) / 1200
    const cx = Math.floor(rnd(m.seed, 700 + n) * c.W)
    const cy = 3 + pick(m.seed, 710 + n, 3)
    const colour = mix(SPARKS[pick(m.seed, 720 + n, SPARKS.length)]!, 0x000000, k * 0.7)
    const r = Math.round(k * 4)
    for (let a = 0; a < 8; a++) put(c, cx + Math.cos((a * Math.PI) / 4) * r * 1.6, cy + Math.sin((a * Math.PI) / 4) * r, colour)
  }
}
