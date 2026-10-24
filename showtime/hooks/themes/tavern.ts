// Theme: tavern. Its scene, its words and its pet.
//
// The scene: an adventurers' tavern (#c9a227) against a lamplit plank wall, in fixed spots from the left: a hearth
// whose fire crackles on two frames, a bard who plays while thinking (notes rising on 12), the barkeep at his counter,
// two tables under the quest board. A scroll per task on the board (fixed pitch, floor-scaled), the newest done one
// torn off and falling six frames; the tally chalked on the counter. A patron per agent (four seats) drinks on eight
// frames, the newest raising a mug in place. tool: he polishes a mug (4 frames) or pours at the tap on bash, the pints
// fill in the tool's colour and its light warms the counter (on actAge); ask/say/wait: a bubble over the bar, his
// arms folded waiting. testFail: a brawl, chairs hurled right from each table, crashing in dust; testPass: the fire
// flares; commit: a toast. Motion rules: the wall fills every row but the firebox, whose flame tips are the run that
// moves; cues and props keep their own columns, clear of the board; patrons' mugs stay under it.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Px = readonly [x: number, y: number]

/** Columns: the bard, his barrel and mug, the counter's ends, the barkeep's left arm, the work mug, the tap, the
 * pints, the sign; the first table and the tables' pitch, the board's left; most scrolls. */
const [BARD_X, MUG_X, BAR_X, BAR_END, KEEP_X, WORK_X, TAP_X, SIGN_X] = [6, 12, 14, 26, 15, 19, 21, 24]
const PINTS = [23, 25]
const [TABLE_X, TABLE_PITCH, BOARD_X, MAX_SCROLLS, SEAT_TILES] = [31, 10, 28, 12, 6]
/** Frames: an act's change, a greeting, the torn scroll (2 tearing, 6 falling), the 100% glow, a flare. */
const [CHANGE_FRAMES, GREET_FRAMES, TEAR_FRAMES, ALL_FRAMES, FLARE_FRAMES] = [4, 12, 8, 16, 12]
/** testFail: a chair's flight (12 frames, a column each, rising out of its table over 3), its top row by frame
 * (under the board, right of the bar); the dust. */
const CHAIR_ARC = [3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 4, 4]
const [DUST_FROM, DUST_TO, BRAWL_TO] = [11, 24, 20]
/** commit: every mug's lift by newsAge, rising over 10 frames and back over 10 (eased), foam on the hold; the
 * patrons' mugs a pixel at most, so they stay under the board. A greeting: a mug up, the hair flashing. */
const TOAST = [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, ...Array(8).fill(2), 2, 2, 1, 1, 1, 1, 1, 0, 0, 0]
const GREET = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]

const [GOLD, DOZE] = ['#c9a227', '#8d99ae']
const [STONE, MANTEL, LOG, EMBER] = [['#6c757d', '#868e96'], '#7f5539', '#6f4518', '#ff8500']
const FIRE: Record<string, string> = { r: '#e85d04', o: '#ff8500', y: '#ffb703', w: '#ffe066' }
/** The fire's two crackle frames, pixel rows 2-4 inside the hearth (columns 1-4). */
const FLAMES = [['.r..', 'royr', 'oywo'], ['..r.', '.yor', 'owyo']]
const [FLOOR, PLANK, SEAM, WALL, BEAM, LAMPLIGHT] = ['#8b5e34', '#7f5539', '#6f4518', '#4f3829', '#5a4030', '#ffd8a8']
const LIGHT_PITCH = 8
const [TOP, SHEEN, FRONT, PANEL] = ['#b08968', '#e6ccb2', '#8b5e34', '#6f4518']
const [SKIN, HAIR, APRON, SHIRT, BROW] = ['#f1c27d', '#adb5bd', '#f8f9fa', '#457b9d', '#6f4518']
const [HAT, FEATHER, TUNIC, LUTE, NECK] = ['#52b788', '#e63946', '#9d4edd', '#dda15e', '#bc6c25']
const [PEWTER, RIM, ALE, FOAM, CLOTH, GLASS] = ['#adb5bd', '#ced4da', '#e09f3e', '#fffbe6', '#a8dadc', '#dee2e6']
const [TABLE, CANDLE, FLAME, STOOL, HOOP] = ['#a47148', '#fff3b0', ['#ffb703', '#ff8500'], '#9c6644', '#adb5bd']
const [BOARD, BOARD_LIT, SCROLL, ROLL, SEAL] = ['#9c6644', '#c08552', '#f1e3c4', '#d6c39b', '#c1121f']
const [CHAIR, DUST, NOTE] = ['#deb887', ['#e9ecef', '#ced4da', '#adb5bd', '#868e96'], ['#ffd166', '#ff8fab']]
const PATRONS = [['#e76f51', '#ffb703'], ['#2a9d8f', '#adb5bd'], ['#e9c46a', '#e63946'], ['#8ecae6', '#f4a261']]
const TOOL_INK: Record<ToolKind, string> = { bash: '#ffd60a', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** A mug, one column: foam over ale, `lift` pixels up from resting on pixel row `y` (its bottom); foam
 * splashing over it on alternate frames when `splash` (never above the band). */
function mug(cv: Canvas, x: number, y: number, lift: number, splash = -1): void {
  plot(cv, x, y - 1 - lift, FOAM)
  plot(cv, x, y - lift, ALE)
  const sy = y - 2 - lift - mod(splash, 2)
  if (splash >= 0 && sy >= 0) plot(cv, x + (mod(splash, 4) < 2 ? 0 : 1), sy, '#ffffff')
}

/** The hearth: mantel, stone sides and hearth, logs, the fire's crackle frame (taller and whiter on a flare), an
 * ember stepping along the logs on 12 frames, the fire's glow flickering on the floor in front. */
function hearth(cv: Canvas, t: number, flare: number): void {
  for (let x = 0; x < 6; x++) plot(cv, x, 0, MANTEL)
  for (const y of [1, 4, 5, 6]) for (const x of y === 1 || y === 6 ? [0, 1, 2, 3, 4, 5] : [0, 5]) {
    plot(cv, x, y, STONE[noise(x * 7 + y * 3) < 0.5 ? 0 : 1]!)
  }
  for (let x = 1; x < 5; x++) plot(cv, x, 5, mod(t, 12) >> 2 === x - 1 ? EMBER : LOG)
  FLAMES[mod(t, 2)]!.forEach((row, j) => [...row].forEach((k, i) => {
    if (FIRE[k]) plot(cv, 1 + i, 2 + j, flare > 0 && j > 0 ? FIRE[k === 'r' ? 'y' : 'w']! : FIRE[k]!)
  }))
  if (flare > 0) for (let x = 1; x < 5; x++) if (mod(x + t, 2) === 0 || flare > 1) plot(cv, x, 1, FIRE.y!)
  for (let x = 0; x < 9; x++) plot(cv, x, 7, mix(FLOOR, EMBER, (0.35 - x * 0.04) * (mod(t, 2) ? 1 : 0.7)))
}

/** The bard on his stool by the barrel: hat and feather, face, tunic, the lute across him (its neck up to the
 * right); strumming in think (the hand on a 4-frame cycle) with notes rising off the neck on 12, else resting,
 * his foot tapping on 12 in every act; dozing (his head sunk a pixel, the lute's neck with it) while waiting. */
function bard(cv: Canvas, t: number, playing: boolean, doze: boolean): void {
  const art = doze ? ['......', '...F..', '.HHH.N', '.SS.N.', '.TTLL.', '.TTLL.', '.BB...']
    : ['...F..', '.HHH..', '.SS..N', '.TT.N.', '.TTLL.', '.TTLL.', '.BB...']
  draw(cv, BARD_X, 0, art, { F: FEATHER, H: HAT, S: SKIN, T: TUNIC, L: LUTE, N: NECK, B: STOOL })
  plot(cv, BARD_X + 3, playing && mod(t, 4) >= 2 ? 5 : 4, SKIN)
  plot(cv, BARD_X + (mod(t, 12) < 6 ? 3 : 4), 6, TUNIC)
  // A note every 12 frames beside the lute's head, rising a pixel every third frame (3 px) and swaying a column.
  const step = mod(t, 12) / 3 | 0
  if (playing) plot(cv, MUG_X + 1 - mod(step, 2), 3 - step, NOTE[mod(t / 12 | 0, 2)]!)
}

/** The barkeep's hands for the act, keyed on `actAge` from rest (both hands down on the counter's edge), and the
 * cloth while he polishes: around the work mug a pixel a frame. */
function keeper(s: Signals, t: number): { hands: Px[]; cloth?: Px; head: number; fold?: boolean } {
  const a = s.actAge
  const rest: Px[] = [[KEEP_X, 3], [KEEP_X + 3, 3]]
  if (s.act === 'tool' && s.tool === 'bash') return { hands: [rest[0]!, [KEEP_X + 3, 2]], head: 0 }
  if (s.act === 'tool') {
    const cloth = ([[WORK_X, 2], [WORK_X + 1, 2], [WORK_X + 1, 3], [WORK_X, 3]] as const)[mod(t, 4)]!
    return { hands: [rest[0]!, [KEEP_X + 3, cloth[1]]], cloth, head: 0 }
  }
  if (s.act === 'ask') return { hands: [rest[0]!, [KEEP_X + 3, a < 1 ? 2 : mod(a, 12) < 6 ? 0 : 1]], head: 0 }
  if (s.act === 'say') {
    const open = a >= 1 && mod(a, 12) < 6
    return { hands: [open ? [KEEP_X - 1, 2] : rest[0]!, [KEEP_X + 4, a < 1 ? 3 : 1]], head: 0 }
  }
  // Waiting he folds his arms over the apron (a frame per hand) and dozes, his head sinking on a 16-frame breath.
  if (s.act === 'wait') {
    return { hands: [a < 2 ? rest[0]! : [KEEP_X + 1, 3], a < 1 ? rest[1]! : [KEEP_X + 2, 3]], fold: a >= 2,
      head: a >= 2 && mod(a, 16) < 10 ? 1 : 0 }
  }
  return { hands: rest, head: 0 }
}

/** The bar: the counter (its sheen sliding by `t`, the tool's light warming its top by `glow`), the barkeep, the
 * work mug (filled under the tap on bash), the tap, the pints (filling in the tool's colour by `fill` frames). */
function bar(cv: Canvas, t: number, s: Signals, glow: number, fill: number, lift: number, hold: number): void {
  const ink = TOOL_INK[s.tool ?? 'other']
  const k = keeper(s, t)
  // A toast: his free hand raises a mug whatever the act (so its gesture holds still through it).
  if (lift >= 0) {
    k.hands[0] = [KEEP_X, 3 - lift]
    mug(cv, BAR_X, 3, lift, hold)
  }
  const y0 = k.head
  draw(cv, KEEP_X, y0, ['.HH.', '.SB.'], { H: HAIR, S: SKIN, B: BROW })
  for (const y of [2, 3]) for (const c of [1, 2]) if (y >= y0 + 2) plot(cv, KEEP_X + c, y, APRON)
  for (const c of [0, 3]) for (const y of k.fold ? [2, 3] : [2]) plot(cv, KEEP_X + c, y, SHIRT)
  for (const [x, y] of k.hands) plot(cv, x, y, SKIN)
  // The work mug on the counter, under the tap: poured on bash (the stream flickering), else pewter.
  const pour = s.act === 'tool' && s.tool === 'bash'
  const level = pour ? Math.min(2, s.actAge >> 2) : 0
  for (const c of [0, 1]) {
    plot(cv, WORK_X + c, 2, level >= 2 ? FOAM : RIM)
    plot(cv, WORK_X + c, 3, level >= 1 ? ALE : PEWTER)
  }
  if (k.cloth) plot(cv, k.cloth[0], k.cloth[1], CLOTH)
  if (pour) plot(cv, WORK_X + 1, 1, mod(t, 2) ? ALE : '#f4a261')
  plot(cv, WORK_X + 1, 0, RIM)
  plot(cv, TAP_X, 0, pour ? ink : GOLD)
  for (const y of [1, 2, 3]) plot(cv, TAP_X, y, RIM)
  // The pints, each filling a pixel at a time (two frames apart) from the bottom, foam last.
  PINTS.forEach((x, p) => {
    for (const y of [2, 3]) {
      const full = fill - 2 - 4 * p >= 2 * (3 - y)
      plot(cv, x, y, full ? (y === 2 ? FOAM : ink) : y === 2 ? RIM : GLASS)
    }
  })
  const sheen = mod(t >> 1, 24)
  for (let x = BAR_X; x <= BAR_END; x++) {
    plot(cv, x, 4, mix(x - BAR_X === sheen ? SHEEN : TOP, ink, glow))
    plot(cv, x, 5, FRONT)
    plot(cv, x, 6, mod(x - BAR_X, 4) === 0 ? PANEL : FRONT)
  }
}

/** The quest board (at least over the tables): a scroll per task at a fixed pitch from its left
 * (floor-scaled), done ones torn away (a scrap left on the pin), the newest shaking two frames then falling six
 * from its tile; a glint stepping along the top row. */
function board(cv: Canvas, t: number, s: Signals): Px | undefined {
  const fit = Math.max(0, Math.floor((cv.w - BOARD_X - 1) / 3))
  const count = Math.min(s.total, MAX_SCROLLS, fit)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const tear = s.doneAge < TEAR_FRAMES && lit > litOf(s.done - 1) ? s.doneAge : -1
  const tiles = Math.min(fit, Math.max(count, SEAT_TILES))
  const glint = mod(t >> 1, 3 * tiles + 8)
  for (let x = BOARD_X; x <= BOARD_X + 3 * tiles; x++) for (const y of [0, 1]) plot(cv, x, y, BOARD)
  for (let k = 0; k < tiles; k++) {
    const x = BOARD_X + 1 + 3 * k
    const pinned = k < count && (k >= lit || (k === lit - 1 && tear >= 0 && tear < 2))
    const shake = pinned && k === lit - 1 ? mod(tear, 2) : 0
    for (const c of [0, 1]) {
      const top = pinned ? ROLL : k < count && c === 0 ? SCROLL : BOARD
      plot(cv, x + c, 0, glint === 3 * k + c ? (top === BOARD ? BOARD_LIT : '#fffaf0') : top)
      plot(cv, x + c, 1, !pinned ? BOARD : c === shake ? SCROLL : shake || k !== lit - 1 ? SEAL : '#ffffff')
    }
  }
  // The falling scroll's top-left, drawn by the caller over everything.
  return tear >= 2 && lit > 0 && lit <= tiles ? [BOARD_X + 1 + 3 * (lit - 1), tear - 1] : undefined
}

/** A table: top, pedestal, a candle flickering (now and then a pixel taller), burning low and red while `low`. */
function table(cv: Canvas, t: number, tx: number, k: number, low: boolean): void {
  for (let c = 0; c < 3; c++) plot(cv, tx + c, 5, TABLE)
  plot(cv, tx + 1, 6, TABLE)
  plot(cv, tx + 1, 4, CANDLE)
  const flame = low ? ['#e85d04', '#9d4b1c'] : FLAME
  plot(cv, tx + 1, 3, flame[noise(k * 5 + (t >> 1)) < 0.5 ? 0 : 1]!)
  if (mod(t + 5 * k, 14) < 3 && !low) plot(cv, tx + 1, 2, flame[0]!)
}

/** A patron at seat `side` (0 left of the table, facing right; 1 right of it, mirrored), the mug lifted `lift`
 * above the table, the hair flashing white in a greeting. An empty seat is a stool. */
function patron(cv: Canvas, tx: number, side: number, i: number, sat: boolean,
  o: { lift: number; flash: boolean; froth: boolean }): void {
  const at = (c: number, y: number, ink: string) => plot(cv, side ? tx + 5 - c : tx - 3 + c, y, ink)
  for (const y of sat ? [6] : [5, 6]) [at(0, y, STOOL), at(1, y, STOOL)]
  if (!sat) return
  const [body, ink] = PATRONS[i]!
  const hair = o.flash ? '#ffffff' : ink!
  for (const [c, y] of [[0, 2], [1, 2], [0, 3]] as const) at(c, y, hair)
  at(1, 3, SKIN)
  for (const y of [4, 5]) [at(0, y, body!), at(1, y, body!)]
  at(2, 4 - o.lift, SKIN)
  mug(cv, side ? tx + 2 : tx, 4, o.lift)
  if (o.froth) plot(cv, side ? tx + 2 : tx, 3 - o.lift, '#ffffff')
}

/** A hurled chair, three by three, tumbling (flipped every three frames), its first frames only its lower rows. */
function chair(cv: Canvas, x: number, y: number, a: number): void {
  const art = mod(a, 6) < 3 ? ['c..', 'ccc', 'c.c'] : ['..c', 'ccc', 'c.c']
  art.forEach((row, j) => [...row].forEach((k, c) => k === 'c' && j >= 2 - a && plot(cv, x + c, y + j, CHAIR)))
}

/** Dust where a chair crashed, `a` frames on: a solid puff spreading to three pixels each way and back, its middle
 * billowing a pixel higher, mottled and fading. */
function dust(cv: Canvas, x: number, a: number): void {
  const r = Math.max(0, Math.min(3, (a + 1) >> 1, (DUST_TO - DUST_FROM - a) >> 1))
  for (let dx = -r; dx <= r; dx++) for (const y of Math.abs(dx) < r ? [4, 5] : [5]) {
    plot(cv, x + dx, y, DUST[Math.min(3, (a >> 2) + (noise(dx * 3 + y + a) < 0.4 ? 1 : 0))]!)
  }
}

/** The sign over the bar: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, k: { fail: boolean; pass: boolean; toast: boolean }) {
  if (k.fail) return { text: '×', c: FEATHER }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (k.toast) return { text: '✓', c: GOLD }
  if (Math.min(s.actAge, s.toolAge) < CHANGE_FRAMES) return { text: '·', c: RIM }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: NOTE[1]! }
  if (s.act === 'wait') return { text: frame(['z', 'Z'], t >> 2), c: DOZE }
  return { text: frame(['·', ':'], t >> 2), c: RIM }
}

export function tavernScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const fail = s.news === 'testFail' && s.newsAge < DUST_TO ? s.newsAge : -1
  const pass = s.news === 'testPass' && s.newsAge < FLARE_FRAMES ? s.newsAge : -1
  const toast = s.news === 'commit' && s.newsAge < TOAST.length ? s.newsAge : -1
  const isTool = s.act === 'tool'

  // Layer 1: the wall (a ceiling beam, lamplight bands drifting right a column every other frame, LIGHT_PITCH
  // apart, so every column brightens within 16 frames; warmed by the fire's flicker; the firebox dark),
  // the floor and the hearth, its fire crackling in every act and flaring on a passed test.
  const warm = mod(t, 2) ? 0.22 : 0.14
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < 7; y++) {
      if ((x >= 1 && x <= 4 && y >= 1 && y <= 4) || (x === 0 && (y === 2 || y === 3))) continue
      const base = y === 0 ? BEAM : WALL
      const band = Math.abs(mod(x - (t >> 1), LIGHT_PITCH) - 1)
      const lit = band < 2 ? mix(base, LAMPLIGHT, band ? 0.07 : 0.14) : base
      plot(cv, x, y, x < 11 ? mix(lit, EMBER, warm * (1 - x / 11)) : lit)
    }
    plot(cv, x, 7, mod(x, 6) === 5 ? SEAM : mod(x, 12) < 6 ? FLOOR : PLANK)
  }
  hearth(cv, t, pass < 0 ? 0 : pass < 2 || pass >= FLARE_FRAMES - 2 ? 1 : 2)
  // Layer 2: the bard, his barrel and mug (raised in a toast).
  const dozing = s.act === 'wait' && s.actAge >= 3
  bard(cv, t, s.act === 'think', dozing)
  for (const y of [5, 6]) for (const c of [0, 1]) plot(cv, MUG_X + c, y, y === 5 ? HOOP : STOOL)
  const lift = toast >= 0 ? TOAST[toast]! : 0
  const hold = toast >= 10 && toast < 18 ? toast : -1
  mug(cv, MUG_X, 4, lift, hold)
  if (lift > 0) plot(cv, MUG_X - 1, 3 - lift, SKIN)
  // Layer 3: the bar. The tool's own (the pints filling, the light on the counter) grow in on actAge alone.
  const glow = isTool ? 0.45 * Math.min(1, s.actAge / 8) : 0
  if (BAR_X < w) bar(cv, t, s, glow, isTool ? s.actAge : -99, toast >= 0 ? lift : -1, hold)
  // ask, say, wait: a bubble over the bar (gold asking, white saying, slate dozing), grown over 3 frames of actAge.
  const talk = s.act === 'ask' || s.act === 'say' || s.act === 'wait' ? Math.min(3, s.actAge) : 0
  const bubble = s.act === 'ask' ? GOLD : s.act === 'wait' ? DOZE : APRON
  for (const [x, y, from] of [[SIGN_X - 2, 1, 1], [SIGN_X - 1, 0, 2], [SIGN_X - 1, 1, 2], [SIGN_X, 0, 3],
    [SIGN_X, 1, 3], [SIGN_X + 1, 0, 3], [SIGN_X + 1, 1, 3]] as const) if (talk >= from) plot(cv, x, y, bubble)
  // Layer 4: the quest board and the tables, a patron per agent in fixed seats (two a table).
  const falling = board(cv, t, s)
  const seats = [0, 1, 2, 3].filter(i => TABLE_X + TABLE_PITCH * (i >> 1) + (i & 1 ? 5 : 2) < w)
  const n = Math.min(s.agents, seats.length)
  const low = s.act === 'wait' && s.actAge >= 4
  for (let k = 0; 2 * k < seats.length; k++) table(cv, t, TABLE_X + TABLE_PITCH * k, k, low)
  for (const i of seats) {
    const tx = TABLE_X + TABLE_PITCH * (i >> 1)
    const isNew = i === n - 1 && s.agentsAge < GREET_FRAMES
    const greet = isNew ? GREET[s.agentsAge]! : 0
    const drink = mod(t + 3 * i, 8) >= 5 ? 1 : 0
    const brawl = fail >= 1 && fail < BRAWL_TO ? (mod(fail + i, 4) < 2 ? 1 : 0) : -1
    patron(cv, tx, i & 1, i, i < n, {
      lift: toast >= 0 ? Math.min(1, lift) : brawl >= 0 ? brawl : greet || drink,
      flash: isNew && s.agentsAge < 8 && mod(s.agentsAge, 4) < 2,
      froth: hold >= 0 && mod(hold + i, 2) === 0,
    })
  }
  // testFail: a chair hurled to the right from each table (away from the bar), crashing in dust.
  if (fail >= 0) for (let k = 0; 2 * k < seats.length; k++) {
    const tx = TABLE_X + TABLE_PITCH * k
    if (fail < CHAIR_ARC.length) chair(cv, tx + fail, CHAIR_ARC[fail]!, fail)
    else if (fail >= DUST_FROM) dust(cv, tx + 1 + DUST_FROM, fail - DUST_FROM)
  }

  // The torn scroll falls in front of everything.
  const [fx, fy] = falling ?? [-9, 0]
  for (const c of [0, 1]) [plot(cv, fx + c, fy, ROLL), plot(cv, fx + c, fy + 1, c ? SEAL : SCROLL)]

  const g = cells(cv)
  if (SIGN_X < w) {
    const { text, c } = sign(s, t, { fail: fail >= 0, pass: pass >= 0, toast: toast >= 0 })
    put(g, SIGN_X, 0, text, talk >= 3 && fail < 0 && pass < 0 && toast < 0 ? { c: '#3d2b1f', bg: bubble, b: true }
      : { c, bg: WALL, b: true })
  }
  if (s.total > 0 && BAR_END < w) {
    const tallyX = BAR_END + 1 - `${s.done}/${s.total}`.length
    const all = s.done >= s.total && s.doneAge < ALL_FRAMES && mod(s.doneAge, 4) < 2
    put(g, tallyX, 3, `${s.done}/${s.total}`, { c: all ? GOLD : SCROLL, bg: FRONT, b: true })
  }
  return g
}

/** A frothy tankard: a foam head spilling over the rim (dripping down the left), an amber body with a face, a
 * pewter base, the handle a ring on the right. */
export const PET: PetArt = {
  body: ['..FFFFFF....', '.FFFFFFFFhh.', '.FAAAAAAA.h.', '..AAAAAAA.h.', '..PPPPPPPhh.'],
  step: ['...FFFFFF...', '.FFFFFFFFhh.', '..AAAAAAAF.h', '..AAAAAAA.h.', '..PPPPPPPhh.'],
  colors: { F: FOAM, A: ALE, P: PEWTER, h: RIM },
  eyes: [4, 7], eyeRow: 2, eye: '#3d2b1f', lid: ALE, mouth: [5, 3], blush: '#ff8fab', spark: GOLD,
}

export const TAVERN: Theme = {
  name: 'tavern',
  rows: SCENE_ROWS,
  color: GOLD,
  accent: FOAM,
  sprite: {
    think: ['♪·  ', '♪ · ', '♪  ·', '♪ · '], tool: ['▯~  ', '▯ ~ ', '▯  ~', '▯ ~ '],
    say: ['♪ ♫', '♫ ♪'], wait: ['▯ .', '▯ ..', '▯ ...'],
  },
  happy: '▯ ✓', sad: '▯ …', dead: '✗', sleep: '▯ zZ',
  confetti: ['✦', '·', '°', '♪'],
  palette: [GOLD, FOAM, ALE, FEATHER],
  scene: tavernScene,
  pet: PET,
}
