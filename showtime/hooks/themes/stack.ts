// Theme: stack. Its scene, its words and its pet.
//
// The scene: a falling-block well, ten columns wide, in the left third of the band: dim walls down
// from a rim at pixel row 2 to a floor at row 7, the opening above where a piece hovers. Stars drift
// by along the top row at three speeds, and sparks rise beside both walls to the rim (a diagonal
// spray on the left, a jet on the right). The tasks are rows in the well: `total` of them ruled dim from the floor up
// (five fit; more are floor-scaled), the bottom `done` settled solid in piece colours, the newest
// flashing white for six frames, all rolling colours when the last lands. Thinking, a piece slides to
// and fro over the opening (a lap every twelve frames) and flips every eight; asking it bobs with a
// `?`; saying it flips quickly with a note; waiting it just slides. A tool starting freezes the
// hovering piece and drops it a pixel a frame onto the stack, where it rests and is cleared with a
// white flash; after that a new piece is born at the left wall as soon as the last is cleared, and
// at every tool change, slides to its column, drops and clears; on bash it hovers and rests a frame
// less and drops with a streak. Each subagent widens the well by a column (four at most), the new column glowing
// for eight frames. A failed test greys everything and leans the well's upper rows a column right
// for eight frames (the topple). A passing test: the rows and walls pulse white, sparks double, a
// `★`. A commit: the well flashes white and drains gold from the top over twelve frames, a `✓`.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same row or a neighbour). The walls are
// the anchor: they stand in cell rows 1–3, so a piece born beside the left wall in cell row 0 starts
// a column from the wall's run below it, and a spark born beside either wall is fused to it. A piece
// slides and drops a pixel a frame, every orientation's rows start within a column of its left edge,
// and ruled rows are solid lines fused to the walls, so a piece passing over them changes no run. The
// right sparks rise straight (parting from the wall two columns out would be a jump; the left ones
// fan out because they are the left end of their run). Stars keep to the top cell row, which the
// sparks never reach (a spark bridging two stars and moving on would expose one two columns off),
// and skip the well and the sign beside it, so they only ever vanish there and reappear beside the
// left wall, a column from its run below. The sign sits on the right wall. The topple cracks the
// left wall (its column stays lit) rather than moving it, so every row beside it stays one run.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

const IDLE_AGE = 999
const WELL_W = 10
/** The rim: the walls run from this pixel row to the floor; a piece hovers in the rows above. */
const RIM = 2
const FLOOR = 7
/** Task rows that fit between the rim and the floor. */
const ROWS_MAX = FLOOR - RIM
const MAX_AGENTS = 4
/** Columns the sign beside the well may take. */
const SIGN_W = 4
/** How far a hovering piece slides from the left wall: the widest piece stays inside. */
const HOVER_SPAN = WELL_W - 4
const HOVER_FRAMES = 2
const FLIP_EVERY = 8
const SAY_FLIP_EVERY = 4
/** Frames a hovering piece keeps its shape: two laps of the slide, so it changes at the left wall. */
const SHAPE_EVERY = 24
/** A landed piece rests this long, the last CLEAR_FRAMES of them white, before the next is born. */
const REST_FRAMES = 4
const CLEAR_FRAMES = 2
/** On bash a piece hovers and rests a frame less: the fast drop. */
const BASH_HASTE = 1
/** The spawn flash as the act turns. */
const SPAWN_FRAMES = 4
const FAIL_FRAMES = 20
const TOPPLE_FRAMES = 8
const PASS_FRAMES = 12
const COMMIT_FRAMES = 12
const DONE_FLASH_FRAMES = 6
const DONE_ROLL_FRAMES = 16
const GLOW_FRAMES = 8
/** A spark climbs from the floor to the rim. */
const SPARK_LIFE = FLOOR - RIM + 1

/** A piece: two pixel rows in each of two orientations, every row starting within a column of
 * the piece's left edge (so a flip or a half-cell drop never starts a run two columns off). */
type Piece = { art: readonly (readonly [string, string])[]; color: string }
const PIECES: readonly Piece[] = [
  { art: [['OO', 'OO'], ['OO', 'OO']], color: '#ffd60a' },
  { art: [['....', 'IIII'], ['....', 'IIII']], color: '#4cc9f0' },
  { art: [['TTT', '.T.'], ['.T.', 'TTT']], color: '#f72585' },
  { art: [['.SS', 'SS.'], ['SS.', '.SS']], color: '#9ece6a' },
  { art: [['LLL', 'L..'], ['L..', 'LLL']], color: '#f8961e' },
]
const PALETTE = PIECES.map(p => p.color)
const CYAN = '#4cc9f0'
const WALL = '#4d7290'
const RULE = '#3a5570'
const WHITE = '#ffffff'
const GOLD = '#ffd60a'
const GREY = '#6c757d'
const PALE_GREY = '#8d99ae'
const STAR = '#5c6b8a'
const STAR_BRIGHT = '#8d99ae'
/** A spark's colour by its age: bright at the wall, fading as it climbs. */
const SPARK = ['#caf0f8', '#caf0f8', CYAN, CYAN, WALL, RULE]
/** A new column's glow by frames since the agent joined. */
const GLOW = [WHITE, WHITE, CYAN, CYAN, WALL, WALL, RULE, RULE]
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** A piece in the air or at rest: its left column, its top pixel row, its art and colour. */
type Flying = { x: number; py: number; art: readonly [string, string]; color: string; isDropping: boolean }

const pieceW = (p: Piece) => p.art[0]![0].length

/** Where the left wall stands: the well sits in the left third of the band. */
const wellX = (w: number) => Math.max(1, Math.floor(w / 6) - 6)

/** The hovering piece's left column at `t`: a lap from the left wall and back every twelve frames. */
function hoverX(t: number, x0: number): number {
  const p = mod(t, 2 * HOVER_SPAN)
  return x0 + 1 + (p < HOVER_SPAN ? p : 2 * HOVER_SPAN - p)
}

/** The hovering piece's shape and orientation at `t`. */
function hoverPiece(t: number, flipEvery: number): { piece: Piece; orient: number } {
  return { piece: frame(PIECES, Math.floor(t / SHAPE_EVERY)), orient: Math.floor(t / flipEvery) & 1 }
}

/** The piece while a tool runs, cycle after cycle: born at the left wall, slid to its column, hovered,
 * dropped a pixel a frame onto the stack, rested, cleared white; each cycle as long as that takes.
 * The first cycle after the act turned is the hovering piece instead, frozen where it was and dropped.
 * A tool change starts the cycles over. */
function toolPiece(
  t: number, s: Signals, x0: number, width: number, landing: number, bash: boolean,
): Flying {
  const hover = HOVER_FRAMES - (bash ? BASH_HASTE : 0)
  const rest = REST_FRAMES - (bash ? BASH_HASTE : 0)
  const fresh = s.actAge <= s.toolAge && s.actAge < IDLE_AGE
  const phase = fresh ? s.actAge : s.toolAge < IDLE_AGE ? s.toolAge : t
  let f = phase
  let k = 0
  let piece: Piece
  let orient: number
  let slide: number
  let len: number
  for (;;) {
    if (k === 0 && fresh) {
      ;({ piece, orient } = hoverPiece(t - phase, FLIP_EVERY))
      slide = 0
    } else {
      piece = PIECES[Math.floor(noise(k + 11) * PIECES.length)]!
      orient = noise(k + 23) < 0.5 ? 0 : 1
      slide = Math.floor(noise(k + 37) * (width - pieceW(piece) + 1))
    }
    len = slide + hover + landing + rest
    if (f < len) break
    f -= len
    k++
  }
  const x = k === 0 && fresh ? hoverX(t - phase, x0) : x0 + 1 + Math.min(f, slide)
  const fall = f - slide - hover
  const py = Math.max(0, Math.min(fall, landing))
  const isClearing = f >= len - CLEAR_FRAMES
  const color = isClearing ? WHITE : piece.color
  return { x, py, art: piece.art[orient]!, color, isDropping: fall > 0 && fall <= landing }
}

/** The piece while nothing drops: sliding over the opening, flipping (think, say) or bobbing (ask).
 * The bob is down over the lap's second half, while the slide runs left, and up again a column clear
 * of the left wall; there is no flip then. A row that starts a column in from the piece's edge,
 * bobbed or flipped on a step right, would start two off, as would a step away from the wall it
 * was fused to while down. */
function idlePiece(t: number, s: Signals, x0: number): Flying {
  const isAsk = s.act === 'ask'
  const { piece, orient } = hoverPiece(t, s.act === 'say' ? SAY_FLIP_EVERY : FLIP_EVERY)
  const bob = isAsk && mod(t, 2 * HOVER_SPAN) > HOVER_SPAN ? 1 : 0
  const flash = s.actAge < SPAWN_FRAMES && mod(t, 2) === 0
  const art = piece.art[isAsk || s.act === 'wait' ? 0 : orient]!
  return { x: hoverX(t, x0), py: bob, art, color: flash ? WHITE : piece.color, isDropping: false }
}

/** Stars along the top cell row, drifting left at three speeds, twinkling; none over the well or
 * the sign beside it, so they only ever reappear beside the left wall. */
function stars(cv: Canvas, t: number, skipL: number, skipR: number, grey: boolean): void {
  const n = Math.max(2, Math.floor(cv.w / 12))
  for (let i = 0; i < n; i++) {
    const x = mod(Math.floor(noise(i) * cv.w) - Math.floor(t / (2 + mod(i, 3))), cv.w)
    if (x >= skipL && x <= skipR) continue
    const twinkle = mod(t + i * 5, 24) < 3
    plot(cv, x, noise(i + 100) < 0.5 ? 0 : 1, grey ? GREY : twinkle ? STAR_BRIGHT : STAR)
  }
}

/** The topple: the well's upper rows lean a column right while a failed test lands. */
const leanOf = (py: number, lean: boolean) => (lean && py >= RIM && py < FLOOR - 1 ? 1 : 0)

/** The well: walls from the rim to the floor, the floor, `count` ruled rows with `lit` of them settled
 * in piece colours (brick-staggered), the newest flashing, all rolling when the last lands; a new
 * column glowing for a subagent. Grey while a test fails, gold while a commit lands. */
function well(
  cv: Canvas, s: Signals, x0: number, width: number, lit: number, count: number, lean: boolean,
): void {
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const wallR = x0 + width + 1
  const allDone = s.total > 0 && s.done >= s.total
  const roll = allDone && s.doneAge < DONE_ROLL_FRAMES ? s.doneAge >> 1 : 0
  const pulse = isPass && mod(s.newsAge, 4) < 2
  let wallColor = WALL
  if (isFail) wallColor = GREY
  else if (isCommit) wallColor = GOLD
  else if (pulse) wallColor = WHITE
  // The left wall cracks rather than leans (its column stays lit): the rows beside it stay one run.
  for (let py = RIM; py <= FLOOR; py++) {
    const dx = leanOf(py, lean)
    plot(cv, x0, py, wallColor)
    plot(cv, x0 + dx, py, wallColor)
    plot(cv, wallR + dx, py, wallColor)
  }
  for (let c = 0; c < width; c++) plot(cv, x0 + 1 + c, FLOOR, wallColor)
  for (let i = 0; i < count; i++) {
    const py = FLOOR - 1 - i
    const dx = leanOf(py, lean)
    const isNewest = i === lit - 1 && s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0
    for (let c = 0; c < width; c++) {
      let color = RULE
      if (i < lit) {
        const seg = Math.floor((c + (i & 1)) / 2)
        color = frame(PALETTE, Math.floor(noise(i * 7 + seg * 3) * PALETTE.length) + roll)
        if (isFail) color = PALE_GREY
        else if (isNewest || pulse) color = WHITE
      } else if (isFail) color = GREY
      plot(cv, x0 + 1 + c + dx, py, color)
    }
  }
  if (s.agents > 0 && s.agentsAge < GLOW_FRAMES && width > WELL_W) {
    for (let py = RIM; py < FLOOR; py++) plot(cv, x0 + width + leanOf(py, lean), py, GLOW[s.agentsAge]!)
  }
}

/** Sparks beside the walls: born at the floor against a wall, up a pixel a frame to the rim; the left
 * ones fan out a column every other frame, the right ones rise straight. Two a side, three frames
 * apart (so one of them changes cell every frame); `more` frames into a reaction two more are born
 * (at the wall, so they never appear mid-air). */
function sparks(cv: Canvas, t: number, x0: number, wallR: number, more: number, colors: readonly string[]): void {
  const ages = [mod(t, SPARK_LIFE), mod(t + 3, SPARK_LIFE)]
  if (more >= 0) ages.push(mod(more, SPARK_LIFE))
  if (more >= 3) ages.push(mod(more - 3, SPARK_LIFE))
  for (const a of ages) {
    const py = FLOOR - a
    plot(cv, x0 - 1 - Math.floor((a + 1) / 2), py, colors[a]!)
    plot(cv, wallR + 1, py, colors[a]!)
  }
}

/** The piece's pixels, leaning with the well; a streak above it while it drops on bash. */
function drawPiece(cv: Canvas, p: Flying, lean: boolean, streak: boolean): void {
  p.art.forEach((line, j) => {
    const py = p.py + j
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '.') continue
      plot(cv, p.x + i + leanOf(py, lean), py, p.color)
      if (streak && j === 0 && p.py > 0) plot(cv, p.x + i + leanOf(py - 1, lean), py - 1, RULE)
    }
  })
}

/** A commit: the well's rows flash white, then the fill drains from the top, gold and white. */
function commitFill(cv: Canvas, age: number, x0: number, width: number): void {
  const top = age < 2 ? RIM : RIM + 1 + ((age - 2) >> 1)
  const color = mod(age, 2) === 0 ? WHITE : GOLD
  for (let py = top; py < FLOOR; py++) for (let c = 0; c < width; c++) plot(cv, x0 + 1 + c, py, color)
}

export function stackScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const x0 = wellX(w)
  // Each subagent widens the well, as far as leaves the right wall's sparks a column.
  const extra = Math.max(0, Math.min(s.agents, MAX_AGENTS, w - 3 - x0 - WELL_W))
  const width = WELL_W + extra
  const wallR = x0 + width + 1
  const bash = act === 'tool' && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const lean = isFail && s.newsAge < TOPPLE_FRAMES
  const count = Math.min(s.total, ROWS_MAX)
  const lit = s.total > count ? Math.floor(s.done * count / s.total) : Math.min(s.done, count)
  /** The top pixel row of a piece resting on the stack. */
  const landing = FLOOR - 2 - lit

  stars(cv, t, x0, wallR + SIGN_W, isFail)
  well(cv, s, x0, width, lit, count, lean)
  const piece = act === 'tool' ? toolPiece(t, s, x0, width, landing, bash) : idlePiece(t, s, x0)
  if (isFail) piece.color = PALE_GREY
  drawPiece(cv, piece, lean, bash && piece.isDropping)
  if (isCommit) commitFill(cv, s.newsAge, x0, width)
  let sparkColors = SPARK
  if (isFail) sparkColors = SPARK.map(() => GREY)
  else if (isPass) sparkColors = SPARK.map((c, i) => (i < 4 ? '#9ece6a' : c))
  else if (isCommit) sparkColors = SPARK.map((c, i) => (i < 4 ? GOLD : c))
  sparks(cv, t, x0, wallR, isPass || isCommit ? s.newsAge : -1, sparkColors)

  const g = cells(cv)
  // The sign on the right wall's top: the news first, else the act (a `?`, the tool's mark with a
  // spinning corner, a note, dots).
  const sx = wallR + 1
  if (isFail) put(g, sx, 0, '×', { c: GREY, b: true })
  else if (isPass) put(g, sx, 0, mod(t, 4) < 2 ? '★' : '☆', { c: '#9ece6a', b: true })
  else if (isCommit) put(g, sx, 0, '✓', { c: GOLD, b: true })
  else if (act === 'ask') { if (mod(t, 8) < 6) put(g, sx, 0, '?', { c: '#ffd166', b: true }) }
  else if (act === 'tool') {
    put(g, sx, 0, `${TOOL_SIGN[s.tool ?? 'other']}${frame(['▖', '▘', '▝', '▗'], t >> 1)}`, { c: CYAN, b: true })
  }
  else if (act === 'think') put(g, sx, 0, frame(['·', '··', '···', '··'], t >> 1), { c: CYAN })
  else if (act === 'say') put(g, sx, 0, mod(t, 8) < 4 ? '♪' : '♫', { c: CYAN, b: true })
  else put(g, sx, 0, frame(['.', '..', '...'], t >> 2), { c: CYAN })
  return g
}

/** A T piece with eyes, a lighter top edge and a darker stem. */
export const PET: PetArt = {
  body: ['.HHHHHHHHHH.', '.CCCCCCCCCC.', '.CCCCCCCCCC.', '....DDDD....', '....DDDD....'],
  step: ['.HHHHHHHHHH.', '.CCCCCCCCCC.', '.CCCCCCCCCC.', '...DDDD.....', '...DDDD.....'],
  colors: { H: '#90e0ef', C: '#4cc9f0', D: '#4895ef' },
  eyes: [3, 8],
  eyeRow: 1,
  eye: '#1d2a3a',
  lid: '#4cc9f0',
  mouth: [5, 2],
  blush: '#f72585',
  spark: '#ffd60a',
}

export const STACK: Theme = {
  name: 'stack',
  rows: SCENE_ROWS,
  color: '#4cc9f0',
  accent: '#f72585',
  sprite: {
    think: ['[▀▀  ]', '[ ▀▀ ]', '[  ▀▀]', '[ ▀▀ ]'],
    tool: ['[▀▀  ]', '[▄▄  ]', '[██  ]', '[████]'],
    say: ['[▀▀▀▀]', '[▄▄▄▄]'],
    wait: ['[.   ]', '[..  ]', '[... ]', '[....]'],
  },
  happy: '[████]',
  sad: '[▀▄▀▄]',
  dead: '[xxxx]',
  sleep: '[▄▄  ] zZ',
  confetti: ['▀', '▄', '■', '▪', '·'],
  palette: ['#4cc9f0', '#f72585', '#ffd60a', '#9ece6a', '#f8961e'],
  scene: stackScene,
  pet: PET,
}
