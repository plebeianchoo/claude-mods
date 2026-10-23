// Theme: neon. Its scene, its words and its pet.
//
// The scene: a neon-tube face `▐◉‿◉▌` glows at the left of the bottom row and an equalizer of
// rainbow bars runs the rest of it, swelling with what the turn is doing: a slow swell thinking, a
// fast pulse while a tool runs, loud while saying, a low hum waiting. The bars' hue rolls every
// frame and the tube buzzes (dims for a frame) now and then. Over the face's mouth hangs a sign (a
// braille spinner thinking, the tool's mark, `?`, a note, a moon phase waiting) that strikes in over
// four frames after the act changes while the tube flickers and the eyes reopen. Sparks drift left
// along the top row at two speeds, behind the sign and behind the row of bulbs for tasks at the top
// right, `done` of them lit, left of the agent figures (withReactions). A failed test kills the
// sign: grey face with crossed eyes, flat grey bars, `×`, and the shake; a passed test glows the face
// white and drives every bar to the top under a spark rain and `★`; a commit turns the face and the
// bars gold under the spark burst and shows `✓`; bash strobes the bars every fourth frame, doubles
// the hue roll and streaks the sparks; a new agent gets a spark greeting.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same or adjacent row). The face and
// the equalizer stay put, and a bar never drops to blank, so the bottom row is two still runs. The
// sign sits two columns from the face's start, so it is never blank (it dims instead): a blank that
// came back would be a new start two columns from any old one. Sparks drift left a column a frame
// or every other frame: a run moving left may pass behind a still one (it comes out contiguous with
// it, a column from its start), where one moving right would reappear two columns past its end.
import { blank, frame, hsl, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const PINK = '#f72585'
const MAGENTA = '#b5179e'
const VIOLET = '#c77dff'
const CYAN = '#4cc9f0'
const GOLD = '#ffd60a'
const AMBER = '#ffb703'
const GREEN = '#9ece6a'
const GREY = '#9a9a9a'
const WHITE = '#ffffff'
const PALETTE = [PINK, MAGENTA, '#7209b7', CYAN, GOLD]
/** Colours bright enough to roll through the bulbs and the sparks. */
const ROLL = [PINK, VIOLET, CYAN, GOLD]
/** A bar's heights, lowest first; a bar is never blank. */
const BARS = '▁▂▃▄▅▆▇█'
const SPARKS = ['✦', '✧', '·', '+']
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
/** The sign striking in over the four frames after the act or tool changes; the fourth is the new sign, dim. */
const GROW_FRAMES = ['·', '∘', '○']
/** `IDLE_SIGNALS.actAge`: an age this large means no change is known. */
const IDLE_AGE = 999
/** `▐◉‿◉▌`: the face's left edge, its width, the sign's column (over the mouth) and the first bar. */
const FACE_X = 1
const FACE_W = 5
const SIGN_X = FACE_X + 2
const EQ_X = FACE_X + FACE_W + 1
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** Per act: the eye cycle (four frames each), the mouth, the sign cycle and its frames per step, its colour,
 * and the equalizer's floor, swing (in bar heights, 0–7) and speed. */
type ActArt = {
  eye: readonly string[]; mouth: string; sign: readonly string[]; rate: number; c: string
  base: number; amp: number; speed: number
}
const ACTS: Record<Act, ActArt> = {
  think: { eye: ['◉', '◉', '◎', '◎'], mouth: '‿', sign: SPINNER, rate: 2, c: CYAN, base: 0, amp: 4, speed: 0.25 },
  tool: { eye: ['◉'], mouth: '▂', sign: ['✦'], rate: 4, c: GOLD, base: 1, amp: 6, speed: 0.6 },
  ask: { eye: ['◎'], mouth: '○', sign: ['?'], rate: 4, c: GOLD, base: 0, amp: 3, speed: 0.3 },
  say: { eye: ['◕'], mouth: '▽', sign: ['♪', '♫'], rate: 4, c: PINK, base: 1, amp: 6.5, speed: 0.45 },
  wait: { eye: ['○'], mouth: '_', sign: ['◐', '◓', '◑', '◒'], rate: 4, c: VIOLET, base: 0, amp: 1.5, speed: 0.15 },
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '≡', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** A bar's height at column `x`: two waves summed, swung and floored per act; the top under a passed test,
 * the floor under a failed one. */
function barHeight(x: number, t: number, s: Signals, failing: boolean, passing: boolean): number {
  if (failing) return 0
  if (passing) return 6 + (mod(x + s.newsAge, 4) < 2 ? 1 : 0)
  const act = ACTS[s.act]
  const v = (Math.sin(x * 0.33 + t * act.speed) + Math.sin(x * 0.11 - t * act.speed * 0.6) + 2) / 4
  return Math.max(0, Math.min(7, Math.round(act.base + v * act.amp)))
}

export function neonScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  // Layer 1: the equalizer, a still run of bars whose heights and hue roll; gold while a commit lands,
  // a white strobe every fourth frame while bash runs.
  const strobe = bash && mod(t, 4) === 0
  for (let x = EQ_X; x < w; x++) {
    const rainbow = hsl(mod(x * 7 + t * (bash ? 18 : 9), 360), 0.95, 0.62)
    const gold = frame([GOLD, AMBER], x + (s.newsAge >> 1))
    const c = failing ? GREY : committing ? gold : strobe ? WHITE : rainbow
    put(g, x, 1, BARS[barHeight(x, t, s, failing, passing)]!, { c, b: strobe || passing, d: failing })
  }
  // Layer 2: sparks drifting left along the top row, half of them at half speed; grey while a test
  // fails, streaking while bash runs.
  for (let i = 0; i < Math.max(1, Math.floor(w / 10)); i++) {
    const x = mod(Math.floor(noise(i + 11) * w * 2) - (i % 2 ? t : t >> 1), w)
    const style = { c: failing ? GREY : frame(ROLL, i), d: failing || i % 2 === 0 }
    put(g, x, 0, frame(SPARKS, (t >> 3) + i), style)
    if (bash) put(g, x + 1, 0, '·', { c: VIOLET, d: true })
  }
  // A passed test: sparks rain along the top row, drifting left, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) {
      if (mod(x + s.newsAge, 5) !== 0 || x === SIGN_X) continue
      const c = frame([GOLD, WHITE, CYAN], Math.floor((x + s.newsAge) / 5))
      put(g, x, 0, s.newsAge < 10 ? '✦' : '·', { c, d: s.newsAge >= 10 })
    }
  }
  // Layer 3: the face. Its eyes cycle per act and blink every sixteen frames; after the act or tool
  // changes the tube strikes: eyes shut for two frames and the tube dim on the odd frames of four. It
  // buzzes (dims) for a frame every thirteen.
  const age = Math.min(s.actAge, s.toolAge)
  const since = age < IDLE_AGE ? age : t
  const blink = mod(t, 16) < 2 || age < 2
  const buzz = mod(t, 13) === 7 || (age < 4 && mod(age, 2) === 1)
  const eye = failing ? '×' : passing ? '◕' : blink ? '-' : frame(act.eye, t >> 2)
  const mouth = failing ? '▂' : passing ? '‿' : act.mouth
  const faceC = failing ? GREY : passing ? frame([WHITE, CYAN], t >> 1) : committing ? GOLD : buzz ? MAGENTA : PINK
  put(g, FACE_X, 1, `▐${eye}${mouth}${eye}▌`, { c: faceC, b: !buzz && !failing, d: buzz || failing })
  // The sign over the mouth: strikes in over four frames after the act or tool changes, then cycles
  // from that change (from `t` when none is known); `×` on a failed test, `★` on a passed one, `✓` on
  // a commit. Never blank: `?` dims on its off beat instead.
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, Math.floor(since / act.rate))
  if (age < GROW_FRAMES.length) sign = GROW_FRAMES[age]!
  if (failing) sign = '×'
  else if (passing) sign = '★'
  else if (committing) sign = '✓'
  const dimSign = age === GROW_FRAMES.length || (s.act === 'ask' && mod(t, 8) >= 4) || buzz
  const signC = failing ? GREY : passing ? GOLD : committing ? GREEN : act.c
  put(g, SIGN_X, 0, sign, { c: signC, b: !dimSign && s.act !== 'think', d: dimSign })
  // Tasks: a row of bulbs at the top right, left of the agents, `done` of them lit (floor-scaled when
  // more tasks than fit); the newest twinkles, and all of them roll colours when the last lands.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  const lit = s.total > count ? Math.floor((s.done * count) / s.total) : s.done
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const on = i < lit
    const newest = on && i === lit - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : on ? '●' : '○'
    const c = allDone ? frame(ROLL, i + (s.doneAge >> 1)) : glyph === '✦' ? GOLD : on ? CYAN : VIOLET
    put(g, x0 + i, 0, glyph, { c, b: on, d: !on })
  }
  // A new agent: a spark on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    const row = mod(t + i * 3, 8) < 4 ? 0 : 1
    put(g, w - 2 - i * 2, row, frame(['✦', '✧'], s.agentsAge >> 1), { c: CYAN, b: true })
  }
  return withReactions(g, t, s, PINK)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: PINK, L: PINK, D: PINK }, lid: PINK }

export const NEON: Theme = {
  name: 'neon',
  rows: 2,
  sleep: '◢◤ zZ',
  color: PINK,
  accent: CYAN,
  isRainbow: true,
  sprite: {
    think: SPINNER.map(c => `${c} ◢◤◢◤`),
    tool: ['▰▱▱▱▱', '▰▰▱▱▱', '▱▰▰▱▱', '▱▱▰▰▱', '▱▱▱▰▰', '▱▱▱▱▰'],
    say: ['▁▃▅▇▅▃', '▃▅▇▅▃▁', '▅▇▅▃▁▃', '▇▅▃▁▃▅', '▅▃▁▃▅▇', '▃▁▃▅▇▅'],
    wait: ['◐ ◆', '◓ ◇', '◑ ◆', '◒ ◇'],
  },
  happy: '✦ ◢◤ ✦',
  sad: '▁▁▁',
  dead: '✕ ◢◤ ✕',
  confetti: ['✦', '✧', '+', '·', '◆'],
  palette: PALETTE,
  scene: neonScene,
  pet: PET,
}
