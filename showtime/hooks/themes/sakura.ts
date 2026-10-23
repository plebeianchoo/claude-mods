// Theme: sakura. Its scene, its words and its pet.
//
// The scene: a kaomoji strolls under falling cherry blossom. Petals drift back along the top row at
// two speeds; fallen petals carpet the bottom row and stir in place (the camera does not pan). What
// the figure is doing shows in its face (per-act eyes and mouth, a blink) and in a thought bubble
// over its head (dots thinking, the tool's mark, `?`, a note), with a ribbon fluttering behind it.
// Tasks are a row of blossoms at the top right, `done` of them open; agents bob at the right edge
// (withReactions), a petal greeting the newest. A failed test greys the figure and the sky and gives
// it tears; a passed test glows it and showers petals along the top row; a commit makes the whole
// carpet bloom under the spark burst; bash streaks the petals.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may
// start more than one column from a run start in the frame before (same or adjacent row). So the
// carpet stays put and only changes glyph (a scrolling ground parts from the walker at two columns
// a frame), petals drift a column a frame or every other frame, and the figure steps a column every
// fourth frame. The cells before its face and after its ribbon stay clear so its run keeps its own
// start, and the ribbon is never blank so the run never splits. The bubble sits over the right eye,
// within a column of the face's last run start on the row below, so it may blink or grow in; petals
// pass behind it and behind the blossom row, and come out a column from where they went in.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const PINK = '#ffb7c5'
const ROSE = '#ff8fab'
const DEEP = '#fb6f92'
const BLUSH = '#ffc2d1'
const CREAM = '#ffe5ec'
const MAUVE = '#c98da8'
const LEAF = '#95d5b2'
const GOLD = '#ffd166'
const SKY = '#a2d2ff'
const GREY = '#9a9a9a'
const PALETTE = [PINK, ROSE, DEEP, CREAM]
const PETALS = ['✿', '❀', '❁', '·']
const CARPET = ['.', '·', ',', '˙']
/** The ribbon behind the figure, two frames each: a four-frame step cycle. */
const RIBBON_FRAMES = ['~', '-']
/** The bubble growing in over the four frames after the act or tool changes; the fourth is the new sign, dim. */
const GROW_FRAMES = ['·', '∘', '○']
/** `(˶ᵔ ᵕ ᵔ˶)` and its ribbon. */
const FACE_W = 9
const FIG_W = FACE_W + 1
/** The bubble's column from the face's left bracket: over the right eye. */
const BUBBLE_DX = 6
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** Per act: the eyes, the mouth cycle (four frames each), the bubble (four frames each), its color. */
const ACTS: Record<Act, { eye: string; mouth: readonly string[]; sign: readonly string[]; c: string }> = {
  think: { eye: '•', mouth: ['ᵕ'], sign: ['·', '∘', '○', '∘'], c: SKY },
  tool: { eye: 'ᵔ', mouth: ['ᴗ', 'ω', 'ᴗ', 'ᵕ'], sign: ['✧'], c: GOLD },
  ask: { eye: '◦', mouth: ['ᵕ'], sign: ['?', '?', '?', ' '], c: GOLD },
  say: { eye: 'ᵔ', mouth: ['ᵕ', 'ω', 'ᵕ', 'ᴗ'], sign: ['♪', '♫'], c: PINK },
  wait: { eye: '-', mouth: ['ᵕ'], sign: ['.', '·', '˙', '·'], c: '#b8b8be' },
}
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '≡', search: '⌕', agent: 'ᗣ', web: '◎', other: '✧' }

/** The face's left bracket column at frame `t`: a lap from off the left edge to off the right, a column per four frames. */
function figureX(t: number, w: number): number {
  return mod(Math.floor(t / 4), w + FIG_W + 2) - (FIG_W + 1)
}

export function sakuraScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  const fx = figureX(t, w)
  // Layer 1: the carpet of fallen petals, a still pattern that stirs in place; it blooms while a commit lands.
  for (let x = 0; x < w; x++) {
    if (x === fx - 1 || x === fx + FIG_W || noise(x + 31) < 0.5) continue
    const stir = Math.floor(noise(x + 57) * 4) + (t >> 3)
    if (committing) put(g, x, 1, frame(['✿', '❀'], stir), { c: frame(PALETTE, x + (s.newsAge >> 1)), b: s.newsAge < 10, d: s.newsAge >= 10 })
    else put(g, x, 1, frame(CARPET, stir), { c: frame([MAUVE, BLUSH], stir), d: true })
  }
  // Layer 2: petals drifting left along the top row, half of them at half speed; grey while a test
  // fails, streaking while bash runs.
  for (let i = 0; i < Math.max(1, Math.floor(w / 10)); i++) {
    const x = mod(Math.floor(noise(i + 11) * w * 2) - (i % 2 ? t : t >> 1), w)
    put(g, x, 0, frame(PETALS, (t >> 3) + i), { c: failing ? GREY : frame(PALETTE, i), d: failing })
    if (bash) put(g, x + 1, 0, '·', { c: BLUSH, d: true })
  }
  // A passed test: petals shower along the top row, drifting left, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) if (mod(x + s.newsAge, 5) === 0) put(g, x, 0, s.newsAge < 10 ? '✿' : '·', { c: frame([ROSE, CREAM, GOLD], Math.floor((x + s.newsAge) / 5)), d: s.newsAge >= 10 })
  }
  // Layer 3: the figure, stepping a column every four frames; it blinks every sixteen frames and
  // closes its eyes for the first two frames after the act changes.
  const age = Math.min(s.actAge, s.toolAge)
  const blink = mod(t, 16) < 2 || age < 2
  const eye = failing ? ';' : passing ? 'ᵔ' : blink ? '-' : act.eye
  const mouth = failing ? 'ᴖ' : passing ? frame(['ᵕ', 'ω'], t >> 1) : frame(act.mouth, t >> 2)
  const color = failing ? GREY : passing ? frame([CREAM, '#ffffff'], t >> 1) : frame([PINK, BLUSH], t >> 1)
  put(g, fx, 1, `(˶${eye} ${mouth} ${eye}˶)`, { c: color, b: true })
  put(g, fx + FACE_W, 1, bash ? '≈' : frame(RIBBON_FRAMES, t >> 1), { c: failing ? GREY : ROSE })
  // The thought bubble: grows in over four frames after the act or tool changes, then cycles from
  // that change (from `t` when no change is known); `×` on a failed test, `♥` on a passed one, `✓` on a commit.
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, (age < 999 ? age : t) >> 2)
  if (age < GROW_FRAMES.length) sign = GROW_FRAMES[age]!
  if (failing) sign = '×'
  else if (passing) sign = '♥'
  else if (committing) sign = '✓'
  const bubbleC = failing ? GREY : passing ? ROSE : committing ? LEAF : act.c
  put(g, fx + BUBBLE_DX, 0, sign, { c: bubbleC, b: s.act !== 'think' && age >= 4, d: age === GROW_FRAMES.length })
  // Tasks: a row of blossoms at the top right, left of the agents, `done` of them open (scaled to the
  // row when there are more tasks than fit); the newest twinkles, and all of them roll colours when the last lands.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  const open = s.total > count ? Math.round((s.done * count) / s.total) : s.done
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const lit = i < open
    const newest = lit && i === open - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : lit ? '✿' : '∘'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '✦' ? GOLD : lit ? ROSE : MAUVE
    put(g, x0 + i, 0, glyph, { c, b: lit, d: !lit })
  }
  // A new agent: a petal on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    put(g, w - 2 - i * 2, mod(t + i * 3, 8) < 4 ? 0 : 1, frame(['✿', '❀'], s.agentsAge >> 1), { c: PINK, b: true })
  }
  return withReactions(g, t, s, ROSE)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: ROSE, L: ROSE, D: ROSE }, lid: ROSE }

export const SAKURA: Theme = {
  name: 'sakura',
  rows: 2,
  sleep: '(˶- ᵕ -˶) zZ',
  color: ROSE,
  accent: BLUSH,
  sprite: {
    think: ['✿ (˶ᵔ ᵕ ᵔ˶)', '❀ (˶ᵔ ᵕ ᵔ˶)?', '❁ (˶- ᵕ -˶)?'],
    tool: ['✿ (˶•ᴗ•˶)و ', '❀ (˶•ᴗ•˶)و✧'],
    say: ['✿ (˶ᵔ ᵕ ᵔ˶) ♪', '❀ (˶ᵔ ᵕ ᵔ˶) ♫'],
    wait: ['✿ (˶ᵔ ᵕ ᵔ˶) .  ', '❀ (˶ᵔ ᵕ ᵔ˶) .. ', '❁ (˶ᵔ ᵕ ᵔ˶) ...'],
  },
  happy: '(˶ᵔ ᵕ ᵔ˶)✿',
  sad: '(˶; ᴗ ;˶)',
  dead: '(˶x ᴗ x˶)',
  confetti: ['✿', '❀', '❁', '✾', '·'],
  palette: PALETTE,
  scene: sakuraScene,
  pet: PET,
}
