// Theme: penguins. Its scene, its words and its pet.
//
// The scene: penguins huddled on an ice floe (#90e0ef) in a dark sea, an aurora over them whose curtains breathe
// a cell a frame and shimmer in colour by `t`, the sea's waves scrolling left by `t` alone. A penguin per agent
// (four at most, the host when none) in a fixed slot, shuffling on eight frames, the newest flapping and hopping
// as it joins. think: they waddle in unison; ask: every head turns up over four frames; tool: each drops a line
// into a hole by its side and a fish in the tool's colour leaps a six-frame arc in from the right edge (twice a
// cycle on bash). A done task: the newest penguin belly-slides out of its slot and waddles back (4 + 3 cells
// frames); a fish on the floe's face per task, floor-scaled. testFail cracks the floe between the first two
// slots, the halves drifting a pixel apart and back; testPass flaps every flipper; a commit pulls a fish from the
// host's hole, tosses it up and gulps it. Motion rules: floe and sea fill the bottom cell row, the aurora keeps
// to the top one with fixed starts, the leaping fish starts at the edge and the sign sits in the corner.
import { canvas, cells, draw, frame, hsl, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** A penguin's pose: its head's turn (front, side, tilted, up), lean, feet, flippers out, beak open, hop. */
type Pose = { head: number; lean: number; feet: number; flap: boolean; open: boolean; y: number; sink: number }
/** The crack's line and hairlines' inks, how far the hairlines reach, whether their tips still glint. */
type Crack = { line: string; hair: string; reach: number; tip: boolean }
type Layout = { water: number; f0: number; f1: number; c: number; n: number }

/** The penguin, 5 wide, 5 tall from pixel row PEN_Y: head and face by the head's turn, belly, feet (both, one up,
 * tucked in a hop); a pixel shorter per `sink` as it gets down to slide. Looking up, its beak sticks up a pixel. */
const HEADS = [['.KKK.', 'KWBWK'], ['.KKK.', 'KWWBK'], ['.KKKB', 'KWWWK'], ['.KWK.', 'KWWWK']]
const BELLY = 'KWWWK'
const FEET = ['.O.O.', '...O.', '.O...', '.OOO.']
/** Lying on its belly, facing left from its standing column: its back over beak, head, belly and feet. */
const SLIDE = ['.KKKK.', 'BKWWWO']
const PEN_Y = 1
const FLOE_Y = 6
/** Slots from the huddle's centre: the host's, then right, left, right; the side each shuffles and slides to. */
const SLOT_DX = [-6, 1, -13, 8]
const [SIDE, MAX_FISH] = [[-1, 1, -1, 1], 12]
/** Frames: an act's change, a greeting, a done fish's sparkle, the 100% twinkle; the slide's most cells. */
const [CHANGE, GREET, SPARKLE, ALL_DONE, SLIDE_MAX] = [4, 8, 8, 16, 8]
/** A leap's frames and head rows; testPass; the commit: the toss from the host's hole to its beak, then gulped. */
const [LEAP, PASS, COMMIT] = [6, 12, 16]
const LEAP_Y = [5, 4, 3, 3, 4, 5]
const TOSS = [[5, 5], [5, 4], [5, 3], [5, 2], [5, 1], [6, 0], [5, 0], [4, 0], [3, 0]] as const
/** The host's head through the commit: watching the hole, tilting up, beak up for the catch, and back down. */
const TOSS_HEAD = [1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0]
/** testFail: the crack runs (0-7), the left half drifts off (9-20), the right (11-18), the crack fades (22-25). */
const [LEFT_FROM, LEFT_TO, RIGHT_FROM, RIGHT_TO, FADE_FROM, FAIL] = [9, 21, 11, 19, 22, 30]

const INK = { K: '#5d6880', W: '#f1f5f9', B: '#ffa62b', O: '#ff8c42' }
const [OPEN, GOLD, WHITE, RED] = ['#e5383b', '#ffd60a', '#ffffff', '#ef476f']
const [FLOE, SNOW, FACE, CRACK, HAIR] = ['#90e0ef', '#caf0f8', '#48b5d4', '#1b4965', '#2c7da0']
const [SEA, CREST, DEEP, FOAM, ROD, LINE] = ['#2a6f97', '#61a5c2', '#1f5f8b', '#e0fbfc', '#c08552', '#dee2e6']
const [BOBBER, HOLE] = [RED, CRACK]
const [FISH, FISH_TAIL, NOTCH, SILVER, FIN] = ['#ffb703', '#fb8500', '#2c7da0', '#e0fbfc', '#8ecae6']
const TOOL_INK: Record<ToolKind, string> = { bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }
const PALETTE = [FLOE, '#80ffdb', INK.B, '#c77dff']

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** The floe and the open water to its right (wide enough for a leap from w 40); the huddle's centre, nearer the
 * water on a wide band; how many slots fit on the floe. */
function layout(w: number): Layout {
  const water = w < 40 ? 3 : Math.max(9, Math.min(14, Math.floor(w / 5)))
  const [f0, f1] = [Math.max(1, Math.floor(w / 24)), w - 1 - water]
  const c = Math.max(f0 + 6, Math.floor((f0 + f1) / 2), f1 - 24)
  let n = 0
  while (n < SLOT_DX.length && c + SLOT_DX[n]! >= f0 && c + SLOT_DX[n]! + 5 <= f1) n++
  return { water, f0, f1, c, n: Math.max(1, n) }
}

/** The aurora along the top cell row: one faint arc across the sky, its right end breathing a cell a frame (so no
 * frame holds) short of the sign, covering the penguins' heads so they never part from it; brighter curtains
 * drift along it, green above rose-violet folds (none just round a penguin's head), hues and glow shimmering by
 * `t` (colour only). */
function aurora(cv: Canvas, t: number, clear: (x: number) => boolean): void {
  const end = cv.w - 5 - Math.abs(mod(t, 6) - 3)
  for (let x = 0; x <= end; x++) {
    const glow = 0.6 * Math.sin(x * 0.33 + t * 0.09) + 0.4 * Math.sin(x * 0.11 - t * 0.04 + 1)
    const h = 145 + 35 * Math.sin(x * 0.3 - t * 0.15)
    if (glow < -0.2 || x === end) {
      plot(cv, x, 0, hsl(h + 20, 0.45, 0.3 + Math.max(0, glow + 0.6) * 0.2))
      continue
    }
    const l = Math.min(0.7, 0.5 + glow * 0.15 + 0.08 * Math.sin(x * 0.7 + t * 0.4))
    plot(cv, x, 0, hsl(h, 0.85, l))
    if (mod(x + (t >> 2), 4) !== 0 && !clear(x)) plot(cv, x, 1, hsl(h + 150, 0.7, l - 0.08))
  }
}

/** The sea along the bottom two pixel rows, crests scrolling left a cell every other frame; foam at the floe. */
function sea(cv: Canvas, t: number, L: Layout): void {
  for (let x = 0; x < cv.w; x++) {
    const u = x + (t >> 1)
    plot(cv, x, 6, noise(Math.floor(u / 2) + 40) > 0.62 ? CREST : SEA)
    plot(cv, x, 7, noise(u + 90) > 0.8 ? SEA : DEEP)
  }
  for (const x of [L.f0 - 1, L.f1 + 1]) if (mod(t + x, 8) < 4) plot(cv, x, 6, FOAM)
}

/** The floe: snow on its top, its face below, in two halves split by the crack's line (column c, then c-1)
 * drawn `dl` left and `dr` right; a crack: its line, and jagged hairlines `reach` cells either side, tips white. */
function floe(cv: Canvas, L: Layout, dl: number, dr: number, crack?: Crack): void {
  for (const y of [6, 7]) {
    const split = y === 6 ? L.c : L.c - 1
    for (let x = L.f0; x <= L.f1; x++) {
      const end = x === L.f0 || x === L.f1
      if (y === 7 && end) continue
      let ink = y === 7 || end ? FACE : noise(x * 3 + 1) > 0.72 ? SNOW : FLOE
      const d = Math.abs(x - split)
      const tip = crack?.tip && d >= crack.reach - 1
      if (crack && d === 0) ink = crack.line
      else if (crack && d <= crack.reach && (d + y) % 2 === 0) ink = tip ? WHITE : crack.hair
      plot(cv, x <= split ? x - dl : x + dr, y, ink)
    }
  }
}

/** A penguin at (x, PEN_Y + hop): head and face by its turn and lean, belly, feet; flippers out, beak up. */
function penguin(cv: Canvas, x: number, p: Pose): void {
  const ink = { ...INK, B: p.open ? OPEN : INK.B }
  const y = PEN_Y + p.y + p.sink
  // The sky over its head is cleared of the aurora so the head stands out (the head fills that cell either way).
  for (let c = x + p.lean; y === 1 && c < x + p.lean + 5; c++) {
    if (c >= 0 && c < cv.w && HEADS[p.head]![0]![c - x - p.lean] !== '.') cv.px[c] = undefined
  }
  draw(cv, x + p.lean, y, HEADS[p.head]!, ink)
  if (p.head === 3) plot(cv, x + 2 + p.lean, y - 1, INK.B)
  draw(cv, x, y + 2, [...Array<string>(2 - p.sink).fill(BELLY), FEET[p.y < 0 ? 3 : p.feet]!], ink)
  if (p.flap) for (const dx of [-1, 5]) plot(cv, x + dx, y + 2, INK.K)
}

/** The rod beside a penguin, grown over four frames: its tip, the line, a hole in the ice and the bobber, which
 * dips for three frames in twelve. */
function rod(cv: Canvas, x: number, stage: number, t: number): void {
  const at = x + 5
  if (stage >= 1) plot(cv, at, PEN_Y + 1, ROD)
  if (stage >= 2) plot(cv, at, PEN_Y + 2, LINE)
  if (stage >= 3) for (const [y, ink] of [[PEN_Y + 3, LINE], [FLOE_Y, HOLE]] as const) plot(cv, at, y, ink)
  if (stage >= 4) plot(cv, at, PEN_Y + 4, mod(t + 5 * x, 12) < 9 ? BOBBER : LINE)
}

/** The slide after a done task, `a` frames in, `d` cells out: get down a pixel a frame, slide a cell a frame, rest,
 * get up the same way and waddle back a cell every other frame; home at 5 + 3d frames (29 at most). */
function slideAt(a: number, d: number): { p: number; sink: number; lying: boolean; step: number } | undefined {
  if (a < 2) return { p: 0, sink: a + 1, lying: false, step: 0 }
  if (a <= d + 3) return { p: Math.min(a - 2, d), sink: 2, lying: true, step: 0 }
  if (a <= d + 5) return { p: d, sink: d + 6 - a, lying: false, step: 0 }
  const back = a - (d + 6)
  if (back >= 2 * d) return undefined
  return { p: d - ((back + 1) >> 1), sink: 0, lying: false, step: 1 + ((back >> 1) % 2) }
}

/** The sign in the top-right corner: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, k: { fail: boolean; pass: boolean; commit: boolean }) {
  const age = s.act === 'tool' ? Math.min(s.actAge, s.toolAge) : s.actAge
  if (k.fail) return { text: '×', c: RED }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (k.commit) return { text: '✓', c: GOLD }
  if (age < CHANGE) return { text: '·', c: SNOW }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: mod(t, 8) < 6 ? '?' : ' ', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: '#80ffdb' }
  if (s.act === 'think') return { text: frame(['·', '∙', '•', '∙'], t >> 2), c: SNOW }
  return { text: frame(['z', 'Z'], t >> 2), c: '#8d99ae' }
}

export function penguinsScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const L = layout(w)
  const isFail = s.news === 'testFail' && s.newsAge < FAIL
  const isPass = s.news === 'testPass' && s.newsAge < PASS
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT
  const a = s.newsAge
  const dl = isFail && a >= LEFT_FROM && a < LEFT_TO ? 1 : 0
  const dr = isFail && a >= RIGHT_FROM && a < RIGHT_TO ? 1 : 0
  const n = Math.min(L.n, Math.max(1, s.agents))
  // Layer 1: the aurora; layer 2: the sea; the floe (cracked: white then dark as the line runs, hairlines, fading).
  aurora(cv, t, x => SLOT_DX.slice(0, n).some(dx => Math.abs(x - (L.c + dx + 2)) <= 4))
  sea(cv, t, L)
  // The crack runs out across the floe a cell every other frame (white at its tips), then fades as the halves rejoin.
  const fade = (ink: string) => (a < FADE_FROM ? ink : mix(ink, FLOE, (a - FADE_FROM + 1) / 5))
  const crack = isFail && a < FADE_FROM + 4
    ? { line: a < 2 ? WHITE : fade(CRACK), hair: fade(HAIR), reach: Math.min(4, (a >> 1) + 1), tip: a < 8 } : undefined
  floe(cv, L, dl, dr, crack)
  // A fish per task on the floe's face (floor-scaled), done ones lit, the newest sparkling, all twinkling at 100%.
  const count = Math.min(s.total, MAX_FISH, Math.max(0, Math.floor((L.f1 - L.f0 - 1) / 3)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const allDone = s.total > 0 && s.done >= s.total && s.doneAge < ALL_DONE
  for (let k = 0; k < count; k++) {
    const x0 = L.f0 + 1 + 3 * k
    const x = x0 <= L.c - 1 ? x0 - dl : x0 + dr
    const fresh = k === lit - 1 && s.doneAge < SPARKLE && lit > litOf(s.done - 1) && mod(s.doneAge, 2) === 0
    const twinkle = allDone && mod(s.doneAge + k, 4) < 2
    plot(cv, x, 7, k >= lit ? NOTCH : fresh ? WHITE : twinkle ? GOLD : FISH)
    plot(cv, x + 1, 7, k >= lit ? NOTCH : fresh || twinkle ? GOLD : FISH_TAIL)
  }

  // Layer 3: the penguins. Act motion holds still while the act changes and through any reaction.
  const reacting = isFail || isPass || isCommit
  const still = s.actAge < CHANGE || reacting
  const slider = s.done > 0 ? n - 1 : -1
  for (let i = 0; i < n; i++) {
    const side = SIDE[i]!
    const home = L.c + SLOT_DX[i]! + (side < 0 ? -dl : dr)
    const ph = mod(t + 3 * i, 8)
    const pose: Pose = { head: 0, lean: 0, feet: 0, flap: false, open: false, y: 0, sink: 0 }
    let off = 0
    if (s.act === 'think') {
      if (!still) pose.lean = frame([0, 1, 0, -1], t >> 2)
      pose.feet = pose.lean > 0 ? 1 : pose.lean < 0 ? 2 : 0
    } else if (s.act !== 'tool') {
      pose.feet = ph < 2 || (ph >= 4 && ph < 6) ? 0 : ph < 4 ? 1 : 2
      if (!still && s.act !== 'ask') off = ph >= 4 ? side : 0
    }
    if (s.act === 'ask') pose.head = Math.min(3, s.actAge)
    if (s.act === 'tool') pose.head = s.actAge >= 1 ? 1 : 0
    if (s.act === 'say') pose.open = mod(t + 2 * i, 4) < 2
    if (i === n - 1 && s.agents > 0 && s.agentsAge < GREET) {
      pose.flap = mod(s.agentsAge, 2) === 1
      off = 0
      pose.y = s.agentsAge >= 2 && s.agentsAge < 5 ? -1 : 0
    }
    // Flippers flap from the frame after a reaction stills them, and stop before the floe's halves drift.
    if (isPass) pose.flap = mod(a, 2) === 1
    if (isFail && a >= 2 && a < LEFT_FROM) pose.flap = mod(a + i, 4) < 2
    if (i === 0 && isCommit) pose.head = TOSS_HEAD[a]!
    if (pose.head === 3) pose.y = 0   // no hop while looking up: the beak keeps to the top pixel row
    // The slide: the newest penguin, out to its side as far as the floe allows, eight cells at most.
    const room = side < 0 ? home - (L.f0 - dl) : L.f1 + dr - (home + 5)
    const sl = i === slider ? slideAt(s.doneAge, Math.max(0, Math.min(SLIDE_MAX, room))) : undefined
    if (sl) {
      const x = home + side * sl.p
      const lying = side < 0 ? SLIDE : SLIDE.map(r => [...r].reverse().join(''))
      if (sl.lying) draw(cv, x, PEN_Y + 3, lying, INK)
      else penguin(cv, x, { ...pose, head: 0, lean: 0, feet: sl.step, flap: false, y: 0, sink: sl.sink })
      continue
    }
    if (s.act === 'tool' && !(i === 0 && isCommit)) rod(cv, home, Math.min(4, s.actAge), t)
    penguin(cv, home + (still ? 0 : off), pose)
  }

  // Layer 4: the fish. In a tool, a leap in from the right edge every twelve frames, every six on bash (an extra
  // leap shows only if bash was already running as it began); its tail the leap's last pixel; splashes.
  if (s.act === 'tool' && L.water >= 8 && s.actAge >= CHANGE) {
    const [j, ph] = [Math.floor((s.actAge - CHANGE) / LEAP), mod(s.actAge - CHANGE, LEAP)]
    if (j % 2 === 0 || (s.tool === 'bash' && s.toolAge > ph)) {
      const [x, ink] = [w - 2 - ph, TOOL_INK[s.tool ?? 'other']]
      plot(cv, x + 1, ph === 0 ? 6 : LEAP_Y[ph - 1]!, mix(ink, SEA, 0.35))
      plot(cv, x, LEAP_Y[ph]!, ink)
      if (ph === 0 || ph === LEAP - 1) for (const dx of [0, -1]) plot(cv, x + dx, 6, FOAM)
    }
  }
  if (isCommit) {
    // Pulled from the host's hole, up past its head and down into its beak, its tail the path's last pixel.
    const P = L.c + SLOT_DX[0]!
    if (a <= 10) plot(cv, P + 5, FLOE_Y, HOLE)
    if (a < TOSS.length) {
      const [hx, hy] = TOSS[a]!
      const [tx, ty] = a > 0 ? TOSS[a - 1]! : ([5, 6] as const)
      plot(cv, P + tx, ty, FIN)
      plot(cv, P + hx, hy, SILVER)
    } else if (a === TOSS.length) plot(cv, P + 3, 0, FIN)
  }

  const g = cells(cv)
  const { text, c } = sign(s, t, { fail: isFail, pass: isPass, commit: isCommit })
  put(g, w - 2, 0, text, { c, b: true })
  return g
}

/** An emperor chick: a dark cap down the sides of a white face, two eyes and a small dark beak between them, a
 * fluffy grey body with lighter tufts, dark feet. */
export const PET: PetArt = {
  body: ['...KKKKKK...', '..KWWWWWWK..', '..KWWBBWWK..', '..GFGGGGFG..', '...GF..FG...'],
  step: ['...KKKKKK...', '..KWWWWWWK..', '..KWWBBWWK..', '..GFGGGGFG..', '..GF.GG.FG..'],
  colors: { K: '#4a4e5a', W: '#f8f9fa', B: '#e9a15a', G: '#adb5bd', F: '#ced4da' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#212529',
  lid: '#f8f9fa',
  mouth: [5, 2],
  blush: '#ffafcc',
  spark: '#80ffdb',
}

export const PENGUINS: Theme = {
  name: 'penguins',
  rows: SCENE_ROWS,
  color: FLOE,
  accent: '#80ffdb',
  sprite: {
    think: ['◓·  ', '◓ · ', '◓  ·', '◓ · '], tool: ['◓~  ', '◓ ~ ', '◓  ~', '◓ ~ '],
    say: ['◓ ♪', '◓ ♫'], wait: ['◓ .', '◓ ..', '◓ ...'],
  },
  happy: '◓ ✓',
  sad: '◓ …',
  dead: '◓ ✕',
  sleep: '◓ zZ',
  confetti: ['✧', '·', '*', '°'],
  palette: PALETTE,
  scene: penguinsScene,
  pet: PET,
}
