// Theme: snake. Its scene, its words and its pet.
//
// The scene: a grid snake (#9ece6a) winding a figure-eight in the left third of the band, a cell a
// frame in every act, its body banded in two greens so the bands crawl, a pale head with a flick of red
// across it for a tongue (every fourth frame idle, every other saying or hunting, every frame on bash).
// The field is dim dots on a checkerboard, the two lobes it rounds a shade lighter, three dots over the
// crossing, and a brighter wave rolling across it all. Its length is 3 + `done`, growing a cell as a
// task lands, and `total` apples sit dim along the top right beside a `done/total` readout, `done` of
// them red, the newest flashing white, all rolling colours at 100%. In a tool an apple in the tool's
// colour appears ahead on the loop (eight cells or more; five on bash) and the snake runs it down, a
// white bite as it reaches it, the next appearing further along. A sign right of the loop reads the
// act (dots, a bobbing `?`, notes, the tool's mark). Each subagent (four at most) is a small snake of
// its own hue circling a two-by-two ring at the bottom right, growing in and flashing white as it
// joins. A failed test: the snake bites its tail, flashing red for eight frames and two cells shorter
// for twenty, a `×`; a passed test: a golden apple ahead of it, the snake gold once it is eaten, a `★`,
// twenty-four frames; a commit: the apples and the field's wave gold under a `✓`.
//
// Motion rules (tests/scenes.test.ts): the loop's cells carry no dots, so the head always enters an
// empty cell and the tail always leaves one, and no frame can hold; the sign changes its ink every
// other frame besides. New ink away from the body must start within a column of a run already there,
// so the checkerboard is phased to the loop (the lobe length odd): no dot sits beside a straight in
// its own row, where the tail leaving would expose it two columns from the body's end, and a dot sits
// beside each corner the head turns into out of a rightward run (the lattice at the right side, the
// three anchors at the crossing). Apples appear only at loop cells with a dot beside them in their own
// row, or at the band's left edge, so their ink joins a run; the tongue stays on the head's cell. A
// ring grows in from its top left (a dot in the row above anchors it), its margins kept clear, and
// its zone is reserved only where a ring fits, so the right side's anchors survive a narrow band.
import { canvas, cells, frame, mod, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Cell = readonly [x: number, y: number]

/** The loop's left column, and the straight cells along a lobe's top by the band's width. */
const LOOP_X = 1
const MIN_LOBE = 3
const MAX_LOBE = 7
const BASE_LEN = 3
const MIN_LEN = 2
const WAVE = 16
/** The sign's column from the loop's right side. */
const SIGN_GAP = 2
const SIGN_W = 3
const APPLE_PITCH = 2
const APPLE_EVERY = 8
const APPLE_EVERY_BASH = 5
const GOLD_EVERY = 6
const BITE_FRAMES = 2
const RING_PITCH = 3
const MAX_AGENTS = 4
/** The ring's cells in order: a two-by-two square, clockwise from its top left. */
const RING: Cell[] = [[0, 2], [1, 2], [1, 3], [0, 3]]
const RING_LEN = 3
/** Columns a ring and its margins take, from its left cell. */
const RING_ZONE = [-1, 0, 1, 2]
const GREET_FRAMES = 8
const FAIL_FLASH_FRAMES = 8
const FAIL_FRAMES = 20
const FAIL_SHORT = 2
const PASS_FRAMES = 24
const COMMIT_FRAMES = 12
const DONE_FLASH_FRAMES = 8
const DONE_ROLL_FRAMES = 16
const TURN_FRAMES = 4

const GREEN = '#9ece6a'
const GREEN_DARK = '#6f9a3f'
const HEAD = '#d9f99d'
const RED = '#f7768e'
const WHITE = '#ffffff'
const GOLD = '#ffd60a'
const PALE = '#fff3b0'
const STEM = '#b5651d'
const DOT = '#3b3f5c'
const DOT_IN = '#51567c'
const DOT_LIT = '#8a92bf'
const DIM_APPLE = '#6b3a4a'
const GREY = '#8d99ae'
const SIGN = '#cfd8dc'
const PALETTE = [GREEN, RED, GOLD, '#7dcfff', '#bb9af7']
const APPLE: Record<ToolKind, string> = {
  bash: RED, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}
/** Each agent's snake: its head and its body. */
const HUES: readonly (readonly [string, string])[] = [
  ['#7dcfff', '#3d8fbf'], ['#bb9af7', '#8060c0'], ['#ff9e64', '#c06a30'], ['#f7768e', '#b04060'],
]

/** Straight cells along a lobe's top: the loop is 2n + 5 wide, 4n + 10 long, in the left third. Odd, so
 * the lattice falls beside the loop's corners and never beside its straights. */
function lobeOf(w: number): number {
  const n = Math.max(MIN_LOBE, Math.min(MAX_LOBE, Math.floor((Math.floor(w / 3) - 5) / 2)))
  return n % 2 === 0 ? n - 1 : n
}
/** The crossing's column, and the right side's. */
const crossOf = (n: number) => LOOP_X + n + 2
const rightOf = (n: number) => LOOP_X + 2 * n + 4

/** The figure-eight, from the top left lobe's first cell: along the top, down through the crossing to
 * the right lobe's bottom, up its side, back along its top, down through the crossing again to the
 * left lobe's bottom, and up its side. The two lobes meet only at the crossing. */
function loopOf(n: number): Cell[] {
  const c = crossOf(n)
  const r = rightOf(n)
  const out: Cell[] = []
  for (let i = 1; i <= n; i++) out.push([LOOP_X + i, 0])
  out.push([c - 1, 1], [c, 2], [c + 1, 3])
  for (let i = 0; i < n; i++) out.push([c + 2 + i, 3])
  out.push([r, 2], [r, 1])
  for (let i = 0; i < n; i++) out.push([r - 1 - i, 0])
  out.push([c + 1, 1], [c, 2], [c - 1, 3])
  for (let i = 0; i < n; i++) out.push([c - 2 - i, 3])
  out.push([LOOP_X, 2], [LOOP_X, 1])
  return out
}

/** A cell of the band filled in `color`, both pixels. */
function block(cv: Canvas, [x, y]: Cell, color: string): void {
  plot(cv, x, 2 * y, color)
  plot(cv, x, 2 * y + 1, color)
}

/** An apple: a stem pixel over the fruit. */
function apple(cv: Canvas, [x, y]: Cell, color: string, stem = STEM): void {
  plot(cv, x, 2 * y, stem)
  plot(cv, x, 2 * y + 1, color)
}

/** Loop indices where an apple may appear: cells with a dot beside them in their own row (the lobes'
 * far ends, the cells by the crossing's anchors) or at the band's left edge, so its ink joins a run. */
function spotsOf(n: number): number[] {
  return [n - 1, n, 2 * n + 2, 2 * n + 3, 3 * n + 4, 3 * n + 5, 4 * n + 7, 4 * n + 8, 4 * n + 9]
}

/** The first spot at index `i` or after. */
function nextSpot(i: number, spots: number[], L: number): number {
  const m = mod(i, L)
  for (const sp of spots) if (sp >= m) return i - m + sp
  return i - m + L + spots[0]!
}

/** The apple ahead: the first spot `every` or more past where the head was when the hunt began (and
 * past each apple eaten), with the frames since the last bite. */
function appleAhead(
  t: number, t0: number, every: number, spots: number[], L: number,
): { ahead: number; bitten: number } {
  let a = nextSpot(t0 + every, spots, L)
  let prev = -BITE_FRAMES
  while (a <= t) { prev = a; a = nextSpot(a + every, spots, L) }
  return { ahead: a - t, bitten: t - prev }
}

/** The field: a dot in the lower pixel of every other cell, a checkerboard, three more over the crossing
 * (beside the loop's corners, the anchors), the lobes' insides a shade lighter so the track shows, a
 * brighter wave rolling right (gold on a commit); none on the loop, beside the rings, under the sign
 * or along the apple row. */
function field(cv: Canvas, t: number, n: number, reserved: Set<number>, isCommit: boolean): void {
  const c = crossOf(n)
  const r = rightOf(n)
  for (let y = 0; y < SCENE_ROWS; y++) {
    for (let x = 0; x < cv.w; x++) {
      const anchor = (y === 0 && Math.abs(x - c) === 1) || (y === 1 && x === c)
      if ((mod(x + y, 2) !== 0 && !anchor) || reserved.has(y * cv.w + x)) continue
      const inside = y >= 1 && y <= 2 && ((x > LOOP_X && x <= LOOP_X + n) || (x >= c + 2 && x < r))
      const crest = mod(x + 2 * y - t, WAVE) < 3
      plot(cv, x, 2 * y + 1, crest ? (isCommit ? GOLD : DOT_LIT) : inside ? DOT_IN : DOT)
    }
  }
}

/** The cells the field leaves clear: the loop, the sign's box, the apple row and the zones of the rings
 * that fit (whether an agent stands there or not). */
function reservedOf(w: number, loop: Cell[], signX: number, hudL: number): Set<number> {
  const out = new Set(loop.map(([x, y]) => y * w + x))
  for (let y = 0; y < 2; y++) for (let x = signX; x < signX + SIGN_W; x++) out.add(y * w + x)
  for (let x = Math.max(0, hudL); x < w; x++) out.add(x)
  for (let i = 0; i < MAX_AGENTS && w - 2 - RING_PITCH * i >= hudL; i++) {
    for (const dx of RING_ZONE) for (const y of [2, 3]) out.add(y * w + w - 2 - RING_PITCH * i + dx)
  }
  return out
}

/** The snake's length now: three and a task, two shorter while a failed test smarts, regrowing a cell a
 * frame after, growing a cell a frame as a task lands; never longer than the loop less four. */
function lengthOf(s: Signals, loopLen: number): number {
  let len = BASE_LEN + Math.min(s.done, Math.max(0, loopLen - 4 - BASE_LEN))
  if (s.doneAge < 1) len -= 1
  if (s.news === 'testFail') {
    if (s.newsAge < FAIL_FRAMES) len -= FAIL_SHORT
    else if (s.newsAge < FAIL_FRAMES + FAIL_SHORT) len -= FAIL_FRAMES + FAIL_SHORT - s.newsAge
  }
  return Math.max(MIN_LEN, len)
}

/** Segment `k` of the snake (0 the head) at `t`: its colour by the news, the bite and its band. */
function segmentColor(k: number, t: number, s: Signals, bite: boolean, golden: boolean, allDone: boolean): string {
  if (s.news === 'testFail' && s.newsAge < FAIL_FLASH_FRAMES) return mod(t, 2) === 0 ? RED : k === 0 ? HEAD : GREEN
  if (golden) return mod(k + t, 2) === 0 ? GOLD : PALE
  if (allDone && s.doneAge < DONE_ROLL_FRAMES) return frame(PALETTE, k + (s.doneAge >> 1))
  if (k === 0) return bite ? WHITE : HEAD
  return mod(k, 2) === 0 ? GREEN : GREEN_DARK
}

/** The tasks along the top right: `count` apples two apart left of the readout, the `lit` leftmost red
 * (the newest flashing white, all rolling colours at 100%, white on a commit), the rest dim. */
function hud(cv: Canvas, s: Signals, hudL: number, hudR: number, isCommit: boolean, allDone: boolean): void {
  const count = Math.min(s.total, Math.max(0, Math.floor((hudR - hudL) / APPLE_PITCH) + 1))
  const lit = s.total > count ? Math.floor(s.done * count / s.total) : Math.min(s.done, count)
  for (let j = 0; j < count; j++) {
    const x = hudR - (count - 1 - j) * APPLE_PITCH
    if (j >= lit) { apple(cv, [x, 0], DIM_APPLE, DOT_LIT); continue }
    let color = RED
    if (j === lit - 1 && s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0) color = WHITE
    else if (allDone && s.doneAge < DONE_ROLL_FRAMES) color = frame(PALETTE, j + (s.doneAge >> 1))
    else if (isCommit && mod(s.newsAge, 2) === 0) color = WHITE
    apple(cv, [x, 0], color)
  }
}

/** The agents: a small snake of its own hue circling a ring per agent (four at most), from the right
 * edge leftward in the bottom rows, each out of step; the newest grows in a cell a frame from the
 * ring's top left and flashes white as it joins (and again, harmlessly, when one leaves). */
function agents(cv: Canvas, t: number, s: Signals, minX: number): void {
  const n = Math.min(s.agents, MAX_AGENTS)
  for (let i = 0; i < n; i++) {
    const x0 = cv.w - 2 - RING_PITCH * i
    if (x0 < minX) break
    const newest = i === n - 1 && s.agentsAge < GREET_FRAMES
    const growing = newest && s.agentsAge < RING_LEN
    const [head, body] = HUES[i]!
    for (let k = 0; k < (growing ? s.agentsAge + 1 : RING_LEN); k++) {
      const [dx, dy] = growing ? RING[k]! : frame(RING, t + 2 * i - k)
      const color = newest && mod(s.agentsAge, 2) === 0 ? WHITE : k === 0 ? head : body
      block(cv, [x0 + dx, dy], color)
    }
  }
}

/** The sign right of the loop: the news first, else the act, dots while the act turns. Each changes its
 * ink every other frame at least (a length, or the `?` bobbing a row), so no frame can hold. */
function sign(
  s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean,
): { text: string; c: string; row: number } {
  const row = age === 0 ? 1 : 0
  if (isFail) return { text: frame(['×', '×·'], t >> 1), c: GREY, row }
  if (isPass) return { text: frame(['★', '★·', '☆', '☆·'], t >> 1), c: GOLD, row }
  if (isCommit) return { text: frame(['✓', '✓·'], t >> 1), c: GOLD, row }
  if (age < TURN_FRAMES) return { text: frame(['·', '··'], t), c: PALE, row }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + frame(['', '·', '··', '·'], t), c: GOLD, row }
  if (s.act === 'ask') return { text: '?', c: GOLD, row: mod(t, 4) < 2 ? 0 : 1 }
  if (s.act === 'say') return { text: frame(['♪', '♪♫', '♫', '♫♪'], t >> 1), c: GREEN, row }
  if (s.act === 'think') return { text: frame(['·', '··', '···', '··'], t >> 1), c: SIGN, row }
  return { text: frame(['.', '..', '...', '..'], t >> 1), c: SIGN, row }
}

export function snakeScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const n = lobeOf(w)
  const loop = loopOf(n)
  const L = loop.length
  const spots = spotsOf(n)
  const at = (i: number) => loop[mod(i, L)]!
  const signX = rightOf(n) + SIGN_GAP
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const readoutX = w - readout.length
  const hudL = signX + SIGN_W + 1
  const hudR = readoutX - 2
  const bash = s.act === 'tool' && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const age = Math.min(s.actAge, s.toolAge)
  const prey = s.act === 'tool' ? appleAhead(t, t - age, bash ? APPLE_EVERY_BASH : APPLE_EVERY, spots, L) : undefined
  const golden = isPass ? appleAhead(t, t - s.newsAge, GOLD_EVERY, spots, L) : undefined
  const goldenEaten = golden !== undefined && golden.bitten <= s.newsAge
  const bite = (prey?.bitten ?? BITE_FRAMES) < BITE_FRAMES || (goldenEaten && golden.bitten < BITE_FRAMES)

  // Layer 1: the field, its wave rolling; layer 2: the apple ahead on the loop.
  field(cv, t, n, reservedOf(w, loop, signX, hudL), isCommit)
  if (golden && !goldenEaten) apple(cv, at(t + golden.ahead), mod(t, 2) === 0 ? GOLD : PALE, PALE)
  else if (prey) apple(cv, at(t + prey.ahead), APPLE[s.tool ?? 'other'])
  // Layer 3: the snake, tail first so the head lies over the crossing, its tongue a flick of red
  // across the head's top.
  const len = lengthOf(s, L)
  for (let k = len - 1; k >= 0; k--) block(cv, at(t - k), segmentColor(k, t, s, bite, goldenEaten, allDone))
  const flick = bash ? 1 : s.act === 'tool' || s.act === 'say' ? 2 : 4
  if (mod(t, flick) === 0 && !bite && !goldenEaten) plot(cv, at(t)[0], 2 * at(t)[1], RED)
  // Layer 4: the task apples and the agents' rings.
  hud(cv, s, hudL, hudR, isCommit, allDone)
  agents(cv, t, s, hudL)

  const g = cells(cv)
  if (readout) put(g, readoutX, 0, readout, { c: isCommit || isPass ? GOLD : allDone ? GREEN : SIGN, b: true })
  // The sign, a row down the frame the act turns; it yields to the readout when the band is narrow.
  if (!readout || signX + SIGN_W <= readoutX - 1) {
    const { text, c, row } = sign(s, t, age, isFail, isPass, isCommit)
    put(g, signX, row, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  }
  return g
}

/** A coiled snake: banded coils under a raised head. */
export const PET: PetArt = {
  body: ['........HHHH', '........HHHH', '..GDGDGDGD..', '.DGDGDGDGDG.', '..GDGDGDGD..'],
  step: ['........HHHH', '........HHHH', '..GDGDGDGD..', '.GDGDGDGDGD.', '..DGDGDGDG..'],
  colors: { H: HEAD, G: GREEN, D: GREEN_DARK },
  eyes: [9, 11],
  eyeRow: 0,
  eye: '#1d1d1d',
  lid: HEAD,
  mouth: [9, 1],
  blush: RED,
  spark: GOLD,
}

export const SNAKE: Theme = {
  name: 'snake',
  rows: SCENE_ROWS,
  color: GREEN,
  accent: RED,
  sprite: {
    think: ['~~●  ', ' ~~● ', '  ~~●', ' ~~● '],
    tool: ['~~● ○', ' ~~●○', '  ~~●', ' ~~● '],
    say: ['~~● ♪', '~~● ♫'],
    wait: ['~~● .', '~~● ..', '~~● ...'],
  },
  happy: '~~● ★',
  sad: '~~● …',
  dead: '~~✕',
  sleep: '~~● zZ',
  confetti: ['●', '○', '·', '+'],
  palette: PALETTE,
  scene: snakeScene,
  pet: PET,
}
