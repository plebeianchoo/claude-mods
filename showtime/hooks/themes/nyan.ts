// Theme: nyan. Its scene, its words and its pet.
//
// The scene: a pop-tart cat flies right through a starfield at the band's two-fifths, a rainbow
// streaming behind him. The rainbow's six bands and the shadow under them wave (four-column blocks
// a pixel up and down, scrolling away a column a frame), his tail wagging over it, and its length tracks the tasks: four cells with nothing done,
// the whole band behind him with all done, lengthening a cell a frame when a task lands; each
// landing also bursts a star off his ear (a diamond growing a pixel a frame to five and back, its
// colors cycling), and when the last lands the bands roll through their colors. His legs run a
// four-frame cycle, his head dips a pixel for four frames every sixteen and when the act changes, he
// blinks every thirty. Stars pass at three depths, each keeping to its own cell row: far lavender
// pixels along the top a column every four frames, mid pink pixels along the bottom every other
// frame, near white crosses through the middle every frame; while bash runs the near stars streak,
// a dash trailing right of each that grows a pixel a frame from the moment bash starts. Each subagent is a small nyan cat flying in echelon off his nose (alternately low
// and high), the newest entering from the right edge a column a frame; agents the band is too
// narrow for are pips at the right edge. A failed test greys the rainbow and the stars and droops
// his head for twenty frames; a passing test bursts a white star off his ear for sixteen; a commit
// doubles the rainbow for twenty-four: a fainter three-band rainbow sweeps in above a compressed
// first, back from the cat along the trail, then sweeps out again, the near stars in rainbow colors. Asking: a `?` before his face;
// thinking: dots; a tool: a spark; saying: a note.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same row or a neighbour). The cat's
// body never moves: his column is inked on pixel rows 0–5 whatever the wave, so the trail, the
// tart and the head are one run from the trail's start in cell rows 0–2, and the legs (pixel row 6,
// never under the tart's bottom cell) are separate runs that each move a column at most and never
// touch. The trail is seven pixels tall (six bands and a shadow), so its wave of a pixel keeps every
// cell row lit in every column: the wave shows as the top and bottom edges alternating, never as
// ink appearing (a six-tall trail would start new runs in the bottom row at its end, two columns
// from the first leg). The trail ends a column short of him in the bottom row, so no leg ever fuses to it. The head only ever dips a pixel, and its
// ears are two pixels tall, so the ears' cells in the top row never change (a rise would drop the
// forehead into that row and fuse the ears to the tart, and they would reappear as new runs). The
// tail wags over the rainbow, whose cells are lit anyway. Stars are drawn first and overdrawn, so one emerging from under the trail starts
// a column from the trail's start; they are masked under the trail and the cat (one slipping
// through the gap between the tart and an ear, or fused to a leg that steps away, would strand
// the ear or itself) and in the air before his face (where glyphs and bursts shrink);
// each depth keeps to its own cell row, since a star of one speed fused to one of another would be
// stranded when they part.
// Each glyph, burst and mini is fused to his right edge or starts at its own left column, and the
// minis' legs sit under their tarts' bottom cells, so stars pass them without a new run. The stars'
// positions depend on `t` alone (a speed keyed to the tool would move every star by `t` columns
// when the tool changed); bash's pace is a dash trailing to the right of each near star, growing a
// pixel a frame from `toolAge` 0, so the star's run start never moves, and when bash ends the dash
// vanishes (a run shrinking, which the rule allows).
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const CAT_W = 14
/** The tart: 9×6 at his left, its corners round (his column shows the rainbow's ends through them). */
const TART = ['.TTTTTTTT', 'TPPSPPSPT', 'TPSPPPPPT', 'TPPPPSPPT', 'TPSPPPPST', '.TTTTTTTT']
/** The head: 5×6 at his right, ears two pixels tall (so a dip of a pixel keeps their cells), eyes on row 3, cheeks on row 4. */
const HEAD = ['.G..G', '.G..G', 'GGGGG', 'GKGGK', 'GPGGP', '.GGG.']
const HEAD_X = 9
const HEAD_Y = 0
/** The tail: three pixels over the rainbow at his left, its tip wagging a pixel over a twelve-frame cycle. */
const TAIL_Y = 3
const TAIL_WAG = [0, 0, 0, -1, -1, -1, 0, 0, 0, 1, 1, 1]
/** The burst's centre row off his ear. */
const BURST_Y = 1
/** His legs' columns on pixel row 6, a four-frame cycle: each leg moves a column at most and no two ever touch. */
const LEGS = [[1, 4, 7, 10], [1, 5, 7, 11], [2, 5, 8, 11], [2, 4, 8, 10]]
const LEGS_Y = 6
const TART_COLOR = '#ffcc99'
const PINK = '#ff99cc'
const DOT = '#ff3399'
const FUR = '#999999'
const EYE = '#1b1b1b'
const WHITE = '#ffffff'
const PALE_PINK = '#ffd6ff'
const LAVENDER = '#a89cc8'
const YELLOW = '#ffd166'
const RAINBOW = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#6633ff']
/** The trail's seventh row, a deep violet shadow under the bands: seven tall, a pixel's wave keeps every cell row lit. */
const SHADOW = '#4f2d8f'
const BANDS = [...RAINBOW, SHADOW]
/** The rainbow greyed by a failed test, lightest on top. */
const GREYS = ['#9a9a9a', '#8c8c8c', '#7e7e7e', '#707070', '#626262', '#545454', '#484848']
/** The double rainbow of a commit: a fainter three-band rainbow above a full one. */
const DOUBLE = ['#ffb3b3', '#ffffb3', '#b3e0ff', '#ff0000', '#ffff00', '#0099ff', SHADOW]
const TRAIL_MIN = 4
const WAVE_W = 4
/** Idle motions: the head's dip and the blink. */
const DIP_EVERY = 16
const DIP_FRAMES = 4
const BLINK_EVERY = 30
/** Reaction lengths, in frames. */
const TURN_FRAMES = 6
const DONE_FRAMES = 12
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 24
/** The burst's reach off his ear, in pixels; stars are masked over that air so a shrinking burst strands none. */
const BURST_R = 5
const AIR_W = BURST_R + 1
/** Stars by depth: how many a band holds, their speed, their color, and the pixel rows they keep to
 * (a depth to itself: stars of two speeds pass each other, and one fused to another would be stranded). */
const STAR_DEPTHS = [
  { per: 14, speed: 0.25, color: LAVENDER, twinkle: LAVENDER, seed: 40, rows: [0, 1] },
  { per: 14, speed: 0.5, color: PALE_PINK, twinkle: WHITE, seed: 60, rows: [6, 7] },
  { per: 14, speed: 1, color: WHITE, twinkle: PALE_PINK, seed: 80, rows: [3, 4] },
]
const STAR_GREY = '#8a8a8a'
/** Bash streaks the near stars: a dash trailing right of each, growing a pixel a frame from when bash started to this long. */
const DASH_MAX = 2
/** A subagent's mini: 6×4, its own three-band rainbow on its left so every cell row starts at its column. */
const MINI = ['rTTT.G', 'yTPTGG', 'bTTTGG']
const MINI_LEGS = [[2, 4], [2, 5], [3, 5], [3, 4]]
const MINI_W = 6
const MINI_PITCH = 7
const MINI_COLORS = { r: '#ff0000', y: '#ffff00', b: '#0099ff', T: TART_COLOR, P: DOT, G: FUR }
const MAX_AGENTS = 4
/** Pips stack up the right edge from the bottom; three keep the top cell (the glyph's, at width 16) clear. */
const MAX_PIPS = 3

/** Where the cat's left column sits: two-fifths across, but never off the right edge. */
function catX(w: number): number {
  return Math.max(0, Math.min(Math.floor(w * 0.4), w - CAT_W - 1))
}

/** The trail's length for `done` of `total`: four cells with nothing done, all the way back with all. */
function trailFor(done: number, total: number, x: number): number {
  if (total <= 0 || done <= 0) return Math.min(TRAIL_MIN, x)
  return Math.min(x, TRAIL_MIN + Math.round(Math.max(0, x - TRAIL_MIN) * Math.min(done, total) / total))
}

/** The trail's length now: lengthening a cell a frame from where the task before left it. */
function trailLength(s: Signals, x: number): number {
  const target = trailFor(s.done, s.total, x)
  if (s.done <= 0) return target
  const from = trailFor(s.done - 1, s.total, x)
  return from + Math.min(s.doneAge, Math.max(0, target - from))
}

/** The wave of the trail at column `c`: 0 or 1 pixel down, in four-column blocks scrolling away. */
function wave(c: number, t: number): number {
  return mod(Math.floor((c + t) / WAVE_W), 2)
}

/** A star at depth `d`: a pixel, or a cross for the near ones with a `dash` of pixels trailing to its right
 * (bash's streak: it grows rightward, so the star's run start never moves); only pixels `open` lets through. */
function star(cv: Canvas, d: number, cx: number, cy: number, color: string, dash: number, open: (px: number, py: number) => boolean): void {
  const dots = d === 2 ? [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] : [[0, 0]]
  for (const [dx, dy] of dots) if (open(cx + dx!, cy + dy!)) plot(cv, cx + dx!, cy + dy!, color)
  if (d === 2) for (let i = 1; i <= dash; i++) if (open(cx + 1 + i, cy)) plot(cv, cx + 1 + i, cy, color)
}

/** The star field: three depths, each scrolling left at its own speed, entering at the right edge. Positions
 * depend on `t` alone: a speed that changed with the tool would teleport every star when the tool did; bash
 * shows as a `dash` streaking the near stars instead. */
function stars(cv: Canvas, t: number, grey: boolean, festive: boolean, dash: number, open: (px: number, py: number) => boolean): void {
  const w = cv.w
  STAR_DEPTHS.forEach((depth, d) => {
    const n = Math.max(1, Math.floor(w / depth.per))
    for (let i = 0; i < n; i++) {
      const sx = mod(Math.floor(noise(i + depth.seed) * w * 3) - Math.floor(t * depth.speed), w)
      const sy = depth.rows[Math.floor(noise(i + depth.seed + 1) * depth.rows.length)]!
      const twinkle = mod(t + i * 7, 20) < 3
      const color = grey ? STAR_GREY : festive && d === 2 ? RAINBOW[mod(i + (t >> 1), 6)]! : twinkle ? depth.twinkle : depth.color
      star(cv, d, sx, sy, color, dash, open)
    }
  })
}

/** The rainbow: six bands and their shadow waving behind him from `x - len` to his column, in `colors`
 * (the six bands rolled by `roll`); the `sweep` columns nearest him in `DOUBLE`. */
function rainbow(cv: Canvas, t: number, x: number, len: number, colors: readonly string[], roll: number, sweep: number): void {
  const band = (bands: readonly string[], k: number) => (k < 6 ? bands[mod(k + roll, 6)]! : bands[k]!)
  for (let c = Math.max(0, x - len); c < x; c++) {
    const bands = x - c <= sweep ? DOUBLE : colors
    const dy = wave(c, t)
    for (let k = 0; k < BANDS.length; k++) plot(cv, c, k + dy, band(bands, k))
  }
  // His own column: the bands' ends show through the tart's round corners, never waving (his body never moves).
  const bands = sweep > 0 ? DOUBLE : colors
  if (len > 0) for (let k = 0; k < 6; k++) plot(cv, x, k, band(bands, k))
}

/** The cat: the tail over the rainbow, the tart, the head at its dip, the legs at their step. */
function cat(cv: Canvas, t: number, x: number, headOff: number, sad: boolean): void {
  plot(cv, x - 1, TAIL_Y, FUR)
  plot(cv, x - 2, TAIL_Y, FUR)
  plot(cv, x - 3, TAIL_Y + frame(TAIL_WAG, t), FUR)
  draw(cv, x, 0, TART, { T: TART_COLOR, P: PINK, S: DOT })
  const blink = mod(t, BLINK_EVERY) < 2
  draw(cv, x + HEAD_X, HEAD_Y + headOff, HEAD, { G: FUR, K: blink ? FUR : EYE, P: sad ? '#b0b0b0' : PINK })
  for (const lx of frame(LEGS, t)) plot(cv, x + lx, LEGS_Y, FUR)
}

/** A burst off his ear: a diamond growing a pixel a frame to `BURST_R`, holding, and shrinking back, colors cycling. */
function burst(cv: Canvas, x: number, age: number, frames: number, colors: readonly string[]): void {
  const r = Math.min(age, BURST_R, frames - 1 - age)
  if (r < 0) return
  for (let dx = 0; dx <= r; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      if (dx + Math.abs(dy) > r) continue
      plot(cv, x + CAT_W + dx, BURST_Y + dy, colors[mod(dx + Math.abs(dy) + age, colors.length)]!)
    }
  }
}

/** Subagents: a mini nyan cat each in echelon off his nose, low then high; the newest enters from the right edge. Extras are pips up the right edge, from the bottom (clear of the glyph). */
function minis(cv: Canvas, t: number, x: number, s: Signals): void {
  const w = cv.w
  const first = x + CAT_W + 1
  const fits = Math.max(0, Math.floor((w - first - MINI_W) / MINI_PITCH) + 1)
  const n = Math.max(0, Math.min(s.agents, MAX_AGENTS, fits))
  for (let i = 0; i < n; i++) {
    let mx = first + i * MINI_PITCH
    if (i === s.agents - 1) mx = Math.max(mx, w - 1 - s.agentsAge)
    const py = i % 2 ? 0 : 4
    draw(cv, mx, py, MINI, MINI_COLORS)
    for (const lx of frame(MINI_LEGS, t + i)) plot(cv, mx + lx, py + 3, FUR)
  }
  const pips = Math.max(0, Math.min(s.agents - n, MAX_PIPS))
  for (let i = 0; i < pips; i++) {
    const color = RAINBOW[mod(i * 2 + (t >> 2), 6)]!
    plot(cv, w - 1, 6 - 2 * i, color)
    plot(cv, w - 1, 7 - 2 * i, color)
  }
}

export function nyanScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const x = catX(w)
  const len = trailLength(s, x)
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const landed = s.done > 0 && s.doneAge < DONE_FRAMES
  const allDone = landed && s.total > 0 && s.done >= s.total

  // The stars, behind everything: masked under the trail and the cat, and in the air before his face.
  const open = (px: number, py: number) =>
    !(px >= x - len && px <= x + CAT_W) && !(py < 4 && px >= x + CAT_W && px <= x + CAT_W + AIR_W)
  const dash = act === 'tool' && s.tool === 'bash' ? Math.max(0, Math.min(DASH_MAX, s.toolAge)) : 0
  stars(cv, t, isFail, isCommit, dash, open)

  // The rainbow: greyed by a failed test, rolling when the last task lands, doubled by a commit.
  const roll = allDone ? -(s.doneAge >> 1) : 0
  let sweep = 0
  if (isCommit) {
    const pace = Math.max(2, Math.ceil(len / 10))
    sweep = s.newsAge < COMMIT_FRAMES / 2 ? (s.newsAge + 1) * pace : Math.max(0, len - (s.newsAge - COMMIT_FRAMES / 2) * pace)
  }
  rainbow(cv, t, x, len, isFail ? GREYS : BANDS, roll, sweep)

  // The cat: his head dips for a turn of the act and a failed test, and for four frames every sixteen otherwise.
  const headOff = isFail || s.actAge < TURN_FRAMES || mod(t, DIP_EVERY) < DIP_FRAMES ? 1 : 0
  cat(cv, t, x, headOff, isFail)

  // Off his ear: the burst of a landed task (rainbow) or a passing test (white and yellow).
  if (isPass) burst(cv, x, s.newsAge, PASS_FRAMES, [WHITE, YELLOW, PALE_PINK])
  else if (landed) burst(cv, x, s.doneAge, DONE_FRAMES, RAINBOW)

  minis(cv, t, x, s)

  const g = cells(cv)
  // The glyph before his face, fused to his ear's cell: a `?` while asking, a spark while a tool
  // runs, dots while thinking, a note while saying; nothing while a burst takes the air.
  const gx = x + CAT_W
  if (!isPass && !landed) {
    if (act === 'ask') { if (mod(t, 8) < 6) put(g, gx, 0, '?', { c: YELLOW, b: true }) }
    else if (act === 'tool') put(g, gx, 0, frame(['✦', '·', '✧', '·'], t >> 1), { c: YELLOW, b: true })
    else if (act === 'think') put(g, gx, 0, frame(['·', '··', '···', '··'], t >> 2), { c: LAVENDER })
    else if (act === 'say') put(g, gx, 0, mod(t, 8) < 4 ? '♪' : '♫', { c: PINK, b: true })
    else put(g, gx, 0, frame(['.', '..', '...'], t >> 2), { c: LAVENDER })
  }
  return g
}

/** A pop-tart cat, its head poking out on the right. */
export const PET: PetArt = {
  body: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', '.L.L.L..L.L.'],
  step: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', 'L.L.L..L.L..'],
  colors: { T: '#ffcc99', P: '#ff99cc', S: '#ff3399', G: '#a0a0a0', L: '#a0a0a0' },
  eyes: [8, 10],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#a0a0a0',
  blush: '#ff99cc',
  spark: '#ffff00',
}

export const NYAN: Theme = {
  name: 'nyan',
    rows: SCENE_ROWS,
    color: '#ff99cc',
    accent: '#999999',
    isRainbow: true,
    sprite: {
      think: ['~=[,,_,,]:3', '=~[,,_,,]:3'],
      tool: ['~=[,,_,,]:3 *', '=~[,,_,,]:3 +'],
      say: ['~=[,,o,,]:3', '=~[,,_,,]:3'],
      wait: ['~=[,,_,,]:3 .  ', '=~[,,_,,]:3 .. ', '~=[,,_,,]:3 ...'],
    },
    happy: '~=[,,^,,]:3',
    sad: '~=[,,;,,]:3',
    dead: '~=[,,x,,]:3',
    sleep: '~=[,,-,,]:3 zZ',
    confetti: ['*', '+', '·', '✦', '✧'],
    palette: RAINBOW,
    scene: nyanScene,
  pet: PET,
}
