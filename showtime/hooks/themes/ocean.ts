// Theme: ocean. Its scene, its words and its pet.
//
// The scene: a fish `><(((º>` swims in place at the left of the bottom row against a current that
// carries everything else leftward: single-cell wave crests `~`/`≈` along the top row a column a
// frame with a bright foam crest every fifth, gulls gliding over them at a third of the speed,
// plankton drifting below at half speed and a small fish `<><` passing at full speed now and then,
// eaten when it reaches the mouth.
// What the turn is doing shows in the fish's eye and mouth (per act, with a blink), its tail (flicked
// every two frames, a scale glinting along its side) and a sign over its mouth (a bubble spinner
// thinking, the tool's mark with a blub, `?`, notes, dots waiting) that bubbles up over four frames
// after the act changes. Bubbles rise from its mouth to pop at the surface. Tasks are a row of pearls
// at the top right, `done` of them lit, left of the agent figures (withReactions), a bubble greeting
// the newest. A failed test greys the sea and crosses the fish's eye under `×` and the shake; a
// passed test glows the fish and sends a bubble storm up through the sea under `★`; a commit turns
// the crests and the plankton gold under `✓` and the spark burst; bash speeds the current and the
// tail, doubles the bubbles and shows `$`.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same or adjacent row). Everything that
// moves goes left, a column a frame at most: a run moving left may pass behind a still one (the fish,
// the sign, the pearls, a figure) and come out contiguous with it, a column from its start, where one
// moving right would reappear two columns past its end. The crests are single cells three apart, so
// a still mark that a crest leaves starts a column from where that crest was (a wider crest would
// leave it two or more); but a crest bridging two slow things a cell apart would leave the right one
// two columns from the left one's start, so the gulls vanish short of the sign. The fish never moves
// a column: a retreat would uncover whatever lay under its mouth, far from any run start; the lane
// under it and past its mouth carries no plankton for the same reason. Bubbles leave the mouth
// upward, from the cell after it (contiguous with the fish) to
// the same column on the surface (contiguous with the sign), never rightward.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const CYAN = '#48cae4'
const FOAM = '#caf0f8'
const AMBER = '#ffb703'
const ORANGE = '#fb8500'
const GOLD = '#ffd166'
const DEEP = '#5390d9'
const GREY = '#9a9a9a'
const WHITE = '#ffffff'
const PALETTE = [CYAN, FOAM, AMBER, ORANGE]
const FX = 1
const FISH_W = 7
/** The sign hangs over the mouth; bubbles leave from the cell after it. */
const SIGN_X = FX + FISH_W - 1
const MOUTH_X = FX + FISH_W
/** No plankton under the fish or past its mouth: a bare lane. */
const LANE_END = MOUTH_X + 2
/** Gulls vanish left of this column: one parked two cells from the sign or the surface bubble, with a
 * crest between them, would leave the sign a run start two columns from its own when the crest moved on. */
const SKY_X = MOUTH_X + 3
const TAIL = ['><', '><', '=<', '=<']
/** A bubble's life, two frames a stage: at the mouth, at the surface, popping. */
const BUBBLE = ['o', 'o', '°', '°', '˚', '˚']
const BUBBLE_CYCLE = 12
const GULL = ['v', 'v', 'V', 'V']
const PLANKTON = ['·', '∘', '·', '.']
/** The sign bubbling up over the frames after the act or tool changes; the fourth is the new sign, dim. */
const GROW = ['·', '∘', '○']
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** `IDLE_SIGNALS.actAge`: an age this large means no change is known. */
const IDLE_AGE = 999
/** Per act: the eye, the mouth cycle (four frames each), the sign cycle and its frames per step, its colour. */
type ActArt = { eye: string; mouth: readonly string[]; sign: readonly string[]; rate: number; c: string }
const ACTS: Record<Act, ActArt> = {
  think: { eye: 'º', mouth: ['>'], sign: ['·', '∘', '○', '∘'], rate: 4, c: FOAM },
  tool: { eye: '•', mouth: ['>'], sign: ['✦', '✦', '✦', '°'], rate: 2, c: AMBER },
  ask: { eye: '○', mouth: ['>'], sign: ['?', '?', '?', '·'], rate: 4, c: GOLD },
  say: { eye: 'º', mouth: ['>', ')'], sign: ['♪', '♪', '♫', '♫'], rate: 2, c: ORANGE },
  wait: { eye: '-', mouth: ['>'], sign: ['.', '·', '˙', '·'], rate: 4, c: CYAN },
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

export function oceanScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  const age = Math.min(s.actAge, s.toolAge)
  const since = age < IDLE_AGE ? age : t
  // Layer 1: the surface, single-cell crests three apart scrolling left a column a frame, every fifth
  // bright foam; grey on a failed test, gold on a commit.
  for (let x = 0; x < w; x++) {
    if (mod(x + t, 3) !== 0) continue
    const k = Math.floor((x + t) / 3)
    const foam = mod(k, 5) === 0
    const c = failing ? GREY : committing ? GOLD : foam ? FOAM : CYAN
    put(g, x, 0, k % 2 ? '≈' : '~', { c, b: foam && !failing, d: !foam || failing })
  }
  // Layer 2: gulls gliding left over the surface at a third of the speed, wings flapped every four
  // frames, gone before they reach the fish.
  for (let i = 0; i < Math.max(1, Math.floor(w / 24)); i++) {
    const x = mod(Math.floor(noise(i + 5) * w * 3) - Math.floor(t / 3), w + 6) - 3
    if (x >= SKY_X) put(g, x, 0, frame(GULL, (t >> 2) + i), { c: failing ? GREY : FOAM })
  }
  // Layer 3: plankton drifting left along the bottom at half speed (full speed, streaked, while bash
  // runs), clear of the lane under the fish.
  const drift = bash ? t : t >> 1
  for (let i = 0; i < Math.max(2, Math.floor(w / 8)); i++) {
    const x = mod(Math.floor(noise(i + 17) * w * 2) - drift, w)
    if (x < LANE_END) continue
    const c = failing ? GREY : committing ? GOLD : DEEP
    put(g, x, 1, frame(PLANKTON, i), { c, d: !committing })
    if (bash) put(g, x + 1, 1, '·', { c: CYAN, d: true })
  }
  // Layer 4: a small fish passing left at a column a frame, now and then, eaten when it reaches the mouth.
  const px = w - 1 - mod(t, w + 24)
  if (px > MOUTH_X) put(g, px, 1, '<><', { c: failing ? GREY : ORANGE, d: failing })
  // A passed test: a bubble storm rises through the sea with the current, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) {
      if (mod(x + s.newsAge, 5) !== 0) continue
      if (s.newsAge < 8 && x >= LANE_END) put(g, x, 1, 'o', { c: FOAM, b: true })
      if (s.newsAge >= 4 && x !== SIGN_X) {
        const c = frame([FOAM, GOLD, CYAN], Math.floor((x + s.newsAge) / 5))
        put(g, x, 0, '°', { c, d: s.newsAge >= 10 })
      }
    }
  }
  // Layer 5: the fish, swimming in place: tail flicked every two frames (every frame on bash), per-act
  // eye and mouth, a blink every sixteen frames and eyes shut for two frames when the act changes, a
  // scale glinting along its side.
  const blink = (mod(t, 16) < 2 || age < 2) && !failing && !passing
  const eye = failing ? '×' : passing ? '^' : blink ? '-' : act.eye
  const mouth = frame(act.mouth, t >> 2)
  const tail = failing ? '><' : frame(TAIL, bash ? t << 1 : t)
  const color = failing ? GREY : passing ? frame([AMBER, WHITE], t >> 1) : AMBER
  put(g, FX, 1, `${tail}(((${eye}${mouth}`, { c: color, b: !failing })
  put(g, FX + 5, 1, eye, { c: failing ? GREY : FOAM, b: true })
  if (!failing) put(g, FX + 2 + mod(t >> 2, 3), 1, '(', { c: passing ? WHITE : FOAM, b: true })
  // Bubbles from the mouth: `o` at the mouth, `°` then `˚` popping at the surface, two frames each,
  // every twelve; a second stream while bash runs.
  for (let i = 0; i < (bash ? 2 : 1); i++) {
    const a = mod(t + i * 6, BUBBLE_CYCLE)
    if (a < BUBBLE.length && !failing) put(g, MOUTH_X, a < 2 ? 1 : 0, BUBBLE[a]!, { c: FOAM, d: a >= 4 })
  }
  // The sign over the mouth: bubbles up over the four frames after the act or tool changes (`·`, `∘`,
  // `○`, then the new sign dim), then cycles from that change (from `t` when none is known); the tool's
  // mark blubs every eighth frame; `×` on a failed test, `★` on a passed one, `✓` on a commit.
  const mark = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : undefined
  let sign = mark ? frame([mark, mark, mark, '°'], since >> 1) : frame(act.sign, Math.floor(since / act.rate))
  if (age < GROW.length) sign = GROW[age]!
  let style = { c: act.c, b: age > GROW.length && s.act !== 'think', d: age === GROW.length }
  if (failing) [sign, style] = ['×', { c: GREY, b: true, d: false }]
  else if (passing) [sign, style] = ['★', { c: GOLD, b: true, d: false }]
  else if (committing) [sign, style] = ['✓', { c: GOLD, b: true, d: false }]
  put(g, SIGN_X, 0, sign, style)
  // Tasks: a row of pearls at the top right, left of the agents, `done` of them lit (floor-scaled when
  // more than fit), the newest twinkling; all roll colours when the last lands.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW - (SIGN_X + 2)))
  const lit = s.total > count ? Math.floor((s.done * count) / s.total) : Math.min(s.done, count)
  const x0 = w - 1 - agentsW - count
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const on = i < lit
    const newest = on && i === lit - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : on ? '●' : '○'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '✦' ? GOLD : on ? FOAM : CYAN
    put(g, x0 + i, 0, glyph, { c, b: on, d: !on })
  }
  // A new agent: a bubble greeting on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    const row = mod(t + i * 3, 8) < 4 ? 0 : 1
    put(g, w - 2 - i * 2, row, frame(['°', 'o'], s.agentsAge >> 1), { c: FOAM, b: true })
  }
  return withReactions(g, t, s, AMBER)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: AMBER, L: AMBER, D: AMBER }, lid: AMBER }

export const OCEAN: Theme = {
  name: 'ocean',
  rows: 2,
  sleep: '><(((-> zZ',
  color: AMBER,
  accent: CYAN,
  sprite: {
    think: ['><(((º>   ', '><(((º> o ', '><(((º>  °'],
    tool: ['><(((º>~  ', '><(((º>≈≈ ', '><(((º>~≈~'],
    say: ['><(((º> ♪', '><(((º>  ♫'],
    wait: ['><(((º> .  ', '><(((º> .. ', '><(((º> ...'],
  },
  happy: '><(((º> ♪',
  sad: '><(((;>',
  dead: '><(((×>',
  confetti: ['°', 'o', '~', '≈', '·'],
  palette: PALETTE,
  scene: oceanScene,
  pet: PET,
}
