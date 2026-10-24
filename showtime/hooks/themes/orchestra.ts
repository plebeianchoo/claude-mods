// Theme: orchestra. Its scene, its words and its pet.
//
// The scene: a stage under a purple valance (#c77dff) whose folds sway on a 24-frame swing, a metronome ticking
// at the left corner, the conductor on his podium: the baton beats a 6-frame pattern thinking, a quicker 4-frame
// one while a tool runs, a 12-frame figure saying; it rises as he turns to ask (his left hand beckoning) and drops
// as he waits (nodding). The floor's light pool, in the act's or the tool's colour, comes up over four frames. A
// music stand per task (floor-scaled), `done` lit, a note lifting off the newest as it is done; a musician per
// agent in a fixed seat from the right (drum, violin, horn, cello), the newest flashing as it joins, empty chairs
// otherwise; a cymbal on its stand at the right. testFail: the cymbal clashes, falls and is set back as notes
// scatter; testPass: gold lights; commit: applause, hands clapping along the bottom, the conductor bowing.
// Motion rules: the metronome ticks a cell a frame in every act, so no frame holds; every baton path steps a
// pixel a frame from one shared pose; baton and lights key on actAge, so a tool→tool change keeps them going.
import { canvas, cells, draw, frame, mod, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>
type Pose = readonly [number, number]

const VALANCE = '#7b2cbf'
const FOLD = '#9d4edd'
const LILAC = '#c77dff'
const FLOOR = '#7f5539'
const SEAM = '#9c6644'
const WOOD = '#c08552'
const PODIUM = '#b08968'
const CHAIR = '#a47148'
const COAT = '#565f89'
const SHIRT = '#e9ecef'
const SKIN = '#f2c79b'
const WHITE = '#ffffff'
const GOLD = '#ffd60a'
const PALE = '#fff3b0'
const RED = '#ff5d5d'
const DIM = '#6c757d'
const STEEL = '#8d99ae'
const PALETTE = [LILAC, GOLD, '#ff9e64', '#7dcfff', '#9ece6a']
const TOOL_INK: Record<ToolKind, string> = {
  bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** The fold pattern's period and the sway's cycle; the metronome's centre; the conductor's coat and hand. */
const [FOLD_W, SWAY_FRAMES, METRO_X, CON_X, HAND_X, HAND_Y] = [6, 24, 1, 5, 8, 3]
/** The light pool's centre and reach; the sign; where the stands start and their pitch; a seat's width. */
const [POOL_X, POOL_R, SIGN_X, STAND_X, STAND_PITCH, SEAT_W] = [6, 4, 6, 12, 3, 6]
const MAX_AGENTS = 4
/** Frames: a musician's greeting, a lit stand's blink; the news. */
const [GREET_FRAMES, NOTE_FRAMES] = [8, 8]
const [FAIL_FRAMES, SCATTER_FRAMES, PASS_FRAMES, CLAP_FRAMES] = [12, 12, 16, 20]

/** The baton's tip from the hand, a pixel a frame; every path starts at the same pose, so an act's first frame
 * is a cell from wherever the last act left it. Ask and wait hold their last pose. */
const BATON: Record<Act, readonly Pose[]> = {
  think: [[2, 0], [2, -1], [1, -1], [2, -1], [2, 0], [2, 1]],
  tool: [[2, 0], [2, -1], [2, 0], [2, 1]],
  say: [[2, 0], [2, -1], [1, -1], [0, -1], [1, -1], [2, -1], [2, 0], [2, 1], [2, 2], [2, 1], [2, 2], [2, 1]],
  ask: [[2, 0], [2, -1], [1, -1], [0, -1]],
  wait: [[2, 0], [2, 1], [2, 2]],
}
/** A seated musician facing the conductor, from y = 2: hair, face, body, the chair's legs; an empty chair. */
const PLAYER = ['...H.', '...F.', '...BB', '...BB', '..C.C']
const EMPTY_CHAIR = ['....C', '....C', '..CCC', '..C.C']
const SEAT_INK = [
  { H: '#e0af68', B: '#6d597a' }, { H: '#ff7b54', B: '#5c6180' },
  { H: '#cfd8dc', B: '#6b705c' }, { H: '#d4a373', B: '#7d5a50' },
]
const GEAR: Ink = {
  F: SKIN, C: CHAIR, D: SHIRT, d: '#c1121f', V: '#d9822b', T: GOLD, O: '#b5651d', n: '#8b5a2b', w: WHITE,
}
/** The cymbal's three pixels from the stand's left column as it falls: flat on the stand, tipping, sliding off
 * the pole, flat on the floor; and tilted as it rings there. */
const FALL: readonly (readonly Pose[])[] = [
  [[0, 3], [1, 3], [2, 3]],
  [[0, 4], [1, 3], [2, 2]],
  [[-1, 5], [0, 4], [1, 3]],
  [[-1, 6], [0, 5], [1, 4]],
  [[-2, 6], [-1, 6], [0, 6]],
]
const RING: readonly Pose[] = [[-2, 6], [-1, 6], [0, 5]]
/** A failed test's notes: columns and pixels a frame leftward from the cymbal (none faster than a cell), from
 * rows 2, 3 and 4 in turn. */
const SCATTER: readonly Pose[] = [[1, 0.17], [1, -0.17], [0.75, 0], [0.5, 0.2], [0.5, -0.17], [0.34, -0.1]]
const NOTE = ['.S', 'HS']

/** The cymbal's pose at a failed test's age: two frames' clash, the fall to the floor by frame eight, ringing
 * there, then lifted back the way it fell, at rest on its stand from frame 26. */
function cymbalPose(age: number): readonly Pose[] {
  if (age < 2 || age >= 26) return FALL[0]!
  if (age < 8) return FALL[age >> 1]!
  if (age < 12) return FALL[4]!
  if (age < 22) return mod(age, 2) ? RING : FALL[4]!
  return FALL[25 - age]!
}

/** The valance along px 0, its folds along px 1 swaying a pixel either way on a 24-frame swing. */
function valance(cv: Canvas, t: number): void {
  const sway = Math.round(Math.sin((t * Math.PI * 2) / SWAY_FRAMES))
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, 0, VALANCE)
    const k = mod(x - sway, FOLD_W)
    if (k > 0 && k < FOLD_W - 1) plot(cv, x, 1, k === 2 ? LILAC : FOLD)
  }
}

/** The boards along px 7, a seam every five columns, lit around the podium out to `reach`. */
function stage(cv: Canvas, light: string, reach: number): void {
  for (let x = 0; x < cv.w; x++) plot(cv, x, 7, Math.abs(x - POOL_X) <= reach ? light : mod(x, 5) ? FLOOR : SEAM)
}

/** The conductor on his podium: the head leaning `lean` or bowed, the baton at `pose`, the left hand when up. */
function conductor(cv: Canvas, pose: Pose, lean: number, bowed: boolean, left: number, tip: string): void {
  draw(cv, CON_X - 1, 6, ['PPPPP'], { P: PODIUM })
  draw(cv, CON_X, 4, ['CWC', 'CCC'], { C: COAT, W: SHIRT })
  if (bowed) plot(cv, CON_X + 1, 3, WHITE)
  else {
    plot(cv, CON_X + 1 + lean, 2, WHITE)
    plot(cv, CON_X + 1 + lean, 3, SKIN)
  }
  plot(cv, HAND_X, HAND_Y, SKIN)
  if (left > 0) plot(cv, CON_X - 1, left, SKIN)
  const [dx, dy] = pose
  const step = (d: number) => Math.sign(d) * Math.min(1, Math.abs(d))
  plot(cv, HAND_X + step(dx), HAND_Y + step(dy), SHIRT)
  plot(cv, HAND_X + dx, HAND_Y + dy, tip)
}

/** Musician `i` at column `x`, playing on its own cycle unless `rest`: a drum and mallet, a violin and its bow,
 * a horn whose bell lifts, a cello and its bow; all white when `flash`. */
function musician(cv: Canvas, t: number, i: number, x: number, rest: boolean, flash: boolean): void {
  const ink: Ink = { ...GEAR, ...SEAT_INK[i]! }
  if (flash) for (const k of Object.keys(ink)) ink[k] = WHITE
  const p = rest ? 0 : mod(t + 3 * i, 8)
  draw(cv, x, 2, PLAYER, ink)
  if (i === 0) {
    draw(cv, x, 5, ['DDD', 'ddd'], ink)
    plot(cv, x + 2, 4, ink.F!)
    plot(cv, x + 1, mod(p, 4) < 2 ? 4 : 3, ink.w!)
  } else if (i === 1) {
    draw(cv, x + 1, 4, ['VV'], ink)
    draw(cv, x, 2, frame([['..', 'ww'], ['w.', '.w'], ['..', 'ww'], ['.w', 'w.']], p >> 1), ink)
  } else if (i === 2) {
    draw(cv, x + 1, 3, ['TT'], ink)
    draw(cv, x, p < 4 ? 3 : 2, ['T', 'T', 'T'], ink)
  } else {
    draw(cv, x, 2, ['.n', '.n', 'OO', 'OO', 'OO'], ink)
    plot(cv, x + 2, 5, ink.F!)
    draw(cv, x + frame([-1, 0, 1, 0], p), 5, ['ww'], ink)
  }
}

/** A failed test's notes scattering from the cymbal a cell a frame at most, fading, gone off the stage's air. */
function scatter(cv: Canvas, cx: number, age: number): void {
  if (age < 2 || age > SCATTER_FRAMES) return
  const c = age < 5 ? GOLD : age < 9 ? PALE : STEEL
  SCATTER.forEach(([vx, vy], k) => {
    const x = cx - Math.floor(vx * age)
    const y = 2 + (k % 3) + Math.trunc(vy * age)
    if (y >= 2 && y <= 5) draw(cv, x, y, NOTE, { S: c, H: c === GOLD ? WHITE : c })
  })
}

/** The applause: a pair of hands every seven columns along the bottom, rising, clapping on a 2-frame cycle,
 * a spark over each clap. */
function applause(cv: Canvas, age: number): void {
  const top = 6 + Math.max(0, 1 - age, age - (CLAP_FRAMES - 2))
  const shut = mod(age, 2) === 1
  for (let x = 3; x + 3 < cv.w; x += 7) {
    for (const hx of shut ? [x + 1, x + 2] : [x, x + 3]) for (let y = top; y <= 7; y++) plot(cv, hx, y, SKIN)
    if (shut && top < 7) draw(cv, x + 1, top - 1, ['WW'], { W: WHITE })
  }
}

/** The sign on the valance: the news first, else the act. */
function sign(s: Signals, t: number, fail: boolean, pass: boolean, clap: boolean): { text: string; c: string } {
  if (fail) return { text: '×', c: RED }
  if (pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (clap) return { text: '✓', c: GOLD }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1), c: PALE }
  if (s.act === 'wait') return { text: frame(['z', 'Z'], t >> 2), c: STEEL }
  return { text: '·', c: SHIRT }
}

export function orchestraScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const fail = s.news === 'testFail' && s.newsAge < 30
  const pass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const clap = s.news === 'commit' && s.newsAge < CLAP_FRAMES
  const age = s.actAge
  const allDone = s.total > 0 && s.done >= s.total
  // The cymbal's stand at the right, the seats leftward from it, the stands from the conductor up to the seats.
  const cymX = w - 4
  const seatX = (i: number) => cymX - SEAT_W * (i + 1)
  const count = Math.min(s.total, Math.max(0, Math.floor((seatX(MAX_AGENTS - 1) - STAND_X - 1) / STAND_PITCH)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)

  // Layer 1: the valance's folds; layer 2: the stage, its pool lit in the act's or the tool's colour.
  valance(cv, t)
  const tool = s.tool ?? 'other'
  let light = { think: PALE, tool: TOOL_INK[tool], ask: GOLD, say: LILAC, wait: STEEL }[s.act]
  if (fail && s.newsAge < FAIL_FRAMES) light = RED
  else if (pass) light = mod(t, 2) ? GOLD : PALE
  stage(cv, light, fail || pass || clap ? POOL_R : Math.min(POOL_R, age))
  // The metronome at the corner, ticking a cell a frame.
  plot(cv, METRO_X + frame([-1, 0, 1, 0], t), 4, SHIRT)
  plot(cv, METRO_X, 5, WOOD)
  draw(cv, METRO_X - 1, 6, ['DDD'], { D: SEAM })
  // Layer 3: the conductor, beating from the shared pose; bowing to the applause.
  const path = BATON[s.act]
  const held = s.act === 'ask' || s.act === 'wait'
  let pose = held ? path[Math.min(age, path.length - 1)]! : frame(path, age)
  const bowed = clap && s.newsAge >= 2 && s.newsAge < 16
  if (clap) pose = BATON.wait[2]!
  const lean = s.act === 'wait' && !clap && mod(t, 16) >= 8 ? 1 : 0
  const left = s.act === 'ask' && age >= 2 ? (mod(t, 12) < 4 ? 3 : 4) : 0
  const twinkle = s.act === 'ask' && mod(t, 12) < 2
  conductor(cv, pose, lean, bowed, left, s.act === 'tool' ? TOOL_INK[tool] : twinkle ? GOLD : WHITE)
  // The stands, `done` of them lit, the newest blinking as it is done while a note lifts off it a pixel a frame,
  // fading into the valance.
  const sheet = pass || allDone ? GOLD : PALE
  for (let j = 0; j < count; j++) {
    const x = STAND_X + STAND_PITCH * j
    const blink = j === lit - 1 && s.doneAge < NOTE_FRAMES && mod(s.doneAge, 2) === 0
    draw(cv, x, 5, ['SS', '.P'], { S: blink ? WHITE : j < lit ? sheet : DIM, P: STEEL })
  }
  if (s.done > 0 && s.doneAge < 5) {
    const c = frame([GOLD, GOLD, PALE, LILAC, FOLD], s.doneAge)
    draw(cv, lit > 0 ? STAND_X + STAND_PITCH * (lit - 1) : STAND_X - 1, 4 - s.doneAge, NOTE, { S: c, H: c })
  }
  // Layer 4: the musicians in their seats (empty chairs past the agents), the cymbal, a failed test's notes.
  const n = Math.min(s.agents, MAX_AGENTS)
  for (let i = 0; i < MAX_AGENTS && seatX(i) >= STAND_X; i++) {
    const greet = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const flash = greet || (i === 0 && fail && s.newsAge < 2)
    if (i < n) musician(cv, t, i, seatX(i), s.act === 'wait', flash)
    else draw(cv, seatX(i), 3, EMPTY_CHAIR, { C: CHAIR })
  }
  draw(cv, cymX, 4, ['.P.', '.P.', 'P.P'], { P: STEEL })
  const clash = fail && s.newsAge < 2
  for (const [dx, dy] of fail ? cymbalPose(s.newsAge) : FALL[0]!) plot(cv, cymX + dx, dy, clash ? WHITE : GOLD)
  if (fail) scatter(cv, cymX + 1, s.newsAge)
  if (clap) applause(cv, s.newsAge)

  const g = cells(cv)
  const { text, c } = sign(s, t, fail && s.newsAge < FAIL_FRAMES, pass, clap)
  put(g, SIGN_X, 0, text, { c, bg: VALANCE, b: true })
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  if (readout) put(g, w - readout.length - 1, 0, readout, { c: allDone ? GOLD : PALE, bg: VALANCE, b: true })
  return g
}

/** A metronome: a tapered wooden case on its base, the silver arm swinging from the foot, a gold weight on it. */
export const PET: PetArt = {
  body: ['........A...', '....WWWG....', '...WWWAWW...', '...WWAWWW...', '..DDDDDDDD..'],
  step: ['...A........', '....GWWW....', '...WWAWWW...', '...WWWAWW...', '..DDDDDDDD..'],
  colors: { W: WOOD, D: '#8b5a2b', A: SHIRT, G: GOLD },
  eyes: [4, 7],
  eyeRow: 2,
  eye: '#1d1d1d',
  lid: WOOD,
  blush: '#ff8fab',
  spark: LILAC,
}

export const ORCHESTRA: Theme = {
  name: 'orchestra',
  rows: SCENE_ROWS,
  color: LILAC,
  accent: GOLD,
  sprite: {
    think: ['♩·  ', '♩ · ', '♩  ·', '♩ · '],
    tool: ['♩ ╱ ', '♩ ─ ', '♩ ╲ ', '♩ ─ '],
    say: ['♩ ♪', '♩ ♫'],
    wait: ['♩ .', '♩ ..', '♩ ...'],
  },
  happy: '♩ ★',
  sad: '♩ …',
  dead: '✗',
  sleep: '♩ zZ',
  confetti: ['♪', '♫', '·', '+'],
  palette: PALETTE,
  scene: orchestraScene,
  pet: PET,
}
