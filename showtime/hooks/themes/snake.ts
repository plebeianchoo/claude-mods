// Theme: snake. Its scene, its words and its pet.
//
// The scene: a grid snake (#9ece6a) running a figure-eight drawn as a dim track in the left third of
// the band, a cell a frame in every act, its body banded in two greens so the bands crawl, a pale head
// with a flick of red across it for a tongue (every fourth frame idle, every other saying or hunting,
// every frame on bash). Around the track a sparse field of dim dots with a faint wave rolling across
// it. Its length is 3 + `done`, growing a cell as a task lands; `total` apples sit dim along the top
// right beside a `done/total` readout, `done` of them red, the newest flashing white, all rolling
// colours at 100%. In a tool an apple in the tool's colour appears eight cells ahead on the track
// (five on bash) and the snake runs it down, a white bite as it reaches it, the next appearing further
// along. A sign right of the track reads the act (dots, a bobbing `?`, notes, the tool's mark). Four
// dim ring slots at the bottom right: each subagent (four at most) is a small snake of its own hue
// circling one, growing in and flashing white as it joins. A failed test: the snake bites its tail,
// red for twenty frames (flashing white the first eight) and two cells shorter, under a red `×`; a
// passed test: a golden apple ahead, the snake gold once it is eaten, a `★`, twenty-four frames; a
// commit: the apples and the field's wave gold under a `✓`.
//
// Motion rules (tests/scenes.test.ts): the track, the dots and the ring slots are constant ink, so the
// snake, the apples, the agents and every reaction change colour only and no run start ever moves.
// What keeps a frame from holding is the sign: it changes its ink every frame in every act and under
// every news (a tail of dots that grows and shrinks beside a mark that stays), and it never hides,
// moving down to the bottom rows where a narrow band puts the readout in its place.
import { canvas, cells, frame, mod, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Cell = readonly [x: number, y: number]

/** The track's left column; the straight cells along a lobe's top, by the band's width. */
const LOOP_X = 1
const MIN_LOBE = 3
const MAX_LOBE = 8
const BASE_LEN = 3
const MIN_LEN = 1
const DOT_PITCH = 4
const WAVE = 16
/** The sign's column from the track's right side. */
const SIGN_GAP = 2
const SIGN_W = 3
const APPLE_PITCH = 2
const APPLE_EVERY = 8
const APPLE_EVERY_BASH = 5
const GOLD_EVERY = 6
const BITE_FRAMES = 2
const RING_PITCH = 3
const MAX_AGENTS = 4
/** A ring's cells in order: a two-by-two square, clockwise from its top left. */
const RING: Cell[] = [[0, 2], [1, 2], [1, 3], [0, 3]]
const RING_LEN = 3
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
const TRACK = '#464b70'
const DOT = '#3b3f5c'
const DOT_LIT = '#5f668f'
const DIM_APPLE = '#6b3a4a'
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

/** Straight cells along a lobe's top: the track is 2n + 5 wide and 4n + 10 long, in the left third. */
const lobeOf = (w: number) => Math.max(MIN_LOBE, Math.min(MAX_LOBE, Math.floor((Math.floor(w / 3) - 5) / 2)))
const rightOf = (n: number) => LOOP_X + 2 * n + 4

/** The figure-eight, from the top left lobe's first cell: along the top, down through the crossing to
 * the right lobe's bottom, up its side, back along its top, down through the crossing again to the
 * left lobe's bottom, and up its side. The two lobes meet only at the crossing. */
function loopOf(n: number): Cell[] {
  const c = LOOP_X + n + 2
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

/** The apple ahead: `every` cells past where the head was when the hunt began and past each apple
 * eaten, with the frames since the last bite. */
function appleAhead(since: number, every: number): { ahead: number; bitten: number } {
  const phase = mod(since, every)
  return { ahead: every - phase, bitten: since >= every ? phase : BITE_FRAMES }
}

/** The field: a dot in the lower pixel of every fourth cell, each row offset two from the last, a
 * faint wave rolling right (gold on a commit); none from the track's side through a column past the
 * sign (a dot fused to the sign's tail would be exposed as it shrinks), none along the apple row. */
function field(cv: Canvas, t: number, trackR: number, signX: number, hudL: number, isCommit: boolean): void {
  for (let y = 0; y < SCENE_ROWS; y++) {
    for (let x = 0; x < cv.w; x++) {
      if (mod(x - 2 * y, DOT_PITCH) !== 0) continue
      if (x > trackR && x <= signX + SIGN_W) continue
      if (y === 0 && x >= hudL) continue
      const crest = mod(x + 2 * y - t, WAVE) < 3
      plot(cv, x, 2 * y + 1, crest ? (isCommit ? GOLD : DOT_LIT) : DOT)
    }
  }
}

/** The snake's length now: three and a task, two shorter while a failed test smarts, regrowing a cell a
 * frame after, growing a cell a frame as a task lands; never longer than the track less four. */
function lengthOf(s: Signals, loopLen: number): number {
  let len = BASE_LEN + Math.min(s.done, Math.max(0, loopLen - 4 - BASE_LEN))
  if (s.done > 0 && s.doneAge < 1) len -= 1
  if (s.news === 'testFail') {
    if (s.newsAge < FAIL_FRAMES) len -= FAIL_SHORT
    else if (s.newsAge < FAIL_FRAMES + FAIL_SHORT) len -= FAIL_FRAMES + FAIL_SHORT - s.newsAge
  }
  return Math.max(MIN_LEN, len)
}

/** Segment `k` of the snake (0 the head) at `t`: its colour by the news, the bite and its band. */
function segmentColor(k: number, t: number, s: Signals, bite: boolean, golden: boolean, allDone: boolean): string {
  if (s.news === 'testFail' && s.newsAge < FAIL_FRAMES) {
    return s.newsAge < FAIL_FLASH_FRAMES && mod(t, 2) === 0 ? WHITE : RED
  }
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

/** The agents: dim ring slots from the right edge leftward in the bottom rows, as many as fit, and on
 * one per agent (four at most) a small snake of its own hue circling it out of step; the newest grows
 * in a cell a frame from the ring's top left and flashes white as it joins (and again, harmlessly,
 * when one leaves). */
function agents(cv: Canvas, t: number, s: Signals, minX: number): void {
  const n = Math.min(s.agents, MAX_AGENTS)
  for (let i = 0; i < MAX_AGENTS; i++) {
    const x0 = cv.w - 2 - RING_PITCH * i
    if (x0 < minX) break
    for (const [dx, dy] of RING) block(cv, [x0 + dx, dy], TRACK)
    if (i >= n) continue
    const newest = i === n - 1 && s.agentsAge < GREET_FRAMES
    const growing = newest && s.agentsAge < RING_LEN
    const [head, body] = HUES[i]!
    for (let k = 0; k < (growing ? s.agentsAge + 1 : RING_LEN); k++) {
      const [dx, dy] = growing ? RING[k]! : frame(RING, t + 2 * i - k)
      block(cv, [x0 + dx, dy], newest && mod(s.agentsAge, 2) === 0 ? WHITE : k === 0 ? head : body)
    }
  }
}

/** The sign right of the track: the news first, else the act, dots while the act turns. Each changes
 * its ink every frame (a tail of dots growing and shrinking beside a mark), so no frame can hold. */
function sign(
  s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean,
): { text: string; c: string; bob: number } {
  const bob = age === 0 ? 1 : 0
  if (isFail) return { text: frame(['×', '×·'], t), c: RED, bob }
  if (isPass) return { text: frame(['★', '★·', '☆', '☆·'], t), c: GOLD, bob }
  if (isCommit) return { text: frame(['✓', '✓·'], t), c: GOLD, bob }
  if (age < TURN_FRAMES) return { text: frame(['·', '··'], t), c: PALE, bob }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + frame(['', '·', '··', '·'], t), c: GOLD, bob }
  if (s.act === 'ask') return { text: frame(['?', '?·'], t), c: GOLD, bob: mod(t, 4) < 2 ? 0 : 1 }
  if (s.act === 'say') return { text: frame(['♪', '♪♫', '♫', '♫♪'], t), c: GREEN, bob }
  if (s.act === 'think') return { text: frame(['·', '··', '···', '··'], t), c: SIGN, bob }
  return { text: frame(['.', '..', '...', '..'], t), c: SIGN, bob }
}

export function snakeScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const n = lobeOf(w)
  const loop = loopOf(n)
  const L = loop.length
  const at = (i: number) => loop[mod(i, L)]!
  const signX = rightOf(n) + SIGN_GAP
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const readoutX = w - readout.length
  // The sign keeps the top rows unless the readout needs them (a narrow band), then the bottom rows.
  const signRow = readout && signX + SIGN_W > readoutX - 1 ? 2 : 0
  const hudL = signX + SIGN_W + 1
  const hudR = readoutX - 2
  const bash = s.act === 'tool' && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const age = Math.min(s.actAge, s.toolAge)
  const prey = s.act === 'tool' ? appleAhead(age, bash ? APPLE_EVERY_BASH : APPLE_EVERY) : undefined
  const golden = isPass ? appleAhead(s.newsAge, GOLD_EVERY) : undefined
  const goldenEaten = isPass && s.newsAge >= GOLD_EVERY
  const bite = (prey?.bitten ?? BITE_FRAMES) < BITE_FRAMES || (goldenEaten && golden!.bitten < BITE_FRAMES)

  // Layer 1: the field, its wave rolling, and the track; layer 2: the apple ahead on the track.
  field(cv, t, rightOf(n), signX, hudL, isCommit)
  for (const cell of loop) block(cv, cell, TRACK)
  if (golden && !goldenEaten) apple(cv, at(t + golden.ahead), mod(t, 2) === 0 ? GOLD : PALE, PALE)
  else if (prey) apple(cv, at(t + prey.ahead), APPLE[s.tool ?? 'other'])
  // Layer 3: the snake, tail first so the head lies over the crossing, its tongue a flick of red
  // across the head's top.
  const len = lengthOf(s, L)
  for (let k = len - 1; k >= 0; k--) block(cv, at(t - k), segmentColor(k, t, s, bite, goldenEaten, allDone))
  const flick = bash ? 1 : s.act === 'tool' || s.act === 'say' ? 2 : 4
  if (mod(t, flick) === 0 && !bite && !goldenEaten && !isFail) plot(cv, at(t)[0], 2 * at(t)[1], RED)
  // Layer 4: the task apples and the agents' rings.
  hud(cv, s, hudL, hudR, isCommit, allDone)
  agents(cv, t, s, hudL)

  const g = cells(cv)
  if (readout) put(g, readoutX, 0, readout, { c: isCommit || isPass ? GOLD : allDone ? GREEN : SIGN, b: true })
  // The sign, a row down the frame the act turns.
  const { text, c, bob } = sign(s, t, age, isFail, isPass, isCommit)
  put(g, signX, signRow + bob, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
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
