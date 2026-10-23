// Theme: dino. Its scene, its words and its pet.
//
// The scene: the offline-page runner, a kaomoji dino running in place at the left while the desert
// scrolls toward it: ground grit on the bottom row a column a frame, cacti with it (some of them
// doubled) that the dino hops over, wisps of cloud drifting along the top row at a third of the
// speed and thinning out before they reach the dino. What it is doing shows in its face (per-act face with a
// blink), its arms (swapped every two frames, a dust puff cycling behind its heels) and a sign
// floating ahead of it (an ASCII spinner thinking, the tool's mark, `?`, chevrons talking). A HI
// score counts the frames at the top right, left of the tasks: a row of diamonds with `done` of
// them lit; agents bob at the right edge (withReactions), a spark greeting the newest. A failed
// test greys the dino and the cacti and crosses its eyes; a passed test glows it and sweeps stars
// along the sky; a commit turns the ground and the cacti gold under the spark burst.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may
// start more than one column from a run start in the frame before (same or adjacent row). The
// dino never moves a column, so the ground and the cacti may scroll a column a frame past it:
// anything they hide under it comes out next to its own run start. The hop between rows is
// allowed (the test matches adjacent rows), and the dino is in the air whenever a cactus is within
// a cell of it, so the two never touch on a row. Grit touching the dino merges into its run and
// would be left without a run start of its own when the dino takes off, so the ground under the
// dino and the cell past its tail is a bare lane: grit begins at the column after it and only the
// cacti cross it. The dust puff sits on the cell before the dino's heels, at column 1, where the
// test exempts whatever merges with it; cacti vanish before that column. The sign
// keeps a fixed column with a clear cell before it; clouds are a single cell (a two-cell cloud
// parting from the score or the task marks would leave their run start two columns from its own)
// and vanish short of the sign, since one passing behind it would come out two columns from any
// run start. The score and the dino's body have no inner gaps a cloud could show through.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const SAND = '#e9c46a'
const CACTUS = '#2a9d8f'
const ORANGE = '#f4a261'
const RED = '#e76f51'
const GOLD = '#ffd166'
const SKY = '#adb5bd'
const DUST = '#8d99ae'
const GREY = '#9a9a9a'
const WHITE = '#f1faee'
const PALETTE = [SAND, CACTUS, ORANGE, RED]
const RX = 2
const DINO_W = 5
const SIGN_X = RX + DINO_W + 1
/** The ground under the dino (and the cell past its tail) carries no grit: a bare lane. */
const LANE_END = RX + DINO_W + 1
/** Clouds vanish left of this column, so none passes behind the sign. */
const SKY_X = SIGN_X + 2
const CACTUS_GAP = 24
const ARMS = ['ᕕ', 'ᕕ', 'ᕙ', 'ᕙ']
const DUST_PUFF = ['.', '·', '˚', ' ']
const BASH_PUFF = ['*', '·', '˚', ' ']
const GRIT = ['_', '.', '_', ',']
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
const IDLE_AGE = 999
/** Per act: the face, the sign ahead of the dino (four frames each), its color. */
const ACTS: Record<Act, { face: string; sign: readonly string[]; c: string }> = {
  think: { face: 'ᐛ', sign: ['|', '/', '-', '\\'], c: SKY },
  tool: { face: '•', sign: ['✦', '✧', '✦', '·'], c: ORANGE },
  ask: { face: '◦', sign: ['?', '?', '?', '˙'], c: GOLD },
  say: { face: 'ω', sign: ['»', '›', '·', '›'], c: CACTUS },
  wait: { face: '˘', sign: ['.', '·', '˙', '·'], c: DUST },
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** The cacti in view at frame `t`: the column of each, and whether it is a double one. */
function cacti(t: number, w: number): { x: number; wide: boolean }[] {
  const out: { x: number; wide: boolean }[] = []
  for (let k = Math.max(0, Math.floor((t - w - 10) / CACTUS_GAP)); k * CACTUS_GAP <= t; k++) {
    const x = k * CACTUS_GAP + Math.floor(noise(k) * 10) + w - t
    const wide = noise(k + 7) > 0.6
    if (x < w) out.push({ x, wide })
  }
  return out
}

export function dinoScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  const age = Math.min(s.actAge, s.toolAge)
  const since = age < IDLE_AGE ? age : t
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  // Layer 1: the ground, sparse grit scrolling left a column a frame; it streaks while bash runs
  // and turns gold on a commit.
  for (let x = LANE_END; x < w; x++) {
    const n = noise(x + t)
    if (n < 0.78) continue
    const style = committing ? { c: GOLD, b: true } : { c: DUST, d: true }
    put(g, x, 1, frame(GRIT, Math.floor(n * 40)), style)
    if (bash && x > LANE_END) put(g, x - 1, 1, '_', style)
  }
  // Layer 2: clouds drifting left along the sky at a third of the speed, gone before the sign.
  for (let i = 0; i < Math.max(1, Math.floor(w / 16)); i++) {
    const x = mod(Math.floor(noise(i + 11) * w * 3) - Math.floor(t / 3), w + 8) - 4
    if (x < SKY_X) continue
    put(g, x, 0, '~', { c: SKY, d: true })
  }
  // A passed test: stars sweep right along the sky, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) {
      if (mod(x - s.newsAge, 6) !== 0) continue
      const c = frame(PALETTE, Math.floor((x - s.newsAge) / 6))
      put(g, x, 0, s.newsAge < 10 ? '*' : '+', { c, d: s.newsAge >= 10 })
    }
  }
  // Layer 3: the cacti, scrolling with the ground; grey on a failed test, gold on a commit.
  let near = false
  for (const { x, wide } of cacti(t, w)) {
    if (x < RX) continue
    const c = failing ? GREY : committing ? GOLD : CACTUS
    put(g, x, 1, wide ? 'ψψ' : 'ψ', { c, b: !failing })
    if (x <= RX + DINO_W) near = true
  }
  // Layer 4: the dino, running in place: arms swapped every two frames, a dust puff cycling behind
  // its heels, a blink every sixteen frames; it hops to the sky over a cactus and once, briefly,
  // when the act changes.
  const airborne = near || (age >= 1 && age <= 2)
  const row = airborne ? 0 : 1
  const blink = mod(t, 16) < 2 && !failing && !passing
  const face = failing ? '×' : passing ? 'ᐛ' : blink ? '-' : act.face
  const arm = airborne ? 'ᕙ' : failing ? 'ᕕ' : frame(ARMS, t)
  const color = failing ? GREY : passing ? frame([SAND, WHITE], t >> 1) : SAND
  put(g, RX, row, `${arm}(${face})ᕗ`, { c: color, b: true })
  if (!airborne && !failing) {
    put(g, RX - 1, 1, frame(bash ? BASH_PUFF : DUST_PUFF, t), bash ? { c: ORANGE } : { c: DUST, d: true })
  }
  // The sign ahead of the dino: grows in over four frames after the act or tool changes; `×` on a
  // failed test, `★` on a passed one, `✓` on a commit. The cell before it stays clear.
  put(g, SIGN_X - 1, 0, ' ')
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, since >> 2)
  let style = { c: act.c, b: age >= 4 && s.act !== 'think', d: age === 2 }
  if (age < 2) sign = age === 0 ? '·' : '∘'
  if (failing) [sign, style] = ['×', { c: GREY, b: true, d: false }]
  else if (passing) [sign, style] = ['★', { c: GOLD, b: true, d: false }]
  else if (committing) [sign, style] = ['✓', { c: CACTUS, b: true, d: false }]
  put(g, SIGN_X, 0, sign, style)
  // The HI score at the top right, left of the tasks, when there is room; it flashes on a passed test.
  const score = `HI ${String(mod(t, 100000)).padStart(5, '0')}`
  const sx = x0 - 2 - score.length
  const flash = passing && mod(t, 4) < 2
  if (sx >= SKY_X + 2) put(g, sx, 0, score, flash ? { c: GOLD, b: true } : { c: SKY })
  // Tasks: a row of diamonds at the top right, left of the agents, `done` of them lit; the newest twinkles.
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const lit = i < s.done
    const newest = lit && i === s.done - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : lit ? '◆' : '◇'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '✦' ? GOLD : lit ? SAND : DUST
    put(g, x0 + i, 0, glyph, { c, b: lit, d: !lit })
  }
  // A new agent: a spark on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    put(g, w - 2 - i * 2, mod(t + i * 3, 8) < 4 ? 0 : 1, frame(['*', '+'], s.agentsAge >> 1), { c: ORANGE })
  }
  return withReactions(g, t, s, ORANGE)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: SAND, L: SAND, D: SAND }, lid: SAND }

export const DINO: Theme = {
  name: 'dino',
  rows: 2,
  sleep: 'ᕕ(-ᐛ-)ᕗ zZ',
  color: SAND,
  accent: CACTUS,
  sprite: {
    think: ['ᕕ(ᐛ)ᕗ   ', 'ᕕ(ᐛ)ᕗ ? ', 'ᕕ( ᐛ)ᕗ ?'],
    tool: ['ᕕ(ᐛ)ᕗ  ψ', 'ᕕ(ᐛ)ᕗ ψ ', ' ᕕ(ᐛ)ᕗψ '],
    say: ['ᕕ(ᐛ)ᕗ ε=', 'ᕕ(ᐛ)ᕗε=ε='],
    wait: ['ᕕ(ᐛ)ᕗ .  ', 'ᕕ(ᐛ)ᕗ .. ', 'ᕕ(ᐛ)ᕗ ...'],
  },
  happy: 'ヽ(ᐛ)ノ',
  sad: '(ᐛ；)',
  dead: '(×ᐛ×)',
  confetti: ['ψ', '*', '+', '·', '✦'],
  palette: PALETTE,
  scene: dinoScene,
  pet: PET,
}
