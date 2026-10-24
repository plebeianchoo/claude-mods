// Theme: railway. Its scene, its words and its pet.
//
// The scene: a steam train (#6c757d, #e5383b accents) standing in the right half of the band and
// facing right, the world scrolling toward it: dim hills far (pixel rows 2–3, a quarter of the speed),
// the rails and the bridge's piers near (rows 6–7, a cell a frame), and its own smoke drifting back
// along the top rows a cell a frame. A puff is born over the funnel every other frame; one in six is a
// full puff while it idles, one in four in a tool (in the tool's colour), every one on bash, the rest
// wisps. Its wheels turn on a four-frame cycle in a tool (slowly otherwise), sparks fly on bash. A
// carriage per task (six at most, fewer on a narrow band, floor-scaled) trails behind it, loaded with a
// block as the task lands, the newest flashing, all rolling colours at 100%; a `done/total` readout
// sits at the top right. A signal stands ahead of the engine: its arm drops over three frames while a
// permission waits and rises over four as the next act begins, its lamp red while asking. A sign right
// of it reads the act (dots, `?`, notes, the tool's mark). Each subagent (four at most) is a small
// engine of its own hue at the back of the train, puffing a greeting as it joins and a wisp every
// twelve frames after. A failed test greys the train, sparks at its wheels and jolts it a cell for ten
// frames under a `×`; a passed test turns the window and the loads gold under a `★`; a commit sends a
// tunnel in from the right edge, a cell a frame, that swallows the signal and the train (the engine
// dark twelve frames) and lets them out the other side.
//
// Motion rules (tests/scenes.test.ts): pixel row 3 (the hills) and rows 6–7 (the track) are filled
// across the width, so the test sees cell rows 0 and 2 only; every vehicle fills row 4 across its own
// width and stands a column apart from the next, so wheels, sparks and loads change colour, never ink,
// and a leaving agent's engine only disappears. Every funnel stands in rows 1–3, a run start in cell
// row 0 that each puff is born over and leaves a cell at a time, and all the puffs drift at the
// scroll's pace on schedules of `t` alone, so they merge and part only with each other and the
// funnels; the jolt moves the bodies, never the smoke. The signal's lamp never goes out (it blinks in
// colour) and the sign changes its ink every other frame. The tunnel is empty cells between two stone
// columns under a hill roof, so what it hides and uncovers always appears beside a column that stood
// a cell away the frame before.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

const ENGINE_W = 10
/** The funnel's column from the engine's left edge. */
const FUNNEL_X = 8
/** Columns right of the engine's front for the signal, its arm, the sign and the readout. */
const RIGHT_ZONE = 12
const POLE_GAP = 2
const SIGN_GAP = 4
const SIGN_W = 3
const CAR_PITCH = 5
const MAX_CARS = 6
const AGENT_FUNNEL_X = 3
const AGENT_PITCH = 6
const MAX_AGENTS = 4
/** Columns kept free behind the carriages for agent engines on a narrow band. */
const AGENT_RESERVE = 6
const HILL_Y = 2
const RAIL_Y = 6
const TICK_PITCH = 4
const PIER_PITCH = 6
/** Puffs: born every other frame over the funnel, drifting back a cell a frame along these rows. */
const PUFF_LIFE = 8
const PUFF_ROWS = [0, 0, 1, 0, 0, 1, 0, 1]
const PUFF_EVERY = { idle: 6, tool: 4, bash: 2 }
const WISP_EVERY = 12
const WISP_LIFE = 4
const GREET_FRAMES = 8
/** The signal arm's level by `actAge`: dropping while asking, rising as the next act begins. */
const ARM_RISE = [2, 1, 1, 0]
const FAIL_FRAMES = 20
const JOLT_FRAMES = 10
const PASS_FRAMES = 12
/** The tunnel's length: the engine and twelve more cells, so the engine is dark for twelve frames. */
const TUNNEL_W = ENGINE_W + 12
const DONE_FLASH_FRAMES = 8
const DONE_ROLL_FRAMES = 16
const TURN_FRAMES = 4

const GREY = '#6c757d'
const LIGHT = '#adb5bd'
const SHADE = '#545b63'
const STEEL = '#8d99ae'
const RED = '#e5383b'
const RED_LIT = '#ff6b6b'
const RED_DARK = '#a4161a'
const WINDOW = '#ffe8a3'
const WHITE = '#ffffff'
const GOLD = '#ffd60a'
const GREEN = '#9ece6a'
const HILL = '#3b5063'
const RAIL = '#9aa5b1'
const DECK = '#4a5060'
const WISP = '#4f5660'
const SMOKE = ['#dee2e6', '#ced4da', '#adb5bd', '#868e96']
const SPARK = [GOLD, '#ff9e64', WHITE]
const WHEEL_SPIN = [RED, RED_LIT, RED, RED_DARK]
const LOADS = [GOLD, GREEN, '#7dcfff', '#ff9e64', '#bb9af7', '#f7768e']
const AGENT_HUES = ['#7dcfff', '#bb9af7', '#ff9e64', '#f7768e']
const PALETTE = [RED, GOLD, GREEN, '#7dcfff', '#bb9af7']
const PUFF_TOOL: Record<ToolKind, string> = {
  bash: RED_LIT, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7',
  other: SMOKE[0]!,
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}
/** What the accents turn into while a failed test greys the train. */
const DULL: Record<string, string> = {
  ...Object.fromEntries([...LOADS, ...AGENT_HUES, RED, RED_LIT, WINDOW].map(c => [c, STEEL])),
  [RED_DARK]: SHADE,
}

/** The engine, 10×4 from pixel row 1: a tall funnel near the front, the cab at the back, its wheels
 * drawn apart so they can turn. */
const ENGINE = ['........F.', 'RRR.....F.', 'GWG.HHHHFH', 'GGGGGGGGGR']
const ENGINE_COLORS = { F: STEEL, R: RED, G: GREY, W: WINDOW, H: LIGHT }
const WHEELS = [1, 3, 6, 8]
/** A carriage, 4×2 from pixel row 3, its load a block on row 2. */
const CAR = ['GGGG', 'GSSG']
const CAR_COLORS = { G: GREY, S: SHADE }
const CAR_WHEELS = [0, 3]
/** An agent's engine, 5×4 from pixel row 1: a tall funnel, the cab in the agent's hue. */
const AGENT = ['...F.', '...F.', 'CC.F.', 'CCGGG']
const AGENT_COLORS = { F: STEEL, G: GREY }
const AGENT_WHEELS = [1, 3]

const paint = (c: string, isFail: boolean) => (isFail ? DULL[c] ?? c : c)
const toned = (colors: Record<string, string>, isFail: boolean) =>
  Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, paint(c, isFail)]))

/** The engine's left column, how many carriages trail it and how many agent engines fit behind them. */
function layout(w: number, s: Signals): { engineX: number; cars: number; carsL: number; agents: number } {
  const engineX = Math.max(0, w - ENGINE_W - RIGHT_ZONE)
  const cars = Math.min(s.total, MAX_CARS, Math.max(0, Math.floor((engineX - AGENT_RESERVE) / CAR_PITCH)))
  const carsL = engineX - cars * CAR_PITCH
  const agents = Math.min(s.agents, MAX_AGENTS, Math.max(0, Math.floor(carsL / AGENT_PITCH)))
  return { engineX, cars, carsL, agents }
}

/** The far hills: a silhouette on pixel rows 2–3, row 3 always filled, drifting at `far`. */
function hills(cv: Canvas, far: number): void {
  for (let x = 0; x < cv.w; x++) {
    const u = x + far
    plot(cv, x, HILL_Y + 1, HILL)
    if (Math.sin(u * 0.19) + 0.5 * Math.sin(u * 0.43 + 2) > 0.3) plot(cv, x, HILL_Y, HILL)
  }
}

/** The track: the rail with a sleeper every fourth cell over the bridge's deck with a pier every sixth,
 * both scrolling a cell a frame. */
function track(cv: Canvas, t: number): void {
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, RAIL_Y, mod(x + t, TICK_PITCH) === 0 ? GREY : RAIL)
    plot(cv, x, RAIL_Y + 1, mod(x + t, PIER_PITCH) === 0 ? STEEL : DECK)
  }
}

/** The engine's smoke: a puff born over the funnel at `fx` every other frame, drifting back a cell a
 * frame for eight; one in `every` a full puff in `color` fading to grey, the rest wisps (all wisps
 * while a failed test smarts). */
function smoke(cv: Canvas, t: number, fx: number, every: number, color: string, isFail: boolean): void {
  for (let age = mod(t, 2); age < PUFF_LIFE; age += 2) {
    const full = !isFail && mod(t - age, every) === 0
    plot(cv, fx - age, PUFF_ROWS[age]!, !full ? WISP : age < 2 ? color : SMOKE[age >> 1]!)
  }
}

/** The signal ahead of the engine: a pole with a lamp, its arm horizontal, dropped a level a frame
 * while a permission waits and rising over four frames as the next act begins. */
function signal(cv: Canvas, t: number, s: Signals, poleX: number, isFail: boolean): void {
  for (let y = 1; y <= 5; y++) plot(cv, poleX, y, STEEL)
  const level = s.act === 'ask' ? Math.min(2, s.actAge) : s.actAge < ARM_RISE.length ? ARM_RISE[s.actAge]! : 0
  plot(cv, poleX + 1, level > 1 ? 2 : 1, paint(RED, isFail))
  plot(cv, poleX + 2, 1 + level, paint(RED, isFail))
  const lamp = s.act === 'ask' ? (mod(t, 8) < 6 ? RED : RED_DARK) : s.act === 'tool' ? GOLD : GREEN
  plot(cv, poleX, 1, isFail ? LIGHT : lamp)
}

/** The tunnel on a commit: its mouth in from the right edge a cell a frame, every pixel under it
 * cleared, a stone column at each end and a hill roof along the top rows. Returns its columns. */
function tunnel(cv: Canvas, age: number): [number, number] {
  const x0 = cv.w - 1 - age
  const x1 = x0 + TUNNEL_W
  for (let x = Math.max(0, x0); x < Math.min(cv.w, x1); x++) {
    for (let y = 0; y < cv.h; y++) cv.px[y * cv.w + x] = undefined
    if (x === x0 || x === x1 - 1) for (let y = 0; y < cv.h; y++) plot(cv, x, y, STEEL)
    else for (let y = 0; y < 2; y++) plot(cv, x, y, HILL)
  }
  return [x0, x1]
}

/** The sign right of the signal: the news first, else the act, dots while the act turns. Each changes
 * its ink every other frame at least, so no frame can hold. */
function sign(
  s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean,
): [string, string] {
  if (isFail) return [frame(['×', '×·'], t >> 1), STEEL]
  if (isPass) return [frame(['★', '★·', '☆', '☆·'], t >> 1), GOLD]
  if (isCommit) return [frame(['✓', '✓·'], t >> 1), GOLD]
  if (age < TURN_FRAMES) return [frame(['·', '··'], t), SMOKE[0]!]
  if (s.act === 'tool') return [TOOL_SIGN[s.tool ?? 'other'] + frame(['', '·', '··', '·'], t), GOLD]
  if (s.act === 'ask') return [frame(['?', '?·'], t >> 1), GOLD]
  if (s.act === 'say') return [frame(['♪', '♪♫', '♫', '♫♪'], t >> 1), GREEN]
  if (s.act === 'think') return [frame(['·', '··', '···', '··'], t >> 1), LIGHT]
  return [frame(['.', '..', '...', '..'], t >> 1), LIGHT]
}

export function railwayScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const bash = isTool && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const jolting = isFail && s.newsAge < JOLT_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < w + TUNNEL_W
  const allDone = s.total > 0 && s.done >= s.total
  const age = Math.min(s.actAge, s.toolAge)
  const { engineX, cars, carsL, agents } = layout(w, s)
  const lit = s.total > cars ? Math.floor(s.done * cars / s.total) : Math.min(s.done, cars)
  // The jolt: the whole train a cell back on odd frames while the brakes screech.
  const dx = jolting && mod(s.newsAge, 2) === 1 ? -1 : 0
  const ex = engineX + dx
  const poleX = engineX + ENGINE_W + POLE_GAP
  const signX = poleX + SIGN_GAP
  const spin = isTool ? t : t >> 2

  // Layer 1: the hills, far and slow; layer 2: the track, a cell a frame.
  hills(cv, t >> 2)
  track(cv, t)
  // Layer 3: the agents' engines at the back, each puffing a wisp every twelve frames out of step; the
  // newest flashes its cab and puffs a greeting as it joins (and again, harmlessly, when one leaves).
  for (let i = 0; i < agents; i++) {
    const x = carsL - AGENT_PITCH * (i + 1)
    const newest = i === agents - 1 && s.agentsAge < GREET_FRAMES
    const cab = newest && mod(s.agentsAge, 2) === 0 ? WHITE : paint(AGENT_HUES[i]!, isFail)
    draw(cv, x + dx, 1, AGENT, { ...toned(AGENT_COLORS, isFail), C: cab })
    AGENT_WHEELS.forEach((wx, k) => plot(cv, x + dx + wx, 5, paint(frame(WHEEL_SPIN, spin + k + i), isFail)))
    const fx = x + AGENT_FUNNEL_X
    const a = mod(t + 4 * i, WISP_EVERY)
    if (a < WISP_LIFE) plot(cv, fx - a, PUFF_ROWS[a]!, WISP)
    if (newest) plot(cv, fx - s.agentsAge, PUFF_ROWS[s.agentsAge]!, s.agentsAge < 4 ? WHITE : SMOKE[2]!)
  }
  // Layer 4: the carriages, the `lit` nearest the engine loaded (the newest flashing white, all
  // rolling colours at 100%, gold on a passed test).
  for (let j = 0; j < cars; j++) {
    const x = ex - CAR_PITCH * (j + 1)
    draw(cv, x, 3, CAR, toned(CAR_COLORS, isFail))
    CAR_WHEELS.forEach((wx, k) => plot(cv, x + wx, 5, paint(frame(WHEEL_SPIN, spin + k + j), isFail)))
    if (j >= lit) continue
    let load = paint(LOADS[j % LOADS.length]!, isFail)
    if (j === lit - 1 && s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0) load = WHITE
    else if (allDone && s.doneAge < DONE_ROLL_FRAMES) load = frame(PALETTE, j + (s.doneAge >> 1))
    else if (isPass && mod(t, 2) === 0) load = GOLD
    plot(cv, x + 1, 2, load)
    plot(cv, x + 2, 2, load)
  }
  // Layer 5: the engine, its wheels turning, sparks under it on bash and while the brakes screech.
  const engineColors = toned(ENGINE_COLORS, isFail)
  if (isPass && mod(t, 2) === 0) engineColors.W = GOLD
  draw(cv, ex, 1, ENGINE, engineColors)
  WHEELS.forEach((wx, k) => plot(cv, ex + wx, 5, paint(frame(WHEEL_SPIN, spin + k), isFail)))
  if (bash || jolting) {
    for (const k of [0, 1]) plot(cv, ex + Math.floor(noise(t + 31 * k) * ENGINE_W), 5, frame(SPARK, t + k))
  }
  // Layer 6: the smoke, in the tool's colour while one runs, unmoved by the jolt; layer 7: the signal.
  const every = bash ? PUFF_EVERY.bash : isTool ? PUFF_EVERY.tool : PUFF_EVERY.idle
  smoke(cv, t, engineX + FUNNEL_X, every, isTool ? PUFF_TOOL[s.tool ?? 'other'] : SMOKE[0]!, isFail)
  signal(cv, t, s, poleX, isFail)
  // The tunnel over everything on a commit.
  const [tx0, tx1] = isCommit ? tunnel(cv, s.newsAge) : [w, w]
  const covered = (x0: number, x1: number) => x0 < tx1 && x1 > tx0

  const g = cells(cv)
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const readoutX = w - readout.length
  if (readout && !covered(readoutX, w)) {
    put(g, readoutX, 0, readout, { c: isPass ? GOLD : allDone ? GREEN : LIGHT, b: true })
  }
  // The sign; it yields to the readout when the band is narrow, and hides inside the tunnel.
  if ((!readout || signX + SIGN_W <= readoutX - 1) && !covered(signX, signX + SIGN_W)) {
    const [text, c] = sign(s, t, age, isFail, isPass, isCommit)
    put(g, signX, 0, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  }
  return g
}

/** A signal lamp: a red lens over a grey lamp house on a short post. */
export const PET: PetArt = {
  body: ['....RRRR....', '...GGGGGG...', '...GGGGGG...', '....GGGG....', '.....PP.....'],
  step: ['....RRRR....', '...GGGGGG...', '...GGGGGG...', '....GGGG....', '....PP......'],
  colors: { R: RED, G: GREY, P: STEEL },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#1d1d1d',
  lid: GREY,
  mouth: [5, 3],
  blush: RED,
  spark: GOLD,
}

export const RAILWAY: Theme = {
  name: 'railway',
  rows: SCENE_ROWS,
  color: GREY,
  accent: RED,
  sprite: {
    think: ['  ~[oo]', ' ~ [oo]', '~  [oo]', ' ~ [oo]'],
    tool: ['✦ [oo]', '· [oo]', '✶ [oo]', '· [oo]'],
    say: ['♪ [oo]', '♫ [oo]'],
    wait: ['.  [oo]', '.. [oo]', '...[oo]'],
  },
  happy: '★ [oo]',
  sad: '… [oo]',
  dead: '× [xx]',
  sleep: 'zZ [oo]',
  confetti: ['●', '○', '·', '+'],
  palette: PALETTE,
  scene: railwayScene,
  pet: PET,
}
