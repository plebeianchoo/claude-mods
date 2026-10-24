// Theme: volcano. Its scene, its words and its pet.
//
// The scene: an island volcano (#ff6d00) in a scrolling sea, its notched crater glowing and sending up a plume
// (puffs rising a pixel a frame out of it, then drifting right), a glow stepping across the cone, a glint along the
// sand. A tool sends lava down the right slope a cell every two frames (grown on actAge, held at the shore), pulsing
// in the tool's colour; bash pulses faster and brighter and throws sparks. ask: the crater bubbles, the cone throbs;
// say: smoke signals; wait: the crater cools, the plume greys. A hut per task on the shore (floor-scaled), roofed
// when done, the newest roof dropping on; a rowing boat per agent in a fixed slot, flashing as it joins. testFail:
// rocks arc out for twelve frames under a reddening sky; commit: a rainbow fades in and out over the island. Motion
// rules: the plume's newest end and the crater's left horn are one run that never moves; the sky's glow widens a
// column a frame from the crater's left column; lava, waves and the cone's shimmer only change colours.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** The crater's right column (the plume leaves from CX - 1); the first hut's column; pitches; caps; the sign. */
const [CX, HUT0, HUT_P, BOAT_P, MAX_HUTS, MAX_BOATS, SIGN_X] = [9, 19, 4, 7, 12, 4, 1]
/** Pixel rows: the crater's rim (its horns a row higher), the sand; the cone's half-width per row from the rim. */
const [RIM_Y, SAND_Y] = [2, 6]
const CONE_HALF = [2, 4, 6, 8]
/** Frames: an act's change, between puffs, a puff's life; lava cells; a greeting, a roof's drop, the 100% flare. */
const [CHANGE, PUFF_GAP, PUFF_LIFE, FLOW_LEN, GREET, DROP, FLARE] = [4, 2, 10, 9, 8, 6, 16]
/** testFail: the rocks' flight, the sky's glow (frames), its widest, its middle; commit: the rainbow's frames. */
const [ROCK_FRAMES, GLOW_FRAMES, GLOW_MAX, GLOW_X, BOW_FRAMES] = [12, 30, 14, CX + 3, 20]
/** The rocks: columns a frame, and height by frame (never above row 0): the fast ones thrown high, the slow ones
 * low (off row 0 before a bash spark is born beside them). */
const ARC_HIGH = [1, 0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7]
const ARC_LOW = [1, 0, 0, 1, 2, 3, 4, 5, 6, 7]
const ROCKS = [[-1, ARC_HIGH], [-0.5, ARC_LOW], [0.5, ARC_LOW], [0.75, ARC_HIGH]] as const
/** A boat's oar blade by stroke phase (column, pixel row); the newest roof's top row by doneAge as it drops. */
const BLADE = [[0, 5], [0, 6], [1, 6], [1, 5]] as const
const ROOF_TOP = [1, 1, 1, 2, 2, 2]
/** The lava's path down the right slope from the rim: each cell (column, pixel row) on the cone's surface. */
const FLOW: readonly (readonly [number, number])[] = [[CX + 1, 1], [CX + 1, 2], [CX + 2, 3], [CX + 3, 3],
  [CX + 4, 4], [CX + 5, 4], [CX + 6, 5], [CX + 7, 5], [CX + 8, 6]]

const [LAVA, LAVA_HI, LAVA_DEEP, CORE, GOLD, PALE, WHITE] =
  ['#ff6d00', '#ffb703', '#e85d04', '#ffd60a', '#ffd166', '#fff3b0', '#ffffff']
const CONE_INK = ['#8a7060', '#76604f', '#6c584c', '#5e4b3f']
const [CRATER, COLD, EMBER_GLOW, SAND, GLINT] = ['#d00000', '#7a2a2a', '#9c3d1d', '#e9c46a', '#fff3b0']
const SEA_TOP = ['#0096c7', '#48cae4', '#0096c7', '#0077b6', '#0077b6', '#90e0ef']
const SEA_DEEP = ['#0077b6', '#023e8a', '#0077b6', '#0369a1']
const SMOKE = ['#e9ecef', '#ced4da', '#adb5bd', '#868e96']
const [POST, WALL, DOOR, ROOF, PEAK, WINDOW] = ['#7f5539', '#a47148', '#6f4518', '#e76f51', '#f4a261', '#ffd166']
const [HULL, KEEL, OAR, SKIN, FOAM] = ['#a47148', '#7f5539', '#d4a373', '#ffddd2', '#caf0f8']
const HUES = ['#52b788', '#b185db', '#4cc9f0', '#f4a261']
const [SKY_DIM, SKY_RED, ROCK_COOL, FADE_TO] = ['#4a1616', '#c1121f', '#9d0208', '#262a36']
const BOW = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4']
const TOOL_INK: Record<ToolKind, string> = { bash: PALE, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** Where things stand at width `w`: boats that fit (one at least), huts that fit, the sand's end; all by `w` alone. */
function layout(w: number): { boats: number; huts: number; shore: number } {
  const boats = Math.max(1, Math.min(MAX_BOATS, Math.floor((w - HUT0 - 14) / BOAT_P)))
  const huts = Math.max(0, Math.min(MAX_HUTS, Math.floor((w - HUT0 - 2 - boats * BOAT_P) / HUT_P)))
  return { boats, huts, shore: HUT0 + HUT_P * Math.max(1, huts) }
}

/** The sky's glow on a failed test, `age` frames in: from the crater's left column (clear of the bash sparks and
 * the rocks flying left) it widens a column a frame to GLOW_MAX and back, and across the top rows to the right
 * four a frame; reddest low and near the crater; in pixel rows 2-3 it stops short of the roofs. */
function skyGlow(cv: Canvas, age: number): void {
  const r = Math.min(age + 1, GLOW_FRAMES - 1 - age, GLOW_MAX)
  const k = Math.min(1, r / 6)
  for (let y = 0; y < 4; y++) {
    const right = y < 2 ? 4 * r : Math.min(r, CX + 8 - GLOW_X)
    for (let x = GLOW_X - Math.min(r, GLOW_X - CX + 1); x <= GLOW_X + right; x++) {
      const near = 1 - Math.abs(x - GLOW_X) / (2 * GLOW_MAX) - (3 - y) * 0.08
      plot(cv, x, y, mix(SKY_DIM, SKY_RED, Math.max(0, k * near)))
    }
  }
}

/** The rainbow over the island on a commit, `age` frames in: four bands on an arc from shore to shore, fading in
 * over five frames and out over the last five. */
function rainbow(cv: Canvas, age: number, shore: number): void {
  const k = Math.min(1, (age + 1) / 5, (BOW_FRAMES - age) / 5)
  const [c, a, b] = [shore / 2, shore / 2 + 1, 6.6]
  for (let y = 0; y < SAND_Y; y++) {
    for (let x = 0; x < Math.min(cv.w, shore + 2); x++) {
      const d = Math.hypot((x - c) / a, (y - SAND_Y) / b)
      const band = Math.floor((1 - d) * b)
      if (d < 1 && band < BOW.length) plot(cv, x, y, mix(FADE_TO, BOW[band]!, k))
    }
  }
}

/** The cone over the island: a rim round the glowing crater (a horn either side of it), shaded rows, a glow
 * stepping across them on sixteen frames (`throb` warms the whole cone on an ask); the sand from the cone's foot
 * to the shore, a glint along it. */
function island(cv: Canvas, t: number, shore: number, throb: number, glow: string): void {
  for (const x of [CX - 2, CX + 1]) plot(cv, x, RIM_Y - 1, mix(CONE_INK[0]!, EMBER_GLOW, throb))
  CONE_HALF.forEach((h, j) => {
    const y = RIM_Y + j
    for (let x = CX - h; x < CX + h; x++) {
      const vein = mod(t - (x - CX + 8) - 5 * j, 16) === 0 && j > 0
      const base = mix(CONE_INK[j]!, EMBER_GLOW, throb)
      plot(cv, x, y, j === 0 && (x === CX - 1 || x === CX) ? glow : vein ? EMBER_GLOW : base)
    }
  })
  const glint = mod(t >> 1, shore + 8)
  for (let x = 1; x < shore; x++) plot(cv, x, SAND_Y, x === glint ? GLINT : SAND)
}

/** The sea around it: crests scrolling right a column every two frames on top, the deep left every four. */
function sea(cv: Canvas, t: number): void {
  for (let x = 0; x < cv.w; x++) {
    if (!cv.px[SAND_Y * cv.w + x]) plot(cv, x, SAND_Y, SEA_TOP[mod(x - (t >> 1), SEA_TOP.length)]!)
    if (!cv.px[(SAND_Y + 1) * cv.w + x]) plot(cv, x, SAND_Y + 1, SEA_DEEP[mod(x + (t >> 2), SEA_DEEP.length)]!)
  }
}

/** The plume: a puff born every PUFF_GAP frames in the crater, a pixel higher each frame to row 0 and drifting right
 * a column a frame, fading; each touches the one before (one run, its newest end at CX - 1 or CX), the puffs told
 * apart by shade. On `say` every other puff billows white (smoke signals), the rest dim; `tint` lights them from
 * below by `k`; `dark` dims them in an eruption; on `wait` they thin to grey. */
function plume(cv: Canvas, t: number, act: Signals['act'], tint: string, k: number, dark: number): void {
  const signals = act === 'say'
  for (let a = PUFF_LIFE - 1; a >= 0; a--) {
    if (mod(t - a, PUFF_GAP) !== 0) continue
    const id = Math.floor((t - a) / PUFF_GAP)
    const y = Math.max(0, 2 - a)
    const x = CX - 1 + Math.max(0, a - 2)
    const signal = signals && mod(id, 2) === 0 && a >= 2
    let c = signal ? WHITE : SMOKE[Math.min(3, (a >> 2) + (signals || act === 'wait' ? 2 : mod(id, 2)))]!
    c = mix(mix(c, tint, k * (a < 6 ? 0.6 : 0.3)), '#495057', dark)
    for (let dx = 0; dx < 2; dx++) {
      plot(cv, x + dx, y, c)
      if (signal || (a >= 4 && noise(id * 7 + dx) > 0.6)) plot(cv, x + dx, 1, c)
    }
  }
}

/** The lava down the right slope, `reach` cells of it, pulses running down it (a cell a frame on bash, else a cell
 * every two frames) in the tool's colour. */
function lava(cv: Canvas, t: number, reach: number, bash: boolean, ink: string): void {
  const run = bash ? t : t >> 1
  for (let i = 0; i < reach; i++) {
    const p = mod(i - run, 4)
    const c = p === 0 ? (bash ? WHITE : ink) : p === 1 ? (bash ? CORE : LAVA_HI) : i === reach - 1 ? LAVA_DEEP : LAVA
    plot(cv, FLOW[i]![0], FLOW[i]![1], c)
  }
}

/** Sparks out of the crater on bash: one every other frame (with the plume's puffs), alternately left (off the rim,
 * a column clear of the plume) and right (over it), up to row 0 and down, a pixel and a column a frame. */
function sparks(cv: Canvas, t: number): void {
  const PATH = [[0, 1], [1, 0], [2, 0], [3, 1], [4, 2]] as const
  for (let a = 0; a < PATH.length; a++) {
    if (mod(t - a, 2) !== 0) continue
    const right = mod((t - a) >> 1, 2) === 1
    const [dx, y] = PATH[a]!
    if (right && a === PATH.length - 1) continue
    plot(cv, right ? CX + 2 + dx : CX - 3 - dx, y, a < 2 ? WHITE : a < 4 ? CORE : LAVA_HI)
  }
}

/** A hut per task on the sand, HUT_P apart from HUT0 (floor-scaled): bare posts and walls until done, then a roof
 * (the newest dropping on over DROP frames) and a lit window flickering on twelve frames, flashing at 100%. */
function huts(cv: Canvas, t: number, s: Signals, fit: number): void {
  const count = Math.min(s.total, fit)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < DROP && lit > litOf(s.done - 1)
  const flare = s.total > 0 && s.done >= s.total && s.doneAge < FLARE
  for (let k = 0; k < count; k++) {
    const x = HUT0 + HUT_P * k
    const roofed = k < lit
    const top = roofed && fresh && k === lit - 1 ? ROOF_TOP[s.doneAge] ?? 3 : 3
    if (!roofed || top >= 3) for (const dx of [0, 2]) plot(cv, x + dx, 4, POST)
    if (roofed) {
      if (s.doneAge > 0 || !fresh || k !== lit - 1) plot(cv, x + 1, top, PEAK)
      for (let dx = 0; dx < 3; dx++) plot(cv, x + dx, top + 1, ROOF)
    }
    const win = flare && mod(t + k, 2) === 0 ? WHITE : mod(t + 5 * k, 12) < 2 ? LAVA_HI : WINDOW
    for (let dx = 0; dx < 3; dx++) plot(cv, x + dx, 5, dx !== 1 ? WALL : roofed ? win : DOOR)
  }
}

/** A rowing boat facing the island at `x` (seven columns: the oar's sweep, then the hull), stroke phase `p`: the
 * oar level, dipped, pulled back under, lifted; the rower leans back on the pull. White while it greets. */
function boat(cv: Canvas, x: number, p: number, hue: string, flash: boolean): void {
  const at = (dx: number, y: number, c: string) => plot(cv, x + dx, y, flash ? WHITE : c)
  for (let dx = 2; dx < 7; dx++) at(dx, 6, HULL)
  for (let dx = 3; dx < 6; dx++) at(dx, 7, KEEL)
  at(4, 5, hue)
  at(p < 2 ? 4 : 5, 4, SKIN)
  at(3, 5, OAR)
  // The shaft from the hands, and the blade: forward, in the water, back under, lifted (a pixel a frame).
  for (let dx = p === 0 || p === 1 ? 1 : 2; dx < 3; dx++) at(dx, 5, OAR)
  const [bx, by] = BLADE[p]!
  at(bx, by, HULL)
  if (p >= 2) at(0, p + 4, FOAM)
}

/** Rocks out of the crater on a failed test, `age` frames in: each along its arc, a column (or less) a frame,
 * glowing white-hot and cooling; the eruption is over in ROCK_FRAMES. */
function rocks(cv: Canvas, age: number): void {
  if (age >= ROCK_FRAMES) return
  for (const [vx, arc] of ROCKS) {
    if (age >= arc.length) continue
    const x = CX - (vx < 0 ? 1 : 0) + Math.trunc(vx * age)
    plot(cv, x, arc[age]!, age < 3 ? PALE : age < 7 ? LAVA_HI : age < 10 ? LAVA : ROCK_COOL)
  }
}

/** The sign: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, news: 'fail' | 'commit' | undefined): [string, string] {
  if (news) return news === 'fail' ? ['×', '#ff6b6b'] : ['✓', GOLD]
  if (Math.min(s.actAge, s.toolAge) < CHANGE) return ['·', PALE]
  if (s.act === 'tool') return [TOOL_SIGN[s.tool ?? 'other'], TOOL_INK[s.tool ?? 'other']]
  if (s.act === 'ask') return ['?', GOLD]
  if (s.act === 'say') return [frame(['♪', '♫'], t >> 2), '#ff8fa3']
  return s.act === 'think' ? [frame(['·', '∘'], t >> 3), PALE] : [frame(['z', 'Z'], t >> 2), '#8d99ae']
}

export function volcanoScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const lay = layout(w)
  const fail = s.news === 'testFail' && s.newsAge < GLOW_FRAMES ? s.newsAge : -1
  const bow = s.news === 'commit' && s.newsAge < BOW_FRAMES ? s.newsAge : -1
  const tool = s.act === 'tool' ? s.tool ?? 'other' : undefined
  const bash = tool === 'bash'
  // Layer 1: the sky (red in an eruption, a rainbow on a commit), behind everything.
  if (fail >= 0) skyGlow(cv, fail)
  if (bow >= 0) rainbow(cv, bow, lay.shore)
  // Layer 2: the island, its crater lit by the act: brighter over CHANGE frames of a tool, throbbing on an ask.
  const lit = tool ? Math.min(1, (s.actAge + 1) / CHANGE) : 0
  const throb = s.act === 'ask' ? Math.min(1, s.actAge / CHANGE) * (0.5 - 0.5 * Math.cos((Math.PI * t) / 6)) * 0.6 : 0
  const embers = s.act === 'wait' ? COLD : frame([CRATER, LAVA_DEEP], t >> 3)
  island(cv, t, lay.shore, throb, mix(embers, bash ? CORE : LAVA_HI, lit))
  huts(cv, t, s, lay.huts)
  // A tool's lava, grown a cell every two frames of actAge and held at the shore; through any reaction.
  if (tool) lava(cv, t, Math.min(FLOW_LEN, s.actAge >> 1), bash, TOOL_INK[tool])
  sea(cv, t)
  // Layer 3: the plume, lit from below by a tool (over CHANGE frames of actAge), dimmed in an eruption.
  const dark = fail >= 0 ? Math.min(1, fail / 4, (GLOW_FRAMES - fail) / 6) * 0.5 : 0
  plume(cv, t, s.act, bash ? CORE : LAVA, lit, dark)
  if (bash && s.actAge >= 2) sparks(cv, t)
  // ask: the crater bubbles over eight frames, growing in, swelling, popping.
  if (s.act === 'ask' && s.actAge >= 2) {
    const p = mod(t, 8)
    if (p < 6) for (const x of [CX - 1, CX]) plot(cv, x, 1, LAVA_HI)
    if (p >= 3 && p < 6) for (const x of [CX - 1, CX]) plot(cv, x, 0, p === 5 ? WHITE : CORE)
    if (p === 6) for (const x of [CX + 1, CX + 2]) plot(cv, x, 0, PALE)
  }
  // testFail: lava fountains out of the crater while the rocks fly.
  if (fail >= 0 && fail < 7) {
    for (const x of [CX - 1, CX]) for (let y = fail < 3 ? 0 : 1; y < 2; y++) plot(cv, x, y, CORE)
  }
  if (fail >= 0) rocks(cv, fail)
  // Layer 4: a boat per agent in its fixed slot, rowing on four frames; the newest flashes as it joins.
  const n = Math.min(s.agents, lay.boats)
  for (let i = 0; i < n; i++) {
    const x = Math.min(lay.shore + 2 + BOAT_P * i, w - BOAT_P * (lay.boats - i))
    const greet = i === n - 1 && s.agentsAge < GREET && mod(s.agentsAge, 2) === 0
    boat(cv, x, mod(t + i, 4), HUES[i]!, greet)
  }

  const g = cells(cv)
  const [text, c] = sign(s, t, fail >= 0 ? 'fail' : bow >= 0 ? 'commit' : undefined)
  put(g, SIGN_X, 0, text, { c, b: true })
  return g
}

/** A lava blob: a molten drop with a dark crust round a glowing body, bright cracks down its sides, a white-hot
 * core under its eyes, and drips hanging off its bottom edge (they shift as it walks). */
export const PET: PetArt = {
  body: ['....rOOr....', '..rOOYYOcr..', '.rOYYYYYYOr.', '.rcYYWWYYOr.', '..rOrOOr.O..'],
  step: ['....rOOr....', '..rOOYYOcr..', '.rOYYYYYYOr.', '.rcYYWWYYOr.', '..O.rOOrO...'],
  colors: { r: '#9d0208', O: LAVA, Y: LAVA_HI, W: PALE, c: CORE },
  eyes: [4, 7], eyeRow: 1, eye: '#370617', lid: LAVA,
  mouth: [5, 3], blush: '#ff8fa3', spark: CORE,
}

export const VOLCANO: Theme = {
  name: 'volcano',
  rows: SCENE_ROWS,
  color: LAVA,
  accent: LAVA_HI,
  sprite: {
    think: ['▲·  ', '▲ · ', '▲  ·', '▲ · '], tool: ['▲≈  ', '▲ ≈ ', '▲  ≈', '▲ ≈ '],
    say: ['▲ ♪', '▲ ♫'], wait: ['▲ .', '▲ ..', '▲ ...'],
  },
  happy: '▲ ✦', sad: '▲ …', dead: '✗', sleep: '▲ zZ',
  confetti: ['✦', '*', '·', '˚'],
  palette: [LAVA, LAVA_HI, CRATER, SEA_TOP[1]!],
  scene: volcanoScene,
  pet: PET,
}
