// Theme: plumber. Its scene, its words and its pet.
//
// The scene: a platformer runner (#e63946) in the left third, the world scrolling past him in three
// layers: dim hills far (pixel rows 4–5, slowest), single-cell bricks mid along the top row (half the
// near speed), pipes and the brick ground near (a cell a frame while a tool runs, else every other).
// Idle, he bounces in place on a twelve-frame cycle while the pipes pass behind him, a sign ahead of
// his head reading the act (dots, `?`, a note); in a tool he runs, a four-frame step with a hop, the
// tool's mark for a sign, and jumps each pipe in a six-frame arc (bash: legs every frame, dust). Tasks:
// `total` ? blocks along the top right (floor-scaled), `done` of them coins spinning on four frames,
// the newest flashing; at 100% the coins roll colours and a flagpole slides in from the right edge,
// its flag running down. Each subagent (four at most) is a smaller runner trailing him out of step,
// running in from the left edge and hopping as it joins. A failed test greys the world: a ? block
// appears over his head, he bonks it and sits twelve frames under a circling star. A passed test
// flashes him white under a ★. A commit: three bursts of fireworks over the flag, sixteen frames.
//
// Motion rules (tests/scenes.test.ts): the hills fill pixel row 5 and the ground rows 6–7 across the
// width, so the test sees cell rows 0–1 only. Every pixel row of a runner starts within a column of its
// left edge, so his own rows anchor him as he hops; the bounce is a closed walk of single steps two
// cells high (an idle frame always changes), in a tool the hop and the bricks step on alternate frames
// and the sign's dot tail every frame, and nothing hops, bonks or sits while walking in. Bricks are
// single cells four or more apart (a mover in a one-column gap merges two still cells, then exposes one
// two off; the ? blocks are three apart for that) and skip the zone from the last parked runner to past
// the sign, coming out a column from a cap. The bonk block and the star start beside his cap, the flag
// beside a pole that has stood a frame, the fireworks around the pole or at the exempt right edge; a
// new agent enters at the exempt left edge.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

const HERO_W = 5
/** His cap's pixel row when he stands on the ground. */
const STAND_Y = 3
const HILL_Y = 4
const GROUND_Y = 6
/** The sign's column from his left edge, and the first HUD column from the sign. */
const SIGN_GAP = 6
const SIGN_W = 3
const HUD_GAP = 4
const HUD_PITCH = 3
const POLE_FROM_RIGHT = 5
/** The flag shows once the pole has stood a frame, then runs down. */
const FLAG_AT = POLE_FROM_RIGHT
const HUD_FROM_RIGHT = 8
const PIPE_GAP = 20
const PIPE_JITTER = 8
const MAX_AGENTS = 4
const AGENT_W = 3
const AGENT_PITCH = 4
/** Columns between one mid brick and the next, before a jitter of up to two. */
const BRICK_PITCH = 6
/** The idle bounce: a closed walk of single steps, twelve frames to a lap, two cells at most. */
const BOUNCE = [0, 1, 2, 1, 2, 1, 0, 1, 0, 1, 2, 1]
/** The jump over a pipe, by the pipe's column from his, from four columns ahead to one behind. */
const ARC = [1, 2, 3, 3, 2, 1]
const ARC_AHEAD = 4
/** The greeting hop of a new agent. */
const GREET = [1, 2, 2, 1]
const BONK_FRAMES = 5
const BONK = [0, 1, 2, 1, 0]
const SIT_FRAMES = 12
const FAIL_FRAMES = BONK_FRAMES + SIT_FRAMES
const PASS_FRAMES = 12
const COMMIT_FRAMES = 16
const BURSTS = [0, 6, 11]
const BURST_R = 5
const DONE_FLASH_FRAMES = 8
const DONE_ROLL_FRAMES = 16
const TURN_FRAMES = 4

const RED = '#e63946'
const SKIN = '#f6bd60'
const BROWN = '#8d5524'
const BLUE = '#2a6fdb'
const EYE = '#1d1d1d'
const GOLD = '#ffd60a'
const AMBER = '#ffb703'
const PALE = '#fff3b0'
const BLOCK = '#b5651d'
const PIPE = '#43aa8b'
const PIPE_RIM = '#95d5b2'
const PIPE_SHADE = '#2d6a4f'
const HILL = '#2f5d4a'
const GROUND = '#a0522d'
const MORTAR = '#6e3b1e'
const GROUND_DARK = '#7a4a24'
const BRICK_LIT = '#d4874a'
const BRICK_DARK = '#9c5a26'
const POLE = '#cfd8dc'
const FLAG = '#43aa8b'
const WHITE = '#ffffff'
const DUST = '#cfd8dc'
const GREY = '#8d99ae'
const GREY_DIM = '#6c757d'
const GREY_DARK = '#4a4e69'
const PALETTE = [RED, GOLD, PIPE, BLUE, BRICK_LIT]

/** The hero, 5×4: cap, face, shirt and overalls, legs (standing, or two running frames). */
const HERO = ['.RRRR', 'HFFEF', 'RBBBR']
const LEGS_STAND = '.S.S.'
const LEGS_RUN = ['SS..S', 'S..SS']
/** Sitting after the bonk, 5×3, his eyes shut. */
const SIT = ['.RRRR', 'HFXFF', 'SBBBS']
const HERO_COLORS = { R: RED, H: BROWN, F: SKIN, E: EYE, X: BROWN, B: BLUE, S: BROWN }
const HERO_GREY = { R: GREY, H: GREY_DIM, F: GREY, E: GREY_DARK, X: GREY_DARK, B: GREY_DIM, S: GREY_DIM }
/** A trailing agent, 3×4, in its own cap colour. */
const AGENT = ['.CC', 'HFF', 'CBC']
const AGENT_LEGS = ['SS.', '.SS']
const AGENT_CAPS = ['#43aa8b', '#f9c74f', '#4cc9f0', '#b56576']
/** A pipe, 2×3, a light rim over a shaded body. */
const PIPE_ART = ['RR', 'PD', 'PD']
const PIPE_COLORS = { R: PIPE_RIM, P: PIPE, D: PIPE_SHADE }
const PIPE_GREY = { R: GREY, P: GREY_DIM, D: GREY_DARK }
/** A coin's spin: its top and bottom pixel over four frames. */
const COIN: readonly (readonly [string, string])[] = [[GOLD, GOLD], [GOLD, AMBER], [PALE, PALE], [AMBER, GOLD]]
const BURST_DIRS = [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1], [0, -1]]
const BURST_COLORS = [
  [WHITE, GOLD, GOLD, RED, BRICK_DARK], [WHITE, PIPE_RIM, PIPE, PIPE, GREY_DIM], [WHITE, PALE, AMBER, RED, GREY_DIM],
]
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** Where he stands once in: the left third of the band. */
const homeX = (w: number) => Math.max(1, Math.floor(w / 3) - 2)
/** His left edge at `t`: in from the left edge a column a frame, then home. */
const heroX = (t: number, w: number) => Math.min(homeX(w), t - HERO_W)

/** The pipes in view at scroll offset `near`: the left column of each. */
function pipes(near: number, w: number): number[] {
  const out: number[] = []
  for (let k = Math.max(0, Math.floor((near - w - PIPE_JITTER) / PIPE_GAP)); k * PIPE_GAP <= near; k++) {
    const x = k * PIPE_GAP + Math.floor(noise(k) * PIPE_JITTER) + w - near
    if (x < w) out.push(x)
  }
  return out
}

/** His height over the ground: none while he is still walking in; the bonk and the sit on a failed
 * test, the jump over a pipe near him while a tool runs, the run's hop, the idle bounce. */
function heroY(t: number, s: Signals, hx: number, w: number, near: number, isFail: boolean): number {
  if (hx < homeX(w)) return 0
  if (isFail) return s.newsAge < BONK_FRAMES ? BONK[s.newsAge]! : 0
  if (s.act !== 'tool') return frame(BOUNCE, t)
  for (const px of pipes(near, w)) {
    const d = ARC_AHEAD - (px - hx)
    if (d >= 0 && d < ARC.length) return ARC[d]!
  }
  return mod(near, 4) < 2 ? 1 : 0
}

/** The far hills: a dim silhouette on pixel rows 4–5, row 5 always filled, drifting at `far`. */
function hills(cv: Canvas, far: number, color: string): void {
  for (let x = 0; x < cv.w; x++) {
    const u = x + far
    plot(cv, x, HILL_Y + 1, color)
    if (Math.sin(u * 0.21) + 0.5 * Math.sin(u * 0.47 + 1) > 0.2) plot(cv, x, HILL_Y, color)
  }
}

/** The mid bricks: single cells with a lit top edge along the top row, four to eight columns apart,
 * drifting at `mid`; none from `skipL` to `skipR` (the runners and the sign), so they only ever come
 * out at that zone's left edge. */
function bricks(cv: Canvas, mid: number, skipL: number, skipR: number, lit: string, dark: string): void {
  const span = Math.ceil((cv.w + 2) / BRICK_PITCH) * BRICK_PITCH
  for (let i = 0; i * BRICK_PITCH < span; i++) {
    const x = mod(i * BRICK_PITCH + Math.floor(noise(i + 50) * 3) - mid, span) - 1
    if (x < 0 || x >= cv.w || (x >= skipL && x < skipR)) continue
    plot(cv, x, 0, lit)
    plot(cv, x, 1, dark)
  }
}

/** Fireworks: three bursts from one centre, each a ring of sparks a pixel further out every frame. */
function fireworks(cv: Canvas, age: number, cx: number, cy: number): void {
  BURSTS.forEach((b0, b) => {
    const r = age - b0
    if (r < 1 || r > BURST_R) return
    for (const [dx, dy] of BURST_DIRS) plot(cv, cx + dx! * r, cy + dy! * r, BURST_COLORS[b]![r - 1]!)
  })
}

/** The sign ahead of his head: the news first, else the act, a dot while the act turns. */
function sign(
  s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean,
): { text: string; c: string } {
  if (isFail) return { text: '×', c: GREY }
  if (isPass) return { text: mod(t, 4) < 2 ? '★' : '☆', c: GOLD }
  if (isCommit) return { text: '✓', c: GOLD }
  if (age < TURN_FRAMES) return { text: '·', c: PALE }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + frame(['', '·', '··', '·'], t), c: GOLD }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: mod(t, 8) < 4 ? '♪' : '♫', c: PIPE_RIM }
  if (s.act === 'think') return { text: frame(['·', '··', '···', '··'], t >> 1), c: POLE }
  return { text: frame(['.', '..', '...'], t >> 2), c: POLE }
}

export function plumberScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const bash = isTool && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const age = Math.min(s.actAge, s.toolAge)
  /** The near layer's offset: a cell a frame while a tool runs, picking up where the slow scroll was. */
  const since = Math.min(s.actAge, t)
  const near = isTool ? ((t - since) >> 1) + since : t >> 1
  const rx = homeX(w)
  const hx = heroX(t, w)
  const hy = STAND_Y - heroY(t, s, hx, w, near, isFail)
  const sx = hx + SIGN_GAP
  const isHome = hx === rx
  const sitting = isFail && isHome && s.newsAge >= BONK_FRAMES
  const agents = Math.min(s.agents, MAX_AGENTS)
  const allDone = s.total > 0 && s.done >= s.total
  const poleX = allDone ? Math.max(w - POLE_FROM_RIGHT, w - 1 - s.doneAge) : -1

  // Layer 1: the hills, far and slow; layer 2: the ground, bricks and mortar scrolling with the pipes.
  hills(cv, near / 4, isFail ? GREY_DARK : HILL)
  for (let x = 0; x < w; x++) {
    plot(cv, x, GROUND_Y, isFail ? GREY_DIM : mod(x + near, 4) === 3 ? MORTAR : GROUND)
    plot(cv, x, GROUND_Y + 1, isFail ? GREY_DARK : GROUND_DARK)
  }
  for (const px of pipes(near, w)) draw(cv, px, HILL_Y, PIPE_ART, isFail ? PIPE_GREY : PIPE_COLORS)
  // The agents trailing him: the newest runs in from the left edge to the end of the line.
  const agentX = (i: number) => {
    const home = hx - AGENT_PITCH * (i + 1)
    return i === agents - 1 ? Math.min(home, s.agentsAge - AGENT_W) : home
  }
  const parked = agents > 0 && agentX(agents - 1) === hx - AGENT_PITCH * agents ? agents : Math.max(0, agents - 1)
  // Layer 3: the bricks, mid, behind everything that stands: none from the last parked runner's left
  // edge to past the sign.
  const skipL = hx - AGENT_PITCH * parked + 1
  bricks(cv, (near + 1) >> 1, skipL, sx + SIGN_W + 1, isFail ? GREY : BRICK_LIT, isFail ? GREY_DIM : BRICK_DARK)
  // Layer 4: the agents, each jogging in place out of step, the newest hopping a greeting as it arrives.
  for (let i = 0; i < agents; i++) {
    const ax = agentX(i)
    const arrived = s.agentsAge - (rx - AGENT_PITCH * (i + 1) + AGENT_W)
    let ay = 0
    if (isHome && i < parked) {
      const greeting = i === agents - 1 && arrived >= 0 && arrived < GREET.length
      ay = greeting ? GREET[arrived]! : mod(t + 2 * i + 2, 4) < 2 ? 1 : 0
    }
    const colors = isFail ? { ...HERO_GREY, C: GREY } : { ...HERO_COLORS, C: AGENT_CAPS[i]! }
    draw(cv, ax, STAND_Y - ay, [...AGENT, frame(AGENT_LEGS, (t >> 1) + i)], colors)
  }
  // Layer 5: the hero: sitting after the bonk, else standing or running, a flash of white on a pass.
  let heroColors: Record<string, string> = isFail ? HERO_GREY : HERO_COLORS
  if (isPass && mod(t, 2) === 0) heroColors = { ...HERO_COLORS, R: WHITE, B: WHITE }
  if (sitting) draw(cv, hx, GROUND_Y - 2, SIT, heroColors)
  else {
    const running = isTool || !isHome
    const legs = running ? frame(LEGS_RUN, bash ? near : near >> 1) : LEGS_STAND
    draw(cv, hx, hy, [...HERO, legs], heroColors)
    if (bash && hy === STAND_Y) plot(cv, hx - 1 - mod(t, 2), HILL_Y + 1 + mod(t, 2), DUST)
  }
  // Tasks: ? blocks (glyphs, below) and coins along the top right, the newest flashing, all rolling at 100%.
  const hudR = w - HUD_FROM_RIGHT
  const count = Math.min(s.total, Math.max(0, Math.floor((hudR - (rx + SIGN_GAP + HUD_GAP)) / HUD_PITCH) + 1))
  const lit = s.total > count ? Math.floor(s.done * count / s.total) : Math.min(s.done, count)
  const blocks: number[] = []
  for (let j = 0; j < count; j++) {
    const x = hudR - (count - 1 - j) * HUD_PITCH
    if (j >= lit) { blocks.push(x); continue }
    let [top, bottom] = frame(COIN, t + j)
    if (j === lit - 1 && s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0) [top, bottom] = [WHITE, WHITE]
    else if (allDone && s.doneAge < DONE_ROLL_FRAMES) top = bottom = frame(PALETTE, j + (s.doneAge >> 1))
    plot(cv, x, 0, top)
    plot(cv, x, 1, bottom)
  }
  // The flagpole at 100%: in from the right edge a cell a frame, then the flag runs down it.
  if (poleX >= 0) {
    for (let py = 0; py <= GROUND_Y; py++) plot(cv, poleX, py, POLE)
    plot(cv, poleX, 0, GOLD)
    if (s.doneAge >= FLAG_AT) {
      const fy = Math.min(2, s.doneAge - FLAG_AT)
      plot(cv, poleX - 1, fy, FLAG)
      plot(cv, poleX - 1, fy + 1, FLAG)
    }
  }
  if (isCommit) fireworks(cv, s.newsAge, poleX >= 0 ? poleX : w - 1, 1)

  const g = cells(cv)
  for (const x of blocks) put(g, x, 0, '?', { c: GOLD, bg: isFail ? GREY_DIM : BLOCK, b: true })
  // The bonk block over his head, white as he hits it, grey and used after; the dizzy star while he sits.
  if (isFail) {
    const hit = s.newsAge === 2
    put(g, hx + 1, 0, '?', { c: hit ? BLOCK : GREY, bg: hit ? WHITE : GREY_DIM, b: true })
    const star = frame(['✦', '✧'], s.newsAge >> 1)
    if (sitting) put(g, hx + 1 + frame([0, 1, 2, 1], s.newsAge), 1, star, { c: GOLD, b: true })
  }
  // The sign ahead of his head: a dot beside it the frame the act turns, rising into place next frame.
  const { text, c } = sign(s, t, age, isFail, isPass, isCommit)
  put(g, sx, age === 0 ? 1 : 0, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  return g
}

/** A mushroom: a red cap with white spots over a stem that carries the face. */
export const PET: PetArt = {
  body: ['....RRRR....', '..RWWRRWWR..', '.RRRRRRRRRR.', '..FFFFFFFF..', '...FFFFFF...'],
  step: ['....RRRR....', '..RWWRRWWR..', '.RRRRRRRRRR.', '..FFFFFFFF..', '..FFFFFF....'],
  colors: { R: RED, W: WHITE, F: SKIN },
  eyes: [4, 7],
  eyeRow: 3,
  eye: EYE,
  lid: SKIN,
  mouth: [5, 4],
  blush: '#ff8fab',
  spark: GOLD,
}

export const PLUMBER: Theme = {
  name: 'plumber',
  rows: SCENE_ROWS,
  color: RED,
  accent: GOLD,
  sprite: {
    think: ['[o   ]', '[ o  ]', '[  o ]', '[   o]', '[  o ]', '[ o  ]'],
    tool: ['[o  ■]', '[ o ■]', '[  o■]', '[ o ■]'],
    say: ['[o  ♪]', '[o  ♫]'],
    wait: ['[o.  ]', '[o.. ]', '[o...]'],
  },
  happy: '[o ★]',
  sad: '[o …]',
  dead: '[x   ]',
  sleep: '[o   ] zZ',
  confetti: ['●', '■', '★', '·', '+'],
  palette: PALETTE,
  scene: plumberScene,
  pet: PET,
}
