// Theme: bunny. Its scene, its words and its pet.
//
// The scene: a white bunny hops along a still meadow (the camera does not pan), eating the carrots
// ahead of it (each leaves a sprout that regrows when the bunny laps), while dandelion seeds drift
// back along the top row at two speeds. What it is doing shows in its face (per-act eyes and
// mouth, a blink and an ear twitch, a chew after a carrot) and as a sign beside its tail (dots
// thinking, the tool's mark, `?`, a note). Tasks are a row of clovers at the top right, `done` of
// them lit; agents bob at the right edge (withReactions), a sparkle greeting the newest. A failed
// test greys the bunny, grounds it and gives it tears; a passed test glows it and runs sparkles
// along the top row; a commit twinkles over every carrot under the spark burst.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may
// start more than one column from a run start in the frame before (same or adjacent row). So the
// meadow stays put and only shimmers (a scrolling ground parts from the bunny at two columns a
// frame), and the bunny hops on a four-frame cycle (crouch, spring, fly, land), gaining a column
// on each airborne frame and sitting still on the ground: its run starts move at most a column a
// frame, and the hop between rows is allowed (the test matches adjacent rows). Seeds pass behind
// the bunny: the gaps in its glyph leave a run start within a column of every cell it covers, so
// a seed it reveals is never a jump. The cell between nose and sign stays clear so the sign keeps a
// run start of its own; the dust puff sits on the cell before its paws on landing; the bunny runs
// on the ground under the clover row rather than hopping through it; eaten carrots keep a sprout
// in their column so they can regrow at the wrap.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Act, Signals, Theme, ToolKind } from '../themes'

const WHITE = '#f1faee'
const CARROT = '#ff9f1c'
const PEACH = '#ffbf69'
const GRASS = '#80b918'
const GRASS_LIGHT = '#a7d129'
const LAVENDER = '#dcd6f7'
const BLUE = '#b5e2fa'
const GREY = '#9a9a9a'
const PALETTE = [CARROT, GRASS, WHITE, PEACH]
const BUNNY_W = 11
/** The hop, four frames: crouch, spring, fly, land; columns gained by each, and which are airborne. */
const HOP_DX = [0, 1, 2, 2]
const AIR = [false, true, true, false]
const SEEDS = ['✧', '˖', '·']
const GROUND = ['"', "'", '"', '`']
const CARROT_GAP = 13
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
/** Per act: the eyes, the mouth cycle (four frames each), the sign beside the tail (four frames each), its color. */
const ACTS: Record<Act, { eye: string; mouth: readonly string[]; sign: readonly string[]; c: string }> = {
  think: { eye: '•', mouth: ['ᴗ'], sign: ['·', '∘', '°', '∘'], c: LAVENDER },
  tool: { eye: 'ᵔ', mouth: ['ᵕ', 'ω', 'ᵕ', 'ᴗ'], sign: ['ɣ'], c: CARROT },
  ask: { eye: '◦', mouth: ['ᴗ'], sign: ['?', '?', '?', '˙'], c: PEACH },
  say: { eye: 'ᵔ', mouth: ['ᵕ', 'ω', 'ᵕ'], sign: ['♪', '♫'], c: BLUE },
  wait: { eye: '•', mouth: ['ᴗ'], sign: ['.', '·', '˙', '·'], c: '#b8b8be' },
}
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: 'ɣ' }

/** The bunny's paw column at frame `t`: a lap from off the left edge (sign and all) to off the right. */
function bunnyX(t: number, w: number): number {
  return mod(2 * Math.floor(t / 4) + HOP_DX[mod(t, 4)]!, w + BUNNY_W + 2) - (BUNNY_W + 2)
}

export function bunnyScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const failing = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const passing = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const committing = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const bash = s.act === 'tool' && s.tool === 'bash'
  const act = ACTS[s.act]
  const p = mod(t, 4)
  const bx = bunnyX(t, w)
  const nose = bx + BUNNY_W - 1
  const agentsW = 2 * Math.min(s.agents, 4)
  const count = Math.min(s.total, Math.floor(w / 4), Math.max(0, w - 2 - agentsW))
  const x0 = w - 1 - agentsW - count
  const canHop = !failing && (count === 0 || bx + BUNNY_W + 1 < x0)
  const up = canHop && AIR[p]!
  const row = up ? 0 : 1
  // Layer 1: the meadow, a still pattern of dim tufts that shimmer in place.
  for (let x = 0; x < w; x++) {
    if (noise(x + 31) < 0.7) continue
    const sway = Math.floor(noise(x + 57) * 4) + (t >> 3)
    put(g, x, 1, frame(GROUND, sway), { c: frame([GRASS, GRASS_LIGHT], sway), d: true })
  }
  // Layer 2: dandelion seeds drifting left along the top row, half of them at half speed; they
  // streak while bash runs.
  for (let i = 0; i < Math.max(1, Math.floor(w / 12)); i++) {
    const x = mod(Math.floor(noise(i + 11) * w * 2) - (i % 2 ? t : t >> 1), w)
    put(g, x, 0, frame(SEEDS, (t >> 3) + i), { c: WHITE, d: true })
    if (bash) put(g, x + 1, 0, '˖', { c: WHITE, d: true })
  }
  // A passed test (under the bunny, so it never lands on its face): sparkles run right along the top row, fading over the last six frames.
  if (passing) {
    for (let x = 0; x < w; x++) if (mod(x - s.newsAge, 6) === 0) put(g, x, 0, s.newsAge < 10 ? '✦' : '˖', { c: frame([CARROT, GRASS_LIGHT, PEACH], Math.floor((x - s.newsAge) / 6)), d: s.newsAge >= 10 })
  }
  // Layer 3: carrots ahead of the bunny; the ones it has passed are eaten down to a sprout, and a
  // commit twinkles over every carrot.
  let chewing = false
  for (let x = 6; x < w; x += CARROT_GAP) {
    const eaten = x <= nose
    if (eaten && nose < x + 8) chewing = true
    put(g, x, 1, eaten ? '.' : 'ɣ', eaten ? { c: GRASS, d: true } : { c: CARROT, b: true })
    if (committing && !eaten) put(g, x, 0, frame(['✧', '˖'], (s.newsAge >> 1) + x), { c: CARROT, b: s.newsAge < 10 })
  }
  // Layer 4: the bunny, hopping; it blinks every sixteen frames and twitches an ear between blinks.
  // The cell between its nose and its sign stays clear: a tuft, sprout or seed there would merge the
  // sign into the bunny's run, and the sign would then jump when the bunny changes row.
  put(g, bx + BUNNY_W, row, ' ')
  const age = Math.min(s.actAge, s.toolAge)
  const blink = mod(t, 16) < 2
  const twitch = mod(t + 8, 16) < 2 || age < 4
  const eye = failing ? ';' : passing ? 'ᵔ' : blink ? '-' : act.eye
  const mouth = failing ? 'ᴖ' : chewing && !passing ? frame(['ω', 'ᵕ'], t >> 1) : frame(act.mouth, t >> 2)
  const color = failing ? GREY : passing ? frame([WHITE, PEACH], t >> 1) : WHITE
  put(g, bx, row, `૮ ${twitch ? '˵' : '˶'}${eye} ${mouth} ${eye}˶ ა`, { c: color, b: true })
  if (canHop && !AIR[p]!) put(g, bx - 1, 1, p === 3 ? (bash ? '✦' : '⁎') : '·', bash ? { c: CARROT } : { c: '#adb5bd', d: true })
  // The sign beside the tail: grows in over four frames after the act or tool changes; `×` on a
  // failed test, `♥` on a passed one, `✓` on a commit.
  let sign = s.act === 'tool' && s.tool ? TOOL_SIGN[s.tool] : frame(act.sign, t >> 2)
  if (age < 4) sign = age < 2 ? '·' : '˚'
  if (failing) sign = '×'
  else if (passing) sign = '♥'
  else if (committing) sign = '✓'
  put(g, bx + BUNNY_W + 1, row, sign, { c: failing ? GREY : passing ? CARROT : committing ? GRASS_LIGHT : act.c, b: s.act !== 'think' })
  // Tasks: a row of clovers at the top right, left of the agents, `done` of them lit; the newest twinkles.
  const allDone = s.done >= s.total && s.total > 0 && s.doneAge < 16
  for (let i = 0; i < count; i++) {
    const lit = i < s.done
    const newest = lit && i === s.done - 1 && s.doneAge < 12
    const glyph = newest && mod(t, 4) < 2 ? '✦' : lit ? '♣' : '♧'
    const c = allDone ? frame(PALETTE, i + (s.doneAge >> 1)) : glyph === '✦' ? CARROT : lit ? GRASS_LIGHT : GRASS
    put(g, x0 + i, 0, glyph, { c, b: lit, d: !lit })
  }
  // A new agent: a sparkle on the other row from its figure for eight frames.
  if (s.agents > 0 && s.agentsAge < 8) {
    const i = Math.min(s.agents, 4) - 1
    put(g, w - 2 - i * 2, mod(t + i * 3, 8) < 4 ? 0 : 1, frame(['✧', '˖'], s.agentsAge >> 1), { c: PEACH })
  }
  return withReactions(g, t, s, PEACH)
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: WHITE, L: WHITE, D: WHITE }, lid: WHITE }

export const BUNNY: Theme = {
  name: 'bunny',
  rows: 2,
  sleep: '૮ ˶- ᴗ -˶ ა zZ',
  color: WHITE,
  accent: CARROT,
  sprite: {
    think: ['૮ ˶• ᴗ •˶ ა  ', '૮ ˶- ᴗ -˶ ა ?', '૮ ˶• ᴗ •˶ ა ?'],
    tool: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ɣ', '૮ ˶ᵔ ᵕ ᵔ˶ აɣ ', '૮ ˶ᵔ ᵕ ᵔ˶ ა  '],
    say: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ♪', '૮ ˶ᵔ ᵕ ᵔ˶ ა ♫'],
    wait: ['૮ ˶• ᴗ •˶ ა .  ', '૮ ˶• ᴗ •˶ ა .. ', '૮ ˶• ᴗ •˶ ა ...'],
  },
  happy: '૮ ˶ᵔ ᵕ ᵔ˶ ა',
  sad: '૮ ˶; ᴖ ;˶ ა',
  dead: '૮ ˶x ᴖ x˶ ა',
  confetti: ['ɣ', '*', '·', '✦', '"'],
  palette: PALETTE,
  scene: bunnyScene,
  pet: PET,
}
