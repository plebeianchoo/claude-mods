// Theme: samurai. Its scene, its words and its pet.
//
// The scene: a duel on a wooden bridge under a red moon (#e5383b). The hero (white gi, red hakama) holds the
// left third, a rival per agent (three at most, one always) the right, both breathing on a 16-frame cycle, the
// rival mirroring him; blossom hangs from the top corners, a petal let go every other frame, falling a pixel a
// frame onto the deck. A sign behind his head reads the act; a tool tints his steel, each call a slash arc of four
// frames beside the blade (bash cuts twice); ask lifts the blade. A lantern per task on the bridge's beam (floor-
// scaled), `done` lit, the newest brightening; a new rival bows in place. testFail: he staggers 2 px back over six
// frames in a burst of petals and steps back in; testPass: a glint runs the blade; commit: he sheathes it over
// eight frames, bows (the rivals bow back) and draws again within 30. Motion rules: the hero's blade tip never
// leaves its cell row (arcs, not the blade, cut), so no run is born mid-air; petals leave from inside a clump's
// cell; through a commit the sign stands where the tip was; the rail and the deck fill pixel rows 4, 6 and 7.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Px = readonly [dx: number, dy: number, key: string]
type Ink = Record<string, string>

/** A fighter's box (the blade's tip in its last column), a rival's slot pitch, rivals at most, lanterns at most. */
const [FIG_W, PITCH, MAX_RIVALS, MAX_LANTERNS] = [10, 10, 3, 12]
/** Pixel rows: the rail, the deck, the beam (lanterns); a petal's landing frames. */
const [RAIL_Y, DECK_Y, BEAM_Y, LAND] = [4, 6, 7, 6]
/** Frames: an act's change, a lantern's brightening, a rival's bow, the 100% flare, testPass's glint. */
const [CHANGE_FRAMES, LIGHT_FRAMES, GREET_FRAMES, FLARE_FRAMES, PASS_FRAMES] = [4, 8, 12, 16, 12]
/** testFail: his offset back per newsAge (2 px over six frames, held, back in by 26); the burst's frames. */
const STAGGER = [0, 0, 1, 1, 1, 2, ...Array(16).fill(2), 1, 1, 1, 1]
const BURST_FRAMES = 14
/** The burst's petals: heading (columns, rows a frame), first pixel row, frames shown. */
const BURST = [[-1, 0, 3, 12], [-1, 0.25, 2, 10], [0, -1, 3, 4], [1, 0, 4, 14], [1, 0.2, 5, 12], [-1, 0.2, 4, 9],
  [1, 0, 5, 8]] as const

/** The body facing right, by pose: breathing in (standing tall), out (head sunk a pixel), half and full bow. */
const BODY = {
  stand: ['...K......', '..KFF.....', '..WWWW....', '.WWWWH....', '.SRRRR....', 'S.RR..RR..'],
  exhale: ['..........', '..KK......', '..KFF.....', '.WWWWH....', '.SRRRR....', 'S.RR..RR..'],
  half: ['..........', '...KK.....', '..WWFF....', '.WWWWH....', '.SRRRR....', 'S.RR..RR..'],
  bow: ['..........', '....K.....', '..WWKK....', '.WWWWFH...', '.SRRRR....', 'S.RR..RR..'],
} as const
type BodyPose = keyof typeof BODY
/** The blade from the hands (G the guard, B steel, T the tip): ready (raised toward the rival), lifted a pixel,
 * level, shortened as it slides home, sheathed (the hilt at the hip). */
const BLADE: Record<string, readonly Px[]> = {
  ready: [[6, 3, 'G'], [7, 3, 'B'], [8, 2, 'B'], [9, 1, 'T']],
  lift: [[6, 3, 'G'], [7, 2, 'B'], [8, 1, 'B'], [9, 0, 'T']],
  level: [[6, 3, 'G'], [7, 3, 'B'], [8, 3, 'B'], [9, 3, 'T']],
  two: [[6, 3, 'G'], [7, 3, 'B'], [8, 3, 'T']],
  one: [[6, 3, 'G'], [7, 3, 'T']],
  hilt: [[6, 3, 'G']],
  sheathed: [[6, 4, 'G']],
}
/** The slash arc's crescent beside the blade, top to bottom; by toolAge the points shown (from, to) and the
 * lead (white; -1 on the fading frame): a cut down over four frames, on bash a second one rising. The blade
 * itself stays ready, so its tip never leaves its cell row and the arc always grows from a run beside it. */
const ARC: readonly Px[] = [[10, 0, ''], [11, 1, ''], [11, 2, ''], [10, 3, ''], [9, 4, ''], [8, 5, '']]
const SWEEP = [[0, 0, 0], [0, 3, 3], [1, 5, 5], [2, 5, -1], [4, 5, 4], [3, 5, 3], [1, 4, 1], [0, 2, -1]] as const
/** commit by newsAge: the blade home over eight frames, a bow (eased), held, risen, the blade drawn again. */
const SHEATHE = ['level', 'level', 'two', 'two', 'one', 'one', 'hilt', 'hilt', ...Array(16).fill('sheathed'),
  'hilt', 'hilt', 'one', 'two', 'level', 'ready']
const BOWING: (BodyPose | null)[] = [...Array(12).fill(null), 'half', 'half', ...Array(7).fill('bow'), 'half', 'half']

const MOON = '#e5383b'
const MOON_LIT = '#ff6b6b'
const MOON_SEA = '#c9184a'
const WHITE = '#f8f9fa'
const GOLD = '#ffd166'
const STEEL = '#ced4da'
const HAIR = '#495057'
const SKIN = '#ffddd2'
const SAYA = '#6c757d'
const RAIL = '#8b5e34'
const POST = '#6f4518'
const DECK = ['#b08968', '#9c6644']
const BEAM = '#6f4518'
const UNLIT = '#9a8c7a'
const LIT = ['#ffb703', '#ffc93c']
const GLOW = '#a47148'
const PALE = '#fff3b0'
const TWIG = '#7f5539'
const PETAL = ['#ffb3c1', '#ff8fa3', '#ffccd5']
const MOON_ART = ['.MMMM.', 'MLMMMM', 'MMMSMM', 'MMMMMS', '.MMMM.']
const HERO: Ink = { K: HAIR, F: SKIN, W: WHITE, H: SKIN, R: MOON, S: SAYA, G: GOLD, B: STEEL, T: '#ffffff' }
/** Rivals' robes and hakama: indigo, plum, moss; the hero's colours stay his alone. */
const RIVALS: Ink[] = [['#7b83c9', '#4a4e8c'], ['#b5838d', '#6d597a'], ['#a3b18a', '#588157']].map(([w, r]) => ({
  ...HERO, W: w!, R: r!,
}))
const PALETTE = [MOON, WHITE, PETAL[1]!, LIT[0]!]
const TOOL_INK: Record<ToolKind, string> = {
  bash: '#ffd60a', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7',
  other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** A fighter: the body in `pose` and the blade, facing right from `x` (or mirrored, facing left). */
function fighter(cv: Canvas, x: number, face: 1 | -1, pose: BodyPose, blade: string, ink: Ink, glint = -1): void {
  const at = (c: number) => (face > 0 ? x + c : x + FIG_W - 1 - c)
  BODY[pose].forEach((row, y) => [...row].forEach((k, c) => ink[k] && plot(cv, at(c), y, ink[k]!)))
  BLADE[blade]!.forEach(([c, y, k], j) => plot(cv, at(c), y, j === glint ? '#ffffff' : ink[k]!))
}

/** Blossom hanging from the top between `from` and `to`: clumps two wide, a column apart (each its own run), one
 * or two pixels deep. Every other frame a clump (in a shuffled order) lets go a petal at pixel row 1, inside its
 * own cell; it falls a pixel a frame, drifting a column left every other frame, and lies on the deck fading. */
function blossom(cv: Canvas, t: number, from: number, to: number): void {
  const spots: number[] = []
  for (let x = from; x + 1 <= to; x += 3) {
    const n = noise(x * 7 + 1)
    const open = n > 0.5 ? 1 : 0
    for (const dx of [0, 1]) plot(cv, x + dx, 0, dx === 0 && n > 0.75 ? TWIG : PETAL[mod(x + dx, 3)]!)
    if (n > 0.3) plot(cv, x + 1 - open, 1, PETAL[mod(x + 1, 3)]!)
    spots.push(x + open)
  }
  if (spots.length === 0) return
  const order = spots.map((x, i) => [noise(x + 5), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i)
  for (let k = 0; 2 * k < DECK_Y + LAND; k++) {
    const m = (t >> 1) - k
    const a = t - 2 * m
    const x0 = spots[order[mod(m, spots.length)]!]!
    if (a < DECK_Y - 1) plot(cv, x0 - (a >> 1), 1 + a, PETAL[mod(m, 3)]!)
    else if (a < DECK_Y - 1 + LAND) plot(cv, x0 - 2, DECK_Y, mix(PETAL[1]!, DECK[0]!, (a - DECK_Y + 1) / LAND))
  }
}

/** The bridge: the rail behind the fighters, posts under it, the deck's planks and the beam. */
function bridge(cv: Canvas): void {
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, RAIL_Y, RAIL)
    if (mod(x, 4) === 1) plot(cv, x, RAIL_Y + 1, POST)
    plot(cv, x, DECK_Y, DECK[mod(x, 3) === 0 ? 1 : 0]!)
    plot(cv, x, BEAM_Y, BEAM)
  }
}

/** A lantern per task along the beam (floor-scaled), `done` lit and flickering, the newest brightening over
 * LIGHT_FRAMES, all flaring at 100%; a lit lantern warms the beam beside it. */
function lanterns(cv: Canvas, t: number, s: Signals): void {
  const count = Math.min(s.total, MAX_LANTERNS, Math.floor((cv.w - 2) / 4))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < LIGHT_FRAMES && lit > litOf(s.done - 1)
  const flare = s.total > 0 && s.done >= s.total && s.doneAge < FLARE_FRAMES
  for (let k = 0; k < count; k++) {
    const x = Math.floor(((k + 0.5) * cv.w) / count)
    let c = k < lit ? LIT[noise(k * 13 + (t >> 1)) < 0.3 ? 1 : 0]! : UNLIT
    const a = s.doneAge
    if (k === lit - 1 && fresh) c = a < 4 ? mix(UNLIT, PALE, (a + 1) / 4) : mix(PALE, LIT[0]!, (a - 3) / 4)
    else if (k < lit && flare && mod(a + k, 4) < 2) c = PALE
    if (k < lit) for (const dx of [-1, 1]) plot(cv, x + dx, BEAM_Y, GLOW)
    plot(cv, x, BEAM_Y, c)
  }
}

/** The slash arc in its frame `a` (0..7): the points swept so far, the lead white, the rest in `ink`, faded on
 * the last frame of each cut. */
function arc(cv: Canvas, x: number, a: number, ink: string): void {
  const [from, to, lead] = SWEEP[a]!
  for (let i = from; i <= to; i++) {
    plot(cv, x + ARC[i]![0], ARC[i]![1], i === lead ? '#ffffff' : lead < 0 ? mix(ink, '#1a1a1e', 0.45) : ink)
  }
}

/** Petals bursting out where he stood, a pixel a frame each: back past him through his cell row, one up over
 * his head, the rest forward low across the rail (a row always full, so none parts from a shape). */
function burst(cv: Canvas, cx: number, age: number): void {
  BURST.forEach(([vx, vy, y0, life], i) => {
    if (age < life) plot(cv, cx + vx * age, y0 + Math.floor(vy * age), PETAL[i % 3]!)
  })
}

/** The sign behind his head: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, age: number, k: { fail: boolean; pass: boolean; commit: boolean }) {
  if (k.fail) return { text: '×', c: MOON }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (k.commit) return { text: '✓', c: GOLD }
  if (age < CHANGE_FRAMES) return { text: '·', c: STEEL }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: PETAL[0]! }
  if (s.act === 'think') return { text: frame(['·', '∘'], t >> 3), c: STEEL }
  return { text: frame(['z', 'Z'], t >> 2), c: SAYA }
}

export function samuraiScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isFail = s.news === 'testFail' && s.newsAge < STAGGER.length
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < SHEATHE.length
  // The hero at the left third, the first rival's slot at the right third, the others behind it.
  const hx = Math.max(2, Math.floor(w / 3) - 6)
  const rx = Math.max(hx + FIG_W, Math.floor((2 * w) / 3) - 4)
  const fit = [0, 1, 2].filter(i => rx + PITCH * i + FIG_W <= w).length
  const rivals = Math.max(1, Math.min(s.agents, MAX_RIVALS, fit))
  const gap = rx - hx - FIG_W

  // Layer 1: the moon between them (still), behind the rail; the blossom in both top corners.
  if (gap >= 8) draw(cv, hx + FIG_W + (gap >> 1) - 3, 0, MOON_ART, { M: MOON, L: MOON_LIT, S: MOON_SEA })
  bridge(cv)
  blossom(cv, t, 0, hx - 3)
  if (fit > 0) blossom(cv, t, rx + PITCH * fit + 2, w - 1)
  lanterns(cv, t, s)

  // Layer 2: the hero. Breathing on 16 frames; a strike per tool call on toolAge (min'd with actAge so the
  // first call strikes even if the kind is unchanged); ask lifts the blade; reactions hold their own poses.
  const strike = s.act === 'tool' ? Math.min(s.actAge, s.toolAge) : 999
  const cuts = s.tool === 'bash' ? 8 : 4
  const breath: BodyPose = mod(t, 16) < 8 ? 'stand' : 'exhale'
  let [pose, blade, back] = [breath, 'ready', 0] as [BodyPose, string, number]
  if (isFail) [pose, back] = ['exhale', STAGGER[s.newsAge]!]
  else if (isCommit) [pose, blade] = [BOWING[s.newsAge] ?? breath, SHEATHE[s.newsAge]!]
  else if (s.act === 'ask' && s.actAge >= 2) blade = 'lift'
  const passGlint = isPass ? mod(s.newsAge, 6) : s.act === 'say' && mod(t, 12) < 4 ? mod(t, 12) : -1
  // While a tool runs the steel takes the tool's colour (it names the tool, so it turns with it).
  const steel = s.act === 'tool' && !isFail && !isCommit ? { ...HERO, B: TOOL_INK[s.tool ?? 'other'] } : HERO
  fighter(cv, hx - back, 1, pose, blade, steel, passGlint)
  // No arc through a commit (the blade is away) nor for a call made in one or in a stagger, after it either.
  const since = s.newsAge - strike
  const held = s.news === 'commit' ? since < SHEATHE.length
    : s.news === 'testFail' && since >= 0 && since < STAGGER.length
  if (strike < cuts && !held) arc(cv, hx - back, strike, TOOL_INK[s.tool ?? 'other'])

  // Layer 3: the rivals, mirrored, in fixed slots; the newest bows as it joins; all bow back to a commit; the
  // first one's blade glints as he staggers.
  for (let i = 0; i < rivals; i++) {
    const greet = i === rivals - 1 && s.agentsAge < GREET_FRAMES
      ? Math.min(s.agentsAge, GREET_FRAMES - 1 - s.agentsAge) : -1
    let rp: BodyPose = mod(t + 4 * i, 16) < 8 ? 'stand' : 'exhale'
    if (greet >= 0) rp = greet < 2 ? rp : greet < 4 ? 'half' : 'bow'
    if (isCommit) rp = BOWING[s.newsAge] ?? rp
    const glint = i === 0 && isFail && s.newsAge >= 4 && s.newsAge < 16 ? mod(s.newsAge, 4) : -1
    fighter(cv, rx + PITCH * i, -1, rp, 'ready', RIVALS[i]!, glint)
  }
  if (isFail && s.newsAge < BURST_FRAMES) burst(cv, hx + 2, s.newsAge)

  const g = cells(cv)
  const { text, c } = sign(s, t, Math.min(s.actAge, s.toolAge), { fail: isFail, pass: isPass, commit: isCommit })
  // Behind his head, touching it; through a commit where the blade's tip was, so the tip comes back beside it.
  put(g, hx - back + (isCommit ? 9 : 1), 0, text, { c, b: true })
  return g
}

/** A tiny ronin: a wide straw hat (a crown over a brim), eyes under it, a plain robe, a hilt at the hip. */
export const PET: PetArt = {
  body: ['....hhhh....', '.yhhhhhhhhy.', '...FFFFFF.T.', '..IIFFFFIG..', '..III..III..'],
  step: ['....hhhh....', '.yhhhhhhhhy.', '...FFFFFF.T.', '..IIFFFFIG..', '...II..II...'],
  colors: { h: '#d4a373', y: '#a98467', F: SKIN, I: '#7b83c9', G: GOLD, T: '#8d99ae' },
  eyes: [4, 7],
  eyeRow: 2,
  eye: '#2b2d42',
  lid: SKIN,
  mouth: [5, 3],
  blush: '#ff8fa3',
  spark: PETAL[1]!,
}

export const SAMURAI: Theme = {
  name: 'samurai',
  rows: SCENE_ROWS,
  color: MOON,
  accent: WHITE,
  sprite: {
    think: ['/·  ', '/ · ', '/  ·', '/ · '],
    tool: ['/   ', '―›  ', '\\›› ', '― › '],
    say: ['/ ♪', '/ ♫'],
    wait: ['/ .', '/ ..', '/ ...'],
  },
  happy: '/ ✓',
  sad: '/ …',
  dead: '✕',
  sleep: '/ zZ',
  confetti: ['✿', '❀', '·', '°'],
  palette: PALETTE,
  scene: samuraiScene,
  pet: PET,
}
