// Theme: mecha. Its scene, its words and its pet.
//
// The scene: a mecha flies right on the bottom row, its thruster flaring behind it, debris streaming
// past at half speed. While a tool runs, targets close in from the right edge a column a frame and
// are shot as they arrive: the arm's beam grows out over three frames and a burst blooms where the
// target was. The top row is the HUD: radar sweeps entering at the right edge and running left, a
// sign over the mecha's head (dots thinking, the tool's mark, `?`, a note) and a row of target marks
// at the right, `done` of them lit (left of the agent figures, withReactions). What the mecha is
// doing also shows in its eyes and mouth, which blink, and in its arm (a beam, radio waves). A
// failed test greys everything, crosses its eyes and shakes the frame; a passed test glows it and
// rains sparks along the HUD; a commit turns the debris gold under the spark burst and shows `✓`;
// bash keeps the beam on and streaks the debris; a new agent gets a radio blip.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same or adjacent row). The mecha
// stays put, so the debris may stream toward it (a dot reaching the arm joins its run and vanishes
// behind it; streaming away from it would spawn starts beside the arm). Debris is only drawn past
// the burst zone, so nothing reappears from under the beam or the burst; targets appear at the
// right edge (exempt), the beam grows from the arm, contiguous with the face, and stays on until
// the burst has faded so the burst never detaches; the burst grows outward a cell at a time. A
// moving run that touches a still one parts from it two columns on, so the sweeps never reach the
// sign (they fade out two columns short of it, and the HUD has no ticks for them to cross) and the
// debris keeps a cell clear of each target.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const CYAN = '#4cc9f0'
const ICE = '#a9e8fb'
const PINK = '#f72585'
const GOLD = '#ffd60a'
const BLUE = '#7aa2f7'
const STEEL = '#8d99ae'
const GREEN = '#9ece6a'
const GREY = '#9a9a9a'
const WHITE = '#ffffff'
const PALETTE = [CYAN, PINK, GOLD, BLUE]
const FLAME = ['≋', '≈', '∼']
const FLAME_COLORS = ['#ff9f1c', '#ffbf69', '#ff595e']
const DEBRIS = ['·', '˙', '.']
/** A sweep, head first: it runs left. */
const SWEEP = '▇▅▃▂▁▔'
const TARGET_FRAMES = ['◇', '◆']
/** The burst where a target was, from the third frame after the beam reaches it. */
const BURST_FRAMES = ['✶', '·✶·', '·✶·', '·+·', '···', '···']
/** The sign growing in over the four frames after the act or tool changes; the fourth is the new sign, dim. */
const GROW_FRAMES = ['·', '∘', '○']
/** The arm's radio waves while saying, four frames each. */
const WAVE_FRAMES = ['▸', '▸▸', '▸▸▸', ' ']
/** The mecha's left bracket column; its flame sits two columns before it, its arm right after its face. */
const MECHA_X = 2
const FACE_W = 5
const ARM_X = MECHA_X + FACE_W
/** The sign's column: over the mouth. The sweeps stop two columns right of it. */
const SIGN_X = MECHA_X + 2
const SWEEP_STOP = SIGN_X + 2
const BEAM_W = 3
/** Where a target stops to be shot. */
const NEAR = ARM_X + 1 + BEAM_W
/** Frames of beam and burst after a target arrives. */
const BOOM = 2 + BURST_FRAMES.length
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** Per act: the eye cycle (four frames each), the mouth, the sign cycle (four frames each), its color. */
const ACTS: Record<Act, { eye: readonly string[]; mouth: string; sign: readonly string[]; c: string }> = {
  think: { eye: ['◉', '◎', '◉', '○'], mouth: '_', sign: ['▖', '▘', '▝', '▗'], c: BLUE },
  tool: { eye: ['◉'], mouth: '▂', sign: ['✦'], c: GOLD },
  ask: { eye: ['◎'], mouth: '_', sign: ['?'], c: GOLD },
  say: { eye: ['◕'], mouth: '‿', sign: ['♪', '♫'], c: ICE },
  wait: { eye: ['○'], mouth: '_', sign: ['.', '·', '˙', '·'], c: STEEL },
}
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '≡', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦' }

/** The HUD sweeps: each enters at the right edge, runs left a column a frame and fades out short of the sign. */
function sweeps(g: Grid, t: number, w: number, grey: boolean): void {
  const period = w - SWEEP_STOP + SWEEP.length
  const count = Math.max(1, Math.round(w / 40))
  for (let k = 0; k < count; k++) {
    const head = w - 1 - mod(t + Math.floor((k * period) / count), period)
    for (let i = 0; i < SWEEP.length; i++) {
      if (head + i >= SWEEP_STOP) put(g, head + i, 0, SWEEP[i]!, { c: grey ? GREY : CYAN, d: i > 2 })
    }
  }
}

/** The targets while a tool runs: where each is, and how long since it arrived (negative while closing in). */
function targets(t: number, w: number): { x: number; boom: number }[] {
  const approach = Math.max(1, w - 2 - NEAR)
  const cycle = approach + BOOM
  const count = Math.max(1, Math.floor(cycle / 24))
  return Array.from({ length: count }, (_, k) => {
    const phase = mod(t + Math.floor((k * cycle) / count), cycle)
    return { x: Math.max(NEAR, w - 2 - phase), boom: phase - approach }
  })
}

/** A target closing in, then the beam reaching it over three frames and the burst where it was. */
function shoot(g: Grid, t: number, { x, boom }: { x: number; boom: number }, grey: boolean): void {
  if (boom < 2) put(g, x, 1, frame(TARGET_FRAMES, t >> 1), { c: grey ? GREY : PINK, b: !grey })
  if (boom < 0) return
  put(g, ARM_X + 1, 1, '━'.repeat(Math.min(BEAM_W, boom + 1)), { c: grey ? GREY : frame([CYAN, ICE], t), b: true })
  if (boom >= 2) {
    const burst = BURST_FRAMES[boom - 2]!
    put(g, NEAR - (burst.length >> 1), 1, burst, { c: grey ? GREY : frame([GOLD, PINK], boom), b: boom < 5, d: boom >= 5 })
  }
}

export function mechaScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  // Layer 1: the HUD's edge and its sweeps.
  put(g, 0, 0, '▕', { c: BLUE, d: true })
  sweeps(g, t, w, failing)
  // Layer 2: debris streaming toward the mecha at half speed, past the burst zone and clear of the
  // targets; gold while a commit lands, streaking while bash runs.
  const flight = s.act === 'tool' ? targets(t, w) : []
  for (let i = 0; i < Math.max(1, Math.floor(w / 10)); i++) {
    const x = NEAR + 3 + mod(Math.floor(noise(i + 11) * w * 2) - (t >> 1), Math.max(1, w - NEAR - 3))
    if (flight.some(f => Math.abs(f.x - x) <= 1)) continue
    put(g, x, 1, committing ? '✦' : frame(DEBRIS, (t >> 3) + i), { c: committing ? GOLD : STEEL, d: !committing || s.newsAge >= 10 })
    if (bash) put(g, x + 1, 1, '·', { c: STEEL, d: true })
  }
  // Layer 3: the targets, beam and bursts while a tool runs; the beam stays on while bash runs.
  for (const f of flight) shoot(g, t, f, failing)
  if (bash) put(g, ARM_X + 1, 1, '━'.repeat(BEAM_W), { c: failing ? GREY : frame([CYAN, ICE], t), b: true })
  // Layer 4: the mecha: its flame flickers, its eyes cycle per act and blink every sixteen frames
  // (closed for the first two frames after the act changes), its arm fires or signals.
  const age = Math.min(s.actAge, s.toolAge)
  const since = age < 999 ? age : t
  const blink = mod(t, 16) < 2 || age < 2
  const eye = failing ? '×' : passing ? '◕' : blink ? '-' : frame(act.eye, t >> 2)
  const mouth = failing ? '▂' : passing ? '‿' : act.mouth
  const color = failing ? GREY : passing ? frame([ICE, WHITE], t >> 1) : CYAN
  put(g, MECHA_X - 2, 1, failing ? '.' : frame(FLAME, t), { c: failing ? GREY : frame(FLAME_COLORS, t), b: passing, d: failing })
  put(g, MECHA_X, 1, `[${eye}${mouth}${eye}]`, { c: color, b: true })
  const arm = s.act === 'tool' ? '⊃' : s.act === 'say' ? frame(WAVE_FRAMES, since >> 2) : ' '
  put(g, ARM_X, 1, arm, { c: failing ? GREY : act.c, b: s.act === 'tool' })
  // The sign over the head: grows in over four frames after the act or tool changes, then cycles from
  // that change (from `t` when none is known); `×` on a failed test, `★` on a passed one, `✓` on a commit.
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, since >> 2)
  if (age < GROW_FRAMES.length) sign = GROW_FRAMES[age]!
  if (failing) sign = '×'
  else if (passing) sign = '★'
  else if (committing) sign = '✓'
  const dimSign = age === GROW_FRAMES.length || (s.act === 'ask' && mod(t, 8) >= 4)
  put(g, SIGN_X, 0, sign, { c: failing ? GREY : passing ? GOLD : committing ? GREEN : act.c, b: !dimSign && s.act !== 'think', d: dimSign })
  // A passed test: sparks rain along the HUD, drifting left, fading over the last six frames.
  if (passing) {
    for (let x = 1; x < w; x++) if (mod(x + s.newsAge, 5) === 0 && x !== SIGN_X) put(g, x, 0, s.newsAge < 10 ? '✦' : '·', { c: frame([GOLD, ICE, PINK], Math.floor((x + s.newsAge) / 5)), d: s.newsAge >= 10 })
  }
  // Tasks: a row of target marks at the top right, left of the agents, `done` of them lit (scaled down
  // when more tasks than fit); the newest twinkles, and all of them roll colours when the last lands.
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  const lit = s.total > count ? Math.floor((s.done * count) / s.total) : s.done
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const on = i < lit
    const newest = on && i === lit - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : on ? '■' : '□'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '✦' ? GOLD : on ? CYAN : BLUE
    put(g, x0 + i, 0, glyph, { c, b: on, d: !on })
  }
  // A new agent: a radio blip on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    put(g, w - 2 - i * 2, mod(t + i * 3, 8) < 4 ? 0 : 1, frame(['◦', '•'], s.agentsAge >> 1), { c: PINK, b: true })
  }
  return withReactions(g, t, s, CYAN)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: CYAN, L: CYAN, D: CYAN }, lid: CYAN }

export const MECHA: Theme = {
  name: 'mecha',
  rows: 2,
  sleep: '[-_-] zZ',
  color: CYAN,
  accent: PINK,
  sprite: {
    think: ['[◉_◉] ▖', '[◉_◉] ▘', '[◉_◉] ▝', '[◉_◉] ▗'],
    tool: ['[◉_◉]⊃━   ', '[◉_◉]⊃━━  ', '[◉_◉]⊃━━━☆'],
    say: ['[◕‿◕] ▸  ', '[◕‿◕] ▸▸ ', '[◕‿◕] ▸▸▸'],
    wait: ['[○_○] ·  ', '[◎_◎] ·· ', '[◉_◉] ···'],
  },
  happy: '[◕‿◕]b',
  sad: '[╥_╥]',
  dead: '[×_×]',
  confetti: ['✶', '✦', '+', '·', '◆'],
  palette: PALETTE,
  scene: mechaScene,
  pet: PET,
}
