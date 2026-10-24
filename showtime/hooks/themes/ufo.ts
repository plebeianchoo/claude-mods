// Theme: ufo. Its scene, its words and its pet.
//
// The scene: a flying saucer over a farm at night (#b5e48c): a barn and a stretch of fence standing still,
// stars twinkling, grass tufts swaying, cows grazing. The saucer hovers at a fixed column in the right half,
// bobbing a pixel on twelve frames by `t`, rim lights chasing; a sign left of it reads the act. A cow per task
// (floor-scaled) at fixed spots, nearest the saucer first: a done one rises from its spot in a shaft of light
// (a pixel every two frames), then fades. A tool beam grows down and sweeps on `t` over them as light, wide on
// bash, in the tool's colour; a small saucer per agent in a fixed slot, flashing as it joins. testFail
// rocks it down to the grass (each half a pixel a frame), smoking, and lifts it back by frame 30; a commit
// zips it right a cell a frame for eight frames, fading, and fades it back in where it left; testPass flashes.
// Motion rules: the grass fills pixel row 7; cows never move sideways; the sign's tail dot blinks every frame.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** The saucer, 9×3 from its left column and its dome's pixel row: dome (a pilot inside), rim, underside. */
const SAUCER = ['...DPD...', 'RRRRRRRRR', '..UUUUU..']
const MINI = ['.DD.', 'RRRR']
/** Widths: the saucer, a mini's slot, a cow, a cow's slot, the barn, its fence; the most agents and cows. */
const [SAUCER_W, MINI_PITCH, COW_W, COW_PITCH, BARN_W, FENCE_W, MAX_AGENTS, MAX_COWS] = [9, 5, 7, 8, 10, 4, 4, 10]
/** Pixel rows: the cows' top, the fence's rail, the grass; the saucer's lowest top (resting on the grass). */
const [COW_Y, RAIL_Y, GRASS_Y, GROUND_Y] = [4, 5, 7, 4]
/** Frames: an act's change, a beamed cow's rise and its fade, a greeting, testPass, the 100% roll. */
const [CHANGE_FRAMES, BEAM_FRAMES, FADE_FROM, GREET_FRAMES, PASS_FRAMES, ROLL_FRAMES] = [4, 20, 8, 8, 16, 16]
/** testFail by frame: how far down its left and right halves are, rocking as it tumbles (each half a pixel a
 * frame at most), resting tilted on the grass, lifting back a half at a time, slower at both ends; smoke. */
const FAIL_L = [0, 0, 1, 2, 2, 2, 3, 4, 4, 4, ...Array(8).fill(4), 4, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0, 0]
const FAIL_R = [0, 1, 1, 1, 2, 3, 3, 3, 4, 5, ...Array(8).fill(5), 5, 4, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0]
const [SMOKE_FROM, SMOKE_TO] = [9, 22]
/** commit by frame: lights flash, zip (a cell a frame), gone, fade back in, done. */
const [ZIP_FROM, ZIP_FRAMES, BACK_FROM, BACK_FRAMES] = [2, 8, 16, 8]
/** The tool beam's sweep: its foot's offset, two frames each. */
const SWEEP = [0, 1, 2, 2, 1, 0, -1, -2, -2, -1]
const BOB = [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0]

/** Cows, facing left, 7×4: head up, mid, grazing; the tail flicks at column 6. */
const COW = [
  ['HH.....', 'PHSWWS.', '..WWSWT', '..L..L.'],
  ['.......', 'HHSWWS.', 'PHWWSWT', '..L..L.'],
  ['.......', '.HSWWS.', 'HHWWSWT', 'PHL..L.'],
]
const BARN = ['..rrrrrr..', '.rrrrrrrr.', 'TRRRYYRRRT', '.RRWWWWRR.', '.RRWDDWRR.', '.RRWDDWRR.']

const SKY = '#1b1d2b'
const [HULL, RIM, DOME, UNDER, PILOT] = ['#adb5bd', '#ced4da', '#a8dadc', '#6c757d', '#80ed99']
const [WHITE, GOLD, RED, SMOKE, SMOKE_DIM] = ['#ffffff', '#ffd60a', '#ef476f', '#ced4da', '#8d99ae']
const [GRASS, GRASS_2, TUFT, RAIL, POST] = ['#40916c', '#52b788', '#74c69d', '#9c6644', '#b08968']
const BARN_INK = { r: '#9d0208', R: '#c1121f', T: '#f8f9fa', W: '#f8f9fa', D: '#780000', Y: '#ffd166' }
const COW_INKS = [{ W: '#f8f9fa', H: '#f8f9fa', S: '#6c757d', P: '#ffadad', L: '#adb5bd', T: '#adb5bd' },
  { W: '#f8f9fa', H: '#bc6c25', S: '#bc6c25', P: '#ffadad', L: '#dda15e', T: '#bc6c25' }]
const STARS = ['#e0e1dd', '#778da9']
const SHAFT = '#d9ed92'
const LIGHTS = ['#ffd60a', '#ff5d8f', '#4cc9f0', '#80ed99']
const MINI_INK = ['#bb9af7', '#7dcfff', '#ff9e64', '#9ece6a']
const TOOL_INK: Record<ToolKind, string> = {
  bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7',
  other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '*', agent: '&', web: '◎',
  other: '✦' }
const mirror = (art: readonly string[]) => art.map(r => [...r].reverse().join(''))

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** Draws `art` blended toward the sky by `fade` (0: as drawn, 1: gone). */
function ghost(cv: Canvas, x: number, y: number, art: readonly string[], ink: Record<string, string>, fade = 0): void {
  if (fade >= 1) return
  const faded = Object.fromEntries(Object.entries(ink).map(([k, c]) => [k, mix(c, SKY, fade)]))
  draw(cv, x, y, art, faded)
}

/** The barn at the left and a stretch of fence beside it, both still; the grass under them, its tufts swaying. */
function farm(cv: Canvas, t: number, hasBarn: boolean): void {
  if (hasBarn) {
    draw(cv, 1, 1, BARN, BARN_INK)
    for (let x = BARN_W + 1; x < BARN_W + 1 + FENCE_W; x++) {
      for (const y of [RAIL_Y - 1, RAIL_Y]) plot(cv, x, y, RAIL)
      if (mod(x - BARN_W - 1, 3) === 0) for (let y = RAIL_Y - 2; y < GRASS_Y; y++) plot(cv, x, y, POST)
    }
  }
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, GRASS_Y, noise(x + 40) < 0.3 ? GRASS_2 : GRASS)
    // Tufts sway a column in the breeze, each on its own beat of sixteen frames.
    const sway = mod(t + 5 * x, 16) < 8 ? 0 : 1
    if (noise(x + 60) < 0.15 && !(hasBarn && x <= BARN_W + 1)) plot(cv, x + sway, GRASS_Y - 1, TUFT)
  }
}

/** Stars in the top three pixel rows, clear of the barn and the saucers, each twinkling on its own beat. */
function stars(cv: Canvas, t: number, busy: (x: number) => boolean): void {
  const n = Math.max(3, Math.floor(cv.w / 4))
  for (let i = 0; i < n; i++) {
    const x = Math.floor(noise(i + 3) * cv.w)
    if (busy(x)) continue
    plot(cv, x, Math.floor(noise(i + 9) * 3), mod(t + 7 * i, 18) < 3 ? STARS[0]! : STARS[1]!)
  }
}

/** The tool beam: from under the saucer down to the grass, each row a column wider every two, its foot swept
 * by `sweep`; `rows` of it shown (it grows a row a frame), `k` its strength; a pool of light on the grass. */
function beam(cv: Canvas, x: number, y: number, sweep: number, wide: boolean, ink: string, rows: number, k: number) {
  for (let r = y + 3; r < Math.min(GRASS_Y, y + 3 + rows); r++) {
    const c = x + 4 + Math.round((sweep * (r - 2)) / 4)
    const hw = 1 + ((r - 3) >> 1) + (wide && r > 3 ? 1 : 0)
    for (let dx = -hw; dx <= hw; dx++) {
      const under = cv.px[r * cv.w + c + dx] ?? SKY
      if (c + dx >= 0 && c + dx < cv.w) plot(cv, c + dx, r, mix(under, ink, (Math.abs(dx) === hw ? 0.35 : 0.6) * k))
    }
    if (r === GRASS_Y - 1) for (let dx = -hw; dx <= hw; dx++) {
      const under = cv.px[GRASS_Y * cv.w + c + dx]
      if (under) plot(cv, c + dx, GRASS_Y, mix(under, ink, 0.5 * k))
    }
  }
}

/** The saucer at (x, y), its left four columns a pixel lower (tilt -1) or its right four (+1); `lights` for
 * each rim pixel, faded toward the sky by `fade`. */
function saucer(cv: Canvas, x: number, y: number, tilt: number, lights: (i: number) => string, fade: number) {
  if (fade >= 1) return
  SAUCER.forEach((line, j) => {
    for (let i = 0; i < SAUCER_W; i++) {
      const key = line[i]
      if (key === '.') continue
      const ink = key === 'R' ? lights(i) : key === 'D' ? DOME : key === 'P' ? PILOT : UNDER
      const dy = (tilt < 0 && i < 4) || (tilt > 0 && i > 4) ? 1 : 0
      plot(cv, x + i, y + j + dy, mix(ink, SKY, fade))
    }
  })
}

/** The sign left of the saucer: the news first, else the act, a dot while the act changes; its tail dot blinks
 * every frame, so no frame can hold. */
function sign(s: Signals, t: number, age: number, k: { fail: boolean; pass: boolean; commit: boolean }) {
  const dot = mod(t, 2) === 0 ? '·' : ''
  if (k.fail) return { text: '×' + dot, c: RED }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1) + dot, c: GOLD }
  if (k.commit) return { text: '✓' + dot, c: GOLD }
  if (age < CHANGE_FRAMES) return { text: '·' + dot, c: RIM }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + dot, c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?' + dot, c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2) + dot, c: LIGHTS[1]! }
  if (s.act === 'think') return { text: '◌' + dot, c: DOME }
  return { text: frame(['z', 'Z'], t >> 2) + dot, c: SMOKE_DIM }
}

export function ufoScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const hasBarn = w >= 40
  const fieldL = hasBarn ? BARN_W + FENCE_W + 2 : 1
  const sx = Math.max(fieldL + 4, Math.min(w - SAUCER_W - 2, Math.floor(w * 0.62)))
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_L.length
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < BACK_FROM + BACK_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const a = s.newsAge
  // Its place: the bob by `t` (held from the reaction's start while it crashes), the reaction's own motion.
  let [x, y, tilt, fade] = [sx, BOB[mod(t, 12)]!, 0, 0]
  if (isFail) {
    const [l, r] = [FAIL_L[a]!, FAIL_R[a]!]
    ;[y, tilt] = [Math.min(GROUND_Y, BOB[mod(t - a, 12)]! + Math.min(l, r)), Math.sign(r - l)]
  }
  if (isCommit && a >= ZIP_FROM) {
    const zip = Math.min(ZIP_FRAMES, a - ZIP_FROM + 1)
    if (a < BACK_FROM) [x, fade] = [sx + zip, sx + ZIP_FRAMES >= w ? 0 : zip / ZIP_FRAMES]
    else fade = 1 - (a - BACK_FROM + 1) / (BACK_FRAMES + 1)
  }
  // Agents: a small saucer per agent in a fixed slot left of the sign, as many as fit in the sky right of the
  // barn (over the fence: the minis fly in pixel rows 0-2, the fence stands in 3-6).
  const skyL = hasBarn ? BARN_W + 1 : 1
  const slots = Math.min(MAX_AGENTS, Math.max(0, Math.floor((sx - 9 - skyL) / MINI_PITCH) + 1))
  const minis = Math.min(s.agents, slots)
  // Two columns clear of the sign, so a bobbing mini never parts from it.
  const miniX = (i: number) => sx - 9 - MINI_PITCH * i
  const busy = (c: number) => (hasBarn && c <= BARN_W + 1) || (c >= sx - 4 && c <= sx + SAUCER_W + 1) ||
    (c >= miniX(slots - 1) - 1 && c < sx - 4)

  // Layer 1: the stars; layer 2: the barn and the fence, still; the grass, its tufts swaying.
  stars(cv, t, busy)
  farm(cv, t, hasBarn)
  // Layer 3: the cows, at fixed spots; the done ones (nearest the saucer first) gone, the newest rising in a
  // shaft of light a pixel every two frames, into the saucer if it stood under it, fading out.
  // Spots: every COW_PITCH from the fence, taken nearest the saucer first; none depends on `total`.
  const spots = Array.from({ length: Math.floor((w - fieldL) / COW_PITCH) }, (_, k) => fieldL + k * COW_PITCH)
    .sort((p, q) => Math.abs(p + 3 - sx - 4) - Math.abs(q + 3 - sx - 4) || p - q).slice(0, MAX_COWS)
  const count = Math.min(s.total, MAX_COWS, spots.length)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  spots.slice(0, count).forEach((cx, j) => {
    const k = cx
    const rising = j === lit - 1 && s.doneAge < BEAM_FRAMES && lit > litOf(s.done - 1)
    if (j < lit && !rising) return
    const faces = noise(k + 31) < 0.5
    const ink = COW_INKS[noise(k + 41) < 0.7 ? 0 : 1]!
    if (rising) {
      const up = Math.min(COW_Y, s.doneAge >> 1)
      const f = Math.max(0, (s.doneAge - FADE_FROM + 1) / (BEAM_FRAMES - FADE_FROM))
      const top = Math.max(0, COW_Y - 1 - s.doneAge)
      for (let r = top; r < GRASS_Y; r++) for (let c = 2; c < COW_W - 1; c++) {
        plot(cv, cx + c, r, mix(cv.px[r * w + cx + c] ?? SKY, SHAFT, (c === 2 || c === 5 ? 0.45 : 0.75) * (1 - f)))
      }
      ghost(cv, cx, COW_Y - up, faces ? COW[0]! : mirror(COW[0]!), ink, f)
      return
    }
    const p = mod(t + Math.floor(noise(k + 51) * 32), 32)
    const head = p < 18 ? 0 : p < 20 || p >= 30 ? 1 : 2
    // Its tail flicks up a pixel for two frames in ten.
    const flick = mod(t + k * 3, 10) < 2
    const art = COW[head]!.map((row, j2) => (flick && j2 < 3 ? row.slice(0, 6) + (j2 === 1 ? 'T' : '.') : row))
    draw(cv, cx, COW_Y, faces ? art : mirror(art), ink)
  })
  // Layer 4: the tool beam over the cows as light, grown a row a frame and strengthening over CHANGE_FRAMES as
  // the act starts; it follows the saucer (faded with it), fades out over the crash's first three frames and
  // back in over its lift, home at full strength as the reaction ends.
  const crash = isFail ? Math.max(0, Math.min(1, (a + 1) / 3, (FAIL_L.length - 1 - a) / 8)) : 0
  if (s.act === 'tool') {
    const k = Math.min(1, (s.actAge + 1) / CHANGE_FRAMES) * (1 - fade) * (1 - crash)
    const ink = TOOL_INK[s.tool ?? 'other']
    if (k > 0) beam(cv, x, y, frame(SWEEP, t >> 1), s.tool === 'bash', ink, Math.min(9, s.actAge + 1), k)
  }
  // Layer 5: the minis, each bobbing on its own beat, the newest flashing as it joins; the saucer, its smoke.
  for (let i = 0; i < minis; i++) {
    const flash = i === minis - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const rim = flash ? WHITE : MINI_INK[i]!
    draw(cv, miniX(i), BOB[mod(t + 4 * i + 6, 12)]!, MINI, { D: DOME, R: mod(t + i, 6) < 1 ? WHITE : rim })
  }
  const lights = (i: number): string => {
    if (isFail) return a >= SMOKE_FROM && mod(t + i, 4) < 1 ? RED : HULL
    if (isPass || (allDone && s.doneAge < ROLL_FRAMES)) return frame(LIGHTS, i + (t >> 1))
    if (isCommit && a < ZIP_FROM) return WHITE
    if (mod(i, 2) === 1) return HULL
    if (s.act === 'think') return mod(i - (t >> 1), 4) === 0 ? GOLD : RIM
    if (s.act === 'tool') return mod(t + (i >> 1), 2) === 0 ? TOOL_INK[s.tool ?? 'other'] : RIM
    if (s.act === 'ask') return mod(t, 8) < 4 ? GOLD : RIM
    if (s.act === 'say') return frame(LIGHTS, (i >> 1) + (t >> 2))
    return mod(t, 16) < 8 ? '#5e7ce2' : RIM
  }
  if (isCommit && a >= ZIP_FROM && a < BACK_FROM && fade < 1) {
    for (const k of [1, 2, 3]) if (x - k >= sx) plot(cv, x - k, y + 1, mix(RIM, SKY, Math.min(1, fade + k / 4)))
  }
  saucer(cv, x, y, tilt, lights, fade)
  if (isFail && a >= SMOKE_FROM && a < SMOKE_TO) {
    for (let p = 0; p < 4; p++) {
      const life = a - SMOKE_FROM - 3 * p
      if (life < 0 || life > 8) continue
      const py = y - 1 - (life >> 1)
      if (py >= 0) plot(cv, x + 3 + mod(p, 3) + (life >> 2), py, life < 5 ? SMOKE : SMOKE_DIM)
    }
  }

  const g = cells(cv)
  if (s.total > 0 && w - 5 > sx + SAUCER_W + 1) {
    const readout = `${s.done}/${s.total}`
    put(g, w - 1 - readout.length, 0, readout, { c: allDone ? PILOT : RIM, b: true })
  }
  const age = Math.min(s.actAge, s.toolAge)
  const { text, c } = sign(s, t, age, { fail: isFail, pass: isPass, commit: isCommit })
  put(g, sx - 3, 0, text, { c, b: s.act !== 'think' || isFail || isPass || isCommit })
  return g
}

/** A little alien: a big green head tapering to its chin, two big dark eyes, antennae
 * with yellow tips (twitching in on a step). */
export const PET: PetArt = {
  body: ['..Y......Y..', '...GHHHHG...', '..GGGGGGGG..', '..GGGGGGGG..', '....GGGG....'],
  step: ['...Y....Y...', '...GHHHHG...', '..GGGGGGGG..', '..GGGGGGGG..', '....GGGG....'],
  colors: { G: '#80ed99', H: '#b7f7c4', Y: '#ffd60a' },
  eyes: [4, 3, 8, 7],
  eyeRow: 2,
  eye: '#3c096c',
  lid: '#80ed99',
  mouth: [5, 4],
  blush: '#ffadad',
  spark: '#caffbf',
}

export const UFO: Theme = {
  name: 'ufo',
  rows: SCENE_ROWS,
  color: '#b5e48c',
  accent: DOME,
  sprite: {
    think: ['◓·  ', '◓ · ', '◓  ·', '◓ · '], tool: ['◓▽  ', '◓ ▽ ', '◓  ▽', '◓ ▽ '],
    say: ['◓ ♪', '◓ ♫'], wait: ['◓ .', '◓ ..', '◓ ...'],
  },
  happy: '◓ ★',
  sad: '◓ …',
  dead: '◓ ✕',
  sleep: '◓ zZ',
  confetti: ['✦', '·', '∘', '+'],
  palette: ['#b5e48c', DOME, GOLD, '#ff5d8f'],
  scene: ufoScene,
  pet: PET,
}
