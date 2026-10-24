// Theme: railway. Its scene, its words and its pet.
//
// A steam train facing right with the world scrolling toward it (hills far at a quarter, track and
// bridge near and smoke a cell a frame), a carriage per task, a signal whose arm drops on ask, an
// agent's engine per subagent in a fixed slot at the back, and a tunnel mouth around the engine on a
// commit (in four frames, dark twelve, out four).
//
// Motion rules (tests/scenes.test.ts): pixel row 3 (the hills) and rows 6–7 (the track) fill the width,
// so the test sees cell rows 0 and 2 only; every vehicle fills row 4 across its width a column apart
// from the next, so wheels, sparks and loads change colour, never ink. Funnels stand in rows 1–3, a run
// start each puff is born over and leaves a cell at a time on schedules of `t` alone; the jolt moves
// the bodies, never the smoke. The lamp never goes out and the sign changes its ink every other frame.
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
/** Columns the carriages keep on a narrow band before the agents get slots. */
const CARS_FIRST = 15
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
/** The signal arm's level by `actAge` while a permission waits: horizontal, half down, down. */
const ARM_DROP = [0, 1, 1, 2]
const FAIL_FRAMES = 20
const JOLT_FRAMES = 10
const PASS_FRAMES = 12
/** The tunnel mouth around the engine: fading in over four frames, dark twelve, fading out over four. */
const FADE_FRAMES = 4
const DARK_FRAMES = 12
const COMMIT_FRAMES = 2 * FADE_FRAMES + DARK_FRAMES
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

/** The engine, carriages and agent slots by the width alone: the slots sit left of the widest carriage
 * zone, so a change of `total` never moves an agent engine. */
function layout(w: number, s: Signals): { engineX: number; cars: number; slotsL: number; agents: number } {
  const engineX = Math.max(0, w - ENGINE_W - RIGHT_ZONE)
  // One slot whenever an agent's engine fits at all, more once the carriages have their first columns.
  const more = Math.floor((engineX - CARS_FIRST) / AGENT_PITCH)
  const slots = Math.min(MAX_AGENTS, Math.max(engineX >= AGENT_PITCH ? 1 : 0, more))
  const carsMax = Math.min(MAX_CARS, Math.max(0, Math.floor((engineX - slots * AGENT_PITCH) / CAR_PITCH)))
  const slotsL = engineX - carsMax * CAR_PITCH
  return { engineX, cars: Math.min(s.total, carsMax), slotsL, agents: Math.min(s.agents, slots) }
}

/** A `#rrggbb` colour at `f` of its brightness. */
function shade(c: string, f: number): string {
  const ch = (i: number) => Math.round(parseInt(c.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')
  return '#' + ch(1) + ch(3) + ch(5)
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
 * frame for `life` frames; one in `every` a full puff in `color` fading to grey, the rest wisps (all
 * wisps while a failed test smarts). */
function smoke(cv: Canvas, t: number, fx: number, every: number, color: string, isFail: boolean, life: number): void {
  for (let age = mod(t, 2); age < life; age += 2) {
    const full = !isFail && mod(t - age, every) === 0
    plot(cv, fx - age, frame(PUFF_ROWS, age), !full ? WISP : age < 2 ? color : SMOKE[Math.min(3, age >> 1)]!)
  }
}

/** The signal ahead of the engine: a pole with a lamp, its arm horizontal, dropping over four frames
 * as a permission starts to wait and down until it is answered. */
function signal(cv: Canvas, t: number, s: Signals, poleX: number, isFail: boolean): void {
  for (let y = 1; y <= 5; y++) plot(cv, poleX, y, STEEL)
  const level = s.act === 'ask' ? frame(ARM_DROP, Math.min(s.actAge, ARM_DROP.length - 1)) : 0
  plot(cv, poleX + 1, level > 1 ? 2 : 1, paint(RED, isFail))
  plot(cv, poleX + 2, 1 + level, paint(RED, isFail))
  const lamp = s.act === 'ask' ? (mod(t, 8) < 6 ? RED : RED_DARK) : s.act === 'tool' ? GOLD : GREEN
  plot(cv, poleX, 1, isFail ? LIGHT : lamp)
}

/** The tunnel mouth on a commit, around the engine from `x0` to `x1`, `f` of the way in: stone columns
 * and a hill roof brighten as everything inside dims, cleared to dark at `f` = 1. */
function tunnel(cv: Canvas, x0: number, x1: number, f: number): void {
  for (let x = Math.max(0, x0); x < Math.min(cv.w, x1); x++) {
    const stone = x === x0 || x === x1 - 1
    for (let y = 0; y < cv.h; y++) {
      const i = y * cv.w + x
      if (stone || y < 2) cv.px[i] = shade(stone ? STEEL : HILL, f)
      else cv.px[i] = cv.px[i] && f < 1 ? shade(cv.px[i]!, 1 - f) : undefined
    }
  }
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
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const age = Math.min(s.actAge, s.toolAge)
  const { engineX, cars, slotsL, agents } = layout(w, s)
  const litOf = (done: number) => (s.total > cars ? Math.floor(done * cars / s.total) : Math.min(done, cars))
  const lit = litOf(s.done)
  // The newest load flashes only when this task lit a carriage (floor-scaled, not every task does).
  const newLoad = lit > litOf(s.done - 1) && s.doneAge < DONE_FLASH_FRAMES
  // The jolt: the whole train a cell back on odd frames while the brakes screech.
  const dx = jolting && mod(s.newsAge, 2) === 1 ? -1 : 0
  const ex = engineX + dx
  const poleX = engineX + ENGINE_W + POLE_GAP
  const signX = poleX + SIGN_GAP
  const spin = isTool ? t : t >> 2

  // Layer 1: the hills, far and slow; layer 2: the track, a cell a frame.
  hills(cv, t >> 2)
  track(cv, t)
  // Layer 3: the agents' engines in fixed slots, a wisp every twelve frames out of step; the newest flashes
  // its cab and puffs a greeting as it joins (and again, harmlessly, when one leaves).
  for (let i = 0; i < agents; i++) {
    const x = slotsL - AGENT_PITCH * (i + 1)
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
    if (j === lit - 1 && newLoad && mod(s.doneAge, 2) === 0) load = WHITE
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
  // On a commit the puffs live a frame longer each frame, then shorter: steam rolls out of the back mouth.
  const life = PUFF_LIFE + (isCommit ? Math.min(s.newsAge, COMMIT_FRAMES - s.newsAge) : 0)
  smoke(cv, t, engineX + FUNNEL_X, every, isTool ? PUFF_TOOL[s.tool ?? 'other'] : SMOKE[0]!, isFail, life)
  signal(cv, t, s, poleX, isFail)
  // The tunnel mouth around the engine on a commit: fading in, dark twelve frames, fading out.
  if (isCommit) {
    const f = Math.min(FADE_FRAMES + 1, s.newsAge + 1, COMMIT_FRAMES - s.newsAge) / (FADE_FRAMES + 1)
    tunnel(cv, engineX - 1, engineX + ENGINE_W + 1, f)
  }

  const g = cells(cv)
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const readoutX = w - readout.length
  if (readout) put(g, readoutX, 0, readout, { c: isPass ? GOLD : allDone ? GREEN : LIGHT, b: true })
  // The sign; it yields to the readout when the band is narrow.
  if (!readout || signX + SIGN_W <= readoutX - 1) {
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
