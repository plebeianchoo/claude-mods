// Theme: aquarium. Its scene, its words and its pet.
//
// The scene: a tank (#4895ef): a rippling surface, water shading darker to the sand, kelp swaying at the back,
// a treasure chest at the left under the act's sign and the readout, an airstone's sparse bubble column, a
// clownfish crossing the tank and a fish per agent (four at most, each its own shape) in its own slot from the
// right. A pearl per task in the sand (floor-scaled), lit when done; the chest opens and coins float up as one
// lands. Thinking, a snail crawls the floor; a tool sends up a bubble curtain in its colour (bash densest);
// asking, the clownfish blows a big bubble; saying, a string; waiting, it sinks and dozes. testFail clouds the
// water and the fish dart; testPass flashes them gold; a commit lowers a diver on a hose, torch on the chest.
// Motion rules: the water rows are full, so movers there change colour only (checked by shape in the dump);
// row 0's run starts are the surface's troughs, drifting left a cell every other frame in alternate pairs (one
// moves every frame), in from the right edge and gone under the sign's zone at the left, where the diver dives.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>
type Fish = { art: readonly string[]; ink: Ink }

/** Pixel rows: the surface, the lowest water row, the sand. */
const [SURFACE_Y, FLOOR_Y, SAND_Y] = [1, 6, 7]
/** Columns: the chest, the sign and readout over it, the diver beside it, where the troughs may start. */
const [CHEST_X, SIGN_X, READOUT_X, DIVER_X, ZONE_MIN] = [2, 1, 4, 9, 14]
/** Columns: the airstone, the first pearl, the curtain, the clownfish's left end; a fish's slot; trough spacing. */
const [AIR_X, PEARL_X, STREAM_X, HOST_X, SLOT, MAX_AGENTS, TROUGH_PITCH] = [15, 9, 18, 13, 9, 4, 8]
/** Frames: an act's turn, a fish's greeting, the chest open, the cloud, the dart's settling, a pass's flash. */
const [TURN_FRAMES, GREET_FRAMES, OPEN_FRAMES, CLOUD_FRAMES, SETTLE_FRAMES, PASS_FRAMES] = [4, 8, 16, 16, 30, 16]
/** The diver's top row: in from y = -4 a pixel a frame to the floor, the torch sweeping, back up from UP_AT. */
const [DIVER_TOP, DIVER_FLOOR, UP_AT] = [-4, 3, 20]
/** A startled fish's offset from its path, a cell a frame: out ahead and back past. */
const DART = [0, 1, 2, 3, 3, 2, 1, 0, -1, -1, 0]
const [SURFACE, GLINT, MURK, BUBBLE] = ['#4895ef', '#9dcbff', '#7d8a6a', '#cfeaff']
const WATER = ['#2f6fa8', '#2a659a', '#255b8c', '#21527f', '#1e4a74']
const SAND = ['#d4b483', '#c9a66b']
const KELP = ['#2d9a5e', '#52b788']
const [GOLD, WHITE, PEARL, SHELL, STONE, DIM] = ['#ffd60a', '#ffffff', '#f1f3f5', '#9c8466', '#8d99ae', '#9aa5b1']
const PALETTE = [SURFACE, '#ff8c42', GOLD, '#c77dff', '#52b788']
const TOOL_INK: Record<ToolKind, string> = {
  bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#a9c7ff', other: '#ff8fab',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦' }

/** The clownfish, facing right: a forked tail, orange with a white band, its eye and nose at the front. */
const [HOST, HOST_FLICK] = [['T.OWOO.', '.TOWOEO', 'T.OWOO.'], ['.TOWOO.', 'T.OWOEO', '.TOWOO.']]
const HOST_INK: Ink = { O: '#ff8c42', W: WHITE, T: '#ff6b1a', E: '#1d1d1d' }
/** The agents' fish, facing right, bottom-aligned on the floor row: a tetra, a puffer, an angelfish, a betta. */
const FISH: readonly Fish[] = [
  { art: ['T.BBBE', 'TTRRRR'], ink: { B: '#4cc9f0', R: '#ef476f', T: '#a9def9', E: '#1d1d1d' } },
  { art: ['.P.P.', 'TPSPE', '.PPP.'], ink: { P: '#ffd166', S: '#e09f3e', T: '#f9c74f', E: '#1d1d1d' } },
  { art: ['.A..', 'TASE', '.A..'], ink: { A: '#e9ecef', S: '#8d99ae', T: '#ced4da', E: '#1d1d1d' } },
  { art: ['TT...', 'TTBBE', 'TT...'], ink: { B: '#c77dff', T: '#e0aaff', E: '#1d1d1d' } },
]
const [SNAIL, SNAIL_STEP] = [['.SS.A', 'FssFF'], ['.SSA.', 'FssFF']]
const SNAIL_INK: Ink = { S: '#e76f51', s: '#f4a261', F: '#e9c46a', A: '#e9c46a' }
const [CHEST_SHUT, CHEST_OPEN] = [['.LLLL.', 'KKGKKK', 'BBBBBB'], ['.LLLL.', 'GgGgGG', 'KKGKKK', 'BBBBBB']]
const CHEST_INK: Ink = { L: '#b5651d', K: '#8b4513', B: '#a0522d', G: GOLD, g: '#fff3b0' }
const CHEST_LIT: Ink = { L: '#d9893b', K: '#b0662e', B: '#c47443', G: '#fff3b0', g: WHITE }
/** The diver, facing the chest: a round brass helmet with its porthole, the torch in hand, a red suit. */
const DIVER = ['.HH.', 'VHH.', 'YSSS', '.S.S']
const DIVER_INK: Ink = { H: '#ffc43d', V: '#cde8ff', Y: '#fff3b0', S: '#e5383b' }

const recolor = (ink: Ink, f: (c: string, k: string) => string): Ink =>
  Object.fromEntries(Object.entries(ink).map(([k, c]) => [k, f(c, k)]))
const flip = (art: readonly string[]) => art.map(r => [...r].reverse().join(''))
const hex = (h: string, i: number) => Number.parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
/** `a` blended `f` of the way to `b`. */
const mix = (a: string, b: string, f: number) =>
  '#' + [0, 1, 2].map(i => Math.round(hex(a, i) * (1 - f) + hex(b, i) * f).toString(16).padStart(2, '0')).join('')

/** A swimmer's offset along `range` cells and its heading: a cell every `every` frames, a `rest`-frame turn
 * at each end, facing about half way through it. */
function swim(t: number, range: number, every: number, rest: number): { dx: number; right: boolean } {
  const leg = range * every
  const p = mod(t, 2 * (leg + rest))
  if (p < leg) return { dx: Math.floor(p / every), right: true }
  if (p < leg + rest) return { dx: range, right: p < leg + rest / 2 }
  if (p < 2 * leg + rest) return { dx: range - Math.floor((p - leg - rest) / every), right: false }
  return { dx: 0, right: p >= 2 * leg + rest + rest / 2 }
}

/** Where a swimmer is `age` frames into a failed test: from where it was as the news landed it chases its
 * path plus the dart, a cell a frame at most, so it is back on its path for good well before SETTLE_FRAMES. */
function darted(at: (tt: number) => number, t: number, age: number, dir: number): number {
  if (age >= SETTLE_FRAMES) return at(t)
  let x = at(t - age)
  for (let a = 1; a <= age; a++) x += Math.sign(at(t - age + a) + dir * (DART[a] ?? 0) - x)
  return x
}

/** A swimmer this frame: its path's column, darting on a failed test, facing the way it moves. */
function swimmer(t: number, s: Signals, at: (tt: number) => number, right: (tt: number) => boolean) {
  if (s.news !== 'testFail' || s.newsAge >= SETTLE_FRAMES) return { x: at(t), right: right(t) }
  const dir = right(t - s.newsAge) ? 1 : -1
  const x = darted(at, t, s.newsAge, dir)
  const was = s.newsAge > 0 ? darted(at, t - 1, s.newsAge - 1, dir) : x
  return { x, right: x === was ? right(t) : x > was }
}

/** The surface along px 1, glints drifting right; troughs a cell wide drifting left (each a cell every other
 * frame, neighbours on alternate frames), a crest over the cells behind each, none left of `zone`. */
function surface(cv: Canvas, t: number, zone: number): void {
  for (let x = 0; x < cv.w; x++) plot(cv, x, SURFACE_Y, mod(x - (t >> 2), 11) === 0 ? GLINT : SURFACE)
  const n = 2 * Math.ceil((Math.ceil(cv.w / TROUGH_PITCH) + 1) / 2)
  for (let k = 0; k < n; k++) {
    const x = mod(k * TROUGH_PITCH + Math.floor(noise(k + 5) * 3) - ((t + (k & 1)) >> 1), n * TROUGH_PITCH)
    if (x < zone || x >= cv.w) continue
    cv.px[SURFACE_Y * cv.w + x] = undefined
    plot(cv, x + 2, 0, SURFACE)
    plot(cv, x + 3, 0, GLINT)
  }
}

/** The water shading down to the floor row, the sand under it, the kelp at the back swaying its top two pixels
 * a column either way on a 32-frame cycle, each strand on its own phase. */
function tank(cv: Canvas, t: number): void {
  for (let y = SURFACE_Y + 1; y <= FLOOR_Y; y++) for (let x = 0; x < cv.w; x++) plot(cv, x, y, WATER[y - 2]!)
  for (let x = 0; x < cv.w; x++) plot(cv, x, SAND_Y, SAND[noise(x + 9) < 0.7 ? 0 : 1]!)
  for (let i = 0; ; i++) {
    const x = AIR_X + 2 + i * 7 + Math.floor(noise(i + 40) * 3)
    if (x >= cv.w - 1) break
    const h = noise(i + 50) < 0.5 ? 3 : 4
    const sway = frame([0, 1, 1, 0, 0, -1, -1, 0], (t >> 2) + i * 3)
    for (let j = 0; j < h; j++) plot(cv, x + (j >= h - 2 ? sway : 0), FLOOR_Y - j, KELP[j & 1]!)
  }
  plot(cv, AIR_X, FLOOR_Y, STONE)
}

/** Bubbles up a column from `y0` a pixel a frame, one per `period`, wobbling; a trail behind each on a streak. */
function column(cv: Canvas, t: number, x: number, y0: number, period: number, ink: string, streak = false): void {
  for (let y = y0 - mod(t, period); y > SURFACE_Y; y -= period) {
    plot(cv, x + ((y >> 1) & 1), y, ink)
    if (streak && y + 1 <= y0) plot(cv, x + (((y + 1) >> 1) & 1), y + 1, mix(ink, WATER[y - 1] ?? ink, 0.5))
  }
}

/** The chest: shut, or open as a task lands (the lid lifts a pixel, gold glinting), four coins floating up a
 * pixel a frame and glinting on the surface; lit while the diver's torch is on it. */
function chest(cv: Canvas, t: number, s: Signals, lit: boolean): void {
  const ink = lit ? CHEST_LIT : CHEST_INK
  const age = s.doneAge
  const isOpen = s.done > 0 && age < OPEN_FRAMES && age >= 1 && age < OPEN_FRAMES - 1
  if (!isOpen) return draw(cv, CHEST_X, FLOOR_Y - 2, CHEST_SHUT, ink)
  draw(cv, CHEST_X, FLOOR_Y - 3, CHEST_OPEN, mod(t, 2) ? ink : { ...ink, g: GOLD, G: '#fff3b0' })
  for (let k = 0; k < 4; k++) {
    const y = FLOOR_Y - 3 - (age - 2 - 3 * k)
    if (y > FLOOR_Y - 3 || y < SURFACE_Y - 1) continue
    plot(cv, CHEST_X + 2 + (k & 1), Math.max(SURFACE_Y, y), y < SURFACE_Y ? WHITE : GOLD)
  }
}

/** The diver on a commit: down a pixel a frame on its hose to the floor beside the chest, its torch beam
 * sweeping the chest a row up and down (its row, -1 while none), then back up the same way, gone by frame 27. */
function diver(cv: Canvas, t: number, age: number): number {
  const top = age < UP_AT ? Math.min(DIVER_FLOOR, DIVER_TOP + age) : DIVER_FLOOR - (age - UP_AT)
  if (top <= DIVER_TOP) return -1
  for (let y = 0; y < top; y++) plot(cv, DIVER_X + 2, y, DIM)
  draw(cv, DIVER_X, top, DIVER, DIVER_INK)
  if (top !== DIVER_FLOOR) return -1
  column(cv, t, DIVER_X + 1, top - 1, 5, BUBBLE)
  return top + 2 + frame([0, -1, -1, 0, 1, 1], age >> 1)
}

/** The clownfish's act: a big bubble blown at its mouth (ask), three in a row every twelve frames (say), one in
 * sixteen (wait), each rising a pixel a frame from where the mouth was. */
function mouthBubbles(cv: Canvas, t: number, s: Signals, mouthAt: (tt: number) => readonly [number, number]): void {
  const every = s.act === 'say' || s.act === 'ask' ? 12 : s.act === 'wait' ? 16 : 0
  const phases = s.act === 'say' ? [0, 3, 6] : s.act === 'ask' ? [5] : [0]
  if (!every || s.actAge < TURN_FRAMES) return
  if (s.act === 'ask' && mod(t, 12) < 6) {
    const [mx, my] = mouthAt(t)
    plot(cv, mx, my, BUBBLE)
    if (mod(t, 12) >= 3) plot(cv, mx, my - 1, BUBBLE)
  }
  for (let rise = 1; rise <= 4; rise++) {
    const born = t - rise
    if (!phases.includes(mod(born, every)) || s.actAge - rise < TURN_FRAMES) continue
    const [mx, my] = mouthAt(born)
    if (my - rise > SURFACE_Y) plot(cv, mx, my - rise, BUBBLE)
  }
}

export function aquariumScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const [isTool, tool] = [s.act === 'tool', s.tool ?? 'other']
  const [isPass, isCommit] = [s.news === 'testPass' && s.newsAge < PASS_FRAMES, s.news === 'commit' && s.newsAge < 30]
  const age = Math.min(s.actAge, s.toolAge)
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  // Troughs keep clear of the sign, the readout and (from w = 32) the diver's way down.
  const zone = Math.max(w < 32 ? 0 : ZONE_MIN, READOUT_X + readout.length + 1)

  // Layer 1: the surface, the water, the sand and the kelp; the pearls in the sand, a task each.
  surface(cv, t, zone)
  tank(cv, t)
  const count = Math.min(s.total, Math.max(0, Math.floor((w - PEARL_X - 1) / 2)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  for (let j = 0; j < count; j++) {
    const isNew = j === lit - 1 && s.doneAge < GREET_FRAMES && lit > litOf(s.done - 1)
    plot(cv, PEARL_X + 2 * j, SAND_Y, j >= lit ? SHELL : isNew && mod(s.doneAge, 2) ? GOLD : PEARL)
  }
  // Layer 2: the bubbles: the airstone's column always, the tool's curtain (its colour; bash densest, streaked)
  // joining a column at a time over the act's first four frames (not the tool's: a tool change keeps it).
  column(cv, t, AIR_X, FLOOR_Y - 1, 6, BUBBLE)
  if (isTool) {
    for (let x = STREAM_X; x < w - 2; x += 3) {
      if (noise(x + 31) * TURN_FRAMES >= s.actAge + 1) continue
      column(cv, t + Math.floor(noise(x) * 8), x, FLOOR_Y, tool === 'bash' ? 3 : 6, TOOL_INK[tool], tool === 'bash')
    }
  }
  // Layer 3: the snail (thinking), crawling a cell every three frames from off the left to off the right,
  // fading in over the act's turn, behind the chest.
  if (s.act === 'think') {
    const x = mod(Math.floor(t / 3), w + 12) - 6
    const f = Math.min(1, (s.actAge + 1) / TURN_FRAMES)
    draw(cv, x, FLOOR_Y - 1, mod(t, 6) < 3 ? SNAIL : SNAIL_STEP, recolor(SNAIL_INK, c => mix(WATER[4]!, c, f)))
  }
  const beam = isCommit ? diver(cv, t, s.newsAge) : -1
  chest(cv, t, s, beam >= 0)
  for (let x = DIVER_X - 3; x < DIVER_X && beam >= 0; x++) plot(cv, x, beam, x === DIVER_X - 1 ? '#fff7cc' : '#ffe8a3')
  // The cloud on a failed test: the tank dims toward murk over four frames, holds, clears; the fish a little.
  const murk = s.news === 'testFail' && s.newsAge < CLOUD_FRAMES
    ? (0.6 * Math.min(s.newsAge + 1, TURN_FRAMES, CLOUD_FRAMES - s.newsAge)) / TURN_FRAMES : 0
  if (murk) for (let i = cv.w; i < cv.px.length; i++) if (cv.px[i]) cv.px[i] = mix(cv.px[i]!, MURK, murk)
  const dim = (ink: Ink): Ink => (murk ? recolor(ink, c => mix(c, MURK, murk / 3)) : ink)
  // Layer 4: the fish: one per agent in its slot from the right (the newest flashing white as it joins), the
  // clownfish across the tank; all gold on a pass.
  const n = Math.min(s.agents, MAX_AGENTS, Math.max(0, Math.floor((w - 4) / SLOT)))
  for (let i = 0; i < n; i++) {
    const { art, ink } = FISH[i]!
    const x0 = w - 1 - SLOT * (i + 1)
    const range = SLOT - art[0]!.length - 1
    const at = (tt: number) => x0 + swim(tt + 7 * i, range, 3, 4).dx
    const fish = swimmer(t, s, at, tt => swim(tt + 7 * i, range, 3, 4).right)
    const bob = mod(t + 5 * i, 20) < 10 ? 0 : 1
    const flash = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const tint = flash ? recolor(ink, () => WHITE) : isPass ? goldOf(ink, t) : ink
    draw(cv, fish.x, FLOOR_Y + 1 - art.length - bob, fish.right ? art : flip(art), dim(tint))
  }
  const L = Math.min(HOST_X, Math.max(0, w - 9))
  const range = Math.max(0, w - 9 - L)
  const hostAt = (tt: number) => L + swim(tt, range, 2, 6).dx
  const hostRight = (tt: number) => swim(tt, range, 2, 6).right
  const host = swimmer(t, s, hostAt, hostRight)
  const hy = SURFACE_Y + 1 + (s.act === 'wait' && s.actAge >= 2 ? 1 : 0)
  const flick = s.act !== 'wait' && mod(t, isTool ? 2 : 4) < (isTool ? 1 : 2)
  const art = flick ? HOST_FLICK : HOST
  draw(cv, host.x, hy, host.right ? art : flip(art), dim(isPass ? goldOf(HOST_INK, t) : HOST_INK))
  mouthBubbles(cv, t, s, tt => [hostRight(tt) ? hostAt(tt) + 7 : hostAt(tt) - 1, hy + 1])

  const g = cells(cv)
  const { text, c } = sign(s, t, age)
  put(g, SIGN_X, 0, text, { c, b: true })
  if (readout) put(g, READOUT_X, 0, readout, { c: isCommit || isPass ? GOLD : s.done >= s.total ? PEARL : DIM })
  return g
}

/** A fish's colours on a passed test: all but its eye gold, shimmering every other frame. */
const goldOf = (ink: Ink, t: number): Ink => recolor(ink, (c, k) => (k === 'E' ? c : mod(t, 2) ? GOLD : '#ffe066'))

/** The sign over the chest: the news first, else the act, a dot while the act turns; a tail dot on even frames. */
function sign(s: Signals, t: number, age: number): { text: string; c: string } {
  const dot = mod(t, 2) === 0 ? '·' : ''
  if (s.news === 'testFail' && s.newsAge < 20) return { text: '×' + dot, c: DIM }
  if (s.news === 'testPass' && s.newsAge < PASS_FRAMES) return { text: frame(['★', '☆'], t >> 1) + dot, c: GOLD }
  if (s.news === 'commit' && s.newsAge < 30) return { text: '✓' + dot, c: GOLD }
  if (age < TURN_FRAMES) return { text: '·' + dot, c: GLINT }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + dot, c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?' + dot, c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1) + dot, c: GLINT }
  if (s.act === 'think') return { text: '·' + dot, c: DIM }
  return { text: frame(['z', 'Z'], t >> 2) + dot, c: DIM }
}

/** A seahorse facing left: a pale coronet spike, a long tube snout, a back fin, its dark tail curled under. */
export const PET: PetArt = {
  body: ['......c.....', '.....hhhc...', '..ssshhh....', '....t.bBf...', '....tttB....'],
  step: ['......c.....', '.....hhhc...', '..ssshhh....', '....t.bB....', '....tttBf...'],
  colors: { h: '#ffb703', s: '#ffb703', c: '#fff3b0', b: '#ffd166', B: '#ffb703', f: '#fff3b0', t: '#e85d04' },
  eyes: [6],
  eyeRow: 1,
  eye: '#1d1d1d',
  lid: '#ffb703',
  blush: '#ff8fab',
  spark: GOLD,
}

export const AQUARIUM: Theme = {
  name: 'aquarium',
  rows: SCENE_ROWS,
  color: SURFACE,
  accent: '#ff8c42',
  sprite: {
    think: ['><>  ', '><> °', '><>° ', '><> °'],
    tool: ['><>°o', '><>o°', '><>°°', '><>oo'],
    say: ['><> ♪', '><> ♫'],
    wait: ['><> .', '><> ..', '><> ...'],
  },
  happy: '><> ★',
  sad: '><> …',
  dead: '✗',
  sleep: '><> zZ',
  confetti: ['°', 'o', '·', '✦'],
  palette: PALETTE,
  scene: aquariumScene,
  pet: PET,
}
