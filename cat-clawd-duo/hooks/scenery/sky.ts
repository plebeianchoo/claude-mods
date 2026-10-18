// Sky: a random time of day and weather each turn, clouds and hills drifting
// at the turn's pace, rain heavier (and lightning, in a storm) while a tool
// runs, and a bird crossing while Claude writes, the sun or moon aglow.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Scene } from './pixels'

const TIMES = [
  { top: 0x3a7bd5, bottom: 0xbfe3ff, light: 0xfff3a0, hill: 0x4c9a4a, far: 0x7fb77e }, // day
  { top: 0x2b1b4f, bottom: 0xf08a4b, light: 0xff9e3d, hill: 0x3d4a3a, far: 0x6a5a6e }, // dusk
  { top: 0x050816, bottom: 0x1b2a4a, light: 0xe8e8f0, hill: 0x16241c, far: 0x24303f }, // night
] as const
const CLEAR = 0
const RAIN = 2
const STORM = 3
const CLOUDS = [2, 5, 7, 8]
const BIRD_UP = ['b.b', '.b.']
const BIRD_DOWN = ['...', 'bbb']

export const sky: Scene = (c, m) => {
  const timeOfDay = pick(m.seed, 1, 3)
  const time = TIMES[timeOfDay]!
  const isNight = timeOfDay === 2
  const weather = pick(m.seed, 2, 4)
  const isWet = weather >= RAIN
  gradient(c, isWet ? mix(time.top, 0x404650, 0.5) : time.top, time.bottom)

  // Stars on a dry night, twinkling.
  if (isNight && !isWet) {
    for (let i = 0; i < c.W / 3; i++) {
      put(c, Math.floor(rnd(m.seed, 100 + i) * c.W), Math.floor(rnd(m.seed, 200 + i) * 9), mix(0x40445a, 0xffffff, wave(m.t + i * 397, 1800)))
    }
  }

  // The sun or moon, glowing while Claude writes; a storm hides it.
  const lx = Math.floor(c.W * (0.6 + rnd(m.seed, 3) * 0.3))
  if (weather !== STORM) {
    if (m.state === 'say') disc(c, lx, 4, 4, mix(time.light, time.bottom, 0.6))
    disc(c, lx, 4, 2, time.light)
  }

  // Far hills, slow.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist * 0.2
    const h = 3 + Math.round(2 * Math.sin(u / 9 + m.seed) + Math.sin(u / 4))
    rect(c, x, PH - 3 - h, 1, h, time.far)
  }

  // Clouds, more of them the worse the weather.
  const grey = isWet ? 0x8a8f99 : isNight ? 0x3a4058 : 0xf4f6fa
  for (let i = 0; i < CLOUDS[weather]!; i++) {
    const w = 6 + pick(m.seed, 300 + i, 8)
    const x = mod(Math.floor(rnd(m.seed, 310 + i) * c.W * 2 - m.dist * (0.6 + rnd(m.seed, 320 + i) * 0.6)), c.W + w * 2) - w
    const y = 1 + pick(m.seed, 330 + i, 5)
    rect(c, x, y + 1, w, 2, grey)
    rect(c, x + 2, y, w - 4, 1, grey)
  }

  // Near hills, at the turn's pace.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist
    const h = 2 + Math.round(Math.sin(u / 6 + m.seed * 3) + 0.5 * Math.sin(u / 2.5))
    rect(c, x, PH - h, 1, h, time.hill)
  }

  // Rain, heavier and slanting while a tool runs; lightning in a storm.
  if (isWet) {
    const isBusy = m.state === 'tool'
    const drops = Math.floor(c.W * (isBusy ? 0.8 : 0.35))
    for (let i = 0; i < drops; i++) {
      const fall = m.t * (0.02 + rnd(m.seed, 500 + i) * 0.01)
      const y = mod(Math.floor(rnd(m.seed, 510 + i) * PH + fall), PH)
      const x = mod(Math.floor(rnd(m.seed, 520 + i) * c.W - (isBusy ? fall * 0.5 : 0)), c.W)
      put(c, x, y, 0x9ec9ff)
    }
    if (weather === STORM && isBusy && mod(Math.floor(m.t / 90), 23) === 0) {
      for (let i = 0; i < c.px.length; i++) c.px[i] = mix(c.px[i]!, 0xffffff, 0.6)
    }
  }

  // A bird crosses while Claude writes; a clear day gets a second one.
  if (m.state === 'say') {
    const birds = weather === CLEAR && !isNight ? 2 : 1
    for (let b = 0; b < birds; b++) {
      const x = mod(Math.floor(m.t * 0.02) - b * 9, c.W + 6) - 3
      const y = 6 + b * 2 + Math.round(Math.sin(m.t / 400 + b))
      const isUp = Math.floor(m.t / 200 + b) % 2 === 0
      sprite(c, isUp ? BIRD_UP : BIRD_DOWN, { b: isNight ? 0xcfd3e0 : 0x2a2a35 }, x, y)
    }
  }
}
