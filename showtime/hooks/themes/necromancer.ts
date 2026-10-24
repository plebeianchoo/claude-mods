// Theme: necromancer. Its scene, its words and its pet.
//
// The scene: a graveyard at night (#80ed99): the moon in the top-left corner (a glint crossing it), bats flying
// right to left a cell a frame, fog drifting along the ground, a hooded necromancer whose staff's orb pulses on 12
// frames, a skeleton per agent (four at most) rising in place at its grave over six frames and digging on four, a
// headstone per task left of the cross (fixed pitch, floor-scaled), its soul flame lit as done, flickering on two
// frames. A tool raises the staff, tints the orb and streams the fog in its colour (grown on actAge); bash brings
// lightning onto the cross (two frames, the sky flashing), more often as it runs. testFail: the skeletons fall to
// bone piles over eight frames and stand again by 28 (with none, he recoils); testPass: they cheer; commit: a lich
// crown wipes in over him from the orb and the fog glows, 20 frames. Motion rules: bats keep to cell row 0, where
// all they pass has a run start under it in row 1; the bolt grows up from the cross, the crown wipes a column a
// frame; the fog row is always full, so the streams and the glow on it only change colours.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** Columns: the necromancer's left, his staff from it; the first skeleton's grave, their pitch, the most shown;
 * the headstones' pitch (leftward from the cross) and the most of them. */
const [NX, STAFF, AX, PITCH, MAX_SKELETONS, GRAVE_PITCH, MAX_GRAVES] = [5, 5, 13, 7, 4, 4, 12]
const [FOG_Y, GROUND_Y] = [6, 7] // pixel rows: the fog, the ground
/** Frames: an act's change, a skeleton's rise, a flame's lighting, the 100% flare; a tool's streams (in, length). */
const [CHANGE, RISE, LIGHT, FLARE, STREAM_IN, STREAM_LEN] = [4, 6, 8, 16, 8, 5]
/** bash's lightning: a window of frames by `t` holding at most one strike, the actAge its odds grow to one over. */
const [BOLT_P, BOLT_RAMP] = [12, 30]
/** testFail: the collapse (8 frames), the pile until 20, the rise back by 28; his recoil, a column until 14. */
const [FALL, PILE_END, BACK_END, RECOIL_END] = [8, 20, 28, 14]
/** commit: the crown (and the fog's glow) and its wipe; testPass: the cheer. */
const [CROWN_FRAMES, WIPE, PASS] = [20, 4, 12]

/** A skeleton, 5×5 from pixel row 2: a skull (W, sockets E), arms (A), spine and ribs (R), legs (L). It digs on
 * four frames: arms up, out, swung down, out; a clod (by dig frame, from its left) flies up past its right arm. */
const SKELETON = {
  stand: ['.WWW.', '.EWE.', 'A.R.A', '.RRR.', '.L.L.'],
  up: ['.WWW.', 'AEWEA', '..R..', '.RRR.', '.L.L.'],
  down: ['.WWW.', '.EWE.', '..R..', 'ARRRA', '.L.L.'],
} as const
type Pose = keyof typeof SKELETON
const DIG: Pose[] = ['up', 'stand', 'down', 'stand']
const CLOD: (readonly [number, number] | null)[] = [[5, 3], null, [5, 5], [5, 4]]
/** The necromancer, 5×5 from pixel row 2: hood (H) with glowing eyes (E), robe (R, a fold D), a bony hand (h)
 * on the staff; the crown over him, its band from pixel row 1 and points at row 0. */
const NECRO = ['.HH..', 'HEEH.', 'RRRRh', 'RDRR.', 'RRRRR']
const CROWN = ['Y.Y.', 'YGYY']
const MOON_ART = ['.MM.', 'MMMS', '.MS.']
const MOON_GLINT = [[1, 0], [2, 0], [2, 1], [1, 1]] as const

const [SOUL, SOUL_HI, SOUL_DIM, HALO_DIM, PALE, WHITE] =
  ['#80ed99', '#c7f9cc', '#38a3a5', '#3d7a68', '#f1fff4', '#ffffff']
const [BONE, BONE_SHADE, SOCKET, DIRT, MOUND] = ['#e9ecef', '#ced4da', '#495057', '#9c6644', '#7f5539']
const [HOOD, ROBE, WOOD] = ['#7b6fb0', '#5e548e', '#9c8063']
const [MOON, MOON_SHADE, BAT, STONE, STONE_LIT, CROSS, CROSS_LIT] =
  ['#e9f5db', '#cfe1b9', '#7d6b91', '#8d99ae', '#c0c8d6', '#adb5bd', '#dee2e6']
const [UNLIT, OLD, GOLD, GOLD_DIM, RED, BOLT] =
  ['#5c677d', '#6c757d', '#ffd166', '#8a7a4a', '#ef476f', '#fff3b0']
const [FOG, GROUND] = [['#5c6b63', '#6b7d72', '#7f9387'], ['#4f4337', '#5a4b3c']]
/** The sky's background on a strike's two frames (a terminal shows it; the review sheet leaves spaces out). */
const SKY_FLASH = ['#56627a', '#3f4759']
const TOOL_INK: Record<ToolKind, string> = { bash: '#ffd60a', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** Bats flying right to left a cell a frame by `t`, in cell row 0, in and out off the band's edges; their wings
 * beat on four frames (tips up at pixel row 0, then level), three cells wide either way. */
function bats(cv: Canvas, t: number): void {
  const n = Math.max(2, Math.floor(cv.w / 32))
  const span = cv.w + 12
  for (let i = 0; i < n; i++) {
    const x = cv.w - mod(t + Math.floor((i * span) / n), span)
    if (mod(t + i, 4) < 2) [[0, 0], [1, 1], [2, 0]].forEach(([dx, y]) => plot(cv, x + dx!, y!, BAT))
    else for (let dx = 0; dx < 3; dx++) plot(cv, x + dx, 1, BAT)
  }
}

/** The fog along pixel row 6, drifting a cell every four frames; a tool's streams in its colour run left through
 * it a cell a frame, each `k` (0..1) of STREAM_LEN long; while he speaks, green ripples run out from his staff
 * (`say`); the commit's glow over all of it; the ground under it. */
function fog(cv: Canvas, t: number, k: number, ink: string, glow: number, say: boolean): void {
  const len = Math.round(STREAM_LEN * k)
  const span = cv.w + 2 * STREAM_LEN
  const n = Math.max(3, Math.floor(cv.w / 10))
  const tint = new Array<number>(cv.w).fill(0)
  for (let i = 0; len > 0 && i < n; i++) {
    const head = mod(Math.floor(((i + noise(i + 41)) * span) / n) - t, span) - STREAM_LEN
    for (let j = 0; j < len; j++) if (head + j >= 0 && head + j < cv.w) tint[head + j] = 0.85 * (1 - j / (len + 1))
  }
  for (let x = 0; x < cv.w; x++) {
    const base = FOG[Math.floor(noise(Math.floor((x + (t >> 2)) / 3) * 3.7) * FOG.length)]!
    const d = x - NX - STAFF - 1
    const ripple = say && d >= 0 && d < 24 && mod(d - t, 8) < 2 ? 0.6 * (1 - d / 24) : 0
    plot(cv, x, FOG_Y, mix(mix(base, ink, Math.max(tint[x]!, ripple)), SOUL, glow * 0.8))
    plot(cv, x, GROUND_Y, GROUND[mod(x, 5) === 0 ? 1 : 0]!)
  }
}

/** bash's strike, its frame (0 or 1) or -1: a window of BOLT_P frames by `t` holds at most one, two frames at a
 * point of its own; it comes with odds grown over BOLT_RAMP frames of actAge read at its first frame, so a strike
 * is always the pair. */
function strikeOf(t: number, s: Signals): number {
  if (s.act !== 'tool' || s.tool !== 'bash') return -1
  const win = Math.floor(t / BOLT_P)
  const at = mod(t, BOLT_P) - Math.floor(noise(win * 3 + 11) * (BOLT_P - 2))
  if (at < 0 || at > 1) return -1
  return s.actAge - at >= 0 && noise(win * 7 + 5) < (s.actAge - at) / BOLT_RAMP ? at : -1
}

/** The cross at `cx` (glinting on 16 frames, white when struck) and grave slots leftward from it down to `minX`:
 * a headstone per task (floor-scaled) with its soul flame, an ember until done, then lit green and flickering on
 * two frames, the newest kindling over LIGHT frames, all flaring at 100%; an old grave in every other slot, so a
 * new headstone rises where one stood; moonlight steps along them every four frames. */
function graves(cv: Canvas, t: number, s: Signals, cx: number, minX: number, struck: boolean): void {
  const cross = struck ? WHITE : mod(t, 16) < 3 ? CROSS_LIT : CROSS
  draw(cv, cx, 3, ['.C.', 'CCC', '.C.', '.C.'], { C: cross })
  const slots = cx - GRAVE_PITCH >= minX ? Math.floor((cx - GRAVE_PITCH - minX) / GRAVE_PITCH) + 1 : 0
  const count = Math.min(s.total, MAX_GRAVES, slots)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < LIGHT && lit > litOf(s.done - 1)
  const flare = s.total > 0 && s.done >= s.total && s.doneAge < FLARE
  for (let k = 0; k < slots; k++) {
    const x = cx - GRAVE_PITCH * (k + 1)
    const glint = k === mod(t >> 2, Math.max(slots, 6))
    if (k >= count) {
      // An old grave where no task is: a low stone or a small cross, sunk in the fog.
      const old = noise(k * 5 + 3) < 0.6 ? ['...', '.oo', '.oo'] : ['.o.', 'ooo', '.o.']
      draw(cv, x, 3, old, { o: glint ? STONE : OLD })
      continue
    }
    draw(cv, x, 3, ['cSc', 'SSS', 'SSS'], { S: STONE, c: OLD })
    if (glint) plot(cv, x + 1, 3, STONE_LIT)
    let [body, tip] = k < lit ? [SOUL, SOUL_HI] : [mod(t + 3 * k, 12) < 6 ? UNLIT : OLD, '']
    const a = s.doneAge
    if (k === lit - 1 && fresh) body = tip = a < 4 ? mix(UNLIT, PALE, (a + 1) / 4) : mix(PALE, SOUL, (a - 3) / 4)
    else if (k < lit && flare && mod(a + k, 4) < 2) body = tip = PALE
    plot(cv, x + 1, 2, body)
    if (tip) plot(cv, x + 1, 1, tip)
    if (k < lit && mod(t + k, 2) === 0) plot(cv, x + 1, 0, tip)
  }
}

/** A skeleton's pixels from `pose`, `f` (0..7) frames into its collapse: the arms and spine drop onto the ribs at
 * 1, all of it onto the legs at 3, the skull drops three from 4 to 6 as the arms spread a column: a bone pile,
 * the skull on top. Each row of its body keeps a run under the skull's, so nothing parts from it. */
function bones(pose: Pose, f: number): [number, number, string][] {
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v))
  const drop = [clamp(f - 3, 3), clamp(f - 3, 3), f < 1 ? 0 : f < 3 ? 1 : 2, clamp(f - 2, 1), 0]
  const out: [number, number, string][] = []
  for (const r of [4, 3, 2, 1, 0]) {
    ;[...SKELETON[pose][r]!].forEach((k, c) => {
      if (k !== '.') out.push([c + (r === 2 && f >= 4 ? (c < 2 ? -1 : 1) : 0), 2 + r + drop[r]!, k])
    })
  }
  return out
}

/** The sign beside his hood: the news first, else the act, a dot while it changes. */
function sign(s: Signals, t: number, k: { fail: boolean; pass: boolean; commit: boolean }) {
  if (k.fail) return { text: '×', c: RED }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (k.commit) return { text: '♛', c: GOLD }
  if (Math.min(s.actAge, s.toolAge) < CHANGE) return { text: '·', c: BONE_SHADE }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: mod(t, 8) < 6 ? '?' : ' ', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: SOUL_HI }
  if (s.act === 'think') return { text: frame(['·', '∘'], t >> 3), c: SOUL }
  return { text: frame(['z', 'Z'], t >> 2), c: OLD }
}

export function necromancerScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const a = s.newsAge
  const isFail = s.news === 'testFail' && a < BACK_END
  const isPass = s.news === 'testPass' && a < PASS
  const isCommit = s.news === 'commit' && a < CROWN_FRAMES
  const kind = s.tool ?? 'other'
  const ink = TOOL_INK[kind]
  const cx = w - 4
  const fit = [0, 1, 2, 3].filter(i => AX + PITCH * i + 5 < cx).length
  const shown = Math.min(s.agents, MAX_SKELETONS, fit)
  // The tool act's own, grown in over STREAM_IN frames of actAge and kept through any reaction.
  const gust = s.act === 'tool' ? Math.min(1, s.actAge / STREAM_IN) : 0
  const glow = isCommit ? Math.min(1, (a + 1) / 5, (CROWN_FRAMES - a) / 5) : 0
  const strike = strikeOf(t, s)

  // Layer 1: the moon (still, a glint crossing it on 16 frames) and the bats.
  draw(cv, 0, 0, MOON_ART, { M: MOON, S: MOON_SHADE })
  const gl = mod(t >> 1, 8)
  if (gl < 4) plot(cv, MOON_GLINT[gl]![0], MOON_GLINT[gl]![1], WHITE)
  bats(cv, t)
  // Layer 2: the fog and the ground, the graves and their flames.
  fog(cv, t, gust, s.act === 'say' ? SOUL : ink, glow, s.act === 'say')
  graves(cv, t, s, cx, AX + PITCH * shown, strike >= 0)

  // Layer 3: the skeletons in fixed slots, each over its open grave; the newest rises (arms up) over RISE frames
  // of agentsAge; they dig while he thinks or works, stand for ask and wait, wave for say, cheer a testPass and
  // fall into bone piles on a testFail.
  for (let i = 0; i < shown; i++) {
    const x = AX + PITCH * i
    for (let dx = -1; dx < 6; dx++) plot(cv, x + dx, FOG_Y, dx === 2 ? DIRT : MOUND)
    const rise = i === shown - 1 && s.agentsAge < RISE ? RISE - 1 - s.agentsAge : 0
    const dig = mod(t + 2 * i, 4)
    let pose: Pose = s.act === 'think' || s.act === 'tool' ? DIG[dig]! : 'stand'
    if (s.act === 'say') pose = mod(t + 2 * i, 8) < 4 ? 'up' : 'stand'
    if (isPass || rise > 0) pose = 'up'
    const f = isFail ? (a < FALL ? a : a < PILE_END ? FALL - 1 : BACK_END - 1 - a) : 0
    const eye = s.act === 'ask' && !isFail ? GOLD : SOCKET
    const inks: Record<string, string> = { W: BONE, E: eye, A: BONE_SHADE, R: BONE_SHADE, L: BONE }
    for (const [dx, y, k] of bones(isFail ? 'stand' : pose, f)) {
      if (y + rise <= FOG_Y) plot(cv, x + dx, y + rise, inks[k]!)
    }
    const clod = CLOD[dig]
    if (pose === DIG[dig] && !isFail && rise === 0 && clod && (s.act === 'think' || s.act === 'tool')) {
      plot(cv, x + clod[0], clod[1], DIRT)
    }
  }

  // Layer 4: the necromancer. A tool raises the staff a pixel; the orb pulses on 12 frames while he thinks,
  // takes the tool's colour, blazes gold for ask (its glow down the staff), flickers for say, dims to wait (eyes
  // shut but a peek every 24 frames); testFail recoils him a column (eyes red) when no skeleton stands, testPass
  // flashes him, a commit crowns him.
  const back = isFail && shown === 0 && a >= 1 && a < RECOIL_END ? 1 : 0
  const nx = NX - back
  const sx = nx + STAFF
  const lift = s.act === 'tool' && s.actAge >= 2 ? 1 : 0
  const p = (1 - Math.cos((2 * Math.PI * mod(t, 12)) / 12)) / 2
  const shut = mod(t, 24) < 20
  let [orb, halo, eyes] = [mix(SOUL_DIM, SOUL_HI, p), mix(HALO_DIM, SOUL, p), SOUL]
  if (s.act === 'tool') [orb, halo, eyes] = [mix(SOUL, ink, gust), mix(HALO_DIM, ink, gust * (0.5 + 0.5 * p)), SOUL]
  else if (s.act === 'ask') [orb, halo, eyes] = [GOLD, mix(GOLD_DIM, GOLD, p), GOLD]
  else if (s.act === 'say') [orb, halo, eyes] = mod(t, 4) < 2 ? [SOUL_HI, SOUL, SOUL_HI] : [SOUL, HALO_DIM, SOUL]
  else if (s.act === 'wait') [orb, halo, eyes] = [mix(HALO_DIM, SOUL_DIM, p), HALO_DIM, shut ? HOOD : SOUL_DIM]
  if (isFail && a < 12) orb = mod(a, 4) < 2 ? RED : orb
  if (back > 0) eyes = RED
  if (isPass) [eyes, orb] = [WHITE, mod(a, 4) < 2 ? WHITE : orb]
  if (strike >= 0) orb = WHITE
  draw(cv, nx, 2, NECRO, { H: HOOD, E: eyes, R: ROBE, D: HOOD, h: BONE })
  for (let y = 2 - lift; y <= FOG_Y - lift; y++) plot(cv, sx, y, WOOD)
  const oy = 1 - lift
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) plot(cv, sx + dx!, oy + dy!, halo)
  plot(cv, sx, oy, orb)
  if (s.act === 'ask' && s.actAge >= 2) plot(cv, sx + 1, 2, GOLD_DIM)
  if (isCommit) {
    // The crown wipes in from the orb's side a column a frame, and out the same way; its gold eases in and out.
    const shownFrom = Math.max(0, WIPE - 1 - a, a - (CROWN_FRAMES - WIPE))
    const gold = mix(GOLD_DIM, GOLD, Math.min(1, (a + 1) / WIPE, (CROWN_FRAMES - a) / WIPE))
    CROWN.forEach((row, y) => [...row].forEach((k, c) => {
      if (k !== '.' && c >= shownFrom) plot(cv, nx + c, y, k === 'G' ? SOUL : gold)
    }))
  }

  // bash's lightning: the night lights up, the bolt grows up from the cross (two pixels, then a fork to the top).
  if (strike >= 0) {
    const k = strike === 0 ? 0.5 : 0.25
    for (let i = 0; i < cv.px.length; i++) if (cv.px[i]) cv.px[i] = mix(cv.px[i]!, WHITE, k)
    plot(cv, cx + 1, 2, WHITE)
    plot(cv, cx, 1, strike === 0 ? WHITE : BOLT)
    if (strike === 1) for (const dx of [-1, 1]) plot(cv, cx + dx, 0, BOLT)
  }

  const g = cells(cv)
  const { text, c } = sign(s, t, { fail: isFail, pass: isPass, commit: isCommit })
  put(g, nx - 1, 1, text, { c, b: true })
  if (strike >= 0) {
    for (const row of g) for (const c of row) if (!c.bg && c.ch !== '█' && c.ch !== '') c.bg = SKY_FLASH[strike]
  }
  return g
}

/** A tiny skull: a rounded cranium, two dark sockets with a glint of green in each, a nose notch, a row of teeth. */
export const PET: PetArt = {
  body: ['...WWWWWW...', '..WSSWWSSW..', '..WSSWWSSW..', '..WWWNNWWW..', '...WTWWTW...'],
  step: ['...WWWWWW...', '..WSSWWSSW..', '..WSSWWSSW..', '..WWWNNWWW..', '...TWTTWT...'],
  colors: { W: BONE, S: SOCKET, N: SOCKET, T: OLD },
  eyes: [3, 7],
  eyeRow: 1,
  eye: SOUL,
  lid: SOCKET,
  mouth: [5, 4],
  spark: SOUL,
}

export const NECROMANCER: Theme = {
  name: 'necromancer',
  rows: SCENE_ROWS,
  color: SOUL,
  accent: BONE,
  sprite: {
    think: ['†·  ', '† · ', '†  ·', '† · '],
    tool: ['†~  ', '† ~ ', '†  ~', '† ~ '],
    say: ['† ♪', '† ♫'],
    wait: ['† .', '† ..', '† ...'],
  },
  happy: '† ✓',
  sad: '† …',
  dead: '☠',
  sleep: '† zZ',
  confetti: ['✦', '·', '+', '°'],
  palette: [SOUL, BONE, SOUL_HI, GOLD],
  scene: necromancerScene,
  pet: PET,
}
