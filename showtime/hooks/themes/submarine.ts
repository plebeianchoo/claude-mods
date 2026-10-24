// Theme: submarine. Its scene, its words and its pet.
//
// The scene: a yellow submarine holding the left third of the deep (#4361ee) while light rays, fish and the
// seabed drift past, each layer at its own speed by `t` alone; its wake streams back and its propeller turns,
// a sign over the bow reads the act. think: a sonar ring every twelve frames, a cell a frame; ask: the
// periscope rises over four frames, its lens glinting; say: a lamp on the sail blinks morse; tool: the propeller spins
// on two frames in the tool's colour, its wash tinted, bash dives a pixel deeper. A torpedo leaves the bow per
// done task, a depth-gauge pip per task top right (floor-scaled); an escort sub per agent behind, greeting in
// place. testFail springs a leak (drops inside, bubbles out, nose down ten frames); testPass flashes the
// portholes; a commit surfaces it a pixel a frame with a flag for sixteen frames, then it sinks back.
// Motion rules: fish and weeds keep to the seabed's cell row (always full); rays are one cell wide per row;
// the ring is clipped ahead of the bow and is born beside the sign, whose start steadies it as it detaches.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>

/** The sub, 11×4 from its left column and its sail's pixel row: the sail, the hull with portholes, the bow
 * at the right; the propeller's hub at column 0, its blades flicking out by the shaft at column 1. */
const SUB = ['......SS...', '..HHHHHHHH.', '.DHHWHWHWHH', '..HHHHHHHH.']
const SUB_W = 11
const SAIL_Y = 2
const SIGN_DX = 11
/** Columns from the sail's back: the periscope's shaft; the say lamp; the leak's crack; the tilt's hinges
 * (the bow alone dips first and rises last, so the tilt eases in and out). */
const SCOPE_DX = 7
const LAMP_DX = 6
const CRACK_DX = 3
const TILT_DX = 5
const BOW_DX = 8
/** The sonar ring: its origin from the sub's left column, its lag per pixel row from the sail's, and the
 * first column it shows in (clear of the bow). */
const RING_DX = 10
const RING_LAG = [3, 2, 1, 0, 0, 1]
const RING_FROM = SUB_W
const RING_FRAMES = 12
const ESCORT = ['..S..', 'PHHHN']
const ESCORT_PITCH = 6
const MAX_AGENTS = 4
const FISH = ['.EBB.T', 'BBBBTT']
const FISH_W = 6
const PIPS = 8
const WAKE = 6
/** Frames: an act's turn, a dive, a greeting, a torpedo's run, the newest pip's flash, the 100% roll. */
const [TURN_FRAMES, DIVE_AT, GREET_FRAMES, TORPEDO_FRAMES, PIP_FLASH, ROLL_FRAMES] = [4, 2, 8, 14, 8, 16]
/** Frames: the leak, the tilt (from, to), the escaping bubbles; testPass; the flag held at the surface. */
const [LEAK_FRAMES, TILT_FROM, TILT_TO, BUBBLE_FRAMES, PASS_FRAMES, FLAG_FRAMES] = [20, 2, 12, 15, 12, 16]
const MORSE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0]

const DEEP = '#4361ee'
const HULL = '#ffd166'
const SAIL = '#f4a261'
const SHAFT = '#8d99ae'
const GLASS = '#bde0fe'
const GOLD = '#ffd60a'
const WHITE = '#ffffff'
const RED = '#ef476f'
const WATER = '#7ec8e3'
const PALE = '#cfd8dc'
const RAYS = ['#6c8cff', '#5f7cf2', '#5068d8', '#4a5fc4']
const SAND = ['#8a7650', '#a08a5c', '#6f6045']
const WEED = ['#2d9c6a', '#52b788']
const ROCK = '#6c757d'
const WAKE_INK = ['#d0e1ff', '#a8c5ff', '#7a9cf0', '#5a78f0']
const RING_INK = ['#e0f0ff', '#b3cfff', '#8eacf5', '#7090e0']
const PIP_OFF = '#4a5584'
const PIP_ON = '#80ffdb'
const HUES = ['#7dcfff', '#bb9af7', '#f7768e', '#9ece6a']
const FISH_HUES = ['#ff9e40', '#4cc9f0', '#ff7eb6']
const PALETTE = [DEEP, HULL, '#4cc9f0', '#c77dff', PIP_ON]
const TOOL_INK: Record<ToolKind, string> = {
  bash: GOLD, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

/** Light rays slanting down from the top over four pixel rows, a cell every six frames, one cell per row;
 * their lower half shows only in open water past `from` (clear of the escorts, the sub and the ring's birth),
 * their top pixel passes behind the gauge's pips from `gaugeL`. */
function rays(cv: Canvas, t: number, from: number, gaugeL: number): void {
  const n = Math.max(2, Math.floor(cv.w / 14))
  const span = cv.w + 4
  for (let i = 0; i < n; i++) {
    const x = mod(Math.floor((i * span) / n + noise(i + 7) * 4) - Math.floor(t / 6), span) - 2
    for (let y = 0; y < 4; y++) if (y === 0 ? x < gaugeL : y === 1 || x + 1 > from) plot(cv, x + (y >> 1), y, RAYS[y]!)
  }
}

/** The seabed: sand along the bottom pixel row, weeds and rocks on it, a cell every three frames; fish over
 * it a cell every two frames, two pixels tall, all in the bottom cell row. */
function seabed(cv: Canvas, t: number): void {
  const off = Math.floor(t / 3)
  for (let x = 0; x < cv.w; x++) {
    const u = x + off
    const n = noise(u)
    plot(cv, x, 7, n < 0.25 ? SAND[2]! : n > 0.85 ? SAND[1]! : SAND[0]!)
    if (noise(u + 50) < 0.12) plot(cv, x, 6, WEED[mod(t + u * 5, 12) < 6 ? 0 : 1]!)
    else if (noise(u + 90) < 0.05) plot(cv, x, 6, ROCK)
  }
  const n = Math.max(1, Math.floor(cv.w / 24))
  const span = cv.w + FISH_W + 3
  for (let i = 0; i < n; i++) {
    const x = mod(Math.floor((i * span) / n + noise(i + 3) * 6) - (t >> 1), span) - FISH_W
    const c = FISH_HUES[i % FISH_HUES.length]!
    draw(cv, x, 6, FISH, { E: WHITE, B: c, T: GOLD })
  }
}

/** The wake behind the propeller: bubbles every other cell streaming back a cell a frame, `len` cells; once
 * dived on bash a second row over it, offset, so the wake runs solid (in one cell row, clear of the fish) but
 * for its last cell, flickering. */
function wake(cv: Canvas, t: number, x0: number, y: number, len: number, bash: boolean, tint?: string): void {
  for (let k = 0; k < len; k++) {
    const ink = k < 2 && tint ? tint : WAKE_INK[Math.min(3, Math.floor((k * 4) / len))]!
    if (mod(k + t, 2) === 0) plot(cv, x0 - 1 - k, y, ink)
    else if (bash && k < len - 1) plot(cv, x0 - 1 - k, y - 1, ink)
  }
}

/** The sub: SUB at (x, y), the columns from `hinge` on a pixel lower (nose down); the propeller's hub, and
 * its blades above and below the shaft when `blades`. */
function sub(cv: Canvas, x: number, y: number, ink: Ink, blades: boolean, hinge: number): void {
  SUB.forEach((line, j) => {
    for (let i = 0; i < line.length; i++) {
      const c = ink[line[i]!]
      if (c) plot(cv, x + i, y + j + (i >= hinge ? 1 : 0), c)
    }
  })
  plot(cv, x, y + 2, ink.P!)
  if (blades) for (const j of [1, 3]) plot(cv, x + 1, y + j, ink.P!)
}

/** The sonar ring: an arc ahead of the bow, every pixel row a cell further each frame, lagging by RING_LAG
 * above and below the bow's row, shown only clear of the bow; dimming as it spreads. */
function ring(cv: Canvas, x: number, y: number, r: number): void {
  const ink = RING_INK[Math.min(3, r >> 2)]!
  for (let j = 0; j < RING_LAG.length; j++) {
    const px = y - SAIL_Y + j
    const dx = RING_DX + r - RING_LAG[j]!
    if (px >= 0 && dx >= RING_FROM && Math.abs(j - 3) <= r) plot(cv, x + dx, px, ink)
  }
}

/** The escorts: an escort sub per agent (four at most, as many as fit) in a slot behind the sub, all edging a
 * column back and forth together on a twelve-frame beat, propellers flickering; the newest flashes as it joins. */
function escorts(cv: Canvas, t: number, s: Signals, subX: number): void {
  const n = Math.min(s.agents, MAX_AGENTS, Math.floor((subX - 1) / ESCORT_PITCH))
  for (let i = 0; i < n; i++) {
    const x = subX - 1 - ESCORT_PITCH * (i + 1) - (mod(t, 12) < 6 ? 0 : 1)
    const flash = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const c = flash ? WHITE : HUES[i]!
    draw(cv, x, SAIL_Y, ESCORT, { S: c, H: c, N: flash ? WHITE : GLASS, P: mod(t, 2) === 0 ? SHAFT : PALE })
  }
}

/** The depth gauge: `count` pips at the top right (floor-scaled), `done` of them lit, the newest
 * flashing, rolling the palette at 100%. */
function gauge(cv: Canvas, s: Signals, count: number): void {
  const lit = s.total > count ? Math.floor((s.done * count) / s.total) : Math.min(s.done, count)
  const roll = s.total > 0 && s.done >= s.total && s.doneAge < ROLL_FRAMES
  for (let j = 0; j < count; j++) {
    let c = j < lit ? PIP_ON : PIP_OFF
    if (j === lit - 1 && s.doneAge < PIP_FLASH && mod(s.doneAge, 2) === 0) c = WHITE
    else if (j < lit && roll) c = frame(PALETTE, j + (s.doneAge >> 1))
    plot(cv, cv.w - 1 - 2 * (count - 1 - j), 0, c)
  }
}

/** A torpedo per done task: out of the bow a cell a frame, a bubble trail behind, dimming before it ends. */
function torpedo(cv: Canvas, x: number, y: number, age: number): void {
  const dim = age >= TORPEDO_FRAMES - 3
  plot(cv, x, y, dim ? SHAFT : RED)
  plot(cv, x - 1, y, dim ? '#6c757d' : PALE)
  for (const k of [3, 5]) if (age >= k) plot(cv, x - k, y, WAKE_INK[k >> 1]!)
}

/** The leak: a crack in the hull blinking, drops falling inside (tilting with it), bubbles escaping up. */
function leak(cv: Canvas, x: number, y: number, age: number, hinge: number): void {
  plot(cv, x + CRACK_DX, y + 1, mod(age, 2) === 0 ? WHITE : RED)
  for (const dx of [5, 7]) plot(cv, x + dx, y + 1 + mod(age + dx, 3) + (dx >= hinge ? 1 : 0), WATER)
  for (let k = 0; 3 * k < BUBBLE_FRAMES; k++) {
    const life = age - 3 * k
    if (life >= 0 && life < y) plot(cv, x + CRACK_DX, y - life, GLASS)
  }
}

/** The sign over the bow: the news first, else the act, a dot while the act turns; one cell always. */
function sign(s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean) {
  if (isFail) return { text: '×', c: RED }
  if (isPass) return { text: frame(['★', '☆'], t >> 1), c: GOLD }
  if (isCommit) return { text: '✓', c: GOLD }
  if (age < TURN_FRAMES) return { text: '·', c: PALE }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: GLASS }
  if (s.act === 'think') return { text: '◌', c: GLASS }
  return { text: frame(['z', 'Z'], t >> 2), c: PALE }
}

export function submarineScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const isBash = isTool && s.tool === 'bash'
  const isFail = s.news === 'testFail' && s.newsAge < LEAK_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const age = Math.min(s.actAge, s.toolAge)
  const x = Math.floor(w / 3)
  // Its depth: a pixel deeper on bash (on `actAge`, so a bash after a bash does not dive again); a commit
  // lifts the sail to the band's top a pixel a frame, holds it there FLAG_FRAMES, and lets it back down.
  const top = SAIL_Y + (isBash && s.actAge >= DIVE_AT ? 1 : 0)
  const a = s.news === 'commit' ? s.newsAge : 999
  const rise = Math.max(0, Math.min(top, a, 2 * top + FLAG_FRAMES - a))
  const isCommit = a < 2 * top + FLAG_FRAMES
  const y = top - rise
  // The leak's tilt: the bow dips two frames, then the front half, and back the same way.
  const tiltAge = isFail ? Math.min(s.newsAge - TILT_FROM, TILT_TO - 1 - s.newsAge) : -1
  const hinge = tiltAge < 0 ? SUB_W : tiltAge < 2 ? BOW_DX : TILT_DX

  // The gauge's pips, as many as fit past the sonar ring's reach.
  const pips = Math.min(s.total, PIPS, Math.max(0, Math.floor((w - x - RING_DX - RING_FRAMES - 1) / 2)))
  // Layer 1: the light rays; layer 2: the seabed with its weeds and fish; layer 3: the escorts, the wake.
  rays(cv, t, x + SUB_W + 1, pips > 0 ? w - 2 * pips + 1 : w)
  seabed(cv, t)
  escorts(cv, t, s, x)
  wake(cv, t, x, y + 2, WAKE, top > SAIL_Y, isTool ? TOOL_INK[s.tool ?? 'other'] : undefined)
  // Layer 4: the sonar ring, the torpedo, the sub; the periscope, the lamp, the flag; the news over it.
  if (s.act === 'think') ring(cv, x, y, mod(s.actAge, RING_FRAMES))
  if (s.done > 0 && s.doneAge < TORPEDO_FRAMES) torpedo(cv, x + SUB_W + s.doneAge, y + 2, s.doneAge)
  // The propeller: a turn every four frames, every frame in a tool once it has spun up.
  const blades = isTool && s.actAge >= TURN_FRAMES ? mod(t, 2) === 1 : mod(t + 1, 4) >= 2
  let port = GLASS
  if (isFail) port = mod(t, 2) === 0 ? RED : '#9d0208'
  else if (isPass) port = mod(t, 2) === 0 ? WHITE : GOLD
  const prop = isTool ? TOOL_INK[s.tool ?? 'other'] : SHAFT
  sub(cv, x, y, { S: SAIL, H: HULL, D: SHAFT, W: port, P: prop }, blades, hinge)
  if (s.act === 'ask') {
    const h = Math.min(2, s.actAge)
    for (let j = 1; j <= h; j++) plot(cv, x + SCOPE_DX, y - j, SHAFT)
    if (s.actAge >= 3) plot(cv, x + SCOPE_DX + 1, y - 2, mod(t, 12) < 2 ? WHITE : GLASS)
  }
  if (s.act === 'say' && s.actAge >= 2 && y > 0) plot(cv, x + LAMP_DX, y - 1, frame(MORSE, t) ? WHITE : '#9a7b2c')
  if (isCommit && rise === top) {
    // At the surface: foam at both ends, the flag run up a pixel a frame and down again, flapping between.
    const flag = Math.min(3, a - top + 1, top + FLAG_FRAMES - a + 1)
    for (let k = 0; k < flag; k++) if (k < 2 || mod(t, 4) < 2) plot(cv, x + 5 - k, 0, k === 1 ? WHITE : RED)
    for (const dx of [1, SUB_W - 1]) plot(cv, x + dx, 1, WHITE)
  }
  if (isFail) leak(cv, x, y, s.newsAge, hinge)
  gauge(cv, s, pips)

  const g = cells(cv)
  const { text, c } = sign(s, t, age, isFail, isPass, isCommit)
  put(g, x + SIGN_DX, 0, text, { c, b: true })
  return g
}

/** A jellyfish: a domed bell with a scalloped rim, eyes on the bell, two tentacles and two arms trailing. */
export const PET: PetArt = {
  body: ['....HBBB....', '...HBBBBB...', '..RBRBRBRR..', '..T.O.O.T...', '.T..O.O..T..'],
  step: ['....HBBB....', '...HBBBBB...', '..RBRBRBRR..', '...TO.O.T...', '...TO.O.T...'],
  colors: { B: '#c77dff', H: '#e0aaff', R: '#e0aaff', T: '#ff9ee5', O: '#f1c0ff' },
  eyes: [5, 7],
  eyeRow: 1,
  eye: '#3c096c',
  lid: '#c77dff',
  blush: '#ff8fab',
  spark: '#80ffdb',
}

export const SUBMARINE: Theme = {
  name: 'submarine',
  rows: SCENE_ROWS,
  color: DEEP,
  accent: HULL,
  sprite: {
    think: ['◖)   ', '◖ )  ', '◖  ) ', '◖   )'],
    tool: ['◖≈  ', '◖ ≈ ', '◖  ≈', '◖ ≈ '],
    say: ['◖ ♪', '◖ ♫'],
    wait: ['◖ .', '◖ ..', '◖ ...'],
  },
  happy: '◖ ★',
  sad: '◖ …',
  dead: '◖ ✕',
  sleep: '◖ zZ',
  confetti: ['○', '◦', '·', '°'],
  palette: PALETTE,
  scene: submarineScene,
  pet: PET,
}
