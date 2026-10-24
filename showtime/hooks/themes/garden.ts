// Theme: garden. Its scene, its words and its pet.
//
// The scene: flower beds (#52b788) along a picket fence under drifting clouds, a big pink flower at the
// left, a sign on the first picket reading the act and a butterfly over the path (fluttering on a
// twelve-frame bob thinking or saying, perched opening its wings asking, basking slowly waiting, folded
// in the rain). A seed per task in the beds (floor-scaled), sprouting a stage every two frames as it is
// done; rain in the tool's colour while a tool runs, a pixel a frame (bash twice as dense); a bee per
// agent zigzagging over its own picket at the right. testFail wilts and greys the plants, then they
// straighten; testPass turns them gold; a commit bursts the big flower open, petals drifting right.
// Motion rules: rows 2–3 are full; rain falls only by a picket no head touches, so drops appear beside
// one; clouds pass behind the sign's picket; petals hide for good once they near a cloud; bees keep within
// a column of their picket; the sign's tail dot blinks in phase in every act, so no frame holds.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>
/** What colours the flowers this frame, from the news and the tasks. */
type Mood = { grey: boolean; isFail: boolean; isPass: boolean; isCommit: boolean; roll: boolean }

/** Pickets every PITCH columns from POST_X, px 3–5; the rail along px 4; the beds along px 6 over soil.
 * Gap 0 is the path under the sign, gap 1 the butterfly's, the last four the bees', the rest beds. */
const POST_X = 6
const PITCH = 4
const RAIL_Y = 4
const BED_Y = 6
const FIRST_BED = 2
/** The big flower's head, its left column; the butterfly's left wing; the sign on the first picket. */
const HERO_X = 2
const FLY_X = POST_X + PITCH
const SIGN_X = POST_X
const PETAL_X = POST_X + 1
const MAX_AGENTS = 4
const CLOUD_W = 6
const RAIN_PERIOD = 12
const RAIN_PERIOD_BASH = 6
const RAIN_IN_FRAMES = 4
/** Frames: a bee's greeting, a sprout's growing, the 100% roll, an act's turn. */
const [GREET_FRAMES, GROW_FRAMES, DONE_ROLL_FRAMES, TURN_FRAMES] = [8, 8, 16, 4]
/** Frames: the news' signs, the grey of a wilt, the commit's bloom (from, to); the petals it sheds. */
const [FAIL_FRAMES, FAIL_GREY_FRAMES, PASS_FRAMES, COMMIT_FRAMES, BLOOM_FROM, BLOOM_TO] = [20, 12, 16, 16, 2, 12]
const PETALS = 6
const GREEN = '#52b788'
const LEAF = '#95d5b2'
const STEM = '#74c69d'
const PINK = '#ff7eb6'
const GOLD = '#ffd60a'
const PALE = '#fff3b0'
const WHITE = '#ffffff'
const SOIL = '#6b4a2b'
const SOIL_LIGHT = '#8a6a45'
const POST = '#e0c097'
const RAIL = '#a67c52'
const CLOUD_INK = '#5c6382'
const BEE_DARK = '#57534e'
const GREY = '#8d99ae'
const GREY_DIM = '#6c757d'
const SIGN = '#cfd8dc'
const PALETTE = [PINK, GOLD, '#c77dff', '#7dcfff', GREEN]
const HUES = [PINK, '#ffd166', '#c77dff', '#ff9e64', '#7dcfff', '#f9c74f']
const PLANT_INK: Ink = { P: PINK, F: PALE, S: STEM, L: LEAF, D: '#d4a373' }
const GREY_INK: Ink = { P: GREY, F: GREY_DIM, S: GREY_DIM, L: GREY, D: GREY }
const RAIN: Record<ToolKind, string> = {
  bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

const CLOUD = ['.CCC..', 'CCCCCC']
/** A flower's head over its bed's left column, drooped 0–3: the petals fall right and down a pixel at a time. */
const HEAD = [['PFP', '.S.'], ['PF.', '.SP'], ['P..', '.FP'], ['...', 'PFP']]
const HERO_HEAD = ['PPP', 'PFP']
const BLOOM = ['.PPP.', 'PPFPP', '.PPP.']
/** The big flower's head, its top-left pixel: upright, then left and down, away from the fence. */
const HERO_DROOP = [[HERO_X, 1], [HERO_X - 1, 1], [HERO_X - 1, 2], [HERO_X - 1, 3]] as const
const FLY_OPEN = ['WBW', '.B.']
const FLY_SHUT = ['.B.', '.B.']
const FLY_INK: Ink = { W: '#ff9e64', B: '#fde68a' }
/** A bee's zigzag over its picket, six frames: right along low-high-low, back along high-low-high. */
const BEE_ZIG: readonly (readonly [number, number])[] = [[-1, 3], [0, 2], [1, 3], [1, 2], [0, 3], [-1, 2]]
/** The lowest picket a bee may take, clear of the butterfly's wings (so none below w = 20). */
const FIRST_BEE_POST = 3
/** The left column of gap `j` between the pickets. */
const gapX = (j: number) => POST_X + PITCH * j + 1
/** How far a head has drooped on a failed test: a pixel every other frame up to three, then back. */
const droopOf = (age: number) => (age < 8 ? Math.min(3, (age + 1) >> 1) : Math.max(0, 3 - ((age - 6) >> 1)))

/** The clouds' left columns along the top two pixel rows, left a cell every four frames, spread apart. */
function cloudXs(t: number, w: number): number[] {
  const span = w + CLOUD_W + 2
  const n = Math.max(2, Math.floor(w / 24))
  return Array.from({ length: n }, (_, i) => mod(Math.floor((i * span) / n + noise(i) * 3) - (t >> 2), span) - CLOUD_W)
}

/** The fence and the beds: soil along px 7, green beds along px 6 (bare soil at the left edge, under the
 * pickets and along the path), the rail along px 4 and a picket every PITCH columns over it. */
function fence(cv: Canvas): void {
  for (let x = 0; x < cv.w; x++) {
    const picket = x >= POST_X && mod(x - POST_X, PITCH) === 0
    const path = x >= gapX(0) && x < gapX(1) - 1
    plot(cv, x, BED_Y + 1, SOIL)
    plot(cv, x, BED_Y, picket || path || x === 0 ? SOIL_LIGHT : GREEN)
    plot(cv, x, RAIL_Y, RAIL)
    if (picket) for (let y = RAIL_Y - 1; y <= RAIL_Y + 1; y++) plot(cv, x, y, POST)
  }
}

/** A bed's plant from its left column by stage: a seed, a sprout, leaves either side, a head. */
function plant(cv: Canvas, x0: number, stage: number, droop: number, ink: Ink): void {
  plot(cv, x0 + 1, BED_Y, stage > 0 ? ink.S! : ink.D!)
  if (stage >= 1) plot(cv, x0 + 1, RAIL_Y + 1, ink.L!)
  if (stage >= 2) {
    plot(cv, x0 + 1, RAIL_Y, ink.S!)
    plot(cv, x0, RAIL_Y + 1, ink.L!)
    plot(cv, x0 + 2, RAIL_Y + 1, ink.L!)
  }
  if (stage >= 3) draw(cv, x0, 2, HEAD[droop]!, ink)
}

/** The big flower: its head where the droop puts it (or the commit's bloom), a stem to the leaves. */
function hero(cv: Canvas, droop: number, bloom: boolean, ink: Ink): void {
  const [hx, hy] = HERO_DROOP[droop]!
  if (bloom) draw(cv, HERO_X - 1, 0, BLOOM, ink)
  else draw(cv, hx, hy, HERO_HEAD, ink)
  for (let y = hy + 2; y <= RAIL_Y + 1; y++) plot(cv, HERO_X + 1, y, ink.S!)
  plot(cv, HERO_X, RAIL_Y + 1, ink.L!)
  plot(cv, HERO_X + 2, RAIL_Y + 1, ink.L!)
}

/** A flower's colours: grey while the garden wilts, gold flashing white on a passed test, rolling the
 * palette at 100%, white every other frame as the newest opens; a gold centre on a commit. */
function flowerInk(k: number, s: Signals, t: number, m: Mood, opening: boolean): Ink {
  if (m.grey) return GREY_INK
  let P = frame(HUES, k)
  if (m.isPass) P = mod(t, 2) === 0 ? WHITE : GOLD
  else if (m.roll) P = frame(PALETTE, k + (s.doneAge >> 1))
  else if (opening && mod(s.doneAge, 2) === 1) P = WHITE
  return { ...PLANT_INK, P, F: m.isCommit ? GOLD : PALE }
}

/** The butterfly over the path: fluttering (a bob of twelve frames, a flap of six, four while saying),
 * perched on the rail opening its wings four frames in twelve asking, eight in sixteen waiting, folded
 * in the rain and while the act turns. */
function butterfly(cv: Canvas, t: number, s: Signals, age: number): void {
  const flutter = s.act === 'think' || s.act === 'say'
  let y = 3
  let open = false
  if (age >= TURN_FRAMES && flutter) {
    y = mod(t, 12) < 6 ? 2 : 3
    open = s.act === 'say' ? mod(t, 4) < 2 : mod(t, 6) < 3
  } else if (age >= TURN_FRAMES && s.act === 'ask') open = mod(t, 12) < 4
  else if (age >= TURN_FRAMES && s.act === 'wait') open = mod(t, 16) < 8
  draw(cv, FLY_X, y, open ? FLY_OPEN : FLY_SHUT, FLY_INK)
}

/** Rain while a tool runs: in a picket's column and the next (not the sign's; the big flower's stem's), a
 * drop a pixel a frame to the rail's foot, one every `period` frames, the pair half a period apart (a streak
 * behind on bash); none by a picket a head touches, so each drop starts beside a picket's top, only the
 * picket's own column at a bee's; columns join over the first four frames of `since`. */
function rain(cv: Canvas, t: number, since: number, tool: ToolKind, beeFrom: number): void {
  const streak = tool === 'bash'
  const period = streak ? RAIN_PERIOD_BASH : RAIN_PERIOD
  for (let x = 0; x < cv.w; x++) {
    const k = x < POST_X + PITCH ? (x === HERO_X ? 0 : -1) : mod(x - POST_X, PITCH)
    const p = x - k
    if (k < 0 || k > 1 || noise(x + 31) * RAIN_IN_FRAMES >= since + 1) continue
    const headBy = cv.px[2 * cv.w + p - 1] || cv.px[3 * cv.w + p - 1]
    if (x >= POST_X && ((k === 1 && p >= POST_X + PITCH * beeFrom) || headBy)) continue
    const phase = Math.floor(noise(p) * period) + (k * period) / 2
    const y = mod(t + phase, period)
    if (y <= RAIL_Y + 1) plot(cv, x, y, RAIN[tool])
    if (streak && y >= 3 && y <= RAIL_Y + 2) plot(cv, x, y - 1, RAIN[tool])
  }
}

/** The agents: a bee per agent (four at most) zigzagging over its own picket from the right, its stripes
 * flipping every frame, a wing over it as it dips (never in the sky row); the newest flashes white as it
 * joins (and when one leaves). */
function bees(cv: Canvas, t: number, s: Signals, lastPost: number): void {
  const n = Math.min(s.agents, MAX_AGENTS)
  for (let i = 0; i < n && lastPost - i >= FIRST_BEE_POST; i++) {
    const [dx, y] = frame(BEE_ZIG, t + 2 * i)
    const x = POST_X + PITCH * (lastPost - i) + dx
    const flash = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const flip = mod(t, 2) === 0
    plot(cv, x, y, flash ? WHITE : flip ? GOLD : BEE_DARK)
    plot(cv, x, y + 1, flash ? WHITE : flip ? BEE_DARK : GOLD)
    if (y === 3) plot(cv, x, 2, '#cfe8ff')
  }
}

/** A commit's petals: one peels off the bloom every other frame and drifts right along the sky a cell a
 * frame, bobbing between the top two pixel rows, gone behind a cloud (or the readout) once it nears one. */
function petals(cv: Canvas, t: number, age: number, stopX: number): void {
  const hidden = (x: number, at: number) =>
    x >= stopX - 1 || cloudXs(at, cv.w).some(c => x >= c - 1 && x <= c + CLOUD_W)
  for (let k = 0; k < PETALS; k++) {
    const life = age - BLOOM_FROM - 2 * k
    let gone = life < 0
    for (let l = 0; l <= life && !gone; l++) gone = hidden(PETAL_X + l, t - life + l)
    if (!gone) plot(cv, PETAL_X + life, mod((life >> 1) + k, 2), k % 2 ? WHITE : PINK)
  }
}

/** The sign on the first picket: the news first, else the act, a dot while the act turns; its tail dot
 * blinks on even frames in every case, so no frame can hold, at a change of act either. */
function sign(s: Signals, t: number, age: number, m: Mood): { text: string; c: string } {
  const dot = mod(t, 2) === 0 ? '·' : ''
  if (m.isFail) return { text: '×' + dot, c: GREY }
  if (m.isPass) return { text: frame(['★', '☆'], t >> 1) + dot, c: GOLD }
  if (m.isCommit) return { text: '✓' + dot, c: GOLD }
  if (age < TURN_FRAMES) return { text: '·' + dot, c: PALE }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + dot, c: RAIN[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?' + dot, c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1) + dot, c: LEAF }
  if (s.act === 'think') return { text: '·' + dot, c: SIGN }
  return { text: frame(['z', 'Z'], t >> 2) + dot, c: SIGN }
}

export function gardenScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const age = Math.min(s.actAge, s.toolAge)
  const allDone = s.total > 0 && s.done >= s.total
  const grey = isFail && s.newsAge < FAIL_GREY_FRAMES
  const m: Mood = { grey, isFail, isPass, isCommit, roll: allDone && s.doneAge < DONE_ROLL_FRAMES }
  // The readout starts on a picket or a column left of one; the bees take the pickets from the right and
  // the beds the gaps from the third to one short of the bees', all from the width alone.
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  let readoutX = w - readout.length
  while (mod(readoutX - POST_X, PITCH) === 1 || mod(readoutX - POST_X, PITCH) === 2) readoutX -= 1
  const lastPost = Math.floor((w - 2 - POST_X) / PITCH)
  const beds = Math.max(0, lastPost - MAX_AGENTS - FIRST_BED)
  const count = Math.min(s.total, beds)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)

  // Layer 1: the clouds, gone behind the sign's picket so none sits by the big flower as it droops;
  // layer 2: the fence and the beds.
  for (const x of cloudXs(t, w)) draw(cv, x, 0, CLOUD, { C: CLOUD_INK })
  for (let x = 0; x <= POST_X; x++) cv.px[x] = cv.px[w + x] = undefined
  fence(cv)
  // Layer 3: the plants, a seed per task and a flower per done task, the newest sprouting; the big
  // flower, drooping on a failed test, flashing white then blooming on a commit.
  const droop = isFail ? droopOf(s.newsAge) : 0
  for (let j = 0; j < count; j++) {
    const opening = j === lit - 1 && s.doneAge < GROW_FRAMES && lit > litOf(s.done - 1)
    const stage = j >= lit ? 0 : opening ? Math.min(3, s.doneAge >> 1) : 3
    plant(cv, gapX(FIRST_BED + j), stage, droop, flowerInk(j, s, t, m, opening))
  }
  let heroInk = flowerInk(0, s, t, m, false)
  const blink = mod(t, 2) === 0
  if (isCommit) heroInk = { ...heroInk, P: s.newsAge < BLOOM_FROM && blink ? WHITE : PINK, F: blink ? WHITE : GOLD }
  hero(cv, droop, isCommit && s.newsAge >= BLOOM_FROM && s.newsAge < BLOOM_TO, heroInk)
  // Layer 4: the butterfly, the rain while a tool runs, the bees, a commit's petals.
  butterfly(cv, t, s, age)
  // The rain clears for a commit's petals and comes back in over four frames after.
  const since = s.news === 'commit' ? Math.min(s.actAge, s.newsAge - COMMIT_FRAMES) : s.actAge
  if (isTool && since >= 0) rain(cv, t, since, s.tool ?? 'other', lastPost - MAX_AGENTS + 1)
  bees(cv, t, s, lastPost)
  if (isCommit) petals(cv, t, s.newsAge, readout ? readoutX : w)

  const g = cells(cv)
  if (readout) put(g, readoutX, 0, readout, { c: isCommit || isPass ? GOLD : allDone ? GREEN : SIGN, b: true })
  const { text, c } = sign(s, t, age, m)
  put(g, SIGN_X, 1, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  return g
}

/** A sprout: two leaves on a stem over a round green seedling in its soil. */
export const PET: PetArt = {
  body: ['.....L...L..', '.....LLSLL..', '....GGGGGG..', '...GGGGGGGG.', '..BBBBBBBBBB'],
  step: ['....L.....L.', '.....LLSLL..', '....GGGGGG..', '...GGGGGGGG.', '..BBBBBBBBBB'],
  colors: { L: LEAF, S: STEM, G: GREEN, B: SOIL_LIGHT },
  eyes: [5, 8],
  eyeRow: 2,
  eye: '#1d1d1d',
  lid: GREEN,
  mouth: [6, 3],
  blush: PINK,
  spark: GOLD,
}

export const GARDEN: Theme = {
  name: 'garden',
  rows: SCENE_ROWS,
  color: GREEN,
  accent: PINK,
  sprite: {
    think: ['✿·  ', '✿ · ', '✿  ·', '✿ · '],
    tool: ['✿ ☂ ', '✿ ☂·', '✿ ☂ ', '✿·☂ '],
    say: ['✿ ♪', '✿ ♫'],
    wait: ['✿ .', '✿ ..', '✿ ...'],
  },
  happy: '✿ ★',
  sad: '✿ …',
  dead: '✗',
  sleep: '✿ zZ',
  confetti: ['✿', '❀', '·', '+'],
  palette: PALETTE,
  scene: gardenScene,
  pet: PET,
}
