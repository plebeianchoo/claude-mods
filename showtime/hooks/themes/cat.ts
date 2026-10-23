// Theme: cat. Its scene, its words and its pet.
//
// The scene: a pink cat walks across a still meadow (the camera does not pan) with its ball
// rolling ahead, blossoms drifting back along the top row. What it is doing shows twice: as a
// sign over its head (dots thinking, the tool's mark, `?`, a note) and as the trail it sheds
// behind it on the top row (puffs, sparks, dust, notes), drifting back and fading. Tasks are a
// row of hearts at the top right, `done` of them lit; agents bob at the right edge
// (withReactions). A failed test greys the cat and stops its ball and its trail; a passed test
// showers hearts along the top row; a commit runs a gold ripple along the ground under the sparks.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may
// start more than one column from a run start in the frame before (same or adjacent row). A
// scrolling ground cannot meet that (a dot touching the cat's tail parts from it at two columns
// a frame whenever the cat steps), so the ground stays put and only shimmers. The cat moves at
// most a column a frame, walks by alternating its body glyph, and keeps a blank cell behind its
// tail so its run has its own start, next to which the trail is shed; trail glyphs drift left a
// column every two frames; blossoms drift left a column a frame, hidden over the cat's head so
// they never touch the sign; the sign sits over the gap before the ball, so it may blink; the
// ball hops between rows in its own column.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const PINK = '#ffb3c6'
const ROSE = '#ff8fab'
const GOLD = '#ffd166'
const LILAC = '#cdb4db'
const SKY = '#a2d2ff'
const GRASS = '#7fb069'
const GRASS_LIGHT = '#a3c585'
const GREY = '#9a9a9a'
const PALETTE = [PINK, GOLD, LILAC, SKY, ROSE]
/** The body alternates every two frames: a four-frame step cycle. */
const CAT_FRAMES = ['ᓚᘏᗢ', 'ᓚᘎᗢ']
/** The tail flicks up for two frames every twelve. */
const TAIL_UP = 'ᓗ'
const BALL_FRAMES = ['◐', '◓', '◑', '◒']
const GROUND = ['.', '˙', ',', '·']
const BLOSSOMS = ['✿', '❀']
const SPEED = 0.6
const CAT_W = 3
/** Where the ball rolls, from the cat's tail; the sign sits over the gap just before it. */
const BALL_DX = 4
/** A trail glyph is shed every SHED frames and lives TRAIL_LIFE frames: at most two on screen. */
const SHED = 6
const TRAIL_LIFE = 12
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** Per act: the sign over the head (cycling four frames each), the three stages of its trail, their color. */
const ACTS: Record<Act, { sign: readonly string[]; trail: readonly string[]; c: string }> = {
  think: { sign: ['·', '∘', '°', '∘'], trail: ['°', '∘', '·'], c: LILAC },
  tool: { sign: ['✦'], trail: ['✦', '✧', '·'], c: GOLD },
  ask: { sign: ['?', '?', '?', ' '], trail: ['˙', '·', '·'], c: GOLD },
  say: { sign: ['♪', '♫'], trail: ['♪', '♫', '·'], c: SKY },
  wait: { sign: ['.', '·', '˙', '·'], trail: ['·', '·', '˙'], c: '#b8b8be' },
}
const TOOL_SIGN: Record<ToolKind, string> = { bash: '⌁', edit: '✎', read: '≡', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦' }

/** The cat's tail column at frame `t`: a lap across the width and off both edges. */
function catX(t: number, w: number): number {
  return mod(Math.floor(t * SPEED), w + 8) - 6
}

export function catScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const act = ACTS[s.act]
  const cx = catX(t, w)
  // Layer 1: the meadow, a still pattern of dim dots that shimmer in place; a gold ripple runs
  // along it while a commit lands.
  for (let x = 0; x < w; x++) {
    if (x === cx - 1 || x === cx + CAT_W || noise(x + 31) < 0.55) continue
    const sway = Math.floor(noise(x + 57) * 4) + (t >> 3)
    const gold = committing && mod(x + s.newsAge, 4) === 0
    put(g, x, 1, gold ? '✦' : frame(GROUND, sway), { c: gold ? GOLD : frame([GRASS, GRASS_LIGHT], sway), d: !gold })
  }
  // Layer 2: blossoms drifting left along the top row, hidden over the cat's head.
  for (let i = 0; i < Math.max(1, Math.floor(w / 12)); i++) {
    const x = mod(Math.floor(noise(i + 11) * w * 2) - t, w)
    if (x > cx && x <= cx + BALL_DX) continue
    put(g, x, 0, frame(BLOSSOMS, (t >> 2) + i), { c: SKY, d: true })
  }
  // Layer 3: the trail, shed over the tail and drifting back; glyphs older than the act fade neutral.
  for (let i = 0; i < 2; i++) {
    const shedAt = t - mod(t, SHED) - i * SHED
    const age = t - shedAt
    if (age >= TRAIL_LIFE) continue
    const stage = Math.min(2, Math.floor(age / 4))
    const old = age > s.actAge || failing
    put(g, catX(shedAt, w) - (age >> 1), 0, old ? '·' : act.trail[stage]!, { c: failing ? GREY : act.c, d: old || stage === 2 })
  }
  // Layer 4: the cat stepping with its tail flicking, its ball rolling ahead (hopping while a tool runs).
  const catColor = failing ? GREY : passing ? frame([PINK, '#ffffff'], t >> 1) : frame([PINK, '#ffc8dd'], t >> 1)
  let cat = frame(CAT_FRAMES, t >> 1)
  if (mod(t, 12) < 2) cat = TAIL_UP + cat.slice(1)
  put(g, cx, 1, cat, { c: catColor, b: true })
  const hopEvery = s.tool === 'bash' ? 4 : 8
  const hop = s.act === 'tool' && !failing && mod(t, hopEvery) < 2
  put(g, cx + BALL_DX, hop ? 0 : 1, failing ? '◒' : frame(BALL_FRAMES, t >> 1), { c: failing ? GREY : GOLD })
  // The sign over the head: grows in over four frames after the act changes; `×` on a failed test.
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, t >> 2)
  if (s.actAge < 4) sign = s.actAge < 2 ? '·' : '˙'
  if (failing) sign = '×'
  else if (passing) sign = '♥'
  put(g, cx + CAT_W, 0, sign, { c: failing ? GREY : passing ? ROSE : act.c, b: s.act !== 'think' })
  // A passed test: hearts shower along the top row, drifting left, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) if (mod(x + s.newsAge, 5) === 0) put(g, x, 0, s.newsAge < 10 ? '♥' : '♡', { c: frame([ROSE, GOLD], Math.floor((x + s.newsAge) / 5)), d: s.newsAge >= 10 })
  }
  // Tasks: a row of hearts at the top right, left of the agents, `done` of them lit; the newest twinkles.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const lit = i < s.done
    const newest = lit && i === s.done - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : lit ? '♥' : '♡'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : newest && glyph === '✦' ? GOLD : lit ? ROSE : PINK
    put(g, x0 + i, 0, glyph, { c, b: lit, d: !lit })
  }
  return withReactions(g, t, s, ROSE)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: PINK, L: PINK, D: PINK }, lid: PINK }

export const CAT: Theme = {
  name: 'cat',
  rows: 2,
  sleep: '(=－ω－=) zZ',
  color: PINK,
  accent: GOLD,
  sprite: {
    think: ['(=^･ω･^=)   ', '(=^･ω･^=) ? ', '(=^-ω-^=) ? ', '(=^･ω･^=) ?!'],
    tool: ['ฅ(=^･ω･^=) ', ' (=^･ω･^=)ฅ', 'ฅ(=^･ω･^=)ฅ'],
    say: ['(=^･ω･^=)ﾉ ♪', '(=^･ω･^=)ﾉ  ♫', '(=^▽^=)ﾉ ♪'],
    wait: ['(=^･ω･^=) .  ', '(=^･ω･^=) .. ', '(=^･ω･^=) ...'],
  },
  happy: '(=^▽^=)ﾉ',
  sad: '(=；ω；=)',
  dead: '(=×ω×=)',
  confetti: ['✿', '♡', '*', '·', '✦'],
  palette: PALETTE,
  scene: catScene,
  pet: PET,
}
