// Theme: warp. Its scene, its words and its pet.
//
// The scene: a starship's bridge (#7dcfff) looking out between two window struts over the console's silhouette,
// its lights blinking on their own beats. Distant stars twinkle in place; near stars stream left a cell a frame
// by `t` alone in every act: dots, 2-cell lines on a tool, long warp lines on bash, tinted by the tool and grown
// over 8 frames of actAge. An escort per agent (four at most) in fixed formation slots, engines flickering,
// flashing as it joins; a console light per task (floor-scaled, fixed pitch), `done` lit, and a planet sliding
// in from the right as one completes, fading out. think: a scan line sweeps the viewport (12 frames); ask: the
// shields' dome fades in; say: a comm screen rises with a wave; testFail: the shields flare red 10 frames, the
// bridge jolts a pixel; testPass: they glow green, the console blinks; commit: a station grows mid-band in 20.
// Motion rules: streaks and the planet hide behind still things and touch one from its left only with their
// head (`composite`); the scan line and the dome are dotted (`dotted`); all keep a column clear of the escorts.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** Pixel rows of the viewport (the console below them); the struts' width; the formation's left column. */
const [VIEW_H, STRUT_W, FORM_X] = [6, 2, 3]
/** An escort, 6×3 facing right: flame (F, flickering), engine, wings (a nav light at W's tip), hull, nose. */
const SHIP = ['.NW...', 'FEHHHC', '.WW...']
/** The escorts' slots from FORM_X (left column, top pixel row): the lead pair ahead, the second pair behind. */
const SLOTS = [[7, 0], [10, 3], [0, 0], [3, 3]] as const
const [SHIP_W, MAX_SHIPS, LIGHT_PITCH, MAX_LIGHTS, BLINK_PITCH] = [6, 4, 2, 12, 3]
/** A ringed planet, 7×5, and the station (a wheel: ring, spokes, hub, core), 11×6. */
const PLANET = ['..PPP..', '.PLPPP.', 'rrrrrrr', '.PPPPS.', '..PSS..']
const STATION = ['..RRRRRRR..', '.R..HHH..R.', 'RSSSHCHSSSR', 'RSSSHCHSSSR', '.R..HHH..R.', '..RRRRRRR..']
/** Streaks: the longest (bash) and an edit's; frames of actAge they grow over. */
const [WARP_LEN, LINE_LEN, STREAK_IN] = [6, 2, 8]
/** Frames: an act's change, the dome's fade, the comm screen's rise, a light brightening, the 100% flare, a
 * greeting; the planet's slide and where its fade starts; the red flare, testPass; the station's growth, its
 * fade's start and its end. */
const [CHANGE_FRAMES, DOME_IN, SCREEN_IN, LIGHT_FRAMES, FLARE_ALL, GREET_FRAMES] = [4, 4, 3, 8, 16, 10]
const [PLANET_FRAMES, PLANET_FADE, FLARE_FRAMES, PASS_FRAMES] = [24, 16, 10, 12]
const [GROW_FRAMES, STATION_FADE, STATION_END] = [20, 24, 30]
/** testFail: the flare's strength and the bridge's drop (pixels) by newsAge; the scan line's row by frame. */
const FLARE = [0.5, 1, 1, 0.75, 1, 0.7, 0.9, 0.6, 0.45, 0.3]
const SHAKE = [0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0]
const SCAN = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]

const [CYAN, PALE, WHITE, RED, GREEN, AMBER, VIOLET] =
  ['#7dcfff', '#e0f7ff', '#ffffff', '#f7768e', '#9ece6a', '#e0af68', '#bb9af7']
const [STAR_DIM, STAR_MID, STAR_LIT, DOT, DIM] = ['#565f89', '#7982a9', '#c0caf5', '#a9b1d6', '#3b4261']
const [FRAME, CONSOLE_TOP, CONSOLE_FRONT, UNLIT, SCREEN, SCAN_INK, DOME] =
  ['#414868', '#545c7e', '#414868', '#8089b3', '#3b4261', '#5fb3d9', '#4fa3cf']
const SHIP_INK: Record<string, string> = { F: '#ffd166', E: '#ff9e64', W: '#a9b1d6', N: RED, H: '#c0caf5', C: CYAN }
const NOSES = [CYAN, VIOLET, GREEN, AMBER]
const PLANETS = [['#e0af68', '#ffd6a5', '#b5835a', '#c0caf5'], ['#7aa2f7', '#b4d0ff', '#3d59a1', '#e0af68'],
  ['#9ece6a', '#d4f0b0', '#5f8a3a', '#a9b1d6'], ['#bb9af7', '#e2d4ff', '#7a5bb5', '#7dcfff']]
const STATION_INK: Record<string, string> = { R: '#a9b1d6', S: '#737aa2', H: '#c0caf5', C: CYAN }
const BLINKS = [RED, AMBER, CYAN]
const TOOL_INK: Record<ToolKind, string> = { bash: '#b4f9f8', edit: '#ff9e64', read: AMBER, search: CYAN,
  agent: VIOLET, web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: '&', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** Whether cell (x, r) of `cv` holds ink in either of its pixels. */
const inked = (cv: Canvas, x: number, r: number) =>
  x >= 0 && x < cv.w && !!(cv.px[2 * r * cv.w + x] || cv.px[(2 * r + 1) * cv.w + x])

/** Lays the movers (`mv`: all a cell a frame leftward) over the still things in `cv`: a mover shows only in
 * pixels nothing still holds, and never in the cell just left of a still one unless it is its own head there
 * (nothing of it, nor anything still, on its left). A still shape's left edge then never leaps as a mover parts. */
function composite(cv: Canvas, mv: Canvas): void {
  for (let r = 0; r < cv.h / 2; r++) for (let x = 0; x < cv.w; x++) {
    if (!inked(mv, x, r)) continue
    if (!inked(cv, x, r) && inked(cv, x + 1, r) && (inked(mv, x - 1, r) || inked(cv, x - 1, r))) continue
    for (const i of [2 * r * cv.w + x, (2 * r + 1) * cv.w + x]) if (mv.px[i] && !cv.px[i]) cv.px[i] = mv.px[i]
  }
}

/** The near stars: streaks of `len` streaming left a cell a frame by `t`, a pale head and a trail in `ink`. */
function streaks(mv: Canvas, t: number, len: number, ink: string): void {
  const span = mv.w + WARP_LEN + 2
  for (let i = 0; i < Math.max(4, Math.floor(mv.w / 5)); i++) {
    const y = Math.floor(noise(i * 3 + 11) * VIEW_H)
    const head = mod(Math.floor(noise(i * 5 + 2) * span) - t, span) - WARP_LEN
    plot(mv, head, y, len > 1 ? PALE : DOT)
    for (let j = 1; j < len; j++) plot(mv, head + j, y, mix(ink, DIM, (0.6 * (j - 1)) / Math.max(1, len - 1)))
  }
}

type Px = readonly [x: number, y: number, c: string]
/** The shields' dome over the viewport: an ellipse from strut to strut, each column joined to its neighbours'
 * rows, where `keep` allows (clear of the escorts), each pixel coloured by `ink(x)`. */
function dome(w: number, ink: (x: number) => string, keep: (x: number, y: number) => boolean): Px[] {
  const [x0, x1] = [STRUT_W, w - 1 - STRUT_W]
  const hw = (x1 - x0) / 2
  const yOf = (x: number) => {
    const u = Math.min(1, Math.abs(x - x0 - hw) / Math.max(1, hw))
    return Math.round(VIEW_H - 1 - (VIEW_H - 1) * Math.sqrt(1 - u * u))
  }
  const out: Px[] = []
  for (let x = x0; x <= x1; x++) {
    const y = yOf(x)
    const low = Math.max(y, x > x0 ? yOf(x - 1) - 1 : y, x < x1 ? yOf(x + 1) - 1 : y)
    for (let yy = y; yy <= low; yy++) if (keep(x, yy)) out.push([x, yy, ink(x)])
  }
  return out
}

/** Plots an overlay of viewport pixels dotted: across each cell row, each run of its cells keeps every other
 * cell from its first (and its last); the cells between are returned, to be cleared once the movers are laid.
 * Each dot then starts a run of its own, so whatever the overlay hides, or uncovers as it goes, lies beside one. */
function dotted(cv: Canvas, pts: readonly Px[]): number[] {
  const byCell = new Map<number, Px[]>()
  for (const p of pts) {
    if (p[1] < 0 || p[1] >= VIEW_H || p[0] < 0 || p[0] >= cv.w) continue
    const key = (p[1] >> 1) * cv.w + p[0]
    byCell.set(key, [...(byCell.get(key) ?? []), p])
  }
  const gaps: number[] = []
  for (let r = 0; r < VIEW_H / 2; r++) for (let x = 0, a = -1; x < cv.w; x++) {
    const here = byCell.get(r * cv.w + x)
    if (!here) { a = -1; continue }
    if (a < 0) a = x
    const isLast = x + 1 >= cv.w || !byCell.has(r * cv.w + x + 1)
    if ((x - a) % 2 === 1 && !isLast) gaps.push(2 * r * cv.w + x, (2 * r + 1) * cv.w + x)
    else for (const [px, py, c] of here) plot(cv, px, py, c)
  }
  return gaps
}

/** The station, its art revealed in a diamond about the band's centre that grows with the commit's `a` frames (a
 * pixel shows once its columns from the middle plus its rows from the middle two are within reach), so every
 * pixel it adds touches one already there; lights chase round the ring once it is whole. */
function station(cv: Canvas, t: number, a: number, fade: number): void {
  const cx = Math.floor(cv.w / 2)
  const reach = Math.floor(((a + 1) * 8) / GROW_FRAMES)
  const whole = reach >= 7 && a >= GROW_FRAMES - 4
  STATION.forEach((row, y) => [...row].forEach((key, col) => {
    if (key === '.' || Math.abs(col - 5) + (y < 3 ? 2 - y : y - 3) > reach) return
    const lit = whole && key === 'R' && mod(col + y - (t >> 1), 5) === 0
    plot(cv, cx - 5 + col, y, mix(lit ? PALE : STATION_INK[key]!, DIM, fade))
  }))
}

/** The console along the bottom: a task light per task at a fixed pitch from the left (floor-scaled, `done`
 * lit, the newest brightening, all flaring at 100%), then status lights blinking each on its own beat (in the
 * tool's colour while one runs, green on a passed test, amber in unison over an amber glow while it waits). */
function consoleRow(cv: Canvas, t: number, s: Signals, isPass: boolean, jolt: number): void {
  const top = VIEW_H + jolt
  const face = s.act === 'wait' ? mix(CONSOLE_TOP, AMBER, mod(t, 16) < 8 ? 0.4 : 0.2) : CONSOLE_TOP
  for (let x = 0; x < cv.w; x++) [face, CONSOLE_FRONT].forEach((c, dy) => plot(cv, x, top + dy, c))
  const fits = Math.max(1, Math.min(MAX_LIGHTS, Math.floor((cv.w / 2 - FORM_X) / LIGHT_PITCH)))
  const count = Math.min(s.total, fits)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < LIGHT_FRAMES && lit > litOf(s.done - 1)
  const flare = s.total > 0 && s.done >= s.total && s.doneAge < FLARE_ALL
  for (let i = 0; i < count; i++) {
    let c = i < lit ? GREEN : UNLIT
    if (i === lit - 1 && fresh) c = mix(WHITE, GREEN, s.doneAge / LIGHT_FRAMES)
    else if (i < lit && flare && mod(s.doneAge + i, 4) < 2) c = WHITE
    plot(cv, FORM_X + i * LIGHT_PITCH, top, c)
  }
  const tool = s.act === 'tool' ? TOOL_INK[s.tool ?? 'other'] : undefined
  for (let j = 0, x = FORM_X + fits * LIGHT_PITCH + 2; x < cv.w - 5; j++, x += BLINK_PITCH) {
    const beat = mod(t + Math.floor(noise(j + 17) * 16), 16)
    let c = beat < 5 ? tool ?? BLINKS[j % 3]! : beat < 7 ? STAR_MID : face
    if (s.act === 'wait') c = mod(t, 16) < 8 ? AMBER : mix(AMBER, face, 0.6)
    if (isPass) c = mod(s.newsAge, 4) < 2 ? GREEN : face
    plot(cv, x, top, c)
  }
}

/** The sign at the console's right end: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, age: number, k: { fail: boolean; pass: boolean; commit: boolean }) {
  if (k.fail) return { text: '×', c: RED }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GREEN }
  if (k.commit) return { text: '✓', c: CYAN }
  if (age < CHANGE_FRAMES) return { text: '·', c: DOT }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: AMBER }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: GREEN }
  if (s.act === 'think') return { text: frame(['·', '∘'], t >> 3), c: CYAN }
  return { text: frame(['z', 'Z'], t >> 2), c: STAR_MID }
}

export function warpScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const mv = canvas(w, SCENE_ROWS)
  const isFail = s.news === 'testFail' && s.newsAge < SHAKE.length
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < STATION_END
  // testFail jolts the bridge (struts, console) a pixel down on some frames; the view outside stays.
  const jolt = isFail ? SHAKE[s.newsAge]! : 0
  // The escorts in their slots (those that fit inside the struts); stars, scan and dome keep a column off them.
  const ships = SLOTS.slice(0, Math.min(s.agents, MAX_SHIPS)).map(([sx, sy]) => [FORM_X + sx, sy] as const)
    .filter(([x]) => x + SHIP_W <= w - STRUT_W)
  const near = (slots: readonly (readonly [number, number])[]) => (x: number, y: number) =>
    !slots.some(([sx, sy]) => x >= sx - 1 && x <= sx + SHIP_W && y >= sy - 1 && y <= sy + SHIP.length)
  // A commit's station keeps the dome and the scan line off its box.
  const dock = (x: number) => Math.abs(x - Math.floor(w / 2)) <= 6
  const clear = (x: number, y: number) => near(ships)(x, y) && !(isCommit && dock(x))
  // Stars keep off every slot, filled or not, so none comes or goes with an escort.
  const starry = near(SLOTS.map(([sx, sy]) => [FORM_X + sx, sy] as const).filter(([x]) => x + SHIP_W <= w - STRUT_W))

  // Layer 1: the distant stars, still, each twinkling on its own beat of sixteen frames.
  for (let i = 0; i < Math.floor(w / 4); i++) {
    const [x, y] = [Math.floor(noise(i * 7 + 1) * w), Math.floor(noise(i * 7 + 4) * VIEW_H)]
    if (x < STRUT_W || x >= w - STRUT_W || !starry(x, y)) continue
    const beat = mod(t + 5 * i, 16)
    plot(cv, x, y, beat < 2 ? STAR_LIT : beat < 4 || i % 3 === 0 ? STAR_MID : STAR_DIM)
  }
  // The shields' dome: the red flare, testPass's green glow, or ask's, fading in (laid dotted further down).
  const shimmer = (x: number) => mod(x - t, 12) === 0
  const overlay: Px[] = []
  if (isFail && s.newsAge < FLARE_FRAMES) {
    const k = FLARE[s.newsAge]!
    overlay.push(...dome(w, x => mix(DIM, shimmer(x) ? '#ffc4cf' : RED, k), clear))
  } else if (isPass) {
    const k = Math.min(1, 0.4 + 0.3 * s.newsAge, (PASS_FRAMES - s.newsAge) / 6)
    overlay.push(...dome(w, x => mix(DIM, shimmer(x) ? PALE : GREEN, k), clear))
  } else if (s.act === 'ask') {
    const k = Math.min(1, (s.actAge + 1) / DOME_IN)
    overlay.push(...dome(w, x => mix(DIM, shimmer(x) ? PALE : DOME, k), clear))
  }
  const a = s.newsAge
  if (isCommit) station(cv, t, a, a < STATION_FADE ? 0 : (a - STATION_FADE + 1) / (STATION_END - STATION_FADE + 1))

  // Layer 2: the escorts, still in their slots, flames flickering, nav lights blinking; the newest flashes.
  const flame = s.act === 'tool' ? TOOL_INK[s.tool ?? 'other'] : SHIP_INK.F!
  ships.forEach(([sx, sy], i) => {
    const greet = i === ships.length - 1 && s.agentsAge < GREET_FRAMES ? 1 - s.agentsAge / GREET_FRAMES : 0
    SHIP.forEach((row, y) => [...row].forEach((key, x) => {
      if (key === '.' || (key === 'F' && mod(t + 5 * i, 12) % 5 === 4)) return
      let c = key === 'C' ? NOSES[i]! : key === 'F' ? flame : SHIP_INK[key]!
      if (key === 'N') c = mod(t + 4 * i, 16) < 3 || (greet > 0 && mod(s.agentsAge, 2) === 0) ? WHITE : RED
      plot(cv, sx + x, sy + y, greet > 0 && key !== 'N' ? mix(c, WHITE, 0.6 * greet) : c)
    }))
  })

  // The struts and the console (jolted on a failed test); say's comm screen rising from it with a wave.
  for (let y = 0; y < VIEW_H; y++) for (const x of [0, 1, w - 2, w - 1]) plot(cv, x, y + jolt, FRAME)
  for (const x of [2, w - 3]) plot(cv, x, VIEW_H - 1 + jolt, FRAME)
  // think: the scan line, a dotted row sweeping down and up, broken over the escorts' columns.
  if (s.act === 'think') {
    const y = SCAN[mod(t, SCAN.length)]!
    const lane = (x: number) => !ships.some(([sx]) => x >= sx - 1 && x <= sx + SHIP_W) && !(isCommit && dock(x))
    for (let x = STRUT_W; x < w - STRUT_W; x++) if (lane(x)) overlay.push([x, y, SCAN_INK])
  }
  // The dome and the scan line are laid dotted, together, over everything still.
  const gaps = dotted(cv, overlay)
  if (s.act === 'say') {
    const sx = w - 15
    const top = VIEW_H - Math.min(SCREEN_IN, s.actAge + 1)
    for (let x = 0; x < 9; x++) for (let y = top; y < VIEW_H; y++) {
      const wave = 4 + Math.round(Math.sin((x + t) * 0.8))
      plot(cv, sx + x, y + jolt, x === 0 || x === 8 ? CONSOLE_TOP : y === wave ? GREEN : SCREEN)
    }
  }
  consoleRow(cv, t, s, isPass, jolt)

  // Layer 3, the movers: near stars streaming (their length the tool's, grown in on actAge), and a planet per
  // completed task sliding in from the right a cell a frame, fading out before it would stop.
  const full = s.act !== 'tool' ? 1 : s.tool === 'bash' ? WARP_LEN : LINE_LEN
  const len = 1 + Math.round((full - 1) * Math.min(1, s.actAge / STREAK_IN))
  streaks(mv, t, len, s.act === 'tool' ? TOOL_INK[s.tool ?? 'other'] : DOT)
  if (s.done > 0 && s.doneAge < PLANET_FRAMES) {
    const [body, light, shade, ring] = PLANETS[mod(s.done - 1, PLANETS.length)]!
    const fade = s.doneAge < PLANET_FADE ? 0 : (s.doneAge - PLANET_FADE + 1) / (PLANET_FRAMES - PLANET_FADE + 1)
    const ink: Record<string, string> = { P: body!, L: light!, S: shade!, r: ring! }
    PLANET.forEach((row, y) => [...row].forEach((key, x) => {
      if (key !== '.') plot(mv, w - s.doneAge + x, 1 + y, mix(ink[key]!, DIM, fade))
    }))
  }
  composite(cv, mv)
  for (const i of gaps) cv.px[i] = undefined

  const g = cells(cv)
  const kinds = { fail: isFail, pass: isPass, commit: isCommit }
  const { text, c } = sign(s, t, Math.min(s.actAge, s.act === 'tool' ? s.toolAge : 999), kinds)
  put(g, w - 4, SCENE_ROWS - 1, text, { c, b: true })
  return g
}

/** A little astromech: a silver dome with a single dark lens and a red light over a blue band, a white body, two
 * side legs on wide feet and a stub leg between them. */
export const PET: PetArt = {
  body: ['....DDDD....', '...DDDDrD...', '..LBBBBBBL..', '..LWWPPWWL..', '.LLL.SS.LLL.'],
  step: ['....DDDD....', '...DDDDrD...', '..LBBBBBBL..', '..LWWPPWWL..', '.LLL..SS.LLL'],
  colors: { D: '#c8cfe8', r: RED, B: '#3d6fd6', W: '#eef1fa', P: '#3d6fd6', L: '#737aa2', S: '#565f89' },
  eyes: [5], eyeRow: 1, eye: '#1a1b26', lid: '#c8cfe8',
  spark: CYAN,
}

export const WARP: Theme = {
  name: 'warp',
  rows: SCENE_ROWS,
  color: CYAN,
  accent: VIOLET,
  sprite: {
    think: ['»·  ', '» · ', '»  ·', '» · '], tool: ['»-  ', '»-- ', '»---', '» --'],
    say: ['» ~', '» ≈'], wait: ['» .', '» ..', '» ...'],
  },
  happy: '» ✓', sad: '» …', dead: '✕', sleep: '» zZ',
  confetti: ['✦', '✧', '·', '*'],
  palette: [CYAN, STAR_LIT, VIOLET, GREEN],
  scene: warpScene,
  pet: PET,
}
