// Theme: frogger. Its scene, its words and its pet.
//
// The scene: a frog (#80b918) crossing a lane per task (four at most: road nearest, river beyond, the
// arcade's purple verge past the last; all four with no tasks) from the verge at the bottom left, a lane
// higher per `done`, climbing a pixel a frame; home on a lily pad. Each lane drifts by `t` alone (trucks,
// cars, logs, ripples). It blinks and breathes, rises to ask, croaks, hops in place on a four-frame arc
// in a tool (spraying the tool's colour; every arc on bash), a sign right of it. A truck per agent in the
// nearest lane, the newest flashing and honking. testFail squashes it flat, fades it out and back; testPass
// flashes it gold; a commit brings a lily pad and a fly, its tongue out twelve frames.
//
// Motion rules (tests/scenes.test.ts): every pixel row is filled across the width, so each row is one run and
// movers change colour only; the one hole is the sign's box (blanks on the lane's colour), its text left-aligned,
// its length changing every frame, its last column clear, so no frame holds and no edge moves.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Kind = 'road' | 'water' | 'bank'

const MAX_LANES = 4, MAX_AGENTS = 4
const FROG_X = 2, FROG_W = 5
const BANK_W = FROG_X + FROG_W + 1
const SIGN_X = FROG_X + FROG_W + 3, SIGN_W = 4
const TRUCK_W = 6
const CAR_PITCH = 11, LOG_PITCH = 13
/** Each band's drift, nearest first: its direction and frames a cell (the logs a cell a frame in band 2). */
const DRIFT: readonly (readonly [dir: number, every: number])[] = [[1, 2], [-1, 1], [1, 1], [-1, 2]]
const BREATH = 16, BLINK = 12
const ARC = [0, 1, 1, 0]
const TURN_FRAMES = 4
const GREET_FRAMES = 8
const LAND_FRAMES = 6
const FLAT_FRAMES = 8, FADE_FRAMES = 10
const FAIL_FRAMES = FLAT_FRAMES + 2 * FADE_FRAMES
const PASS_FRAMES = 16
const TONGUE_AT = 4, TONGUE_FRAMES = 12
const COMMIT_FRAMES = 28
const DONE_FLASH_FRAMES = 8, DONE_ROLL_FRAMES = 16

const GREEN = '#80b918'
const GREEN_DARK = '#55a630'
const EYE = '#e9f5a1'
const THROAT = '#d9ed92'
const TONGUE = '#ff5d8f'
const WATER = '#2b6c9e', WATER_DEEP = '#245d8a', RIPPLE = '#6fb1e0'
const LOG = '#9c6644', LOG_DARK = '#7f5539', LOG_END = '#ddb892'
const ASPHALT = '#45475a'
const DASH = '#a9adc1'
const SLAB = '#7b5ea7', SLAB_DARK = '#5e4687', SEAM = '#9a7fc4'
const PAD = '#2d9a4e'
const FLY = '#d0d0d0'
const CAB = '#e0e1dd', GLASS = '#a9def9', LAMP = '#fff3b0'
const WHITE = '#ffffff'
const GOLD = '#ffd60a'
const GREY = '#8d99ae'
const SIGN = '#e9ecef'
const PALETTE = [GREEN, GOLD, '#4cc9f0', TONGUE, '#f9c74f']
const CARS = ['#f94144', '#f9c74f', '#f3722c', '#4cc9f0', '#f72585']
const HUES = ['#4cc9f0', '#b388eb', '#ff9e64', '#f72585']
const TOOL_COLOR: Record<ToolKind, string> = {
  bash: '#f94144', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#b388eb', web: '#7aa2f7',
  other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** The frog, 5×2 from above: eyes either side of its head over a body with legs at the corners. */
const FROG = ['.EGE.', 'DGGGD']
const FROG_BLINK = ['.GGG.', 'DGGGD']
const FROG_PUFF = ['.EGE.', 'DGTGD']
const FROG_HOP = ['DEGED', 'D...D']
const FROG_CROUCH = ['.....', 'DEGED']
const FROG_SHOCK = ['.WGW.', 'DGGGD']
const FLAT = ['DDDDDDD']
/** Cars and trucks, facing right; mirrored for the lanes that drift left. */
const CAR = ['.BW', 'BBL']
const TRUCK = ['TTTTCW', 'TTTTCL']
const mirror = (art: readonly string[]) => art.map(l => [...l].reverse().join(''))

/** `a` toward `b` by `u` in [0, 1]. */
function mix(a: string, b: string, u: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16)
  const v = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * Math.max(0, Math.min(1, u)))
  return `#${[0, 1, 2].map(i => v(i).toString(16).padStart(2, '0')).join('')}`
}

/** Band `k`'s kind with `n` lanes: the nearest a road, the far half river, verge past the last. */
function kindOf(k: number, n: number): Kind {
  if (k >= n) return 'bank'
  if (k === 0) return 'road'
  return k >= Math.max(1, Math.floor(n / 2)) ? 'water' : 'road'
}
const topOf = (k: number) => 6 - 2 * k
const offOf = (t: number, k: number) => DRIFT[k]![0] * Math.floor(t / DRIFT[k]![1])

/** A verge cell, the arcade's purple pavement: slabs with a lighter seam every third column. */
function verge(cv: Canvas, x: number, y: number): void {
  plot(cv, x, y, mod(x, 3) === 0 ? SEAM : SLAB)
  plot(cv, x, y + 1, SLAB_DARK)
}

/** A river lane: logs of four to eight cells, ringed ends, ripples between, all drifting together. */
function river(cv: Canvas, t: number, k: number): void {
  const y = topOf(k)
  const off = offOf(t, k)
  for (let x = 0; x < cv.w; x++) {
    const u = x - off
    const p = mod(u, LOG_PITCH)
    const len = 4 + Math.floor(noise(Math.floor(u / LOG_PITCH) * 5 + k * 11) * 5)
    if (p < len) {
      plot(cv, x, y, p === 0 || p === len - 1 ? LOG_END : LOG)
      plot(cv, x, y + 1, LOG_DARK)
    } else {
      plot(cv, x, y, mod(u + 2 * k, 5) === 0 ? RIPPLE : WATER)
      plot(cv, x, y + 1, WATER_DEEP)
    }
  }
}

/** A road lane: asphalt, a dashed line along the top of the nearest under another road, cars in slots. */
function road(cv: Canvas, t: number, k: number, dashed: boolean): void {
  const y = topOf(k)
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, y, dashed && mod(x, 4) < 2 ? DASH : ASPHALT)
    plot(cv, x, y + 1, ASPHALT)
  }
  if (k === 0) return
  const off = offOf(t, k)
  const art = DRIFT[k]![0] > 0 ? CAR : mirror(CAR)
  for (let slot = Math.floor(-off / CAR_PITCH) - 1; slot * CAR_PITCH + off < cv.w; slot++) {
    if (noise(slot * 7 + k) < 0.3) continue
    draw(cv, slot * CAR_PITCH + off, y, art, { B: frame(CARS, slot), W: GLASS, L: LAMP })
  }
}

/** The nearest lane's traffic: a truck per agent at fixed slots a quarter of a lap apart, two cars between,
 * each wrapping on the lap itself (out past the right edge, back off the left, behind the start bank); the
 * newest truck flashes white and lights its lamp as it joins (and again, harmlessly, when one leaves). */
function traffic(cv: Canvas, t: number, s: Signals): number | undefined {
  const lap = cv.w + TRUCK_W
  const pitch = Math.floor(lap / MAX_AGENTS)
  const at = (j: number, half = 0) => mod(offOf(t, 0) + j * pitch + half, lap) - TRUCK_W
  for (const j of [0, 2]) draw(cv, at(j, pitch >> 1), 6, CAR, { B: frame(CARS, j + 2), W: GLASS, L: LAMP })
  const n = Math.min(s.agents, MAX_AGENTS)
  let honk: number | undefined
  for (let i = 0; i < n; i++) {
    const greet = i === n - 1 && s.agentsAge < GREET_FRAMES
    const flash = greet && mod(s.agentsAge, 2) === 0
    draw(cv, at(i), 6, TRUCK, { T: flash ? WHITE : HUES[i]!, C: CAB, W: GLASS, L: greet ? WHITE : LAMP })
    if (greet) honk = at(i) + TRUCK_W
  }
  return honk
}

/** The frog's lane from `done`: none crossed while there are no tasks, floor-scaled past four. */
function laneOf(done: number, total: number, n: number): number {
  if (total === 0) return 0
  return Math.max(0, total > n ? Math.floor(done * n / total) : Math.min(done, n))
}

type Look = { art: readonly string[]; lift: number; dx: number; c: Record<string, string> }
const COLORS = { G: GREEN, D: GREEN_DARK, E: EYE, T: THROAT, W: WHITE }
const pose = (art: readonly string[], lift = 0, c: Record<string, string> = COLORS, dx = 0): Look =>
  ({ art, lift, dx, c })

/** The frog's art and colours at `t`: the news first, then the act (a crouch while it turns). */
function frogLook(t: number, s: Signals, laneColor: string): Look {
  const a = s.newsAge
  if (s.news === 'testFail' && a < FAIL_FRAMES) {
    if (a < 6) return pose(a < 3 ? FROG_SHOCK : FROG_CROUCH)
    const u = (a - FLAT_FRAMES - FADE_FRAMES + 1) / FADE_FRAMES
    if (u <= 0) return pose(FLAT, 0, { D: mix(GREEN_DARK, laneColor, (a - FLAT_FRAMES) / FADE_FRAMES) }, -1)
    return pose(FROG, 0, Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, mix(laneColor, v, u)])))
  }
  if (s.news === 'testPass' && a < PASS_FRAMES) {
    const lift = ARC[mod(t, 4)]!
    return pose(lift ? FROG_HOP : FROG, lift, mod(t, 2) === 0 ? { ...COLORS, G: GOLD, D: GOLD, E: WHITE } : COLORS)
  }
  const gulp = a - TONGUE_AT - TONGUE_FRAMES
  if (s.news === 'commit' && gulp >= 0 && gulp < 4) return pose(FROG_PUFF)
  if (Math.min(s.actAge, s.toolAge) < TURN_FRAMES) return pose(FROG_CROUCH)
  if (s.act === 'tool') {
    const phase = mod(t, s.tool === 'bash' ? 4 : 8)
    const lift = phase < 4 ? ARC[phase]! : 0
    return pose(lift ? FROG_HOP : FROG, lift)
  }
  const blink = mod(t, BLINK) === 0
  if (s.act === 'say') return pose(mod(t, 4) < 2 ? FROG_PUFF : blink ? FROG_BLINK : FROG)
  const puff = s.act !== 'ask' && mod(t, BREATH) >= BREATH - 4
  return pose(blink ? FROG_BLINK : puff ? FROG_PUFF : FROG, s.act === 'ask' && mod(t, 12) < 6 ? 1 : 0)
}

/** The sign right of the frog: the news first, else the act, dots while it turns. Its length changes every
 * frame (one, two, three cells, left-aligned), so its ink is never the same twice running. */
function sign(t: number, s: Signals): { text: string; c: string } {
  if (s.news === 'testFail' && s.newsAge < FAIL_FRAMES) return { text: frame(['×', '×·'], t), c: GREY }
  if (s.news === 'testPass' && s.newsAge < PASS_FRAMES) return { text: frame(['★', '★·', '☆', '☆·'], t), c: GOLD }
  if (s.news === 'commit' && s.newsAge < COMMIT_FRAMES) return { text: frame(['✓', '✓·'], t), c: GOLD }
  if (Math.min(s.actAge, s.toolAge) < TURN_FRAMES) return { text: frame(['·', '··'], t), c: SIGN }
  const tool = s.tool ?? 'other'
  if (s.act === 'tool') return { text: TOOL_SIGN[tool] + frame(['', '·'], t), c: TOOL_COLOR[tool] }
  if (s.act === 'ask') return { text: frame(['?', '?·', '?', '·?'], t), c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♪♫', '♫', '♫♪'], t), c: GREEN }
  if (s.act === 'think') return { text: frame(['·', '··', '···', '··'], t), c: SIGN }
  return { text: frame(['.', '..', '...', '..'], t), c: SIGN }
}

export function froggerScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const n = s.total > 0 ? Math.min(s.total, MAX_LANES) : MAX_LANES
  const kinds = [0, 1, 2, 3].map(k => kindOf(k, n))
  // Layers 1–2: the lanes, nearest first, each drifting by `t` alone; the nearest one's trucks and cars.
  kinds.forEach((kind, k) => {
    if (kind === 'water') river(cv, t, k)
    else if (kind === 'road') road(cv, t, k, k === 0 && kinds[1] === 'road')
    else for (let x = 0; x < w; x++) verge(cv, x, topOf(k))
  })
  const honk = traffic(cv, t, s)
  for (let x = 0; x < Math.min(w, BANK_W); x++) verge(cv, x, topOf(0))

  // Layer 3: the frog, a lane higher per `done` (a pixel a frame up from the last lane), home on a pad.
  const lane = laneOf(s.done, s.total, n)
  const band = Math.min(lane, MAX_LANES - 1)
  const from = Math.min(laneOf(s.done - 1, s.total, n), MAX_LANES - 1)
  const yTo = topOf(band)
  const y = from < band ? Math.max(yTo, topOf(from) - s.doneAge) : yTo
  const laneColor = { water: WATER, road: ASPHALT, bank: SLAB }[kinds[band]!]
  const allDone = s.total > 0 && s.done >= s.total
  if (allDone && lane >= MAX_LANES) draw(cv, FROG_X - 1, yTo + 1, ['PPPPPPP'], { P: PAD })
  const look = frogLook(t, s, laneColor)
  if (allDone && s.doneAge < DONE_ROLL_FRAMES) look.c = { ...look.c, G: frame(PALETTE, s.doneAge >> 1) }
  // Its hop and rise: a pixel up (a dip in the top band, so it stays whole), none while climbing or catching.
  const lift = y !== yTo || (s.news === 'commit' && s.newsAge < COMMIT_FRAMES) ? 0 : look.lift
  const fy = y - lift < 0 ? y + lift : y - lift
  draw(cv, FROG_X + look.dx, fy + (look.art.length === 1 ? 1 : 0), look.art, look.c)
  // Its splashes: the tool's colour either side as it lands, a ring spreading as it reaches a lane.
  const tool = s.act === 'tool' && Math.min(s.actAge, s.toolAge) >= TURN_FRAMES && !s.news
  if (tool && lift === 0 && mod(t - 3, s.tool === 'bash' ? 4 : 8) < 2) {
    for (const x of [FROG_X - 1, FROG_X + FROG_W]) plot(cv, x, y + 1, TOOL_COLOR[s.tool ?? 'other'])
  }
  const land = s.doneAge - 2 * (band - from)
  if (from < band && land >= 0 && land < LAND_FRAMES) {
    plot(cv, FROG_X - 1 - (land >> 1), y + 1, RIPPLE)
    plot(cv, FROG_X + FROG_W + (land >> 1), y + 1, mod(land, 2) === 0 ? WHITE : RIPPLE)
  }
  // The commit: a lily pad beside it (above; below at the top), a fly over it, the tongue out twelve frames.
  if (s.news === 'commit' && s.newsAge < COMMIT_FRAMES) {
    const up = band < MAX_LANES - 1 ? -1 : 1
    const padY = up < 0 ? y - 1 : y + 2
    const r = Math.min(2, s.newsAge)
    draw(cv, FROG_X + 2 - r, padY, ['PPPPP'.slice(0, 2 * r + 1)], { P: PAD })
    const ta = s.newsAge - TONGUE_AT
    const reach = ta >= 0 && ta < TONGUE_FRAMES ? (ta < 2 || ta >= TONGUE_FRAMES - 2 ? 1 : 2) : 0
    for (let i = 0; i < reach; i++) plot(cv, FROG_X + 2, padY + up * i, TONGUE)
    if (ta < 2) plot(cv, FROG_X + 2 + frame([0, 1, 0, -1], t), padY + up, FLY)
    else if (ta < TONGUE_FRAMES) plot(cv, FROG_X + 2, padY + up * (reach - 1), FLY)
  }

  const g = cells(cv)
  const bgAt = (x: number, row: number) => g[row]![x]!.bg ?? g[row]![x]!.c
  if (honk !== undefined && honk < w) {
    put(g, honk, 2, mod(s.agentsAge, 4) < 2 ? '!' : '♪', { c: GOLD, b: true, bg: bgAt(honk, 2) })
  }
  // The readout along the top right, over the lane; it yields to the sign when they would meet.
  const signRow = Math.floor((y + 1) / 2)
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const rx = w - readout.length
  if (readout && (signRow !== 0 || rx > SIGN_X + SIGN_W)) {
    const flash = s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0
    put(g, rx, 0, readout, { c: flash ? WHITE : allDone ? GOLD : SIGN, b: true, bg: bgAt(rx, 0) })
  }
  // The sign's box: cleared, then its text from the left.
  for (let x = SIGN_X; x < Math.min(w, SIGN_X + SIGN_W); x++) g[signRow]![x] = { ch: ' ', bg: bgAt(x, signRow) }
  const { text, c } = sign(t, s)
  put(g, SIGN_X, signRow, text, { c, b: s.act !== 'think' || !!s.news, bg: g[signRow]![SIGN_X]?.bg })
  return g
}

/** A frog sitting up: white eyes bulging on top, a wide smile, a pale throat, its feet splayed. */
export const PET: PetArt = {
  body: ['.WWW....WWW.', 'GWWWGGGGWWWG', 'GGDDDDDDDDGG', '.GGTTTTTTGG.', 'DD.D....D.DD'],
  step: ['.WWW....WWW.', 'GWWWGGGGWWWG', 'GGDDDDDDDDGG', '.GGTTTTTTGG.', '.DD.D..D.DD.'],
  colors: { G: GREEN, T: THROAT, D: GREEN_DARK, W: WHITE },
  eyes: [2, 9], eyeRow: 0, eye: '#1d1d1d', lid: GREEN,
  mouth: [5, 2], blush: '#ff8fab', spark: GOLD,
}

export const FROGGER: Theme = {
  name: 'frogger',
  rows: SCENE_ROWS,
  color: GREEN,
  accent: GOLD,
  sprite: {
    think: ['•ᴗ•  ', '•ᴗ• ·', '•ᴗ•··', '-ᴗ- ·'],
    tool: ['•ᴗ•  ', ' •ᴗ• ', '  •ᴗ•', ' •ᴗ• '],
    say: ['•o• ♪', '•ᴗ• ♫'],
    wait: ['•ᴗ• .', '•ᴗ• ..', '•ᴗ• ...'],
  },
  happy: '•ᴗ• ★',
  sad: '•_• …',
  dead: 'x_x',
  sleep: '-ᴗ- zZ',
  confetti: ['●', '○', '·', '✦'],
  palette: PALETTE,
  scene: froggerScene,
  pet: PET,
}
