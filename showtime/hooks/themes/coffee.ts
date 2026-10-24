// Theme: coffee. Its scene, its words and its pet.
//
// The scene: a barista in a brown apron (#8d5524, cream sleeves) behind a wooden counter whose top's sheen slides
// by `t`, a red espresso machine at the left, jars on a shelf behind (a glint crossing their lids). Steam rises
// from its wand a pixel a frame in every act; a tool thickens it on `actAge`, bash puffs it on a 2-frame cycle, edit
// drips into the shot cup, and the lamp and the chalk sign name the tool. He wipes the counter thinking (12 frames),
// works the machine in a tool, waves at the shoulder asking, gestures saying, leans waiting. A glass mug per task,
// `done` of them lattes (the newest filling in four stages); a barista per agent at an apron's peg. testFail tips
// the front cup and spills a puddle; testPass stars the sign; a commit lifts a latte-art heart off the front cup.
// Motion rules: the steam column touches the machine in every cell row and its mask changes every frame, so no
// frame holds and it never starts a run; the shelf breaks at the front cup so the heart starts over a run start.
import { canvas, cells, frame, mod, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Px = readonly [number, number]
type Ink = Record<string, string>

/** Columns: the steam's two columns, the barista, the front cup, the task cups and their pitch,
 * an agent's slot pitch; the most cups and agents. */
const [STEAM_X, BAR_X, FRONT_X, CUPS_X, CUP_PITCH, SLOT_W] = [6, 10, 16, 21, 3, 4]
const [MAX_CUPS, MAX_AGENTS] = [12, 4]
/** The chalk readout's column on the counter front, clear of the spill's puddle (FRONT_X + 4 ± 5). */
const READOUT_X = 26
/** Frames: an act's change, a fill stage, a greeting, the 100% shimmer; a passed test, the heart; a spill. */
const [CHANGE_FRAMES, FILL_STEP, GREET_FRAMES, ALL_FRAMES, PASS_FRAMES, HEART_FRAMES, SPILL_FRAMES] =
  [4, 2, 8, 16, 16, 16, 30]

const [BROWN, RIM, CREAM, SKIN, HAIR, EYE] = ['#8d5524', '#c08552', '#f3e1c7', '#e0ac69', '#6b4423', '#5a3d2b']
const [BODY, WAND, TRAY, STEEL, GAUGE, SHOT] = ['#c0392b', '#6c757d', '#dee2e6', '#8d99ae', '#f8f9fa', '#f3e1c7']
const [STEAM_HOT, STEAM, STEAM_DIM] = ['#f8f9fa', '#ced4da', '#8d99ae']
const [GLASS, EMPTY, ESPRESSO, MILK, FOAM, LATTE] = ['#e9ecef', '#4f5d75', '#7a4419', '#c8956b', '#fff3e0', '#a86b3c']
const [TOP, SHEEN, FRONT, SEAM, PUDDLE, GLOSS] = [RIM, '#e6bf94', BROWN, '#a0652d', '#6f4220', '#a0612b']
const GLINT = '#ffffff'
const [SHELF, CLOTH, GOLD, RED, HEART, GREEN] = ['#a47148', '#8ecae6', '#ffd60a', '#ff5d5d', '#ff8fab', '#52b788']
const JARS = [['#e9c46a', BROWN], ['#ced4da', '#f8f9fa'], ['#e9c46a', '#90be6d'], ['#ced4da', '#b5651d']]
const AGENT_HAIR = ['#e9c46a', '#e76f51', '#90be6d', '#a8dadc']
const TOOL_INK: Record<ToolKind, string> = { bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** The machine from column 1, pixel rows 1-5: tray, gauge, lamp (L) and wand, the group head over the shot cup. */
const MACHINE = ['TTTTT', 'BGBLW', 'BHHBW', 'B..BW', 'BssB.']
/** The wipe's hand column offset on its 12-frame cycle, from where the hand rests. */
const WIPE = [2, 2, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1]
/** The hand's height working the machine, a 12-frame pull from rest. */
const PULL = [4, 3, 3, 2, 2, 2, 2, 3, 3, 4, 4, 4]
/** The front cup tipping right, as [handle, top, bottom, base] pixels: upright, leaning, lying (top at the right). */
const TIP: readonly (readonly (readonly Px[])[])[] = [
  [[[0, 3], [0, 4]], [[1, 3], [2, 3]], [[1, 4], [2, 4]], [[1, 5], [2, 5]]],
  [[[1, 3], [0, 4]], [[2, 3], [3, 3]], [[1, 4], [2, 4]], [[1, 5], [2, 5]]],
  [[[2, 3]], [[3, 4], [3, 5]], [[2, 4], [2, 5]], [[1, 4], [1, 5]]],
]
/** The heart over the front cup, growing in two frames a step and shrinking at the end. */
const HEART_ART = [[[1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]]

/** A glass mug, handle at the left: its fill stage 0 (empty) to 4 (a latte, foam on top), or a spill's pose. */
function mug(cv: Canvas, x: number, stage: number, pose = 0, foam = FOAM): void {
  const fills = [[EMPTY, EMPTY], [EMPTY, ESPRESSO], [ESPRESSO, ESPRESSO], [MILK, ESPRESSO], [foam, LATTE]]
  const [top, bottom] = fills[stage]!
  const [handle, tops, bottoms, base] = TIP[pose]!
  for (const [dx, y] of handle!) plot(cv, x + dx, y, GLASS)
  for (const [dx, y] of tops!) plot(cv, x + dx, y, top!)
  for (const [dx, y] of bottoms!) plot(cv, x + dx, y, bottom!)
  for (const [dx, y] of base!) plot(cv, x + dx, y, GLASS)
}

/** Steam from the wand's tip at pixel row 5 up to row 0, a pixel a frame: a puff every third frame, every other
 * one born while bash ran (`bash` frames); a second column on puffs `from` frames old for `vol` frames. */
function steam(cv: Canvas, t: number, bash: number, vol: number): void {
  for (let age = 0; age < 6; age++) {
    const isBash = age <= bash
    if (mod(t - age, isBash ? 2 : 3) !== 0) continue
    const y = 5 - age
    plot(cv, STEAM_X, y, age < 2 ? STEAM_HOT : age < 4 ? STEAM : STEAM_DIM)
    const from = isBash ? 1 : 2
    if (age >= from && age < from + vol) plot(cv, STEAM_X + 1, y, age < 3 ? STEAM : STEAM_DIM)
  }
}

/** The counter: a light top whose sheen slides a pixel every other frame (a puddle of radius `r` at `px`), and the
 * brown front with seams. */
function counter(cv: Canvas, t: number, px: number, r: number): void {
  const sheen = mod(t >> 1, cv.w + 16) - 8
  for (let x = 0; x < cv.w; x++) {
    const wet = r >= 0 && Math.abs(x - px) <= r
    plot(cv, x, 6, wet ? (x === px - (r >> 1) ? GLOSS : PUDDLE) : Math.abs(x - sheen) <= 1 ? SHEEN : TOP)
    plot(cv, x, 7, mod(x, 8) === 7 ? SEAM : FRONT)
  }
}

/** The barista from `x`: hair and face (`face` > 0 looks right) `hy` lower, sleeves, apron, both hands; `dy` lower. */
function barista(cv: Canvas, x: number, o: { dy: number; hy: number; face: number; hands: Px[] }): void {
  const { dy, hy } = o
  for (let y = 2; y < 6; y++) for (let c = 0; c < 2; c++) plot(cv, x + 1 + c, y + dy, y === 2 ? RIM : BROWN)
  for (const c of [0, 3]) for (const y of [2, 3]) plot(cv, x + c, y + dy, CREAM)
  plot(cv, x + 1, dy + hy, HAIR)
  plot(cv, x + 2, dy + hy, HAIR)
  plot(cv, x + 1, 1 + dy + hy, o.face > 0 ? SKIN : EYE)
  plot(cv, x + 2, 1 + dy + hy, o.face > 0 ? EYE : SKIN)
  for (const [hx, y] of o.hands) plot(cv, hx, y, SKIN)
}

/** The barista's pose for the act, keyed on `actAge` from the rest pose (hands down, looking right). */
function pose(s: Signals): { dy: number; hy: number; face: number; hands: Px[]; cloth?: Px[] } {
  const a = s.actAge
  const [left, right]: [Px, Px] = [[BAR_X, 4], [BAR_X + 3, 4]]
  if (s.act === 'think') {
    const hx = BAR_X + 1 + frame(WIPE, a)
    return { dy: 0, hy: 0, face: 1, hands: [left, [hx, 4]], cloth: a < 2 ? undefined : [[hx - 1, 5], [hx, 5]] }
  }
  if (s.act === 'tool') {
    return { dy: 0, hy: 0, face: a < 1 ? 1 : -1, hands: [[BAR_X - 1, a < 1 ? 4 : frame(PULL, a - 1)], right] }
  }
  if (s.act === 'ask') {
    // Raised to the shoulder (never above pixel row 2, so leaving drops it a cell at most), waving up and down.
    const hand: Px = a < 1 ? right : a < 2 ? [BAR_X + 4, 3] : [BAR_X + 4, mod(a - 2, 12) < 6 ? 2 : 3]
    return { dy: 0, hy: 0, face: 1, hands: [left, hand] }
  }
  if (s.act === 'say') {
    const hand: Px = a < 1 ? right : [BAR_X + 4, 3]
    return { dy: 0, hy: mod(a, 12) >= 6 && mod(a, 12) < 9 ? 1 : 0, face: 1, hands: [left, hand] }
  }
  return { dy: mod(a, 16) < 8 ? 0 : 1, hy: 0, face: 1, hands: a < 1 ? [left, right] : [[BAR_X, 5], [BAR_X + 3, 5]] }
}

/** The chalk sign on the counter's front: the news first, else the act, a dot while it changes. */
function sign(s: Signals, t: number, k: { fail: boolean; pass: boolean; heart: boolean }) {
  if (k.fail) return { text: '×', c: RED }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (k.heart) return { text: '♥', c: HEART }
  if (Math.min(s.actAge, s.toolAge) < CHANGE_FRAMES) return { text: '·', c: CREAM }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1), c: CREAM }
  if (s.act === 'wait') return { text: frame(['z', 'Z'], t >> 2), c: STEAM_DIM }
  return { text: frame(['·', ':'], t >> 2), c: CREAM }
}

export function coffeeScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const fail = s.news === 'testFail' && s.newsAge < SPILL_FRAMES ? s.newsAge : -1
  const pass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const heart = s.news === 'commit' && s.newsAge < HEART_FRAMES ? s.newsAge : -1
  const isTool = s.act === 'tool'
  const tool = s.tool ?? 'other'
  // Agents' slots from the right, as many as fit past the front cup; the cups give way to them.
  const slots = Math.max(0, Math.min(MAX_AGENTS, Math.floor((w - 1 - CUPS_X) / SLOT_W)))
  const slotX = (i: number) => w - SLOT_W - SLOT_W * i
  const limit = slots > 0 ? slotX(slots - 1) - 2 : w - 2
  const count = Math.min(s.total, MAX_CUPS, Math.max(0, Math.floor((limit - CUPS_X + 1) / CUP_PITCH)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const allDone = s.total > 0 && s.done >= s.total

  // Layer 1: the shelf behind (broken left of the front cup, so the heart rises from a run start) and its jars.
  for (let x = FRONT_X; x < w; x++) plot(cv, x, 2, SHELF)
  // A glint steps across the lids a pixel every other frame by `t`, then rests two steps before it comes round.
  const jars = Math.max(0, Math.floor((limit - CUPS_X + 3) / 4))
  const glint = mod(t >> 1, Math.max(6, 2 * jars + 2))
  for (let j = 0, x = CUPS_X; j < jars; j++, x += 4) {
    const [lid, fill] = JARS[mod(j, JARS.length)]!
    for (const c of [0, 1]) {
      plot(cv, x + c, 0, glint === 2 * j + c ? GLINT : lid!)
      plot(cv, x + c, 1, fill!)
    }
  }
  // Layer 2: the machine, its lamp in the tool's colour (green on a passed test), the drip on edit; the steam.
  const lamp = pass ? (mod(t, 2) ? GREEN : GOLD) : isTool ? TOOL_INK[tool] : mod(t, 12) < 8 ? GREEN : '#2d6a4f'
  const ink: Ink = { T: TRAY, B: BODY, G: GAUGE, L: lamp, W: WAND, H: STEEL, s: SHOT }
  MACHINE.forEach((row, j) => [...row].forEach((k, c) => ink[k] && plot(cv, 1 + c, 1 + j, ink[k]!)))
  if (isTool && tool === 'edit') {
    if (mod(t, 4) < 2) plot(cv, 2, 4, mod(t, 4) ? GLOSS : ESPRESSO)
    if (mod(t, 4) === 2) plot(cv, 2, 5, ESPRESSO)
  }
  steam(cv, t, isTool && tool === 'bash' ? Math.min(s.actAge, s.toolAge) : -1, isTool ? Math.min(4, s.actAge >> 1) : 0)
  // Layer 3: the barista and his cloth.
  const p = pose(s)
  barista(cv, BAR_X, p)
  for (const [x, y] of p.cloth ?? []) plot(cv, x, y, CLOTH)
  // The agents' baristas in their slots, bobbing on their own beat; the newest waves and flashes as it joins.
  const n = Math.min(s.agents, slots)
  for (let i = n; i < slots; i++) {
    // An empty slot: an apron on its peg, where the next barista will stand.
    const x = slotX(i)
    plot(cv, x + 1, 1, WAND)
    plot(cv, x + 1, 2, RIM)
    for (let c = 0; c < 3; c++) plot(cv, x + c, 3, BROWN)
    plot(cv, x + 1, 4, BROWN)
  }
  for (let i = 0; i < n; i++) {
    const x = slotX(i)
    const greet = i === n - 1 && s.agentsAge < GREET_FRAMES
    const dy = mod(t + 5 * i, 16) < 8 ? 0 : 1
    const hands: Px[] = [[x, 4 + dy], [x + 2, 4 + dy]]
    if (greet) hands[1] = [x + 2, mod(s.agentsAge, 4) < 2 ? 1 + dy : dy]
    const sleeve = greet && mod(s.agentsAge, 2) === 0 ? '#ffffff' : CREAM
    // Three wide: a one-column apron under the face, a sleeve either side.
    for (let y = 2; y < 6; y++) plot(cv, x + 1, y + dy, y === 2 ? RIM : BROWN)
    for (const c of [0, 2]) for (const y of [2, 3]) plot(cv, x + c, y + dy, sleeve)
    plot(cv, x + 1, dy, AGENT_HAIR[i]!)
    plot(cv, x + 1, 1 + dy, SKIN)
    for (const [hx, hy] of hands) plot(cv, hx, hy, SKIN)
  }
  // The cups: `lit` of them filled, the newest in four stages; foam glinting gold at 100%.
  for (let k = 0; k < count; k++) {
    const fresh = k === lit - 1 && s.doneAge < 4 * FILL_STEP && lit > litOf(s.done - 1)
    const glint = allDone && s.doneAge < ALL_FRAMES && mod(s.doneAge + k, 4) < 2
    mug(cv, CUPS_X + CUP_PITCH * k, k >= lit ? 0 : fresh ? 1 + Math.floor(s.doneAge / FILL_STEP) : 4, 0,
      glint ? GOLD : FOAM)
  }
  // The front cup: a spill tips it over 6 frames (rocking first), pours out a puddle that spreads over 10 frames
  // and dries, then it is set back up and refilled, at rest by frame 30.
  let puddle = -1
  if (fail >= 0) {
    const tip = fail < 1 ? 1 : fail < 2 ? 0 : fail < 5 ? 1 : fail < 24 ? 2 : fail < 26 ? 1 : 0
    const stage = fail < 7 ? 2 : fail < 11 ? 1 : fail < 26 ? 0 : Math.min(2, fail - 25)
    mug(cv, FRONT_X, stage, tip)
    // Pouring out of its mouth (in the cup's own column, so nothing bridges to the next cup) onto the counter.
    if (fail >= 5 && fail < 13) plot(cv, FRONT_X + 3, 5 - mod(fail, 2), GLOSS)
    if (fail >= 5 && fail < 15) puddle = Math.min(5, (fail - 4) >> 1)
    else if (fail >= 15 && fail < 25) puddle = 5 - ((fail - 14) >> 1)
  } else mug(cv, FRONT_X, heart >= 0 ? 4 : 2)
  counter(cv, t, FRONT_X + 4, puddle)
  // A commit: a latte-art heart over the front cup, growing in and shrinking out over 16 frames.
  if (heart >= 0) {
    const size = Math.min(2, heart >> 1, (HEART_FRAMES - 1 - heart) >> 1)
    for (const [dx, y] of HEART_ART[size]!) plot(cv, FRONT_X + dx!, y!, HEART)
  }

  const g = cells(cv)
  const { text, c } = sign(s, t, { fail: fail >= 0, pass, heart: heart >= 0 })
  put(g, 2, 3, text, { c, bg: FRONT, b: true })
  if (s.total > 0) put(g, READOUT_X, 3, `${s.done}/${s.total}`, { c: allDone ? GOLD : CREAM, bg: FRONT, b: true })
  return g
}

/** A coffee bean lying on its side: a brown oval with a lighter rim and the dark S-crease along its length,
 * cream eyes over the crease. */
export const PET: PetArt = {
  body: ['...RBBBBR...', '.RBBBBBBBBR.', 'RBkkkkBBBBBR', '.RBBBBkkkkR.', '...RBBBBR...'],
  step: ['...RBBBBR...', '.RBBBBBBBBR.', 'RBkkkkBBBBBR', '.RBBBBkkkkR.', '....RBBBBR..'],
  colors: { B: '#9a5d2a', R: RIM, k: '#5e3517' },
  eyes: [4, 7],
  eyeRow: 0,
  eye: FOAM,
  lid: '#9a5d2a',
  blush: '#ff8fab',
  spark: CREAM,
}

export const COFFEE: Theme = {
  name: 'coffee',
  rows: SCENE_ROWS,
  color: BROWN,
  accent: CREAM,
  sprite: {
    think: ['♨·  ', '♨ · ', '♨  ·', '♨ · '], tool: ['♨~  ', '♨ ~ ', '♨  ~', '♨ ~ '],
    say: ['♨ ♪', '♨ ♫'], wait: ['♨ .', '♨ ..', '♨ ...'],
  },
  happy: '♨ ♥',
  sad: '♨ …',
  dead: '✗',
  sleep: '♨ zZ',
  confetti: ['·', '°', '~', '♥'],
  palette: [RIM, CREAM, GOLD, '#e76f51'],
  scene: coffeeScene,
  pet: PET,
}
