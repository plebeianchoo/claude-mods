// Theme: launch. Its scene, its words and its pet.
//
// The scene: a rocket (#f4a261) on a pad in the left third, a gantry whose lights are the tasks
// (floor-scaled to six, `done` green, the newest flashing, rolling colours at 100%) under a beacon, a
// `done/total` readout, the sea at the right under low clouds, drifting stars. Its altitude tracks
// `done/total`, climbing a pixel a frame as a task lands. A sign over its shoulder reads the act: the
// countdown (3, 2, 1, twelve frames each, then ✦ held), `?`, notes, the tool's mark. In a tool the
// engines catch on the pad and it lifts a pixel on a flame in the tool's colour flickering on two
// frames; bash is a full burn with smoke rolling off left. Subagents are boosters by the fins (three at
// most), the newest separating in place with a flash and a jolt. testFail: the hull greys and drops
// into water under the pad, ten frames of spray, back by frame 22; testPass: the hull flashes white;
// commit: a satellite rings it for twenty frames.
//
// Motion rules: stars, clouds and smoke are lone cells going left, off the rocket's columns and the
// sign; still things touch or stand two apart; the flame and spray only recolour or hug the hull.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** The rocket's left column: the left third of the band. The pad, gantry, sign and sea hang off it. */
const rocketX = (w: number) => Math.max(5, Math.floor(w / 3))
const ROCKET_W = 5
/** The nose's pixel row at rest, how far it can lift, how far it sinks in a splashdown, the pad's row. */
const NOSE_Y = 2
const LIFT_MAX = 2
const SINK = 3
const PAD_Y = 7
const GANTRY_DX = -4
const ARM_DX = -3
const PAD_L = -5
const PAD_R = 7
const SEA_DX = 10
/** The sign over the rocket's shoulder, clear of hull, satellite and boosters; its box, a column spare. */
const SIGN_DX = 6
const SIGN_BOX = 4
const LIGHTS = 6
const BEACON_FRAMES = 12
const MAX_AGENTS = 3
const BOOSTER_DX = [5, -1, 6]
/** The newest booster's jolt down, in pixels, by `agentsAge`. */
const SEPARATE = [0, 1, 1, 1, 1, 0, 0, 0]
/** Stars: cell rows 0 and 1, frames per cell in each, one star per eight columns, kept off the rocket. */
const STAR_PERIODS = [6, 3]
const STAR_PITCH = 8
const STAR_GAP_L = 2
const STAR_GAP_R = 9
const CLOUD_PITCH = 9
const CLOUD_PERIOD = 4
const WAVE = 12
const PUFF_LIFE = 14
const PUFF_GAP = 3
const PUFF_ALONG = 5
const IGNITE_FRAMES = 4
const TURN_FRAMES = 4
const COUNT_FRAMES = 12
const DONE_FLASH_FRAMES = 8
const DONE_ROLL_FRAMES = 16
/** Splashdown: falling (at most LIFT_MAX + SINK frames), the spray, then the climb back. */
const DROP_FRAMES = 6
const SPLASH_FRAMES = 10
const FAIL_FRAMES = DROP_FRAMES + SPLASH_FRAMES + SINK + LIFT_MAX + 1
const PASS_FRAMES = 12
const COMMIT_FRAMES = 20
/** The satellite's path round the hull from the fins' right, every cell beside one of the hull's. */
const ORBIT: [dx: number, dy: number][] = [
  [5, 4], [5, 3], [4, 2], [4, 1], [3, 0], [2, -1], [1, 0], [0, 1], [0, 2], [-1, 3], [-1, 4], [0, 5], [1, 5], [2, 5],
  [3, 5], [4, 5],
]
const COUNTDOWN = ['3', '2', '1', '✦']
/** The spray's height over the water by the frame of the splash, and its columns at each height. */
const SPRAY = [1, 2, 3, 3, 3, 2, 2, 1, 1, 0]
const SPRAY_COLS = [[-1, 0, 4, 5], [0, 1, 3, 4, 5], [0, 4]]

const HULL = '#f4a261'
const TRIM = '#e76f51'
const WINDOW = '#8ecae6'
const PALE = '#fff3b0'
const GOLD = '#ffd60a'
const WHITE = '#ffffff'
const RED = '#f7768e'
const GREEN = '#9ece6a'
const STEEL = '#8d99ae'
const DIM = '#5c6180'
const EMBER = '#9a4a2f'
const PAD = '#6c757d'
const STAR = '#8a92bf'
const STAR_LIT = '#e0e4ff'
const SEA = '#3f6a9c'
const CREST = '#7fb3e6'
const SIGN = '#cfd8dc'
const GREY_DARK = '#4a4e69'
const SMOKE = [SIGN, STEEL, DIM]
const PALETTE = [HULL, TRIM, WINDOW, GOLD, GREEN]
const HUES = ['#7dcfff', '#bb9af7', '#f7768e']
const FLAME: Record<ToolKind, string> = {
  bash: GOLD, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** The rocket, 5×5: a nose, a cabin with a window, a slim body flaring into fins, the engine bell. */
const ROCKET = ['..N..', '.HWH.', '.HHH.', 'NHHHN', 'N.E.N']
const ROCKET_COLORS = { N: TRIM, H: HULL, W: WINDOW, E: DIM }
const ROCKET_GREY = { N: PAD, H: STEEL, W: GREY_DARK, E: GREY_DARK }

/** The nose's lift for `done` of `total`: none at 0, the top at 100%. */
const markOf = (done: number, total: number) => (total > 0 ? Math.round(LIFT_MAX * Math.min(done, total) / total) : 0)

/** The nose's lift: a pixel a frame from the last mark to this one, a pixel up in a tool once lit; on testFail
 * a pixel a frame down to SINK under the pad, held through the splash, then back up a pixel a frame. */
function altitudeOf(s: Signals): number {
  let a = Math.min(markOf(s.done, s.total), markOf(Math.max(0, s.done - 1), s.total) + s.doneAge)
  if (s.act === 'tool' && s.actAge >= IGNITE_FRAMES) a = Math.min(LIFT_MAX, a + 1)
  if (s.news !== 'testFail' || s.newsAge >= FAIL_FRAMES) return a
  const rise = s.newsAge - DROP_FRAMES - SPLASH_FRAMES
  return rise < 0 ? Math.max(-SINK, a - s.newsAge) : Math.min(a, rise - SINK)
}

/** Stars in the top two cell rows drifting left at a speed per row and twinkling, off the rocket. */
function stars(cv: Canvas, t: number, rl: number): void {
  const count = Math.max(1, Math.floor(cv.w / STAR_PITCH))
  const slot = cv.w / count
  for (let row = 0; row < STAR_PERIODS.length; row++) {
    for (let i = 0; i < count; i++) {
      const seed = i + row * 31
      const x = mod(Math.floor(i * slot + noise(seed) * (slot - 2)) - Math.floor(t / STAR_PERIODS[row]!), cv.w)
      if (x >= rl - STAR_GAP_L && x <= rl + STAR_GAP_R) continue
      plot(cv, x, 2 * row + (noise(seed + 3) < 0.5 ? 0 : 1), mod(t + seed * 5, 24) < 3 ? STAR_LIT : STAR)
    }
  }
}

/** The sea along the bottom right, its crest rolling right, low clouds drifting left over it. */
function sea(cv: Canvas, t: number, seaL: number): void {
  for (let x = seaL; x < cv.w; x++) plot(cv, x, PAD_Y, mod(x - t, WAVE) < 2 ? CREST : SEA)
  const span = cv.w - seaL + 6
  for (let i = 0; i < Math.max(1, Math.floor((cv.w - seaL) / CLOUD_PITCH)); i++) {
    const x = seaL - 3 + mod(Math.floor(noise(i + 20) * span) - Math.floor(t / CLOUD_PERIOD), span)
    for (let dx = 0; dx < 3; dx++) if (x + dx >= seaL) plot(cv, x + dx, PAD_Y - 1, DIM)
    if (x + 1 >= seaL) plot(cv, x + 1, PAD_Y - 2, DIM)
  }
}

/** The gantry: a tower with the task lights up it, a beacon on top, an arm stub two columns clear. */
function gantry(cv: Canvas, t: number, s: Signals, rl: number, allDone: boolean): void {
  const gx = rl + GANTRY_DX
  const count = Math.min(s.total, LIGHTS)
  const lit = s.total > count ? Math.floor(s.done * count / s.total) : Math.min(s.done, count)
  for (let py = 0; py < PAD_Y; py++) plot(cv, gx, py, STEEL)
  for (let j = 0; j < count; j++) {
    let color = j < lit ? GREEN : DIM
    if (j === lit - 1 && s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0) color = WHITE
    else if (j < lit && allDone && s.doneAge < DONE_ROLL_FRAMES) color = frame(PALETTE, j + (s.doneAge >> 1))
    plot(cv, gx, PAD_Y - 1 - j, color)
  }
  if (mod(t, BEACON_FRAMES) < 3) plot(cv, gx, 0, RED)
  plot(cv, rl + ARM_DX, NOSE_Y + 2, STEEL)
}

/** Smoke on bash: a puff every three frames rolling left from the exhaust a cell a frame, rising after
 * five frames and fading; placed by `t` alone, only puffs born since the burn began show. */
function smoke(cv: Canvas, t: number, rl: number, burnAge: number): void {
  for (let k = 0; k * PUFF_GAP < PUFF_LIFE; k++) {
    const age = mod(t + k * PUFF_GAP, PUFF_LIFE)
    if (age > burnAge) continue
    const py = age <= PUFF_ALONG ? PAD_Y - 1 : Math.max(1, PAD_Y - 1 - (age - PUFF_ALONG))
    plot(cv, rl - 1 - age, py, SMOKE[Math.min(2, Math.floor(age / 5))]!)
  }
}

/** The engines: in a tool a row of flame in the tool's colour (a grey sputter on the pad first), core and
 * edges swapping every frame, boosters lit too; bash adds a row and lights the pad. Aloft idle: embers. */
function flame(cv: Canvas, t: number, s: Signals, rl: number, fy: number, age: number, n: number): void {
  if (fy > PAD_Y || (fy === PAD_Y && s.act !== 'tool')) return
  if (s.act !== 'tool') {
    for (let dx = 0; dx < ROCKET_W; dx++) plot(cv, rl + dx, fy, dx === 2 && mod(t, 4) < 2 ? TRIM : EMBER)
    return
  }
  const bash = s.tool === 'bash'
  const hot = age >= IGNITE_FRAMES ? FLAME[s.tool ?? 'other'] : STEEL
  const pale = age >= IGNITE_FRAMES ? PALE : SIGN
  const [core, edge] = mod(t, 2) === 0 ? [hot, pale] : [pale, hot]
  if (bash) for (let dx = 0; dx < ROCKET_W; dx++) plot(cv, rl + dx, PAD_Y, mod(t + dx, 2) === 0 ? GOLD : TRIM)
  for (let dx = 0; dx < ROCKET_W; dx++) plot(cv, rl + dx, fy, dx === 2 || (bash && dx > 0 && dx < 4) ? core : edge)
  for (let i = 0; i < n; i++) plot(cv, rl + BOOSTER_DX[i]!, fy, i % 2 === 0 ? core : edge)
  if (bash) for (let dx = 1; dx <= 3; dx++) if (dx === 2 || mod(t, 2) === 0) plot(cv, rl + dx, fy + 1, edge)
}

/** The boosters, one per subagent in its own hue, the newest separating in place: a pixel down and
 * flashing white (again, harmlessly, when one leaves). */
function boosters(cv: Canvas, s: Signals, rl: number, finsY: number, n: number, grey: boolean): void {
  for (let i = 0; i < n; i++) {
    const newest = i === n - 1 && s.agentsAge < SEPARATE.length
    const y = finsY + (newest ? SEPARATE[s.agentsAge]! : 0)
    const flash = newest && mod(s.agentsAge, 2) === 0
    plot(cv, rl + BOOSTER_DX[i]!, y, flash ? WHITE : grey ? STEEL : HUES[i]!)
    plot(cv, rl + BOOSTER_DX[i]!, y + 1, flash ? WHITE : grey ? PAD : STEEL)
  }
}

/** The splashdown: water in the pad's row under the sunk hull, foam lapping its sides, and a crown of
 * spray round the nose rising and falling over ten frames. */
function splashdown(cv: Canvas, t: number, rl: number, a: number, newsAge: number): void {
  if (a >= 0) return
  for (let dx = -1; dx <= ROCKET_W + 1; dx++) plot(cv, rl + dx, PAD_Y, mod(dx - t, 3) === 0 ? CREST : SEA)
  const k = newsAge - DROP_FRAMES
  const h = k >= 0 && k < SPLASH_FRAMES ? SPRAY[k]! : 0
  for (const dx of a === -SINK ? [0, 1, 3, 4] : [4]) plot(cv, rl + dx, PAD_Y - 2, CREST)
  for (let j = 1; j <= h; j++) {
    for (const dx of SPRAY_COLS[j - 1]!) plot(cv, rl + dx, PAD_Y - j, j === h ? WHITE : CREST)
  }
}

/** The satellite: a white cell circling the hull along ORBIT a cell a frame, a two-cell trail. */
function orbit(cv: Canvas, rl: number, noseY: number, age: number): void {
  for (let k = Math.min(2, age); k >= 0; k--) {
    const [dx, dy] = frame(ORBIT, age - k)
    plot(cv, rl + dx, noseY + dy, k === 0 ? WHITE : k === 1 ? GOLD : TRIM)
  }
}

/** The sign over the rocket: the news first, else the act, dots while the act turns. Every variant
 * shows two cells of ink on even frames and one on odd, so no frame can hold. */
function sign(s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean) {
  const tail = mod(t, 2) === 0 ? '·' : ''
  if (isFail) return { text: '×' + tail, c: RED }
  if (isPass) return { text: frame(['★·', '★', '☆·', '☆'], t), c: GOLD }
  if (isCommit) return { text: '✓' + tail, c: GOLD }
  if (age < TURN_FRAMES) return { text: frame(['··', '·'], t), c: PALE }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + tail, c: GOLD }
  if (s.act === 'ask') return { text: frame(['?·', '?', '·?', '?'], t), c: GOLD }
  if (s.act === 'say') return { text: frame(['♪♫', '♫', '♫♪', '♪'], t), c: WINDOW }
  const count = COUNTDOWN[Math.min(COUNTDOWN.length - 1, Math.floor(s.actAge / COUNT_FRAMES))]!
  if (s.act === 'think') return { text: count + tail, c: SIGN }
  return { text: frame(['..', '.', '...', '.'], t), c: SIGN }
}

export function launchScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const rl = rocketX(w)
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const age = Math.min(s.actAge, s.toolAge)
  const n = Math.min(s.agents, MAX_AGENTS)
  const a = altitudeOf(s)
  const noseY = NOSE_Y - a
  const finsY = noseY + ROCKET.length - 1

  // Layer 1: the stars; layer 2: the sea and its clouds; layer 3: the pad and the gantry.
  stars(cv, t, rl)
  sea(cv, t, rl + SEA_DX)
  for (let x = rl + PAD_L; x <= rl + PAD_R; x++) plot(cv, x, PAD_Y, PAD)
  gantry(cv, t, s, rl, allDone)
  // Layer 4: the smoke, the boosters, the engines and the rocket; the news over them.
  if (s.act === 'tool' && s.tool === 'bash') smoke(cv, t, rl, age)
  boosters(cv, s, rl, finsY, n, isFail)
  flame(cv, t, s, rl, finsY + 1, age, n)
  let colors: Record<string, string> = isFail ? ROCKET_GREY : ROCKET_COLORS
  if (isPass && mod(t, 2) === 0) colors = { ...ROCKET_COLORS, H: WHITE, N: WHITE }
  draw(cv, rl, noseY, ROCKET, colors)
  if (isFail) splashdown(cv, t, rl, a, s.newsAge)
  if (isCommit) orbit(cv, rl, noseY, s.newsAge)

  const g = cells(cv)
  const sx = rl + SIGN_DX
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  if (readout && w - readout.length > sx + SIGN_BOX) {
    put(g, w - readout.length, 0, readout, { c: isCommit || isPass ? GOLD : allDone ? GREEN : SIGN, b: true })
  }
  const { text, c } = sign(s, t, age, isFail, isPass, isCommit)
  put(g, sx, 0, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  return g
}

/** An astronaut: a big round helmet, eyes on a blue visor with a glint, a pack on one side, a much narrower
 * grey suit with an orange glove, two thin legs close together. No mouth: the visor hides it. */
export const PET: PetArt = {
  body: ['.....WWWWW..', '...PWGVVVVW.', '...PWVVVVVW.', '...P..SSSO..', '......S.S...'],
  step: ['.....WWWWW..', '...PWGVVVVW.', '...PWVVVVVW.', '...P..SSSO..', '.....S...S..'],
  colors: { W: '#f4f6f8', V: '#3a86ff', G: '#bde0ff', P: STEEL, S: '#b8c2d0', O: HULL },
  eyes: [6, 8],
  eyeRow: 1,
  eye: '#1d1d1d',
  lid: '#3a86ff',
  blush: '#ff8fab',
  spark: GOLD,
}

export const LAUNCH: Theme = {
  name: 'launch',
  rows: SCENE_ROWS,
  color: HULL,
  accent: TRIM,
  sprite: {
    think: ['▲ 3  ', '▲ 2  ', '▲ 1  ', '▲ ✦  '],
    tool: ['▲ ·  ', '▲ ·· ', '▲ ···', '▲ ·· '],
    say: ['▲ ♪  ', '▲ ♫  '],
    wait: ['▲ .  ', '▲ .. ', '▲ ...'],
  },
  happy: '▲ ★',
  sad: '▲ …',
  dead: '▼ ✕',
  sleep: '▲ zZ',
  confetti: ['✦', '★', '·', '+'],
  palette: PALETTE,
  scene: launchScene,
  pet: PET,
}
