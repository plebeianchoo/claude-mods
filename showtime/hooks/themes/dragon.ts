// Theme: dragon. Its scene, its words and its pet.
//
// The scene (2.0, six rows, every cell painted): a sunny fixed stage, life moving inside it. A blue sky brightening
// to the hills, a sun whose rays swap and whose core shimmers, clouds drifting left, far green hills a flock of
// birds crosses now and then; a stone castle at the left (a crenellated keep, a gate, a round tower with a red
// cone roof, its gold pennant flapping, the princess's window), two archers bobbing on the wall, the grass swaying
// at the bottom with fixed flowers; a knight at his post right of the castle, breathing, shifting his weight; and a
// red 16-bit dragon flying a figure-eight over the field by `t` alone, beating its gold wings on eight frames.
// think / wait: it patrols; the princess glances out of her window now and then. bash: a cone of fire down and
// ahead of its jaws, grown only on frames its head holds still, flickering, smoke peeling off the tip; when the tip
// is over the knight he raises his shield and sparks bounce off it. Other tools: sparks off its nose in the tool's
// colour, its wings tinting toward it. ask: the princess leans out waving, a `?` beside her window. say: its jaws
// work and sound rings leave them. A wyvern per agent trails it on its path, the newest flashing as it joins. A
// banner per task hangs from the battlements, furled grey while open, unrolling gold once done. Each actor has a
// home pose for `t` (`patrol`, `knightHome`, `princessHome`). Every 160 frames a set piece plays (strafe, charge,
// tower, catapult, landing, sheep), now and then an easter egg instead (frying pan, Clawd, hatchling): one function
// each, giving who is where at the slot's age, leaving home and back by its end. On a wide band the patrol roams:
// slots whose pieces allow it start or end at the far end, so the dragon crosses the field (at most 120 columns, a
// pixel a frame). News (testPass, testFail, commit) plays on top of all that for 28 frames: fireworks over the
// castle, the banners hung out and the knight's sword salute; a fire blast knocking the knight down, dazed under
// circling stars (on a narrow band, an arrow in the dragon); a roar, the royal banner under the princess's window,
// confetti off the battlements.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { eggSlot, firstSlot, slotAt } from '../events'
import type { Slot } from '../events'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { along, mix, paint, sprite } from '../pixel'
import type { Waypoint } from '../pixel'
import type { Signals, Theme, ToolKind } from '../themes'

/** The band's height in cells (12 pixel rows). */
export const DRAGON_ROWS = 6

// ---- constants and palette -------------------------------------------------------------------------------------

/** Widths: from FULL the whole castle; from WIDE its right part (the left keep off the edge, CROP columns); below
 * WIDE no hills, knight, archers or keep (the tower alone); below TINY no tower either. */
const [FULL, WIDE, TINY, CROP] = [72, 44, 24, 11]
/** The dragon's box, the wyvern's, how far into the dragon's box a wyvern flies, the most wyverns. */
const [DW, DH, VW, VX, VY, MAX_WYVERNS] = [16, 7, 8, 4, 2, 4]
/** The patrol: its left bound past the knight's column (over his head on the full stage, clear of him when
 * cropped), its margin from the right (clear of the sun on the full stage, across it when narrower). */
const [ZONE_DX, ZONE_DX_CROP, ZONE_R, ZONE_R_NARROW] = [4, 7, 10, 4]
/** The knight's home column and top row; the tower's left column (wide). */
const [KNIGHT_X, KNIGHT_Y, TOWER_X] = [26, 3, 14]
/** Frames: an act's change; the fire cone's most length; the sparks'; a wyvern's greeting. */
const [CHANGE, CONE, SPARKS, GREET] = [4, 10, 8, 8]

const [GOLD, PALE, WHITE, INK] = ['#ffb703', '#fff3b0', '#ffffff', '#1b1f3b']
const [FLAME, EMBER] = ['#ffd60a', '#fb8500']
const SMOKE = ['#e9ecef', '#adb5bd']
/** The sky by pixel row, y 0 to 9 (the grass covers 10 and 11). */
const SKY = Array.from({ length: 12 }, (_, y) => mix('#2f80ed', '#9fd8ff', y / 8))
const SUN = { S: '#ffe066', C: '#fff3b0', R: '#ffd166', E: mix('#ffd166', '#fb8500', 0.25) }
const CLOUD = { W: '#ffffff', w: '#eef5fc', S: '#d6e6f5' }
const HILL = ['#8fd18f', '#6fbf73', '#4f9a5a']
const FAR_HILL = HILL.map(c => mix(c, '#9fd8ff', 0.45))
const TREE = { L: '#52b788', G: '#40916c', g: '#2d6a4f', b: '#6b4226' }
const TREE_ART = ['.L.', 'LGg', 'GGg', '.b.']
const GRASS = { hi: '#7ed957', base: '#5cbf3a', shade: '#47a02c', deep: '#3a8a24' }
const FLOWERS = ['#ff6b6b', '#ffd166', '#ffffff', '#c77dff']
const BIRD = '#3d405b'
const STONE = paint('ABCD', '#a9a9bc')
const ROOF = paint('EFGH', '#d62839')
const WOOD = paint('IiOo', '#7f5539')
const WINDOW = '#2b2d42'
const BANNER = paint('XYZz', GOLD)
const FURLED = paint('NnMm', '#8d8f9e')
const DRAGON_KEYS: Record<string, string> = {
  ...paint('RrqQ', '#e63946'), ...paint('YyuU', '#ffd6a5'), ...paint('WwvV', GOLD),
  H: '#fff3b0', h: '#d9b779', E: '#fffbe6', P: INK, M: '#6a040f', T: '#ffffff', C: '#fff3b0',
}
const KNIGHT_KEYS: Record<string, string> = {
  ...paint('KkjJ', '#c0c8d8'), P: '#ff595e', p: mix('#ff595e', INK, 0.3), F: INK,
  T: '#3a86ff', t: mix('#3a86ff', INK, 0.35), Z: mix('#3a86ff', '#fff6d5', 0.4), S: '#3a86ff', s: mix('#3a86ff', INK, 0.35),
  C: '#ffd166', B: '#eef2f8', G: '#ffd166', M: '#6b4226', m: '#4a2e1a',
}
const PRINCESS_KEYS: Record<string, string> = {
  D: '#ff8fab', d: '#ff5d8f', L: mix('#ff8fab', '#fff6d5', 0.4), A: '#ffd166', a: mix('#ffd166', '#bc6c25', 0.35),
  F: '#f6c9a8', c: '#ffd60a', K: '#f6c9a8',
}
const ARCHER_KEYS: Record<string, string> = { ...paint('GgeE', '#4f9a5a'), F: '#f6c9a8', b: '#a47148' }
/** Wyverns' materials, one hue each. */
const HUES = ['#52b788', '#b185db', '#4cc9f0', '#f4a261'].map(h => paint('AaoO', h))
const TOOL_INK: Record<ToolKind, string> = { bash: FLAME, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

// ---- sprite art (facing right; `.` clear) ------------------------------------------------------------------------

/** The dragon, 16×7: a spade-tipped tail at the left, a deep body (highlit back, shaded flank, a pale belly in
 * three tones), two legs with claws, and a horned head (eye with a pupil, a long snout, a jaw) at the right. */
const DRAGON_BODY = [
  '...........hH...',
  '..........QRREP.',
  '....QrRrrRrrrrRR',
  'Q..qrrrrrrrryyqQ',
  'QQqrryyYYyyu....',
  '...qquyyyyuq....',
  '.....qQC..qQC...',
]
/** The jaws open: the upper jaw lifted a pixel, teeth and a dark mouth between. */
const DRAGON_OPEN = [
  '...........hH...',
  '..........QRREPr',
  '....QrRrrRrrrrTM',
  'Q..qrrrrrrrryyqQ',
  'QQqrryyYYyyu....',
  '...qquyyyyuq....',
  '.....qQC..qQC...',
]
/** The near wing over the body in three poses, a bat wing (a scaled arm, gold membrane, a scalloped trailing edge):
 * up over the back, out behind, down under the belly; the cycle runs up, mid, down, mid. */
const WINGS = [
  ['..QQRrrR........', '...VWWwwq.......', '....VvwvV.......'],
  ['', '.QQRrrrR........', '..VWWwwvq.......', '...VvVvv........'],
  ['', '', '', '......QRq.......', '....VWwwv.......', '...VWwvv........', '...VV.v.........'],
  // Folded along the back, landed.
  ['', '....QRRrq.......', '...VWWwwvV......'],
]
const [WING_CYCLE, FOLDED] = [[0, 1, 2, 1], 3]
/** A wyvern, 8×4: tail, body and a horned head, its wing up or down. */
const WYVERN = [
  ['..Aa....', 'o.aaAAaE', '.ooaaaO.', '........'],
  ['........', 'o.aaAAaE', '.ooAaaO.', '...aO...'],
]
/** The knight, 7×8, facing right: plumed helm with a visor slit, tabard over mail, shield on the far arm, sword. */
const KNIGHT = [
  ['..Pp...', '.JKkJ..', '.JkFJ.B', 'ZSJTtJB', 'SCSTtGG', 'ssJTtJ.', '..j.j..', '.MM.Mm.'],
  // Weight on the back foot: the sword arm drops a pixel.
  ['..Pp...', '.JKkJ..', '.JkFJ..', 'ZSJTtJB', 'SCSTtJB', 'ssJTtGG', '..j.j..', '.MM.Mm.'],
]
/** The plume lifted a pixel (its breath), drawn a row above the helm. */
const PLUME_UP = ['...p...']
/** Shield up: the shield raised in front of his face toward the dragon, the sword held back. */
const KNIGHT_SHIELD = ['..PpZS.', '.JKkSCs', '.JkFss.', 'BJJTtJ.', 'GGTTtJ.', '.JJTtJ.', '..j.j..', '.MM.Mm.']
/** The knight's legs running, on four frames; with his sword raised overhead, leaping. */
const RUN_LEGS = [['..j.j..', '.MM.Mm.'], ['.j...j.', 'MM...Mm'], ['..j.j..', '.MM.Mm.'], ['...jj..', '..MMm..']]
const KNIGHT_SLASH = ['..Pp..B', '.JKkJB.', '.JkFG..', 'ZSJTtJ.', 'SCSTtJ.', 'ssJTtJ.', '.j...j.', 'MM...Mm']
/** The slash's white arc ahead of his sword, three frames (offsets from his top left, facing right). */
const SLASH = [[[6, -1], [7, 0], [7, 1]], [[7, 0], [8, 1], [8, 2], [8, 3]], [[8, 2], [8, 3], [7, 4], [6, 5]]]
/** The princess in her window (3×2: crown, hair, face) and leaning out (her arm up or down, the dress on the sill). */
const PRINCESS_IN = ['AcA', 'aFa']
const PRINCESS_OUT = [['.cA.K', 'AFaK.', 'LDd..'], ['.cA..', 'AFaKK', 'LDd..']]
/** The princess out of her window, 3×6: crown, hair and face, arms, a pink gown. Her frying pan (offsets from her
 * top left, facing right) hangs down, comes up, swings over. */
const PRINCESS_FULL = ['.c.', 'AFa', 'KDK', 'LDd', 'DDd', 'Ldd']
const PAN: Record<string, [number, number, string][]> = {
  down: [[3, 2, 'h'], [3, 3, 'P'], [4, 3, 'P']],
  mid: [[3, 2, 'h'], [4, 1, 'P'], [4, 2, 'P']],
  up: [[3, 1, 'h'], [3, 0, 'P'], [3, -1, 'P']],
  hit: [[3, 1, 'h'], [4, 0, 'P'], [5, 0, 'P']],
}
const PAN_KEYS: Record<string, string> = { P: '#4a4e69', h: '#6b4226' }
const ROPE = '#c9a66b'
/** An archer, 3×3: hood, face and bow, tunic. */
const ARCHER = ['.Gb', 'eFb', 'Egb']
/** Cheering: the bow raised over the hood, an arm up. */
const ARCHER_CHEER = ['.bb', '.Gb', 'eFe', 'Eg.']
/** Clouds: small, middle and big puffs. */
const CLOUDS = [
  ['..WWw..', 'SwwwwwS'],
  ['...WW...', '.WWWWww.', 'SSwwwwSS'],
  ['...WWW....', '.WWWWWWww.', 'SSwwwwwwSS'],
]
const BIRDS = [['B.B', '.B.'], ['.B.', 'B.B']]
/** The pennant off the roof's apex: four poses, a pixel each, colours rippling down it. */
const PENNANT: [number, number, string][][] = [
  [[0, 0, 'Y'], [1, 0, 'X'], [2, 0, 'Z']],
  [[0, 0, 'X'], [1, 0, 'Z'], [2, 1, 'Y']],
  [[0, 0, 'Z'], [1, 1, 'Y'], [2, 1, 'X']],
  [[0, 0, 'Y'], [1, 0, 'Z'], [2, 1, 'X']],
]

/** A sheep, 4×3 facing right: wool shaded grey, a dark face, legs stepping; grazing, its head down. */
const SHEEP = [['WWW.', 'wWWF', 'L.L.'], ['WWW.', 'wWWF', '.L.L']]
const SHEEP_GRAZE = ['WWW.', 'wWW.', 'L.LF']
const SHEEP_KEYS: Record<string, string> = { W: '#ffffff', w: '#c9ccd6', F: '#3d405b', L: '#3d405b' }
/** A hay bale, 4×3, its straw turning as it rolls; straw tones. */
const BALE = [['yYYy', 'YyYY', 'oyyo'], ['YyYy', 'yYYy', 'oyyo']]
const BALE_KEYS: Record<string, string> = { Y: '#e9c46a', y: '#c9a227', o: '#8a6d1c' }
const STRAW = ['#e9c46a', '#ffd166']
/** The catapult's arm (wood, a dark cup) and its boulder, 3×3 in a grey ramp; the dust where it lands. */
const BOULDER = ['ABC', 'BBC', 'CCD']
const ROCK = paint('ABCD', '#8d8f9e')
const DUST = '#e6d5b8'
const [ARROW_HEAD, ARROW_SHAFT, STAR] = ['#e9ecef', '#a47148', '#ffd60a']
/** A small horse, 9×4 facing right (tail, back, a head with its mane), its legs galloping on four frames. */
const HORSE = ['......mH.', 'tHHHHHHHH', '.hHHHHh..']
const HOOVES = ['.h.h..h.h', '..hh..hh.', 'h...hh..h', '..hh..hh.']
const HORSE_KEYS: Record<string, string> = { H: '#8d5a3b', h: '#6b4226', m: '#3d2817', t: '#3d2817' }
/** Clawd at 6×3, shrunk from the shared shape (every pair of columns, its top and middle rows), eyes on. */
const CLAWD_MINI = (() => {
  const half = (row: string) => Array.from({ length: row.length >> 1 }, (_, i) => (row[2 * i] !== '.' ? row[2 * i]! : row[2 * i + 1]!)).join('')
  const rows = [0, 2, 3].map(r => half(CLAWD_SHAPE.body[r]!))
  const eyes = CLAWD_SHAPE.eyes.map(x => x >> 1)
  rows[1] = [...rows[1]!].map((c, i) => (eyes.includes(i) ? 'E' : c)).join('')
  return rows
})()
const CLAWD_KEYS: Record<string, string> = { O: '#d77757', L: '#e8957a', D: '#a9553b', E: CLAWD_SHAPE.eye }
/** Clawd's lance (offsets from the rig's left, his arm's row): level, half up, tipped. */
const LANCE = [
  [[7, 0], [8, 0], [9, 0], [10, 0], [11, 0]],
  [[7, 0], [8, 0], [9, -1], [10, -1], [11, -1]],
  [[7, 0], [8, -1], [9, -1], [10, -2], [11, -2]],
]
/** The hatchling, 6×4 facing right: horns, a big red head with a pale eye and pink snout, a gold belly and wing
 * nub (up or down), a dark tail. */
const HATCH = [
  ['..N.K.', 'T.BHHE', '.BGBHS', '..B.B.'],
  ['....K.', 'T.BHHE', '.BNBHS', '..B.B.'],
]
const HATCH_KEYS: Record<string, string> = { K: '#ffd166', N: GOLD, B: '#e63946', H: '#e63946', G: GOLD, S: '#ff758f', T: '#c1121f', E: PALE }

// ---- poses ------------------------------------------------------------------------------------------------------

/** A flyer on the figure-eight: its left column, top pixel row, facing, wing pose, frames since its last turn and
 * to its next. */
export type Fly = { x: number; y: number; face: 1 | -1; wing: number; since: number; until: number }
/** The figure-eight for a width: its middle column, its swing either side, its period in frames; on a wide band
 * (`roam`) its castle end and far end, the left columns the slot boundaries fall on, and the courses worked out so
 * far by slot. */
type Geo = {
  cx: number; a: number; p: number; roam: boolean; near: number; far: number
  slots: Map<number, { c: Course; all: number[] }>
}
export type KnightPose = { x: number; y: number; face: 1 | -1; art: readonly string[]; plume: boolean }
export type PrincessPose = 'hidden' | 'window' | 'wave0' | 'wave1'

/** The stage by width: whether the keep, hills, knight and archers stand (`wide`), whether the tower does, how far
 * the castle is shifted left (`dx`, cropping the left keep below FULL), and where the tower and the knight stand. */
type Stage = { wide: boolean; tower: boolean; dx: number; towerX: number; knightX: number }
function stageOf(w: number): Stage {
  const dx = w >= FULL ? 0 : -CROP
  return { wide: w >= WIDE, tower: w >= TINY, dx, towerX: w >= WIDE ? TOWER_X + dx : 0, knightX: KNIGHT_X + dx }
}

const GEOS = new Map<number, Geo>()
/** The patrol for width `w`: between ZONE_X (over the knight; right of the tower when narrow) and ZONE_R short of
 * the right edge (across the sun), anchored left so its near end comes over the knight. Its period is 80 frames
 * (a swing of 10 at most) or 160 (a swing of 20 at most): never more than 0.8 of a pixel a frame, a multiple of 8
 * (so the turns fall on whole, even frames), and dividing a set piece's slot, so every slot starts and ends with
 * the dragon in the middle of its patrol, heading right. */
function geoOf(w: number): Geo {
  let g = GEOS.get(w)
  if (!g) {
    const right = w >= FULL ? w - ZONE_R : w >= TINY ? w - ZONE_R_NARROW : w
    const left = Math.max(0, Math.min(w >= WIDE ? stageOf(w).knightX + (w >= FULL ? ZONE_DX : ZONE_DX_CROP) : w >= TINY ? 7 : 0, right - DW))
    const reach = Math.max(0, right - left - DW) >> 1
    const p = reach >= 20 ? 160 : 80
    const a = Math.min(reach, p / 8)
    // The castle end is clear of the knight, so nothing overlaps him at a slot's ends; the far end no further off
    // than a crossing covers at a pixel a frame (it moves at a steady pace over three quarters of a slot).
    const near = Math.max(left, stageOf(w).knightX + 7)
    const far = Math.min(right - DW, near + (3 * EVENT_LEN) / 4)
    g = { cx: left + a + (w < TINY ? reach - a : 0), a, p, roam: p === 160 && far > near + 2 * a + 8, near, far, slots: new Map() }
    GEOS.set(w, g)
  }
  return g
}

/** Which slot boundaries fall at the far end on a wide band. A boundary is far only when the piece before it can
 * end there and the piece after it can start there: the tower and the frying pan need the castle at both ends of
 * their slot, the strafe, charge and catapult at their end, the landing and the sheep at their start; Clawd and
 * the hatchling don't mind. Pieces are numbered 0..5, eggs 6..8. */
const [START_FAR, END_FAR] = [new Set([0, 1, 3, 7, 8]), new Set([4, 5, 7, 8])]
const PIECE_IDS = new Map<number, number>()
function pieceId(k: number): number {
  let id = PIECE_IDS.get(k)
  if (id === undefined) {
    const sl = slotAt(k * EVENT_LEN, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE)
    id = sl.egg >= 0 ? EVENT_KINDS + sl.egg : sl.kind
    if (PIECE_IDS.size > 512) PIECE_IDS.clear()
    PIECE_IDS.set(k, id)
  }
  return id
}
/** Whether slot `k` starts at the far end. */
const farStart = (k: number) => END_FAR.has(pieceId(k - 1)) && START_FAR.has(pieceId(k))

/** Slot `k`'s course on a wide band, by its two ends: castle to castle or far to far, a swing of 2a out and back
 * (turning half way); castle to far or back, across the band, easing out of and into each end. Every end is at
 * rest, and the dragon turns there if the next course leaves the other way. */
type Course = { from: number; dir: 1 | -1; out: boolean; len: number }
function courseOf(k: number, g: Geo): Course {
  const [a, b] = [farStart(k), farStart(k + 1)]
  const from = a ? g.far : g.near
  return a === b ? { from, dir: a ? -1 : 1, out: true, len: 2 * g.a } : { from, dir: a ? -1 : 1, out: false, len: g.far - g.near }
}
/** How far along its course (0..1) at `age`: out and back by a cosine; across at a steady pace, easing over a
 * quarter of the slot at each end. */
function along1(c: Course, age: number): number {
  if (c.out) return (1 - Math.cos((2 * Math.PI * age) / EVENT_LEN)) / 2
  const [e, n] = [EVENT_LEN / 4, EVENT_LEN]
  const v = 1 / (n - e)
  return age < e ? (v * age * age) / (2 * e) : age > n - e ? 1 - (v * (n - age) * (n - age)) / (2 * e) : v * (age - e / 2)
}
const faceAt = (c: Course, age: number): 1 | -1 => (c.out && age >= EVENT_LEN / 2 ? (-c.dir as 1 | -1) : c.dir)
const endFace = (c: Course): 1 | -1 => (c.out ? (-c.dir as 1 | -1) : c.dir)

/** Slot `k`'s course and the turns around it (worked out once per slot, kept on the patrol): half way along an
 * out-and-back course, and at a slot's start when the last course ended facing the other way. */
function roamSlot(k: number, g: Geo): { c: Course; all: number[] } {
  let r = g.slots.get(k)
  if (!r) {
    const turns = (j: number) => {
      const cj = courseOf(j, g)
      const out: number[] = []
      if (endFace(courseOf(j - 1, g)) !== faceAt(cj, 0)) out.push(j * EVENT_LEN)
      if (cj.out) out.push(j * EVENT_LEN + EVENT_LEN / 2)
      return out
    }
    r = { c: courseOf(k, g), all: [...turns(k - 1), ...turns(k), ...turns(k + 1), ...turns(k + 2)] }
    if (g.slots.size > 64) g.slots.clear()
    g.slots.set(k, r)
  }
  return r
}

/** The roaming patrol at `t` (see `courseOf`): its column along the slot's course, its height and wings as on the
 * figure-eight (the height held on the turn frames, ages 0 and 80), frames since its last turn and to its next. */
function roam(t: number, g: Geo): Fly {
  const k = Math.floor(t / EVENT_LEN)
  const age = t - k * EVENT_LEN
  const { c, all } = roamSlot(k, g)
  let ev = t - mod(t, 2)
  if (mod(ev, EVENT_LEN / 2) === 0) ev -= 2
  const last = all.filter(u => u <= t).pop() ?? t - 3 * EVENT_LEN
  const next = all.find(u => u > t) ?? t + 3 * EVENT_LEN
  return {
    x: c.from + c.dir * Math.round(c.len * along1(c, age)),
    y: Math.round(1.5 + 1.5 * Math.sin((4 * Math.PI * ev) / g.p)),
    face: faceAt(c, age),
    wing: WING_CYCLE[mod((t + 1) >> 1, 4)]!,
    since: t - last,
    until: next - t,
  }
}

/** The dragon's patrol pose at `t`: across by sin, its height by sin 2θ (y 0..3), facing the way it goes, its wings
 * on an eight-frame cycle. Each frame changes one thing at most besides its column: the wings change pose on odd
 * frames, the height on even ones, never on a turn (turns fall on even frames, the period being a multiple of 8).
 * On a wide band it roams instead (`roam`). Wyverns fly the same path, later. */
export function patrol(t: number, w: number): Fly {
  const g = geoOf(w)
  if (g.roam) return roam(t, g)
  const [half, s] = [g.p / 2, mod(t + g.p / 4, g.p)]
  const since = mod(s, half)
  const turn = (u: number) => mod(u + g.p / 4, half) === 0
  let ev = t - mod(t, 2)
  if (turn(ev)) ev -= 2
  return {
    x: g.cx + Math.round(g.a * Math.sin((2 * Math.PI * t) / g.p)),
    y: Math.round(1.5 + 1.5 * Math.sin((4 * Math.PI * ev) / g.p)),
    face: s < half ? 1 : -1,
    wing: WING_CYCLE[mod((t + 1) >> 1, 4)]!,
    since,
    until: half - since,
  }
}

/** The knight at his post: breathing (the plume lifts on 8 of 16 frames), shifting his weight on 24. */
export function knightHome(t: number, w: number): KnightPose {
  return { x: stageOf(w).knightX, y: KNIGHT_Y, face: 1, art: KNIGHT[mod(t, 24) < 12 ? 0 : 1]!, plume: mod(t, 16) >= 8 }
}

/** The princess: leaning out and waving while asked, else glancing out of her window on 3 frames in 60. */
export function princessHome(t: number, s: Signals): PrincessPose {
  if (s.act === 'ask') return s.actAge < 2 ? 'window' : mod(t, 6) < 3 ? 'wave0' : 'wave1'
  return mod(t, 60) >= 21 && mod(t, 60) < 24 ? 'window' : 'hidden'
}

// ---- small drawers ----------------------------------------------------------------------------------------------

/** The sky through y 9, then the sun at the right: a disc with a pale core shimmering on 10 frames, its eight
 * rays swapping between straight and slanted every 6. */
function skyAndSun(cv: Canvas, t: number, w: number): void {
  for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) plot(cv, x, y, SKY[y]!)
  const [cx, cy] = [w - 7, 2]
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue
      const core = Math.abs(dx) + Math.abs(dy) <= (mod(t, 20) < 10 ? 1 : 0)
      plot(cv, cx + dx, cy + dy, core ? SUN.C : dx === -2 || dy === 2 ? SUN.E : SUN.S)
    }
  }
  const rays = mod(t, 12) < 6
    ? [[-3, 0], [-4, 0], [3, 0], [4, 0], [0, 3], [0, 4], [-1, 3], [1, 3]]
    : [[-3, -2], [3, -2], [-3, 2], [3, 2], [-2, 3], [2, 3], [-3, 3], [3, 3]]
  for (const [dx, dy] of rays) plot(cv, cx + dx!, cy + dy!, SUN.R)
}

/** Clouds drifting left a pixel every 6 frames, wrapping off the left edge back in at the right: 2 to 4 by width. */
function clouds(cv: Canvas, t: number, w: number, count: number): void {
  const span = w + 12
  for (let i = 0; i < count; i++) {
    const art = CLOUDS[i % 3]!
    const x = mod(Math.floor((i * span) / count + noise(i + 3) * 9) - Math.floor(t / 6), span) - 11
    sprite(cv, x, i % 2 === 0 ? 0 : 2, art, CLOUD)
  }
}

/** The near ridge's top row at column `x` (7..9). */
const nearTop = (x: number) => Math.min(9, Math.round(8.4 - 1.1 * Math.sin(x * 0.21 + 0.5) - 0.6 * Math.sin(x * 0.09)))

/** The round trees' columns on the near ridge, from column `from`. */
function trees(w: number, from: number): number[] {
  const out: number[] = []
  for (let x = from + 6; x < w - 2; x += 17) out.push(x + Math.floor(noise(x) * 6))
  return out
}

/** The hills: a far ridge paled by the air (y 5..9) and a nearer green one (y 7..9), each a lit crest over a body
 * shading toward the foot, a few round trees on the near one. A flock of three birds crosses right to left a pixel
 * a frame, flapping, every w + 30 frames. */
function hills(cv: Canvas, t: number, w: number, from: number): void {
  for (let x = from; x < w; x++) {
    const far = Math.max(5, Math.round(6.6 - 1.4 * Math.sin(x * 0.15 + 1) - 0.8 * Math.sin(x * 0.37 + 2)))
    const near = nearTop(x)
    for (let y = far; y < 10; y++) plot(cv, x, y, FAR_HILL[y === far ? 0 : y >= far + 2 ? 2 : 1]!)
    for (let y = near; y < 10; y++) plot(cv, x, y, HILL[y === near ? 0 : y >= near + 2 ? 2 : 1]!)
  }
  for (const at of trees(w, from)) sprite(cv, at - 1, nearTop(at) - 3, TREE_ART, TREE)
  const at = mod(t, w + 30)
  for (let i = 0; i < 3; i++) {
    const x = w + 2 - at + i * 5
    sprite(cv, x, 3 + (i % 2), BIRDS[mod(t + i, 4) < 2 ? 0 : 1]!, { B: BIRD })
  }
}

/** The tower at `x0` (6 wide, y 3..11): stone shaded round (lit from the sun at the right), coursed, a red cone roof
 * over y 0..2 with eaves, the pennant at its apex, the princess's window at y 4..5 and its sill. */
function tower(cv: Canvas, t: number, x0: number): void {
  const ramp = ['D', 'C', 'B', 'B', 'A', 'D']
  for (let y = 3; y < 12; y++) {
    for (let i = 0; i < 6; i++) {
      const course = i > 0 && i < 5 && mod(y, 3) === 2 && mod(i + (y > 6 ? 1 : 0), 2) === 0
      plot(cv, x0 + i, y, STONE[course ? 'C' : ramp[i]!]!)
    }
  }
  const roof = [[2, 3, 'EF'], [1, 4, 'GFFE'], [-1, 6, 'HGFFEEFH']] as const
  roof.forEach(([from, , keys], y) => [...keys].forEach((k, i) => plot(cv, x0 + from + i, y, ROOF[k]!)))
  for (const [dx, dy, k] of PENNANT[mod(t, 4)]!) plot(cv, x0 + 4 + dx, dy, BANNER[k]!)
  for (let i = 1; i < 4; i++) {
    plot(cv, x0 + i, 4, WINDOW)
    plot(cv, x0 + i, 5, WINDOW)
    plot(cv, x0 + i, 6, STONE.A!)
  }
}

/** The keep (x 1..13 and 20..24, shifted by the stage's `dx`, y 4..11): merlons on y 4 with the sky in the
 * crenels, a coursed wall lit from the right, a gate of dark planks under an arch, two arrow slits; then the tower in
 * front. */
function castle(cv: Canvas, t: number, st: Stage): void {
  if (st.wide) {
    const at = (x: number, y: number, c: string) => plot(cv, x + st.dx, y, c)
    for (const [a, b] of [[1, 13], [20, 24]] as [number, number][]) {
      for (let x = a; x <= b; x++) {
        const merlon = mod(x - a, 3) !== 2 || x === b
        if (merlon) at(x, 4, x === a ? STONE.C! : mod(x - a, 3) === 1 || x === b ? STONE.A! : STONE.B!)
        for (let y = 5; y < 12; y++) {
          const joint = mod(y, 2) === 1 ? mod(x + (mod(y, 4) === 1 ? 0 : 2), 4) === 0 : false
          at(x, y, x === a ? STONE.D! : y === 5 ? STONE.C! : joint ? STONE.C! : x === b ? STONE.A! : STONE.B!)
        }
      }
    }
    // The gate: an arch of planks with a dark iron band.
    for (let y = 8; y < 12; y++) {
      for (let x = 5; x <= 8; x++) {
        if (y === 8 && (x === 5 || x === 8)) continue
        at(x, y, y === 10 ? WOOD.o! : x === 5 ? WOOD.O! : mod(x, 2) === 0 ? WOOD.i! : WOOD.I!)
      }
    }
    for (const [x, y] of [[11, 8], [11, 9], [22, 8], [22, 9]] as const) at(x, y, WINDOW)
  }
  if (st.tower) tower(cv, t, st.towerX)
}

/** The banner slots: hanging under the merlons (x, top row), those the crop leaves on screen. */
function bannerSlots(st: Stage): [number, number][] {
  if (st.wide) {
    return ([[2, 5], [5, 5], [8, 5], [11, 5], [20, 5], [23, 5]] as [number, number][])
      .map(([x, y]): [number, number] => [x + st.dx, y]).filter(([x]) => x >= 1)
  }
  return st.tower ? [[1, 7], [3, 7]] : []
}

/** A banner per task: furled grey (1×2) while open, unfurled gold (2×3, its tail rippling on four frames) once
 * done, the newest unrolling a pixel a frame over three. More tasks than slots light them in proportion. */
function banners(cv: Canvas, s: Signals, t: number, st: Stage): void {
  const slots = bannerSlots(st)
  const count = Math.min(s.total, slots.length)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < 3 && lit > litOf(s.done - 1)
  for (let k = 0; k < count; k++) {
    const [x, y] = slots[k]!
    if (k >= lit) {
      plot(cv, x, y, FURLED.N!)
      plot(cv, x, y + 1, FURLED.M!)
      continue
    }
    const rows = k === lit - 1 && fresh ? s.doneAge + 1 : 3
    const ripple = mod(t + 2 * k, 4)
    for (let j = 0; j < rows; j++) {
      plot(cv, x, y + j, j === 0 ? BANNER.X! : BANNER.Y!)
      if (j < 2 || ripple < 2) plot(cv, x + 1, y + j, j === 2 ? BANNER.z! : ripple === j ? BANNER.X! : BANNER.Z!)
    }
  }
}

/** Two archers on the wall-walk behind the merlons (one each side of the tower), each bobbing a pixel on 12
 * frames, offset. */
function archers(cv: Canvas, t: number, dx: number, cheer: boolean): void {
  for (const [x, off] of [[8, 0], [21, 5]] as const) {
    // Cheering, they hop a pixel on four frames, bows held up.
    if (cheer) sprite(cv, x + dx, 1 + (mod(t + off, 4) < 2 ? 0 : 1), ARCHER_CHEER, ARCHER_KEYS)
    else sprite(cv, x + dx, 2 + (mod(t + off, 12) < 6 ? 0 : 1), ARCHER, ARCHER_KEYS)
  }
}

/** The grass, y 10..11: a lit top row over a shaded one, tufts that trade shades on 8 frames (offset), flowers. */
function grass(cv: Canvas, t: number, w: number): void {
  for (let x = 0; x < w; x++) {
    const n = noise(x * 1.7 + 0.3)
    const tuft = n < 0.3
    const sway = mod(t + Math.floor(n * 40), 16) < 8
    plot(cv, x, 10, tuft ? (sway ? GRASS.hi : GRASS.shade) : mod(x, 3) === 0 ? GRASS.hi : GRASS.base)
    plot(cv, x, 11, n > 0.9 ? FLOWERS[Math.floor(n * 97) % 4]! : mod(x, 4) === 1 ? GRASS.deep : GRASS.shade)
  }
}

function knight(cv: Canvas, k: KnightPose, shield: boolean): void {
  sprite(cv, k.x, k.y, shield ? KNIGHT_SHIELD : k.art, KNIGHT_KEYS, k.face)
  if (k.plume && !shield) sprite(cv, k.x, k.y - 1, PLUME_UP, KNIGHT_KEYS, k.face)
}

function princess(cv: Canvas, pose: PrincessPose, x0: number): void {
  if (pose === 'window') sprite(cv, x0 + 1, 4, PRINCESS_IN, PRINCESS_KEYS)
  else if (pose !== 'hidden') sprite(cv, x0 + 1, 4, PRINCESS_OUT[pose === 'wave0' ? 0 : 1]!, PRINCESS_KEYS)
}

/** The dragon at its pose: the body (jaws open if asked), then the near wing in its pose, in `keys` (a tool's
 * colour tints the membrane), each colour through `ink` (a flash keeps its shading, so its edges stay), upside down
 * if `over`. */
function dragon(cv: Canvas, f: Fly, open: boolean, keys: Record<string, string>, ink?: (c: string) => string,
  over = false): void {
  // Upside down (mid-roll): its box's rows the other way up.
  const turn = (art: readonly string[]) => (over ? [...art, ...Array(DH - art.length).fill('')].reverse() : art)
  sprite(cv, f.x, f.y, turn(open ? DRAGON_OPEN : DRAGON_BODY), keys, f.face, ink)
  sprite(cv, f.x, f.y, turn(WINGS[f.wing]!), keys, f.face, ink)
}

/** A wyvern on its own pose, its wings on four frames, white while it greets. */
function wyvern(cv: Canvas, f: Fly, t: number, i: number, flash: boolean): void {
  const art = WYVERN[mod(t + i, 4) < 2 ? 0 : 1]!
  sprite(cv, f.x + VX, f.y + VY, art, HUES[i]!, f.face, flash ? () => WHITE : undefined)
}

/** Where the jaws are: the column just ahead of the snout and the mouth's row. */
const jaws = (f: Fly): [number, number] => [f.face > 0 ? f.x + DW : f.x - 1, f.y + 3]

/** The fire cone, `len` pixels down and ahead of the jaws (a pixel down every two ahead, widening to five), each
 * pixel trading among three flame tones every frame. Smoke peels off its tip and rises a pixel a frame, a puff
 * every 3 frames, each only while the cone has stood full since the puff left (`full(a)`: full `a` frames ago). */
function fire(cv: Canvas, f: Fly, len: number, t: number, full: (a: number) => boolean): void {
  const [jx, jy] = jaws(f)
  for (let i = 0; i < len; i++) {
    const [x, cy] = [jx + f.face * i, jy + (i >> 1)]
    const half = Math.min(2, (i + 1) / 3) | 0
    for (let dy = -half; dy <= half; dy++) {
      const n = noise(i * 7.1 + dy * 3.3 + t * 0.91)
      const edge = Math.abs(dy) === half && half > 0
      plot(cv, x, cy + dy, edge ? (n < 0.5 ? EMBER : FLAME) : n < 0.35 ? PALE : n < 0.75 ? FLAME : EMBER)
    }
  }
  if (len < CONE) return
  const [tx, ty] = [jx + f.face * (len - 1), jy + ((len - 1) >> 1)]
  for (const off of [0, 3]) {
    const a = mod(t + off, 6)
    if (full(a)) plot(cv, tx, ty - 3 - a, SMOKE[a < 3 ? 0 : 1]!)
  }
}

/** Sparks streaming off the nose in a tool's colour, `len` pixels: a checkerboard over the jaw's two rows flipping
 * every frame, every third spark pale. */
function sparks(cv: Canvas, f: Fly, len: number, t: number, hue: string): void {
  const [jx, jy] = jaws(f)
  for (let i = 0; i < len; i++) {
    const x = jx + f.face * i
    for (const j of [-1, 0]) if (mod(x + j - f.face * t, 2) === 0) plot(cv, x, jy + j, i % 3 === 2 ? PALE : hue)
  }
}

/** Sound rings out of the jaws: a 3-pixel arc born over the jaw's tip (so it leaves from the head even as the
 * dragon flies), moving on from where the jaws were when it set off a pixel a frame, a new one every 6, two in
 * flight, the outer one paler. `at(te)` is the dragon's pose at frame `te`, `born(te)` whether a ring set off then. */
function rings(cv: Canvas, t: number, at: (te: number) => Fly, born: (te: number) => boolean = () => true): void {
  for (let k = 0; k < 2; k++) {
    const d = mod(t, 6) + 6 * k
    if (!born(t - d)) continue
    const f = at(t - d)
    const [jx, jy] = jaws(f)
    const x = jx + f.face * (d - 1)
    const c = k === 0 ? PALE : mix(PALE, SKY[jy]!, 0.5)
    plot(cv, x - f.face, jy - 1, c)
    plot(cv, x, jy, c)
    plot(cv, x - f.face, jy + 1, c)
  }
}

/** Sparks bouncing off a raised shield whose top right is (x, y): three pixels on and just off its face, flickering
 * in two patterns. */
function shieldSparks(cv: Canvas, x: number, y: number, t: number): void {
  const pts = mod(t, 2) === 0 ? [[1, 0], [0, -1], [1, 2]] : [[1, 1], [-1, -1], [0, 2]]
  for (const [dx, dy] of pts) plot(cv, x + dx!, y + dy!, mod(t + dx!, 3) === 0 ? WHITE : FLAME)
}

/** The sign: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number): [string, string] {
  if (s.news && s.newsAge < 30) {
    return s.news === 'testFail' ? ['×', '#d62839'] : [s.news === 'testPass' ? frame(['★', '☆'], t >> 1) : '✓', GOLD]
  }
  if (Math.min(s.actAge, s.toolAge) < CHANGE) return ['·', WHITE]
  if (s.act === 'tool') return [TOOL_SIGN[s.tool ?? 'other'], TOOL_INK[s.tool ?? 'other']]
  if (s.act === 'ask') return ['?', '#ffd166']
  if (s.act === 'say') return [frame(['♪', '♫'], t >> 2), '#ff758f']
  return s.act === 'think' ? ['◌', WHITE] : [frame(['z', 'Z'], t >> 2), '#e9ecef']
}

/** Writes a glyph over the pixels at cell (x, row) on the colour under it, so the cell stays painted. */
function glyph(g: Grid, cv: Canvas, x: number, row: number, text: string, c: string): void {
  if (x < 0 || x >= cv.w) return
  put(g, x, row, text, { c, b: true, bg: cv.px[2 * row * cv.w + x] ?? SKY[2 * row]! })
}

// ---- set pieces -------------------------------------------------------------------------------------------------

/** The schedule: slots of EVENT_LEN frames, each one of EVENT_KINDS set pieces, now and then (EGG_CHANCE) one of
 * EGG_KINDS easter eggs instead. */
export const EVENT_LEN = 160
export const EVENT_KINDS = 6
export const EGG_KINDS = 3
export const DRAGON_SEED = 7
export const EGG_CHANCE = 1 / 40
/** The age a trip is back on its patrol by (early enough that sound rings, which look 11 frames back, are home by
 * the slot's end); how far behind its patrol pose it comes up when it has to turn first; the dragon's top row with
 * its feet on the grass. */
const [BACK, APPROACH, GROUND] = [146, 4, 4]

type Draw = (cv: Canvas) => void
/** Where a piece starts from: the slot's first frame, the width and stage, the turn's signals, the patrol by the
 * slot's age, and the knight and princess at home now. */
type Home = { t0: number; w: number; st: Stage; s: Signals; at: (age: number) => Fly; kn: KnightPose; pr: PrincessPose }
/** Who is where on a frame: the dragon (behind the castle or not, jaws open, flashing white, upside down, its
 * fire's length, roaring rings), the knight (in front of the dragon or not), the princess at her window; and what
 * else is drawn: under the hills, behind the castle (`mid`), in front of it but behind the knight and dragon
 * (`low`), in front of the dragon but behind the castle (`fore`, shown only where the castle isn't) and the knight
 * (if `knightFront`), and over all (`top`, then the knight's sword stroke, `slash`). `actors`: where the piece's
 * own actors stand (left column, top row) while on screen, for the speed test. */
type Cast = {
  f: Fly; behind: boolean; open: boolean; flash: boolean; over: boolean; len: number; roar: boolean
  kn: KnightPose; knightFront: boolean; pr: PrincessPose
  under?: Draw; mid?: Draw; low?: Draw; fore?: Draw; top?: Draw; slash?: Draw
  actors?: Record<string, [number, number]>
}
/** A set piece: what changes at `age` of its slot, everyone home at 0 and from BACK on. */
type Piece = (age: number, h: Home) => Partial<Cast>

/** A stop on a trip: where, the age to be there by (later if it can't), how long to stay, which way to face. */
type Way = { x: number; y: number; at: number; hold?: number; face?: 1 | -1 }
/** A trip planned: its path (turn holds put in), the ages it turns at and its facing after each, the ages it leaves
 * and rejoins the patrol, when it reaches and leaves each stop, and whether it makes it home by BACK (else it stays
 * home). */
type Plan = {
  pts: Waypoint[]; turns: number[]; faces: (1 | -1)[]; from: number; to: number; arr: number[]; dep: number[]; ok: boolean
}

const evenUp = (n: number) => n + mod(n, 2)
/** Frames a leg takes at the most a pixel a frame across and half a pixel down, two more for a turn first. */
const span = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  evenUp(Math.max(Math.abs(a.x - b.x), 2 * Math.abs(a.y - b.y))) + 2

/** Plans a trip through `ways`: it leaves the patrol as late as still reaches the first stop by its age, goes stop to
 * stop as fast as it may, and rejoins its patrol by BACK at the age that lets it stay longest at its last stop (up to
 * that stop's hold; the later age on a tie): straight in if the patrol there flies the way it would arrive, else
 * coming up from behind, APPROACH back. Every age on the path is even; a turn holds the dragon still for two frames and falls on the
 * second, an even frame. */
function plan(h: Home, ways: Way[]): Plan {
  const first = ways[0]!
  let from = evenUp(first.at) - 2
  while (from > 2 && span(h.at(from), first) > first.at - from) from -= 2
  const holds = ways.map(way => evenUp(way.hold ?? 0))
  const n = ways.length - 1
  const last = ways[n]!
  const into = (e: Fly) => Math.sign(e.x - last.x) === e.face
  const nearOf = (e: Fly, at: number): Way => ({ x: e.x - e.face * APPROACH, y: e.y, at: at - APPROACH - 2 })
  const latestAt = (at: number) => {
    const e = h.at(at)
    return into(e) ? at - span(last, e) : nearOf(e, at).at - span(last, nearOf(e, at))
  }
  let [arr, dep, to] = [[] as number[], [] as number[], BACK]
  // Twice: if it reaches its last stop too late to get home, the stays before it are cut by as much and the stops
  // timed again.
  for (let pass = 0; pass < 2; pass++) {
    ;[arr, dep] = [[], []]
    let [prev, time]: [{ x: number; y: number }, number] = [h.at(from), from]
    ways.forEach((way, i) => {
      const a = Math.max(evenUp(way.at), time + span(prev, way))
      arr.push(a)
      dep.push(a + holds[i]!)
      ;[prev, time] = [way, a + holds[i]!]
    })
    // Rejoin where it may stay longest at its last stop (up to its hold), the later rejoin on a tie.
    const want = dep[n]!
    to = BACK
    for (let at = BACK - 2; at > arr[n]!; at -= 2) if (Math.min(want, latestAt(at)) > Math.min(want, latestAt(to))) to = at
    let late = arr[n]! - latestAt(to)
    for (let i = n - 1; i >= 0 && late > 0; i--) {
      const cut = Math.min(late + mod(late, 2), holds[i]!)
      holds[i] = holds[i]! - cut
      late -= cut
    }
  }
  const end = h.at(to)
  const near = nearOf(end, to)
  const latest = latestAt(to)
  dep[n] = Math.max(arr[n]!, Math.min(dep[n]!, latest))
  const raw: Way[] = [{ x: h.at(from).x, y: h.at(from).y, at: from }]
  ways.forEach((way, i) => {
    raw.push({ x: way.x, y: way.y, at: arr[i]!, face: way.face })
    if (dep[i]! > arr[i]!) raw.push({ x: way.x, y: way.y, at: dep[i]! })
  })
  if (!into(end)) raw.push(near)
  raw.push({ x: end.x, y: end.y, at: to })
  const pts: Waypoint[] = []
  const turns: number[] = []
  const faces: (1 | -1)[] = [h.at(from).face]
  raw.forEach((p, i) => {
    pts.push(p)
    const q = raw[i + 1]
    if (!q) return
    const face = faces[faces.length - 1]!
    const want = p.face ?? (q.x > p.x ? 1 : q.x < p.x ? -1 : face)
    if (want !== face) {
      pts.push({ x: p.x, y: p.y, at: p.at + 2 })
      turns.push(p.at + 2)
      faces.push(want)
    }
  })
  return { pts, turns, faces, from, to, arr, dep, ok: arr[n]! <= latest }
}

/** The dragon on a planned trip at `age`: its column by the path on any frame, its row on even frames, its facing
 * by the turns, its wings on the patrol's beat; home before and after (and throughout, if the trip can't be made),
 * though before it leaves its next turn is the trip's, so a breath draws back for that one. */
function fly(p: Plan, age: number, h: Home): Fly {
  const home = h.at(age)
  if (!p.ok || age >= p.to) return home
  if (age <= p.from) {
    // Home, but its next turn is the trip's (the patrol's own, if that comes first).
    return age + home.until <= p.from ? home : { ...home, until: (p.turns[0] ?? p.to + h.at(p.to).until) - age }
  }
  let n = 0
  while (n < p.turns.length && p.turns[n]! <= age) n++
  const [prev, next] = [p.turns[n - 1], p.turns[n]]
  return {
    x: along(p.pts, age).x,
    y: along(p.pts, age - mod(h.t0 + age, 2)).y,
    face: p.faces[n]!,
    wing: home.wing,
    since: prev === undefined ? h.at(p.from).since + age - p.from : age - prev,
    until: next === undefined ? p.to - age + h.at(p.to).until : next - age,
  }
}

const SETUPS = new Map<string, unknown>()
/** A piece's setup for its slot (its trip planned, where things go), worked out once per piece, slot and width: the
 * breath looks back over many frames, each casting the scene again. */
function setup<T>(name: string, h: Home, make: () => T): T {
  const key = `${name}:${h.t0}:${h.w}`
  if (SETUPS.has(key)) return SETUPS.get(key) as T
  const made = make()
  if (SETUPS.size > 64) SETUPS.clear()
  SETUPS.set(key, made)
  return made
}

const beat = (t: number) => (t + 1) >> 1
/** The wing pose at `t` in a barrel roll begun at `r` (even): the beat run backwards for eight frames, which brings
 * it back in step. */
const rolled = (t: number, r: number) => WING_CYCLE[mod(t >= r && t < r + 8 ? 2 * beat(r) - beat(t) : beat(t), 4)]!

/** The furthest right the patrol goes in the middle of the slot (ages 40 to 110). */
function reach(h: Home): number {
  let r = h.at(40).x
  for (let a = 42; a <= 110; a += 2) r = Math.max(r, h.at(a).x)
  return r
}

/** The knight at `x` (his feet `lift` above the grass) in `art`, facing `face`. */
const knightAt = (x: number, lift: number, face: 1 | -1, art: readonly string[]): KnightPose =>
  ({ x, y: KNIGHT_Y - lift, face, art, plume: false })
const runArt = (i: number) => [...KNIGHT[0]!.slice(0, 6), ...RUN_LEGS[mod(i, 4)]!]
/** A white flash that keeps the shading (and so the edges). */
const blanch = (c: string) => mix(c, WHITE, 0.7)

/** 0 strafe: it dives to the knight's height a fire's length off him, breathes on his shield (which he raises,
 * sparks flying off it), climbs and flies home. */
const strafe: Piece = (age, h) => {
  const p = setup('strafe', h, () => {
    const x = Math.min(h.kn.x + 16, h.w - DW)
    return plan(h, [{ x, y: 3, at: 58, hold: 40, face: -1 }, { x: x + 6, y: 0, at: 0 }])
  })
  const [a, d] = [p.arr[0]! + 4, p.dep[0]!]
  const len = p.ok && age >= a && age < d ? Math.min(CONE, age - a + 1, d - 1 - age) : 0
  return { f: fly(p, age, h), len }
}

/** 1 charge: the knight runs out under the dragon hovering low, leaps and slashes (a white arc); it flinches, white
 * for two frames, knocked up two pixels and settling back over six, then backs off up and away; he walks back to
 * his post. */
const charge: Piece = (age, h) => {
  const k = h.kn
  const run = Math.max(6, Math.min(20, h.w - DW - 10 - k.x))
  const kx = k.x + run
  const p = setup('charge', h, () => plan(h, [{ x: kx + 8, y: 3, at: 50, hold: 30, face: -1 }, { x: kx + 14, y: 0, at: 0 }]))
  if (!p.ok) return {}
  const [a, d] = [p.arr[0]!, p.dep[0]!]
  const leap = a + 6
  // He walks back once he has landed and the dragon has gone; if it leaves before it has flinched, nothing plays.
  const [hit, start, back] = [leap + 4, leap - 2 - 2 * run, Math.max(d + 2, leap + 10)]
  if (d < hit + 2) return {}
  // He walks home at most a pixel every three frames, and is there (turned round) by BACK; if the dragon came too
  // late for that, nothing plays.
  const walk = Math.min(3 * run, BACK - 4 - back)
  if (walk < run) return {}
  const knock = age >= hit && age < hit + 10 ? [1, 1, 2, 2, 2, 2, 1, 1, 1, 1][age - hit]! : 0
  const f = fly(p, age, h)
  let kn = k
  if (age >= start && age < leap - 2) kn = knightAt(k.x + ((age - start) >> 1), 0, 1, runArt(age))
  else if (age >= leap - 2 && age < leap) kn = knightAt(kx, 0, 1, runArt(0))
  else if (age >= leap && age < leap + 10) {
    const lift = [1, 2, 3, 3, 3, 3, 3, 2, 1, 0][age - leap]!
    kn = knightAt(kx, lift, 1, age >= leap + 2 && age < leap + 7 ? KNIGHT_SLASH : runArt(age))
  } else if (age >= leap + 10 && age < back) kn = { ...k, x: kx }
  else if (age >= back && age < back + walk + 2) {
    const x = kx - Math.min(run, Math.floor((run * (age - back)) / walk))
    kn = knightAt(x, 0, -1, x === kx || x === k.x ? runArt(0) : runArt(age >> 1))
  }
  const arc = age - leap - 2
  const top: Draw | undefined = arc >= 0 && arc < 3
    ? cv => { for (const [dx, dy] of SLASH[arc]!) plot(cv, kn.x + dx!, kn.y + dy!, WHITE) }
    : undefined
  return { f: { ...f, y: f.y - knock }, flash: age >= hit && age < hit + 2, kn, slash: top }
}

/** The archers' three arrows, loosed `from` on (each from a bow on screen), arcing up over the field and falling
 * into the grass: each one's start column and frames in flight, while in the air. */
function arrowsAt(age: number, from: number, st: Stage, w: number): [number, number, number][] {
  const out: [number, number, number][] = []
  ;([[21, 0], [8, 8], [21, 16]] as const).forEach(([ax, delay], k) => {
    const [x0, i] = [ax + st.dx + 3, age - from - delay]
    if (x0 >= 1 && i >= 0 && arc(i) < 10 && x0 + i < w) out.push([x0, i, k])
  })
  return out
}
/** An arrow's row `j` frames into its flight. */
const arc = (j: number) => 3 - Math.round(j / 2 - (j * j) / 48)
function arrows(cv: Canvas, age: number, from: number, st: Stage, w: number): void {
  for (const [x0, i] of arrowsAt(age, from, st, w)) {
    plot(cv, x0 + i - 2, arc(Math.max(0, i - 2)), ARROW_SHAFT)
    plot(cv, x0 + i - 1, arc(Math.max(0, i - 1)), ARROW_SHAFT)
    plot(cv, x0 + i, arc(i), ARROW_HEAD)
  }
}

/** 2 tower run: it sweeps low past the princess's tower (in front of the castle, behind the knight) and off the left
 * edge, comes back high behind the castle and out over the field; she watches it come, ducks while it is near and
 * looks out again after; the archers loose three arrows that arc over it and miss. */
const towerRun: Piece = (age, h) => {
  const { st } = h
  const tx = st.towerX
  const out = -DW - 1
  const p = setup('tower', h, () => plan(h, [
    { x: tx + 10, y: 3, at: 24, face: -1 },
    { x: out, y: 3, at: 0, face: 1 },
    { x: out, y: 0, at: 0 },
    { x: st.wide ? st.knightX + 7 : tx + 6, y: 0, at: 0 },
  ]))
  if (!p.ok) return {}
  const [a0, a1, , a2] = p.arr as [number, number, number, number]
  const past = a1 + 2 + tx + 6 - out
  const pr: PrincessPose = !st.tower ? h.pr
    : age >= a0 - 10 && age < a0 + 2 ? 'window'
    : age >= a0 + 2 && age < past ? 'hidden'
    : age >= past && age < past + 16 ? 'window'
    : h.pr
  const actors: Record<string, [number, number]> = {}
  if (st.wide) for (const [x0, i, k] of arrowsAt(age, a1 + 4, st, h.w)) actors[`arrow${k}`] = [x0 + i, arc(i)]
  return {
    f: fly(p, age, h), behind: age >= a1 && age < a2, pr, knightFront: true,
    top: st.wide ? cv => arrows(cv, age, a1 + 4, st, h.w) : undefined, actors,
  }
}

/** 3 catapult: behind the keep a catapult's arm rises over the merlons with a boulder, flings it in an arc at the
 * dragon hovering over the field, which barrel-rolls as it passes behind; the boulder lands in the grass right of the
 * knight in a puff of dust and settles in; the arm lowers. */
const catapult: Piece = (age, h) => {
  const { st, kn, w } = h
  const px = st.dx === 0 ? 6 : 1
  const deg = (a: number) => (a < 40 ? 170 - (35 * Math.max(0, a - 10)) / 30
    : a < 48 ? 135 - (60 * (a - 40)) / 8 : a < 90 ? 75 : 75 + (95 * Math.min(40, a - 90)) / 40)
  const tip = (a: number): [number, number] => {
    const r = (deg(a) * Math.PI) / 180
    return [px + Math.round(5 * Math.cos(r)), 6 - Math.round(5 * Math.sin(r))]
  }
  const [bx, by] = tip(48).map(v => v - 1) as [number, number]
  // It waits over the field for the boulder if it can be there in time; else (coming from the far end) the boulder
  // is aimed where it will be as it flies home, landing twice as far off as where they meet.
  const { p, hover, n, meet } = setup('catapult', h, () => {
    const dx = kn.x + 10
    const wait = Math.min(w - 4, kn.x + 30) - bx
    const p = plan(h, [{ x: dx, y: 1, at: 40, hold: wait + 12, face: -1 }])
    const hover = p.ok && p.arr[0]! <= 40 + dx - bx
    let [n, meet] = [wait, 48 + dx - bx]
    if (!hover) {
      meet = 48 + 30
      for (let m = 60; m <= 120; m++) if (bx + m - 48 + 2 >= h.at(m).x) { meet = m; break }
      n = Math.min(w - 4 - bx, Math.max(30, Math.min(86, 2 * (meet - 48))))
    }
    return { p, hover, n, meet }
  })
  const [lx, land] = [bx + n, 48 + n]
  const boulder = (a: number): [number, number] => {
    if (a < 48) return tip(a).map(v => v - 1) as [number, number]
    const u = Math.min(1, (a - 48) / n)
    return [bx + Math.min(n, a - 48), Math.round(by + (8 - by) * u * u - 6 * u * (1 - u))]
  }
  const f = hover ? fly(p, age, h) : h.at(age)
  const roll = meet - 6 - mod(meet, 2)
  const sink = Math.max(0, (age - land - 12) >> 2)
  const [ox, oy] = boulder(age)
  const rock = (cv: Canvas) => { if (sink < 3) sprite(cv, ox, oy + sink, BOULDER.slice(0, 3 - sink), ROCK) }
  const actors: Record<string, [number, number]> = {}
  if (age >= 10 && age < 130) actors.arm = tip(age)
  if (age >= 10 && age < land + 24 && sink < 3) actors.boulder = [ox, oy + sink]
  return {
    actors,
    f: { ...f, wing: rolled(h.t0 + age, h.t0 + roll) }, over: age >= roll + 2 && age < roll + 6,
    mid: age >= 10 && age < 130 ? cv => {
      // A beam two pixels thick (lit on top), a dark cup at its end.
      const rad = (deg(age) * Math.PI) / 180
      for (let r = 1; r <= 5; r++) {
        const [ax, ay] = [px + Math.round(r * Math.cos(rad)), 6 - Math.round(r * Math.sin(rad))]
        plot(cv, ax + 1, ay, WOOD.O!)
        plot(cv, ax, ay, r === 5 ? WOOD.o! : WOOD.I!)
      }
      if (age < 48) rock(cv)
    } : undefined,
    low: age >= 48 && age < land + 24 ? cv => {
      rock(cv)
      const k = age - land
      if (k >= 0 && k < 12) {
        for (const [ex, ey] of [[-2, 2], [-1, 1], [0, 0], [3, 0], [4, 1], [5, 2]] as const) {
          plot(cv, lx + ex, 8 + ey - (k >> 2), mix(DUST, SKY[8]!, k / 12))
        }
      }
    } : undefined,
  }
}

/** 4 landing: it comes down on the far grass, folds its wings and roars: rings run out of its jaws, the grass
 * flattens in a wave either side, two birds burst out of the trees either side; then it takes off for home. */
const landing: Piece = (age, h) => {
  const { lx, p } = setup('landing', h, () => {
    const lx = Math.min(h.w - DW - 8, reach(h) + 6)
    return { lx, p: plan(h, [{ x: lx, y: GROUND, at: 52, hold: 50, face: -1 }]) }
  })
  if (!p.ok) return {}
  const [a, d] = [p.arr[0]!, p.dep[0]!]
  const f = fly(p, age, h)
  const roar = age >= a + 10 && age < Math.min(a + 40, d - 6)
  const [wave, flight] = [age - a - 10, age - a - 12]
  // Two birds burst out of the trees either side of it.
  const near = trees(h.w, Math.max(0, h.st.dx + 25))
  const perches = [[near.filter(x => x < lx - 1).pop(), -1], [near.find(x => x > lx + DW), 1]] as const
  const birds = h.st.wide && flight >= 0 && flight < 12
    ? perches.flatMap(([x0, dir]): [number, number][] => (x0 === undefined ? [] : [[x0 - 1 + dir * flight, nearTop(x0) - 5 - flight]]))
    : []
  return {
    actors: Object.fromEntries(birds.map((b, i) => [`bird${i}`, b])),
    f: age >= a + 3 && age < d - 3 ? { ...f, wing: FOLDED } : f, open: roar, roar,
    mid: wave >= 0 && wave < 30 ? cv => {
      for (const x of [lx - 1 - wave, lx - 2 - wave, lx + DW + wave, lx + DW + 1 + wave]) plot(cv, x, 10, GRASS.deep)
    } : undefined,
    top: birds.length > 0 ? cv => {
      for (const [x, y] of birds) sprite(cv, x, y, BIRDS[mod(age, 4) < 2 ? 0 : 1]!, { B: BIRD })
    } : undefined,
  }
}

/** 5 sheep: a hay bale rolls in from the right with three sheep behind it; they graze; the dragon swoops at them and
 * they scatter (two off to the right, one bolting left behind the knight and the castle, if it can get there); it
 * snaps at the bale instead, which bursts into straw that falls into the grass; it flies home. */
const sheep: Piece = (age, h) => {
  const { w, kn, st } = h
  const { s0, p } = setup('sheep', h, () => {
    const s0 = Math.min(Math.max(w - 36, kn.x + 10), reach(h) + 10)
    const come = w - s0
    return { s0, p: plan(h, [{ x: s0 + 12, y: 2, at: come + 16, face: -1 }, { x: s0 + 5, y: GROUND, at: come + 34, hold: 22 }]) }
  })
  const come = w - s0
  const scatter = p.ok ? p.arr[0]! : come + 16
  const burst = p.ok ? p.arr[1]! + 8 : scatter + 24
  const wall = st.dx + 24
  const bolt = s0 + 6 - (wall - 3) <= BACK - scatter - 4
  const flock = Array.from({ length: 3 }, (_, i) => {
    const home = s0 + 6 + 6 * i
    const left = i === 0 && bolt
    let [x, face, art] = [Math.max(home, w + 6 + 6 * i - age), -1 as 1 | -1, SHEEP[mod(age >> 1, 2)]!]
    if (age >= come && age < scatter) art = mod(age + 4 * i, 16) < 8 ? SHEEP_GRAZE : SHEEP[0]!
    if (age >= scatter && left) [x, art] = [home - (age - scatter), SHEEP[mod(age, 2)]!]
    if (age >= scatter + 2 && !left) [x, face, art] = [home + age - scatter - 2, 1, SHEEP[mod(age, 2)]!]
    else if (age >= scatter && !left) [face, art] = [-1, SHEEP[0]!]
    return { x, face, art, on: age < BACK && x < w && x > -4 }
  })
  const bale = Math.max(s0, w - age)
  const herd = (cv: Canvas) => {
    for (const { x, face, art, on } of flock) if (on) sprite(cv, x, 8, art, SHEEP_KEYS, face)
    if (age < burst) sprite(cv, bale, 8, BALE[age < come ? mod(age >> 1, 2) : 0]!, BALE_KEYS)
  }
  const actors: Record<string, [number, number]> = {}
  flock.forEach(({ x, on }, i) => { if (on) actors[`sheep${i}`] = [x, 8] })
  if (age < burst && age < BACK) actors.bale = [bale, 8]
  const straw = (cv: Canvas) => {
    const i = age - burst
    if (i < 0) return
    for (let k = 0; k < 8; k++) {
      const y = 8 + (k >> 2) - Math.min(i, 3) + Math.max(0, i - 3)
      if (y < 10) plot(cv, s0 + (k & 3) + (((k & 3) - 1.5) > 0 ? 1 : -1) * (i >> 1), y, STRAW[k & 1]!)
    }
  }
  return {
    actors,
    f: fly(p, age, h), open: p.ok && age >= burst - 2 && age < burst + 1,
    mid: age < BACK ? herd : undefined, top: age >= burst && age < burst + 12 ? straw : undefined,
  }
}

/** Egg 0, frying pan: a rope uncoils from the princess's window, she climbs out and down it; the dragon passes low
 * and she bonks it with a frying pan (it flashes white, three stars circle its head while it hovers, dazed); she
 * climbs back up and draws the rope in. */
const pan: Piece = (age, h) => {
  const tx = h.st.towerX
  const p = setup('pan', h, () => plan(h, [{ x: tx + 12, y: 0, at: 40, face: -1 }, { x: tx - 2, y: 0, at: 0, hold: 34 }]))
  const bonk = p.ok ? p.arr[1]! : 70
  const back = p.ok ? p.dep[1]! + 2 : 104
  const rope = age < 4 ? 0 : age < back + 16 ? Math.min(5, (age - 4) >> 1) : Math.max(0, 5 - ((age - back - 16) >> 1))
  const rows = age < 14 ? 0
    : age < back + 2 ? Math.min(6, 2 + ((age - 14) >> 1))
    : Math.max(0, 6 - ((age - back - 2) >> 1))
  const y = age >= 24 && age < back ? 5 : 4
  const pose = age >= bonk - 4 && age < bonk - 2 ? 'mid' : age >= bonk - 2 && age < bonk ? 'up'
    : age >= bonk && age < bonk + 3 ? 'hit' : age >= bonk + 3 && age < bonk + 6 ? 'mid' : 'down'
  const pr: PrincessPose = (age >= 10 && age < 14) || (age >= back + 10 && age < back + 16) ? 'window'
    : age >= 10 && age < back + 16 ? 'hidden' : h.pr
  const f = fly(p, age, h)
  // Dazed while it hovers there; the stars circle where its head is, steady while the head wobbles.
  const dazed = p.ok && age >= bonk && age < Math.min(bonk + 32, p.dep[1]!)
  const wobble = dazed && mod(age - bonk, 8) >= 4 ? 1 : 0
  const fd = { ...f, y: f.y + wobble }
  const stars = dazed && age > bonk
    ? [0, 1, 2].map((k): [number, number] => {
      const a = (age - bonk) * 0.3 + (k * 2 * Math.PI) / 3
      return [f.x + 3 + Math.round(3 * Math.cos(a)), f.y + Math.round(1.5 * Math.sin(a))]
    })
    : []
  const actors: Record<string, [number, number]> = Object.fromEntries(stars.map((xy, k) => [`star${k}`, xy]))
  if (rows > 0) actors.princess = [tx + 1, y]
  return {
    actors,
    f: fd, flash: p.ok && age >= bonk && age < bonk + 2, pr,
    low: rope > 0 ? cv => { for (let j = 0; j < rope; j++) plot(cv, tx + 4, 6 + j, ROPE) } : undefined,
    top: rows > 0 || (dazed && age > bonk) ? cv => {
      if (rows > 0) {
        // Facing left, toward the dragon's head.
        sprite(cv, tx + 1, y, PRINCESS_FULL.slice(0, rows), PRINCESS_KEYS, -1)
        if (rows >= 5) for (const [dx, dy, k] of PAN[pose]!) plot(cv, tx + 3 - dx, y + dy, PAN_KEYS[k]!)
      }
      for (const [x, y] of stars) plot(cv, x, y, STAR)
    } : undefined,
  }
}

/** Egg 1, Clawd: Clawd rides out from behind the castle on a small horse and across the grass to the right edge
 * (behind the knight, in front of the dragon), tipping his lance at the dragon as he passes under it; on a band too
 * wide to cross at a pixel a frame, he rides half way out and back behind the castle. */
const clawd: Piece = (age, h) => {
  const { st, w } = h
  const x0 = st.dx + 24 - 13
  // Off the right edge by 152 if that is at most a pixel a frame; on a wider band he rides out half way and back.
  const across = w + 1 - x0 <= 152
  const xAt = (a: number) => x0 + (across ? Math.floor(((w + 1 - x0) * a) / 152) : Math.min(a, 152 - Math.min(152, a)))
  const face: 1 | -1 = across || age < 76 ? 1 : -1
  const pass = setup('clawd', h, () => {
    for (let a = 0; a < EVENT_LEN; a++) if (Math.abs(xAt(a) + 6 - (h.at(a).x + 8)) <= 2) return a
    return -99
  })
  const x = xAt(age)
  const k = age - pass
  const lance = k >= -4 && k < -2 ? 1 : k >= -2 && k < 6 ? 2 : k >= 6 && k < 8 ? 1 : 0
  const draw = (cv: Canvas) => {
    if (x >= w) return
    const bob = mod(age, 4) < 2 ? 0 : 1
    // Mirrored about the horse (9 wide) when riding back.
    const at = (dx: number, wide = 1) => (face > 0 ? x + dx : x + 9 - dx - wide)
    sprite(cv, x, 7, [...HORSE, HOOVES[mod(age, 4)]!], HORSE_KEYS, face)
    sprite(cv, at(1, 6), 5 + bob, CLAWD_MINI, CLAWD_KEYS, face)
    LANCE[lance]!.forEach(([dx, dy], i) => plot(cv, at(dx!), 6 + bob + dy!, i === 4 ? ARROW_HEAD : ROPE))
  }
  return { fore: draw, knightFront: true, actors: x < w ? { horse: [x, 7] } : undefined }
}

/** Egg 2, hatchling: the pet's hatchling comes out from behind the princess's tower and the castle wall, chases after
 * the dragon's tail (where it was eight frames ago, two pixels behind), both barrel-roll together (they turn over),
 * and it flies off up and to the right. */
const [ROLL, LEAVE] = [76, 92]
const FLIGHTS = new Map<string, [number, number, 1 | -1][]>()
/** The hatchling's whole flight for a slot (its column, row and facing by age), worked out once: a pixel a frame
 * across toward its target, a row every two frames. */
function hatchFlight(h: Home) {
  const key = `${h.t0}:${h.w}`
  let fl = FLIGHTS.get(key)
  if (fl) return fl
  let [x, y, face] = [h.st.towerX, 4, 1 as 1 | -1]
  const path: [number, number, 1 | -1][] = []
  for (let a = 0; a < EVENT_LEN; a++) {
    if (a > 10) {
      let [tx, ty] = [x + 1, -9]
      if (a < LEAVE) {
        const d = h.at(a - 8)
        ;[tx, ty] = [d.face > 0 ? d.x - 8 : d.x + DW + 2, d.y + 2]
      }
      const step = Math.sign(tx - x)
      if (step !== 0) [x, face] = [x + step, step as 1 | -1]
      if (mod(a, 2) === 0) y += Math.sign(ty - y)
    }
    path.push([x, y, face])
  }
  if (FLIGHTS.size > 32) FLIGHTS.clear()
  FLIGHTS.set(key, path)
  return path
}

const hatchling: Piece = (age, h) => {
  const [x, y, face] = hatchFlight(h)[age]!
  const art = HATCH[mod(age, 4) < 2 ? 0 : 1]!
  const turned = age >= ROLL + 2 && age < ROLL + 6
  const draw = (cv: Canvas) => {
    if (y > -4 && x < h.w) sprite(cv, x, y, turned ? [...art].reverse() : art, HATCH_KEYS, face)
  }
  return {
    f: { ...h.at(age), wing: rolled(h.t0 + age, h.t0 + ROLL) }, over: turned, fore: draw, knightFront: true,
    actors: y > -4 && x < h.w ? { hatchling: [x, y] } : undefined,
  }
}

const PIECES: Piece[] = [strafe, charge, towerRun, catapult, landing, sheep]
const EGGS: Piece[] = [pan, clawd, hatchling]
/** Pieces that play on the narrow stage (the rest fall back to the tower's flight there). */
const NARROW = new Set<Piece>([strafe, towerRun, landing, hatchling])
/** For the review sheet: names, and each one's busiest age. */
const PIECE_SHOW: [string, number][] = [
  ['strafe', 80], ['charge', 60], ['tower', 44], ['catapult', 76], ['landing', 72], ['sheep', 70],
]
const EGG_SHOW: [string, number][] = [['frying pan', 58], ['clawd', 70], ['hatchling', 80]]

/** Who is where at frame `t` in `slot` (none: everyone home). Below TINY nothing plays. */
function cast(t: number, w: number, s: Signals, st: Stage, slot: Slot | null): Cast {
  const kn = knightHome(t, w)
  const pr = princessHome(t, s)
  const base: Cast = {
    f: patrol(t, w), behind: false, open: false, flash: false, over: false, len: 0, roar: false,
    kn, knightFront: false, pr,
  }
  if (!slot || w < TINY) return base
  let piece = slot.egg >= 0 ? EGGS[slot.egg]! : PIECES[slot.kind]!
  if (!st.wide && !NARROW.has(piece)) piece = towerRun
  const t0 = t - slot.age
  return { ...base, ...piece(slot.age, { t0, w, st, s, at: a => patrol(t0 + a, w), kn, pr }) }
}

/** For the speed test: where everyone stands at frame `t` on the schedule (left column, top row): the dragon, the
 * knight, a wyvern on the patrol and the set piece's own actors while on screen. */
export function posesAt(t: number, w: number, s: Signals): Record<string, [number, number]> {
  const c = cast(t, w, s, stageOf(w), slotAt(t, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE))
  const v = patrol(t, w)
  return { dragon: [c.f.x, c.f.y], knight: [c.kn.x, c.kn.y], wyvern: [v.x, v.y], ...c.actors }
}

// ---- reactions --------------------------------------------------------------------------------------------------

/** News plays this many frames and leaves nothing behind (the stage clears news at about 40). */
const REACT = 28
const FIREWORK = ['#ffd166', '#80ed99', '#ff8fab']
const [ROAR_END, SOOT, ROYAL] = ['#bc6c25', '#3d2817', '#d62839']
const CONFETTI = ['#ffd166', '#ff8fab', '#80ed99', '#ffffff', '#c77dff', '#4cc9f0']
/** The knight's sword salute (from three rows above his helm): the sword lifted to his shoulder, then held
 * overhead straight up or leaning forward. */
const SALUTE = [
  ['', '', '......B', '..Pp..B', '.JKkJGG', '.JkFJk.', 'ZSJTtJ.', 'SCSTtJ.', 'ssJTtJ.', '..j.j..', '.MM.Mm.'],
  ['.....B.', '.....B.', '.....B.', '..PpGGG', '.JKkJk.', '.JkFJk.', 'ZSJTtJ.', 'SCSTtJ.', 'ssJTtJ.', '..j.j..', '.MM.Mm.'],
  ['.......B', '......B.', '......B.', '..PpGG..', '.JKkJk..', '.JkFJk..', 'ZSJTtJ..', 'SCSTtJ..', 'ssJTtJ..', '..j.j...', '.MM.Mm..'],
]
/** Knocked down: crouching (a row lower, no sword), then sitting with his legs out and his sword in the grass. */
const KNIGHT_CROUCH = ['..Pp...', '.JKkJ..', '.JkFJ..', 'ZSJTtJ.', 'SCSTtJ.', 'ssJTtJ.', '.MMjMm.']
const KNIGHT_SIT = ['..Pp.....', '.JKkJ....', '.JkFJ....', 'ZSJTtJ...', 'SCSTtJ...', 'ssJTtjjMm', '.....GBBB']
/** The royal banner under the princess's window: gold, a crimson crown, a swallowtail. */
const ROYAL_BANNER = ['XXZ', 'YRZ', 'YYZ', 'Y.z']
/** Dazed stars circling a head: sixteen steps round a 9×3 ring, never more than a pixel a step. */
const ORBIT: [number, number][] = [
  [0, -1], [1, -1], [2, -1], [3, -1], [4, 0], [3, 1], [2, 1], [1, 1],
  [0, 1], [-1, 1], [-2, 1], [-3, 1], [-4, 0], [-3, -1], [-2, -1], [-1, -1],
]

/** The colour under (x, y) so far, else the sky's. */
const under = (cv: Canvas, x: number, y: number) => cv.px[y * cv.w + x] ?? SKY[Math.min(9, Math.max(0, y))]!
/** `c` faded by `k` toward whatever is under (x, y). */
const fadeAt = (cv: Canvas, x: number, y: number, c: string, k: number) => {
  if (x < 0 || x >= cv.w || y < 0 || y >= cv.h) return
  plot(cv, x, y, k > 0 ? mix(c, under(cv, x, y), k) : c)
}

/** Three stars circling (cx, cy), a step a frame, each a small plus (its arms out from `age` 2), twinkling. */
function dizzy(cv: Canvas, cx: number, cy: number, age: number): void {
  for (let k = 0; k < 3; k++) {
    const [dx, dy] = ORBIT[mod(age + 5 * k, ORBIT.length)]!
    const [x, y] = [cx + dx, cy + dy]
    const arm = mod(age + k, 4) < 2 ? PALE : WHITE
    if (age >= 2) for (const [ax, ay] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) plot(cv, x + ax, y + ay, arm)
    plot(cv, x, y, STAR)
  }
}

/** A puff of smoke at (x, y), `a` frames old (of 10): rising a pixel every two frames, spreading, fading. */
function puff(cv: Canvas, x: number, y: number, a: number): void {
  if (a < 0 || a >= 10) return
  const py = y - (a >> 1)
  const k = a < 6 ? 0 : (a - 5) / 5
  const pts = a < 3 ? [[0, 0], [1, 0]] : [[0, 0], [1, 0], [0, -1], [-1, 0], [2, -1]]
  for (const [dx, dy] of pts) fadeAt(cv, x + dx!, py + dy!, SMOKE[(dx! + dy! + a) & 1]!, k)
}

/** testPass: three rockets go up from the castle a pixel a frame (launched at 0, 1, 2; bursting at 4, 6, 8, the later
 * ones from lower down), each bursting at the top
 * into an eight-rayed star (gold, green, pink) that grows a pixel a frame, thins to its tips, droops and fades by
 * REACT. */
function fireworks(cv: Canvas, age: number, t: number, w: number, st: Stage): void {
  const xs = w >= FULL ? [4, 10, 22] : st.wide ? [3, 11, 27] : w >= TINY ? [3, 12, 21] : [2, w >> 1, w - 3]
  for (let k = 0; k < 3; k++) {
    const [x, top, born] = [xs[k]!, k === 1 ? 3 : 2, k]
    const bang = 4 + 2 * k
    if (age < born) continue
    if (age < bang) {
      // The rocket: a white head, a trail in its burst's colour flickering, a spark spitting off on alternate sides,
      // a smoke trail under it.
      const y = top + bang - age
      const ink = FIREWORK[k]!
      plot(cv, x, y, WHITE)
      plot(cv, x, y + 1, mod(t, 2) === 0 ? ink : PALE)
      plot(cv, x, y + 2, mix(ink, INK, 0.3))
      plot(cv, x + (mod(age, 2) === 0 ? 1 : -1), y + 2, ink)
      // Its smoke trail back down to where it went up from, thinning.
      for (let j = 3; j <= age - born + 2; j++) fadeAt(cv, x, y + j, SMOKE[0]!, 0.25 * (j - 2))
      continue
    }
    const [a, life] = [age - bang, REACT - 2 - bang]
    if (a >= life) continue
    const r = Math.min(3, a + 1)
    const sag = a >= life - 4 ? 2 : a >= life - 8 ? 1 : 0
    const fade = Math.max(0, (a - (life - 6)) / 6)
    const ink = FIREWORK[k]!
    if (a < 2) plot(cv, x, top, WHITE)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      for (let j = Math.max(1, a >= 10 ? r : a >= 6 ? r - 1 : 1); j <= r; j++) {
        const tip = j === r
        if (top + dy * j < 0) continue
        const c = tip ? (mod(t + k + dx + dy, 3) === 0 ? WHITE : PALE) : ink
        fadeAt(cv, x + dx * j, top + dy * j + (tip ? sag : sag >> 1), tip && a >= 6 ? (mod(t + dx, 2) === 0 ? ink : PALE) : c, fade)
      }
    }
  }
}

/** testPass: every banner slot hangs out gold (unrolling a row a frame, rolling up again at the end), flashing
 * bright on even frames. */
function festive(cv: Canvas, age: number, t: number, st: Stage): void {
  const rows = age < 24 ? Math.min(3, age + 1) : REACT - 1 - age
  const ink = mod(t, 2) === 0 ? (c: string) => mix(c, WHITE, 0.45) : (c: string) => c
  for (const [x, y] of bannerSlots(st)) {
    for (let j = 0; j < rows; j++) {
      plot(cv, x, y + j, ink(j === 0 ? BANNER.X! : BANNER.Y!))
      plot(cv, x + 1, y + j, ink(j === 2 ? BANNER.z! : BANNER.Z!))
    }
  }
}

/** commit: the royal banner unrolls under the princess's window a row a frame and rolls up again at the end. */
function royalBanner(cv: Canvas, age: number, x0: number): void {
  const rows = age < 24 ? Math.min(4, age + 1) : REACT - 1 - age
  sprite(cv, x0 + 1, 7, ROYAL_BANNER.slice(0, Math.max(0, rows)), { ...BANNER, R: ROYAL })
}

/** commit: confetti tossed up off the battlements (or the tower's top), each piece rising two pixels, then
 * fluttering down a pixel every two frames, tumbling, and lying in the grass until REACT. */
function confetti(cv: Canvas, age: number, st: Stage): void {
  const [xs, y0] = st.wide
    ? [Array.from({ length: 12 }, (_, k) => 1 + 2 * k + st.dx).filter(x => x >= 0), 4]
    : st.tower ? [[0, 1, 2, 3, 4, 5], 3] : [[], 0]
  xs.forEach((x, k) => {
    const a = age - mod(5 * k, 7)
    if (a < 0) return
    const y = a < 2 ? y0 - a - 1 : Math.min(11, y0 - 2 + ((a - 2) >> 1))
    const sway = y < 11 && mod((a >> 2) + k, 2) === 1 ? 1 : 0
    const ink = CONFETTI[k % CONFETTI.length]!
    plot(cv, x + sway, y, ink)
    // Tumbling: a strip on edge, then flat (two pixels), a darker back on the turn; flat once it lies in the grass.
    if (y === 11 || mod(a + k, 4) < 2) plot(cv, x + sway + 1, y, y === 11 ? ink : mix(ink, INK, 0.25))
  })
}

/** commit: the roar's rings, one every four frames, born over the jaw's tip where it was when it set off, running out a
 * pixel a frame for ten frames, a 5-pixel arc (its ends a pixel behind) fading from pale to bronze, a darker bronze
 * rim behind it once it has left (so it shows on the sky and on the sun). */
function roar(cv: Canvas, age: number, t: number, at: (te: number) => Fly): void {
  for (let born = 0; born <= 16; born += 4) {
    const d = age - born
    if (d < 0 || d >= 10) continue
    const f = at(t - d)
    const [jx, jy] = jaws(f)
    const x = jx + f.face * (d - 1)
    const [c, rim] = [mix(PALE, ROAR_END, d / 9), mix(ROAR_END, INK, 0.25 + d / 30)]
    for (const dy of [-2, -1, 0, 1, 2]) {
      const bx = x - (Math.abs(dy) === 2 ? f.face : 0)
      if (d > 0) plot(cv, bx - f.face, jy + dy, rim)
      plot(cv, bx, jy + dy, c)
    }
  }
}

/** The knight caught by a fire blast at `age`. `k0` is where he was when the news came, `k1` where he will be at
 * REACT. Flames cover his front for five frames. He is knocked back three pixels from `k0` (a pixel a frame),
 * crouches, and sits with his sword dropped (his place frozen, so he never drifts while down). Then he crouches
 * again and walks, a pixel a frame, to `k1`, arriving a frame before REACT (so his shield's sparks, which follow it
 * by a frame, never start on a step), his shield up on the way if fire is on him. Soot on
 * him fades over 16 frames. Returns how to draw him, his column, where his helm is, whether he is dazed (stars) and
 * whether he is walking back now and was on the frame before (his shield, its sparks). */
function knockedDown(k0: KnightPose, k1: KnightPose, age: number): {
  draw: (cv: Canvas, t: number, shield: boolean) => void; x: number; helm: [number, number]; dazed: boolean
  walking: boolean; walked: boolean
} {
  const back = -k0.face
  const sitX = k0.x + 3 * back
  const dir = Math.sign(k1.x - sitX)
  // He gets up in time to walk the gap (three pixels at his post, more if his place moved on meanwhile).
  const walk = Math.max(7, REACT - 1 - Math.abs(k1.x - sitX))
  const up = walk - 1
  const face: 1 | -1 = dir > 0 ? 1 : dir < 0 ? -1 : k1.face
  const x = age <= 3 ? k0.x + back * age : age < walk ? sitX : k1.x - dir * Math.max(0, REACT - 1 - age)
  const soot = Math.max(0, 0.55 * (1 - age / 16))
  const ink = soot > 0 ? (c: string) => mix(c, SOOT, soot) : undefined
  const sit = age >= 5 && age < up
  const crouch = age === 4 || age === up
  // A wider sprite mirrored about its own width: keep his body where the standing one's would be.
  const draw = (cv: Canvas, t: number, shield: boolean) => {
    if (sit) sprite(cv, k0.face > 0 ? x : x - 2, KNIGHT_Y + 2, KNIGHT_SIT, KNIGHT_KEYS, k0.face, ink)
    else if (crouch) sprite(cv, x, KNIGHT_Y + 1, KNIGHT_CROUCH, KNIGHT_KEYS, age === 4 ? k0.face : face, ink)
    else if (age >= walk) sprite(cv, x, KNIGHT_Y, shield ? KNIGHT_SHIELD : runArt(age), KNIGHT_KEYS, face, ink)
    else sprite(cv, x, k0.y, KNIGHT[0]!, KNIGHT_KEYS, k0.face, ink)
    if (age < 5) {
      // The blast: flames over the side he faced, shrinking, flickering.
      const front = k0.face > 0 ? k0.x + 7 : k0.x - 1
      for (let i = 0; i < 3 - (age >> 1); i++) {
        for (let y = k0.y + 1 + i; y <= KNIGHT_Y + 7; y++) {
          const n = noise(i * 5.3 + y * 1.7 + t * 0.77)
          plot(cv, front + k0.face * i - k0.face * (age > 1 ? 1 : 0), y, n < 0.3 ? PALE : n < 0.7 ? FLAME : EMBER)
        }
      }
    }
  }
  const helm: [number, number] = [x + 3, sit ? KNIGHT_Y + 2 : crouch ? KNIGHT_Y + 1 : KNIGHT_Y]
  return { draw, x, helm, dazed: age >= 6 && age < up, walking: age >= walk, walked: age - 1 >= walk }
}

/** testFail on the narrow stage (no knight): an arrow from the tower's side flies the last four pixels up into the
 * dragon's flank and sticks there until 22; the dragon flashes white for three frames and, from the next, is knocked
 * up a pixel for nine; a puff rises from the hit. */
const HIT = 4
function arrowHit(f0: Fly, age: number): { f: Fly; flash: boolean; draw: (cv: Canvas) => void } {
  const f = age > HIT && age < HIT + 10 ? { ...f0, y: f0.y - 1 } : f0
  const [hx, hy] = [f.x + (f.face > 0 ? 6 : 9), f.y + 4]
  const draw = (cv: Canvas) => {
    if (age < HIT) {
      const [x, y] = [hx - (HIT - age), hy + ((HIT - age + 1) >> 1)]
      plot(cv, x, y, ARROW_HEAD)
      plot(cv, x - 1, y, ARROW_SHAFT)
      plot(cv, x - 2, y + 1, ARROW_SHAFT)
      plot(cv, x - 3, y + 1, WHITE)
    } else if (age < 22) {
      plot(cv, hx - 1, hy, ARROW_SHAFT)
      plot(cv, hx - 2, hy + 1, ARROW_SHAFT)
      plot(cv, hx - 3, hy + 1, WHITE)
      puff(cv, hx, hy - 1, age - HIT)
    }
  }
  return { f, flash: age >= HIT && age < HIT + 3, draw }
}

// ---- the scene --------------------------------------------------------------------------------------------------

/** The scene at frame `t`, `w` cells wide. `opts.slot` forces a set piece (or, null, none) for tests; otherwise the
 * schedule picks it by `t`. */
export function dragonScene(t: number, w: number, s: Signals, opts: { slot?: Slot | null } = {}): Grid {
  const cv = canvas(w, DRAGON_ROWS)
  const st = stageOf(w)
  const slotOf = (te: number): Slot | null => {
    const forced = opts.slot
    if (forced === undefined) return slotAt(te, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE)
    if (forced === null) return null
    const age = forced.age + te - t
    return age >= 0 && age < forced.len ? { ...forced, age } : null
  }
  const casts = new Map<number, Cast>()
  const castAt = (te: number): Cast => {
    let c = casts.get(te)
    if (!c) casts.set(te, (c = cast(te, w, s, st, slotOf(te))))
    return c
  }
  const at = (te: number) => castAt(te).f
  const c = castAt(t)
  // News plays on top of whatever else does, for REACT frames: testPass fireworks, banners and a salute; testFail
  // the knight knocked down (an arrow in the dragon when there is no knight); commit a roar, the royal banner and
  // confetti.
  const age = s.news && s.newsAge < REACT ? s.newsAge : -1
  const [pass, fail, commit] = [age >= 0 && s.news === 'testPass', age >= 0 && s.news === 'testFail', age >= 0 && s.news === 'commit']
  const hit = fail && !st.wide ? arrowHit(c.f, age) : undefined
  const down = fail && st.wide ? knockedDown(castAt(t - age).kn, castAt(t - age + REACT).kn, age) : undefined
  // Roaring it rears, wings raised (dipping to mid on the down beat), jaws open; it keeps to its path.
  const roaring = commit && age < 20
  const f = hit ? hit.f : roaring && c.f.wing !== FOLDED ? { ...c.f, wing: c.f.wing === 2 ? 1 : 0 } : c.f
  const tool = s.act === 'tool' ? s.tool ?? 'other' : undefined
  const hue = tool && tool !== 'bash' ? TOOL_INK[tool] : undefined

  // The breath: grown a pixel on each frame the head held still since the act began and since it last turned
  // (looking back along whatever path it flew), and drawn back before the next turn, so it never swaps sides; a set
  // piece's own fire on top.
  const grown = (te: number, window: number, most: number) => {
    let n = 0
    for (let j = 0; j < window && n < most; j++) {
      const [now, before] = [at(te - j), at(te - j - 1)]
      if (now.face !== before.face) break
      if (now.x === before.x) n++
    }
    return n
  }
  const breath = (te: number, most: number, from: number) =>
    Math.max(0, Math.min(grown(te, s.actAge - (t - te) + 1 - from, most), at(te).until - 2))
  const fireAt = (te: number) => Math.max(castAt(te).len, tool === 'bash' ? breath(te, CONE, 0) : 0)
  const len = fireAt(t)
  const spark = hue ? breath(t, SPARKS, 2) : 0
  // The knight raises his shield while the cone's tip is over him (facing it); sparks fly off it once it is up.
  const kn = c.kn
  const shieldAt = (te: number) => {
    const [fe, k, l] = [at(te), castAt(te).kn, fireAt(te)]
    const [jx, jy] = jaws(fe)
    const tipX = jx + fe.face * (l - 1)
    return st.wide && k.face > 0 && l > 0 && tipX >= k.x - 1 && tipX <= k.x + 7 && jy + ((l - 1) >> 1) >= k.y - 2
  }
  // Knocked down he has no shield up, until he walks back (then as he would anyway).
  const shield = down ? down.walking && shieldAt(t) : shieldAt(t)
  // testPass: at his post, he lifts his sword and holds it overhead, waving it forward and back on 8 frames.
  const salute = pass && st.wide && !shield && kn.face > 0 && kn.y === KNIGHT_Y && KNIGHT.some(a => a === kn.art) &&
    age >= 3 && age < 26 ? SALUTE[age === 3 || age >= 24 ? 0 : mod(age - 4, 8) < 4 ? 1 : 2]! : undefined

  // The dragon: a tool's colour tints its wings over four frames; saying, its jaws work on 3 frames in 6.
  let keys = DRAGON_KEYS
  if (hue) {
    const k = Math.min(1, s.actAge / 4) * 0.6
    keys = { ...DRAGON_KEYS, W: mix(DRAGON_KEYS.W!, hue, k), w: mix(DRAGON_KEYS.w!, hue, k), v: mix(DRAGON_KEYS.v!, hue, k) }
  }
  const say = s.act === 'say' && s.actAge >= 2
  const open = (say && mod(t, 6) < 3) || len > 0 || c.open || roaring || (!!down && age < 4)
  const drawDragon = () => dragon(cv, f, open, keys, c.flash || hit?.flash ? blanch : undefined, c.over)
  const drawKnight = () => {
    if (!st.wide) return
    if (down) down.draw(cv, t, shield)
    else if (salute) sprite(cv, kn.x, kn.y - 3, salute, KNIGHT_KEYS)
    else knight(cv, kn, shield)
  }

  // Back to front: sky and sun, clouds, hills and birds, the archers behind the merlons, the grass, the castle.
  skyAndSun(cv, t, w)
  clouds(cv, t, w, w < TINY ? 1 : Math.min(4, 2 + Math.floor(w / 60)))
  c.under?.(cv)
  if (st.wide) hills(cv, t, w, Math.max(0, st.dx + 25))
  if (c.behind) drawDragon()
  if (st.wide) archers(cv, t, st.dx, pass && age < 26)
  grass(cv, t, w)
  c.mid?.(cv)
  castle(cv, t, st)
  banners(cv, s, t, st)
  if (pass) festive(cv, age, t, st)
  if (commit && st.tower) royalBanner(cv, age, st.towerX)
  // commit: the princess leans out of her window, waving.
  const pr = commit && age >= 2 && age < 24 ? (mod(t, 6) < 3 ? 'wave0' : 'wave1') : c.pr
  if (st.tower) princess(cv, pr, st.towerX)
  c.low?.(cv)

  // The wyverns a fifth of a loop apart behind it on its patrol, the newest greeting as it joins.
  const n = Math.min(s.agents, MAX_WYVERNS)
  for (let i = n - 1; i >= 0; i--) {
    const v = patrol(t - Math.round(((i + 1) * geoOf(w).p) / 5), w)
    wyvern(cv, v, t, i, i === n - 1 && s.agentsAge < GREET && mod(s.agentsAge, 2) === 0)
  }

  if (!c.knightFront) drawKnight()
  if (!c.behind) drawDragon()
  if (c.fore) {
    // In front of the dragon, but behind the castle: only where the castle (with its banners and princess) isn't.
    const [layer, wall] = [canvas(w, DRAGON_ROWS), canvas(w, DRAGON_ROWS)]
    c.fore(layer)
    castle(wall, t, st)
    banners(wall, s, t, st)
    if (st.tower) princess(wall, pr, st.towerX)
    layer.px.forEach((p, i) => { if (p && !wall.px[i]) cv.px[i] = p })
  }
  if (c.knightFront) drawKnight()
  if (len > 0) fire(cv, f, len, t, a => fireAt(t - a) >= CONE)
  if (shield && shieldAt(t - 1) && (!down || down.walked)) shieldSparks(cv, (down ? down.x : kn.x) + 6, down ? KNIGHT_Y : kn.y, t)
  if (hue && spark > 0) sparks(cv, f, spark, t, hue)
  if (say) rings(cv, t, at)
  if (c.roar || castAt(t - 11).roar || castAt(t - 6).roar) rings(cv, t, at, te => castAt(te).roar)
  c.top?.(cv)
  // The knight's own sword stroke, unless a blast has knocked him down.
  if (!down) c.slash?.(cv)
  if (pass) fireworks(cv, age, t, w, st)
  if (down) {
    const [hx, hy] = down.helm
    if (down.dazed) dizzy(cv, hx, hy - 2, age - 6)
    puff(cv, hx + 2 * kn.face, hy + 1, age - 1)
    puff(cv, hx - kn.face, hy + 2, age - 7)
  }
  hit?.draw(cv)
  if (commit) {
    roar(cv, age, t, at)
    confetti(cv, age, st)
  }

  const g = cells(cv)
  const [text, ink] = sign(s, t)
  glyph(g, cv, 0, 0, text, ink)
  if (s.act === 'ask' && st.tower && mod(t, 8) < 6) glyph(g, cv, st.towerX + 7, 1, '?', '#ffd166')
  return g
}

/** A hatchling: a big round head (two gold horn nubs, pale eyes, a pink snout, a jaw that works as it talks) on a
 * small body with a gold belly, a gold wing nub on its back, stubby feet and a tail flicking up behind. */
export const PET: PetArt = {
  body: ['......K...K.', '..N...HHHHH.', '.NNBBHHHHHHS', 'T.BGGBHHHHHS', '.TBB.BB.....'],
  step: ['......K...K.', '..N...HHHHH.', '.NNBBHHHHHHS', 'T.BGGBHHHHHS', '.T.BB..BB...'],
  colors: { K: '#ffd166', N: GOLD, B: '#e63946', H: '#e63946', G: GOLD, S: '#ff758f', T: '#c1121f' },
  eyes: [7, 9], eyeRow: 1, eye: PALE, lid: '#e63946',
  mouth: [9, 3], blush: '#ff758f', spark: EMBER,
}

export const DRAGON: Theme = {
  name: 'dragon',
  rows: DRAGON_ROWS,
  opaque: true,
  color: '#e63946',
  accent: GOLD,
  sprite: {
    think: ['⋗·  ', '⋗ · ', '⋗  ·', '⋗ · '], tool: ['⋗≋  ', '⋗ ≋ ', '⋗  ≋', '⋗ ≋ '],
    say: ['⋗ ♪', '⋗ ♫'], wait: ['⋗ .', '⋗ ..', '⋗ ...'],
  },
  happy: '⋗ ✦', sad: '⋗ …', dead: '✗', sleep: '⋗ zZ',
  confetti: ['✦', '*', '·', '˚'],
  palette: ['#e63946', GOLD, EMBER, '#ffd166'],
  scene: (t, w, s) => dragonScene(t, w, s),
  showcase: () => [
    ...PIECE_SHOW.map(([name, busy], k) => ({
      name: `piece ${name}`, t: firstSlot(k, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE) + busy - 12,
    })),
    ...EGG_SHOW.map(([name, busy], e) => ({
      name: `egg ${name}`, t: eggSlot(e, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE) + busy - 12,
    })),
  ],
  pet: PET,
}
