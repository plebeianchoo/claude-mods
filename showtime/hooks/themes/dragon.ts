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
// home pose for `t` (`patrol`, `knightHome`, `princessHome`) that set pieces leave from and return to. News
// (testPass, testFail, commit) shows only on the sign for now; the scene's reactions come with the set pieces.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import type { Slot } from '../events'
import type { PetArt } from '../pets'
import { mix, paint, sprite } from '../pixel'
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
 * cropped), its margin from the right (clear of the sun on the full stage, across it when narrower), its most
 * swing. */
const [ZONE_DX, ZONE_DX_CROP, ZONE_R, ZONE_R_NARROW, MAX_A] = [4, 7, 10, 4, 32]
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
]
const WING_CYCLE = [0, 1, 2, 1]
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
/** The princess in her window (3×2: crown, hair, face) and leaning out (her arm up or down, the dress on the sill). */
const PRINCESS_IN = ['AcA', 'aFa']
const PRINCESS_OUT = [['.cA.K', 'AFaK.', 'LDd..'], ['.cA..', 'AFaKK', 'LDd..']]
/** An archer, 3×3: hood, face and bow, tunic. */
const ARCHER = ['.Gb', 'eFb', 'Egb']
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

// ---- poses ------------------------------------------------------------------------------------------------------

/** A flyer on the figure-eight: its left column, top pixel row, facing, wing pose, frames since its last turn and
 * to its next. */
export type Fly = { x: number; y: number; face: 1 | -1; wing: number; since: number; until: number }
/** The figure-eight for a width: its middle column, its swing either side, its period in frames. */
type Geo = { cx: number; a: number; p: number }
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
 * the right edge (across the sun), anchored left so its near end comes over the knight; a period long enough that
 * it never moves more than 0.8 of a pixel a frame (a multiple of 8, so the turns fall on whole, even frames). */
function geoOf(w: number): Geo {
  let g = GEOS.get(w)
  if (!g) {
    const right = w >= FULL ? w - ZONE_R : w >= TINY ? w - ZONE_R_NARROW : w
    const left = Math.max(0, Math.min(w >= WIDE ? stageOf(w).knightX + (w >= FULL ? ZONE_DX : ZONE_DX_CROP) : w >= TINY ? 7 : 0, right - DW))
    const room = Math.max(0, right - left - DW)
    const a = Math.min(MAX_A, room >> 1)
    g = { cx: left + a + (w < TINY ? (room >> 1) - a : 0), a, p: 8 * Math.round(Math.max(64, 8 * a) / 8) }
    GEOS.set(w, g)
  }
  return g
}

/** The dragon's patrol pose at `t`: across by sin, its height by sin 2θ (y 0..3), facing the way it goes, its wings
 * on an eight-frame cycle. Each frame changes one thing at most besides its column: the wings change pose on odd
 * frames, the height on even ones, never on a turn (turns fall on even frames, the period being a multiple of 8).
 * Wyverns fly the same path, later. */
export function patrol(t: number, w: number): Fly {
  const g = geoOf(w)
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

/** How far a breath (fire or sparks) has grown over the last `window` frames: a pixel on each frame the dragon held
 * its column, so its tip never moves two in a frame (`most` at most). */
function grown(t: number, w: number, window: number, most: number): number {
  let n = 0
  for (let j = 0; j < window && n < most; j++) if (patrol(t - j, w).x === patrol(t - j - 1, w).x) n++
  return n
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
  for (let x = from + 6; x < w - 2; x += 17) {
    const at = x + Math.floor(noise(x) * 6)
    sprite(cv, at - 1, nearTop(at) - 3, TREE_ART, TREE)
  }
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
function archers(cv: Canvas, t: number, dx: number): void {
  for (const [x, off] of [[8, 0], [21, 5]] as const) {
    sprite(cv, x + dx, 2 + (mod(t + off, 12) < 6 ? 0 : 1), ARCHER, ARCHER_KEYS)
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
 * colour tints the membrane). */
function dragon(cv: Canvas, f: Fly, open: boolean, keys: Record<string, string>): void {
  sprite(cv, f.x, f.y, open ? DRAGON_OPEN : DRAGON_BODY, keys, f.face)
  sprite(cv, f.x, f.y, WINGS[f.wing]!, keys, f.face)
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
 * flight, the outer one paler. `at(te)` is the dragon's pose at frame `te`. */
function rings(cv: Canvas, t: number, at: (te: number) => Fly): void {
  for (let k = 0; k < 2; k++) {
    const d = mod(t, 6) + 6 * k
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

// ---- the scene --------------------------------------------------------------------------------------------------

/** The scene at frame `t`, `w` cells wide. `opts.slot` will force a set piece (or none) for tests; set pieces
 * come in a later step, so for now every frame is the plain patrol. */
export function dragonScene(t: number, w: number, s: Signals, opts: { slot?: Slot | null } = {}): Grid {
  void opts
  const cv = canvas(w, DRAGON_ROWS)
  const st = stageOf(w)
  const f = patrol(t, w)
  const kn = knightHome(t, w)
  const tool = s.act === 'tool' ? s.tool ?? 'other' : undefined
  const hue = tool && tool !== 'bash' ? TOOL_INK[tool] : undefined

  // Back to front: sky and sun, clouds, hills and birds, the archers behind the merlons, the castle, the grass.
  skyAndSun(cv, t, w)
  clouds(cv, t, w, w < TINY ? 1 : Math.min(4, 2 + Math.floor(w / 60)))
  if (st.wide) {
    hills(cv, t, w, Math.max(0, st.dx + 25))
    archers(cv, t, st.dx)
  }
  grass(cv, t, w)
  castle(cv, t, st)
  banners(cv, s, t, st)
  if (st.tower) princess(cv, princessHome(t, s), st.towerX)

  // The wyverns a fifth of a loop apart behind it, the newest greeting as it joins.
  const n = Math.min(s.agents, MAX_WYVERNS)
  for (let i = n - 1; i >= 0; i--) {
    const v = patrol(t - Math.round(((i + 1) * geoOf(w).p) / 5), w)
    wyvern(cv, v, t, i, i === n - 1 && s.agentsAge < GREET && mod(s.agentsAge, 2) === 0)
  }

  // The breath: grown a pixel on each frame the head held still since the act began and since the last turn, and
  // drawn back before the next turn, so it never swaps sides.
  const breath = (te: number, most: number, from: number) => {
    const p = te === t ? f : patrol(te, w)
    return Math.max(0, Math.min(grown(te, w, Math.min(s.actAge - (t - te) + 1 - from, p.since - 1), most), p.until - 2))
  }
  const len = tool === 'bash' ? breath(t, CONE, 0) : 0
  const spark = hue ? breath(t, SPARKS, 2) : 0
  // The knight raises his shield while the cone's tip is over him.
  const [jx, jy] = jaws(f)
  const tipX = jx + f.face * (len - 1)
  const shield = st.wide && len > 0 && tipX >= kn.x - 1 && tipX <= kn.x + 7 && jy + ((len - 1) >> 1) >= kn.y - 2
  if (st.wide) knight(cv, kn, shield)

  // The dragon: a tool's colour tints its wings over four frames; saying, its jaws work on 3 frames in 6.
  let keys = DRAGON_KEYS
  if (hue) {
    const k = Math.min(1, s.actAge / 4) * 0.6
    keys = { ...DRAGON_KEYS, W: mix(DRAGON_KEYS.W!, hue, k), w: mix(DRAGON_KEYS.w!, hue, k), v: mix(DRAGON_KEYS.v!, hue, k) }
  }
  const say = s.act === 'say' && s.actAge >= 2
  const open = (say && mod(t, 6) < 3) || len > 0
  dragon(cv, f, open, keys)
  if (len > 0) fire(cv, f, len, t, a => breath(t - a, CONE, 0) >= CONE)
  if (shield) shieldSparks(cv, kn.x + 6, kn.y, t)
  if (hue && spark > 0) sparks(cv, f, spark, t, hue)
  if (say) rings(cv, t, te => patrol(te, w))

  const g = cells(cv)
  const [text, c] = sign(s, t)
  glyph(g, cv, 0, 0, text, c)
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
  pet: PET,
}
