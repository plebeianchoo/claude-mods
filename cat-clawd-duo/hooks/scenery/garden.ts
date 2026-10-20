// Garden: a Japanese garden in spring, sakura in bloom over a pond, torii
// gates and a pagoda beyond, hills far off, all drifting at the turn's pace,
// by day or at dusk with the lanterns lit. Petals fall; a gust streams them
// sideways while a tool runs and Clawd, in a kasa, sweeps them up; a crane
// glides past while Claude writes and he strolls under a paper parasol.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Canvas, type Moment, type Scene } from './pixels'
import { handle, visitor, type Outfit, type Visit } from './visitor'

const TIMES = [
  { top: 0x8ccfff, bottom: 0xfff0f5, hill: 0x7fb59a, far: 0xa9cfc0, pond: 0x7fb8d6, path: 0x9a9aa0, pagoda: 0x4a4a5c, light: 0xfff3a0, lantern: 0xd8d8dc }, // spring day
  { top: 0x2b1b4f, bottom: 0xf08a9b, hill: 0x3d4a5a, far: 0x5a5a7a, pond: 0x3a4a7a, path: 0x5a5a66, pagoda: 0x1e1e2a, light: 0xff9e3d, lantern: 0xffd27a }, // dusk, lanterns lit
] as const
const VERMILION = 0xc1121f
const BLOSSOM = 0xffb7c5
const BLOSSOM_LIGHT = 0xffd6e0
const PETAL = 0xff9fb5
const TRUNK = 0x5a3a22
const STRAW = 0xe9c46a
const STRAW_DARK = 0xc9a24a
const KOI = 0xff7b00
const CRANE = ['WWW.....', '..WWWWbb', 'bWWWWW..', '...r....']

/** A torii: two posts and two crossbeams, the top one wider. */
function torii(c: Canvas, x: number, base: number) {
  rect(c, x + 1, base - 9, 2, 9, VERMILION)
  rect(c, x + 11, base - 9, 2, 9, VERMILION)
  rect(c, x - 1, base - 10, 16, 1, VERMILION)
  rect(c, x, base - 11, 14, 1, mix(VERMILION, 0x000000, 0.3))
  rect(c, x + 1, base - 7, 12, 1, VERMILION)
}

/** A pagoda silhouette: three tiers of roof, each wider than the one above, their eaves turned up. */
function pagoda(c: Canvas, x: number, base: number, colour: number) {
  const wall = mix(colour, 0xffffff, 0.25)
  rect(c, x + 5, base - 12, 4, 12, wall)
  for (let t = 0; t < 3; t++) {
    const y = base - 10 + t * 4
    const half = 4 + t * 2
    rect(c, x + 7 - half, y, half * 2 + 1, 1, colour)
    put(c, x + 7 - half - 1, y - 1, colour)
    put(c, x + 7 + half + 1, y - 1, colour)
    rect(c, x + 6, y + 1, 2, 1, colour)
  }
  put(c, x + 7, base - 13, colour)
  put(c, x + 7, base - 14, colour)
}

/** A sakura: a trunk and a round canopy of blossom, swaying in a gust. */
function sakura(c: Canvas, x: number, base: number, r: number, sway: number) {
  rect(c, x - 1, base - r - 3, 2, r + 3, TRUNK)
  put(c, x + 1, base - r - 2, TRUNK)
  disc(c, x + sway, base - r - 4, r, BLOSSOM)
  disc(c, x + sway - 1, base - r - 5, Math.max(1, r - 2), BLOSSOM_LIGHT)
}

/** A kasa: a wide straw cone over his head. */
function kasa(c: Canvas, v: Visit) {
  const { x, y } = v.head
  rect(c, x + 1, y - 1, 12, 1, STRAW)
  for (let i = 1; i < 12; i += 2) put(c, x + i, y - 1, STRAW_DARK)
  rect(c, x + 4, y - 2, 6, 1, STRAW)
  rect(c, x + 6, y - 3, 2, 1, STRAW_DARK)
}

/** The broom he sweeps with while a tool runs, side to side, petals heaped at its bristles. */
function sweeping(c: Canvas, v: Visit, m: Moment) {
  if (v.pose !== 'pan') return
  const swing = Math.round(Math.sin(m.t / 300) * 2)
  const [bx, by] = handle(c, [v.hand[0] + v.facing * swing, v.hand[1]], v.facing, 1, 3, TRUNK)
  rect(c, bx + (v.facing > 0 ? 0 : -1), by, 2, 2, STRAW)
  const heap = v.x + (v.facing > 0 ? 20 : -5)
  rect(c, heap, PH - 3, 3, 1, PETAL)
  put(c, heap + 1, PH - 4, BLOSSOM)
}

/** A paper parasol held high over him on his stroll, spokes showing, its handle slanting down to his hand. */
function parasol(c: Canvas, v: Visit) {
  if (v.pose !== 'walk') return
  const [hx, hy] = v.hand
  const top = v.head.y - 7
  const cx = hx - v.facing * 4
  rect(c, cx - 7, top + 2, 15, 1, VERMILION)
  rect(c, cx - 5, top + 1, 11, 1, VERMILION)
  rect(c, cx - 2, top, 5, 1, VERMILION)
  for (let i = -6; i <= 6; i += 3) put(c, cx + i, top + 2, BLOSSOM_LIGHT)
  const [jx, jy] = handle(c, [hx, hy], -v.facing, -1, 3, TRUNK)
  for (let y = top + 3; y < jy; y++) put(c, jx - v.facing, y, TRUNK)
}

/** A crane gliding right to left, wings slowly beating. */
function crane(c: Canvas, m: Moment) {
  const x = c.W - mod(Math.floor(m.t * 0.016), c.W + 16) + 4
  const y = 2 + Math.round(Math.sin(m.t / 700))
  const flap = Math.floor(m.t / 350) % 2
  const art = flap ? CRANE : [CRANE[1]!, CRANE[0]!, CRANE[2]!, CRANE[3]!]
  sprite(c, art, { W: 0xffffff, b: 0x1a1a1a, r: 0xe63946 }, x, y)
}

const SWEEPER: Outfit = { job: 'pan', dress: (c, v, m) => (kasa(c, v), sweeping(c, v, m), parasol(c, v)) }

export const garden: Scene = (c, m) => {
  const time = TIMES[pick(m.seed, 1, 3) === 2 ? 1 : 0]!
  const isDusk = time === TIMES[1]
  const isGust = m.state === 'tool'
  const BANK = PH - 4 // the pond's far bank: the trees and gates stand on it
  gradient(c, time.top, time.bottom)

  // The sun or moon, glowing while Claude writes.
  const lx = Math.floor(c.W * (0.55 + rnd(m.seed, 3) * 0.35))
  if (m.state === 'say') disc(c, lx, 4, 4, mix(time.light, time.bottom, 0.6))
  disc(c, lx, 4, 2, time.light)

  // Far hills, slow and soft.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist * 0.2
    const h = 4 + Math.round(2 * Math.sin(u / 12 + m.seed) + Math.sin(u / 5))
    rect(c, x, BANK - h, 1, h, time.far)
    const h2 = 2 + Math.round(1.5 * Math.sin(u / 7 + m.seed * 2))
    rect(c, x, BANK - h2, 1, h2, time.hill)
  }

  // Pagodas beyond the bank, at a middle pace.
  const mid = Math.floor(m.dist * 0.6)
  for (let b = Math.floor(mid / 72) - 1; b <= Math.floor((mid + c.W) / 72) + 1; b++) pagoda(c, b * 72 + pick(m.seed, 3000 + b, 40) - mid, BANK, time.pagoda)

  // Sakura on the bank, at the turn's pace, swaying in a gust; a torii in front of them every so often, lanterns hung from it.
  const off = Math.floor(m.dist)
  for (let b = Math.floor(off / 16) - 1; b <= Math.floor((off + c.W) / 16) + 1; b++) {
    const x = b * 16 + pick(m.seed, 2000 + b, 6) - off
    const sway = isGust ? Math.round(Math.sin(m.t / 250 + b)) : 0
    sakura(c, x, BANK, 3, sway)
  }
  for (let b = Math.floor(off / 60) - 1; b <= Math.floor((off + c.W) / 60) + 1; b++) {
    const gx = b * 60 + 20 - off
    torii(c, gx, BANK)
    for (const lxx of [gx + 4, gx + 9]) {
      rect(c, lxx, BANK - 6, 2, 2, time.lantern)
      if (isDusk) {
        const glow = 0.25 + 0.2 * wave(m.t + lxx * 90, 1600)
        for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 3; dx++) {
          const px = lxx + dx, py = BANK - 6 + dy
          if (px >= 0 && px < c.W && py >= 0 && py < PH && Math.abs(dx) + Math.abs(dy) < 4) c.px[py * c.W + px] = mix(c.px[py * c.W + px]!, time.lantern, glow)
        }
      }
    }
  }

  // The pond, with koi, and the stone path along it.
  rect(c, 0, BANK, c.W, 2, time.pond)
  for (let x = 0; x < c.W; x++) if (mod(x + Math.floor(m.t / 200), 9) === 0) put(c, x, BANK, mix(time.pond, 0xffffff, 0.3))
  for (let i = 0; i < 3; i++) {
    const kx = mod(Math.floor(rnd(m.seed, 400 + i) * c.W * 2 - m.dist + Math.sin(m.t / 900 + i) * 4), c.W + 4) - 2
    rect(c, kx, BANK + 1, 2, 1, i === 0 ? 0xffffff : KOI)
    put(c, kx + 2, BANK + 1, i === 0 ? KOI : 0xffffff)
  }
  rect(c, 0, PH - 2, c.W, 2, time.path)
  for (let x = 0; x < c.W; x++) if (mod(x + off, 4) === 0) put(c, x, PH - 1, mix(time.path, 0x000000, 0.2))

  // The crane while Claude writes.
  if (m.state === 'say') crane(c, m)

  // Clawd on the path.
  visitor(c, m, SWEEPER)

  // Petals: drifting down, or streaming sideways in a gust.
  const petals = Math.floor(c.W * (isGust ? 0.6 : 0.3))
  for (let i = 0; i < petals; i++) {
    const fall = m.t * (0.004 + rnd(m.seed, 500 + i) * 0.003)
    const y = mod(Math.floor(rnd(m.seed, 510 + i) * PH + fall), PH)
    const drift = isGust ? fall * 2.5 : Math.sin(m.t / 500 + i) * 2
    const x = mod(Math.floor(rnd(m.seed, 520 + i) * c.W + drift), c.W)
    put(c, x, y, i % 3 ? PETAL : BLOSSOM_LIGHT)
  }
}
