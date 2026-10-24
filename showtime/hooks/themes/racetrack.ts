// Theme: racetrack. Its scene, its words and its pet.
//
// The scene: an oval from the infield, the stands along the top (a flag every tenth column, the crowd doing
// the wave), the far straight a dim lane with cars streaming back, the grass and the near straight, where
// the lead car (#f72585) holds the left third while kerb, grass and stands scroll past at a speed each, by `t`
// alone. Its wheels turn every fourth frame on the pace lap (think), every frame at full speed (tool: exhaust
// in the tool's colour, skid dust, speed lines; bash: flames, dust every frame, longer lines). A car per agent
// in a fixed slot behind it, the newest blinking; a lap pip per task on the grass and a done/total board; a pit
// roof fades in over it while a permission waits, a wrench turning; testFail spins it round in eight frames in
// smoke; the chequered flag waves at 100%, a green flag on testPass, confetti on a commit.
// Motion rules: every pixel row but the sky is filled across the width, so movers change colour only; the
// sign's box over the car is the one hole, its tail dot blinking every frame, so no frame holds.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>

const LEAD_W = 9, AGENT_PITCH = 8, MAX_AGENTS = 4, MAX_PIPS = 12
/** Columns from the lead car's left edge: the sign's box over it, the wrench at its nose, the flag ahead. */
const SIGN_DX = 2, SIGN_W = 3
const WRENCH_DX = LEAD_W, FLAG_DX = LEAD_W + 4, FLAG_W = 4
const FLAG_PITCH = 10, CROWD_WAVE = 24, FAR_CAR_PITCH = 13, TUFT_PITCH = 5, STREAK_PITCH = 9
const EXHAUST_LIFE = 4, DUST_LIFE = 5
const [TURN_FRAMES, GREET_FRAMES, DONE_FLASH_FRAMES, ROOF_FRAMES] = [4, 8, 8, 4]
const [SPIN_FRAMES, FAIL_FRAMES, PASS_FRAMES, CHEQUER_FRAMES, COMMIT_FRAMES] = [8, 24, 16, 24, 20]
/** A commit's confetti: two pieces start falling a frame, a pixel a frame, over the car. */
const CONFETTI = 24
/** Its columns from the lead's left edge, clear of the sign's box (a piece would come out under it). */
const CONFETTI_DX = [-3, -2, -1, 0, 6, 7, 8, 9, 10, 11, 12, 13]
/** The spin-out's smoke: a puff every other frame from these columns of the car, drifting up and back. */
const SMOKE_XS = [1, 7, 4, 2, 6, 3], SMOKE_LIFE = 8

const PINK = '#f72585', PINK_DARK = '#b5179e', PINK_PALE = '#ffc8dd'
const GOLD = '#ffd60a', WHITE = '#ffffff'
const GREY = '#8d99ae', LIGHT = '#ced4da', DIM = '#6c757d'
const TYRE = '#3a3a44', ASPHALT = '#565a70', FAR = '#3d4052', GRASS = '#2d6a4f', TUFT = '#40916c'
const KERB = ['#e63946', '#e9ecef']
const STAND = '#5c677d', STREAK = '#a9afc4', BOARD = '#1b1d2a'
const CHEQUER = ['#3a3a3a', WHITE]
const GREEN_FLAG = ['#38b000', '#70e000']
const AWNING = ['#e63946', '#f1faee']
const CROWD = ['#e0afa0', '#f4a261', '#a8dadc', '#adb5bd', '#ffb4a2', '#cdb4db']
const FLAGS = [PINK, '#4cc9f0', GOLD, '#80ed99']
const FAR_CARS = ['#9d7bb0', '#6c8ead', '#b39a6f', '#7f9c84']
const AGENT_HUES = ['#4cc9f0', '#80ed99', '#ff9e00', '#b388eb']
const DUST = ['#e9c46a', '#d4a373', '#a98467', '#7f6a55']
const SMOKE = ['#f8f9fa', '#dee2e6', '#adb5bd', '#868e96']
const FLAME = [GOLD, '#ff9e00', '#f94144']
const PALETTE = [PINK, GOLD, '#4cc9f0', '#80ed99', '#ff9e00']
const TOOL_COLOR: Record<ToolKind, string> = {
  bash: '#f94144', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7',
  other: '#ff5d8f',
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}

const mirror = (art: readonly string[]) => art.map(l => [...l].reverse().join(''))
/** The lead car from the side, 9×3 from pixel row 4: rear wing, helmet and engine cover over a long body
 * to the nose, two-pixel tyres under it. */
const SIDE = ['WW..HBB..', 'WBBBBBBBN', '.TT...TT.']
const QUARTER_FRONT = ['W..HB..', 'WBBBBBN', '.TT.TTN']
const QUARTER_BACK = ['WW.HB..', 'WBBBBBB', 'TT..TT.']
/** The spin-out, a frame each: side, nose turning to us, head-on, away, the other side, tail-on, back round. */
const SPIN = [
  SIDE, QUARTER_FRONT, ['..H..', 'TBBBT', 'TNNNT'], mirror(QUARTER_FRONT),
  mirror(SIDE), mirror(QUARTER_BACK), ['WWWWW', 'TBHBT', 'T...T'], QUARTER_BACK,
]
/** An agent's car, 6×3 from pixel row 4, one-pixel wheels. */
const AGENT = ['W..H..', 'WBBBBN', '.T..T.']
/** The wrench at the nose, turning a quarter a frame round its middle pixel. */
const WRENCH = [['...', 'EWW', '...'], ['..W', '.W.', 'E..'], ['.W.', '.W.', '.E.'], ['W..', '.W.', '..E']]

/** `a` toward `b` by `u` in [0, 1]. */
function mix(a: string, b: string, u: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16)
  const v = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * Math.max(0, Math.min(1, u)))
  return `#${[0, 1, 2].map(i => v(i).toString(16).padStart(2, '0')).join('')}`
}

/** The stands, a cell every four frames: the crowd along pixel row 1 (a wave running through it a cell a
 * frame, flashing while it cheers), a three-pixel flag every tenth column on the roof line, rippling. */
function stands(cv: Canvas, t: number, cheer: boolean): void {
  const off = t >> 2
  for (let x = 0; x < cv.w; x++) {
    const u = x + off
    const k = mod(u, FLAG_PITCH)
    if (k < 3) plot(cv, x, 0, mix(frame(FLAGS, Math.floor(u / FLAG_PITCH)), WHITE, mod(k + (t >> 1), 3) ? 0 : 0.5))
    let c = noise(u * 3 + 1) < 0.7 ? CROWD[Math.floor(noise(u) * CROWD.length)]! : STAND
    if (mod(x - t, CROWD_WAVE) < 2) c = mix(c, WHITE, 0.5)
    if (cheer && mod(t + u, 2) === 0) c = frame(PALETTE, u)
    plot(cv, x, 1, c)
  }
}

/** The far straight along pixel row 2, cars on it streaming back a cell a frame; the grass on row 3, a cell
 * every other frame; the near straight on rows 4–6 and the kerb on row 7, a cell a frame, speed lines on the
 * tarmac `streak` long while a tool runs (past two, bash's extra: longer, and a second row). */
function track(cv: Canvas, t: number, streak: number): void {
  for (let x = 0; x < cv.w; x++) {
    const far = x + t
    const car = Math.floor(far / FAR_CAR_PITCH)
    const isCar = mod(far, FAR_CAR_PITCH) < 2 && noise(car) < 0.6
    plot(cv, x, 2, isCar ? frame(FAR_CARS, car) : FAR)
    plot(cv, x, 3, mod(x + (t >> 1), TUFT_PITCH) === 0 ? TUFT : GRASS)
    const u = x + t
    for (let y = 4; y <= 6; y++) plot(cv, x, y, ASPHALT)
    plot(cv, x, 7, frame(KERB, u >> 1))
    if (mod(u, STREAK_PITCH) < streak) plot(cv, x, 4, STREAK)
    if (streak > 2 && mod(u + 4, STREAK_PITCH) < streak - 2) plot(cv, x, 6, STREAK)
  }
}

/** `color` over what is drawn at (x, y), `f` of the way. */
function tint(cv: Canvas, x: number, y: number, color: string, f: number): void {
  if (x < 0 || x >= cv.w) return
  const i = y * cv.w + x
  cv.px[i] = mix(cv.px[i] ?? BOARD, color, f)
}

/** The pit roof over the lead car while a permission waits: an awning on pixel row 2 and its posts on row
 * 3, fading in over four frames of `actAge`. */
function pitRoof(cv: Canvas, x0: number, actAge: number): void {
  const f = Math.min(1, (actAge + 1) / ROOF_FRAMES)
  for (let x = x0 - 1; x <= x0 + LEAD_W; x++) {
    tint(cv, x, 2, frame(AWNING, x - x0), f)
    if (x === x0 - 1 || x === x0 + LEAD_W) tint(cv, x, 3, LIGHT, f)
  }
}

/** A two-pixel tyre at (x, y), its hub on the pixel `hub` picks (both, a blur, when `blur`). */
function wheel(cv: Canvas, x: number, y: number, hub: number, blur: boolean): void {
  draw(cv, x, y, ['TT'], { T: TYRE })
  for (const k of blur ? [0, 1] : [mod(hub, 2)]) plot(cv, x + k, y, blur ? LIGHT : WHITE)
}

/** A flag on a pole at `x` ahead of the car, 4×3 from pixel row 1, its fly end dipping a pixel on a
 * four-frame wave: chequered at 100%, green on a passed test. */
function flag(cv: Canvas, x: number, t: number, ink: readonly string[]): void {
  for (let y = 1; y <= 6; y++) plot(cv, x, y, LIGHT)
  const wave = mod(t, 4) < 2 ? 0 : 1
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < FLAG_W; i++) plot(cv, x + 1 + i, 1 + j + (i >= 2 ? wave : 0), frame(ink, i + j + wave))
  }
}

/** The sign in its box over the car: the news first, else the act, a dot while the act turns; its tail dot
 * blinks on even frames in every case, so no frame can hold. */
function sign(t: number, s: Signals, age: number): { text: string; c: string } {
  const dot = mod(t, 2) === 0 ? '·' : ''
  if (s.news === 'testFail' && s.newsAge < FAIL_FRAMES) return { text: '×' + dot, c: GREY }
  if (s.news === 'testPass' && s.newsAge < PASS_FRAMES) return { text: frame(['★', '☆'], t >> 1) + dot, c: GOLD }
  if (s.news === 'commit' && s.newsAge < COMMIT_FRAMES) return { text: '✓' + dot, c: GOLD }
  if (age < TURN_FRAMES) return { text: '·' + dot, c: LIGHT }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + dot, c: TOOL_COLOR[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?' + dot, c: GOLD }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1) + dot, c: PINK_PALE }
  if (s.act === 'think') return { text: '·' + dot, c: LIGHT }
  return { text: frame(['z', 'Z'], t >> 2) + dot, c: LIGHT }
}

export function racetrackScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const bash = isTool && s.tool === 'bash'
  const isAsk = s.act === 'ask'
  // The sign's turn names the tool, so it restarts on a tool change; the pace cues grow on `actAge` alone.
  const age = Math.min(s.actAge, s.toolAge)
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const chequer = allDone && s.doneAge < CHEQUER_FRAMES
  // The lead car at the left third, the agents' slots behind it, all from the width alone.
  const leadX = Math.floor(w / 3)
  const agents = Math.min(s.agents, MAX_AGENTS, Math.floor(leadX / AGENT_PITCH))
  // The wheels: stopped in the pits, a step every fourth frame on the pace lap, every other saying, every
  // frame at full speed; speed lines grow in over the turn (bash's longer ones come and go with bash).
  const cadence = isAsk ? 0 : isTool ? 1 : s.act === 'say' ? 2 : 4
  const hub = cadence ? Math.floor(t / cadence) : 0
  const streak = isTool ? Math.min(bash ? 4 : 2, s.actAge >> 1) : 0

  // Layers 1–2: the stands, then the far straight, the grass and the near straight.
  stands(cv, t, isPass || isCommit || chequer)
  track(cv, t, streak)
  // The lap pips on the grass at the right, floor-scaled, the newest flashing white as it lands.
  const pipX0 = leadX + FLAG_DX + FLAG_W + 2
  const count = Math.min(s.total, MAX_PIPS, Math.max(0, Math.floor((w - pipX0) / 2)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = lit > litOf(s.done - 1) && s.doneAge < DONE_FLASH_FRAMES
  for (let i = 0; i < count; i++) {
    let c = i < lit ? GOLD : DIM
    if (i < lit && chequer) c = frame(PALETTE, i + (s.doneAge >> 1))
    if (fresh && i === lit - 1 && mod(s.doneAge, 2) === 0) c = WHITE
    plot(cv, w - 2 * (count - i), 3, c)
  }
  if (isAsk) pitRoof(cv, leadX, s.actAge)
  // Layer 3: the agents' cars in their slots, wheels turning with the lead's; the newest blinks its headlight
  // and helmet as it joins (and, harmlessly, when one leaves).
  for (let i = 0; i < agents; i++) {
    const x = leadX - AGENT_PITCH * (i + 1)
    const blink = i === agents - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const hue = AGENT_HUES[i]!
    const nose = blink ? WHITE : mix(hue, WHITE, 0.5)
    const ink: Ink = { W: mix(hue, '#000000', 0.35), B: hue, H: blink ? WHITE : LIGHT, N: nose, T: TYRE }
    draw(cv, x, 4, AGENT, ink)
    for (const [k, wx] of [1, 4].entries()) if (mod(hub + k + i, 2) === 0) plot(cv, x + wx, 6, LIGHT)
  }
  // Layer 4: what the lead car throws back: exhaust up and back (the tool's colour while one runs), skid dust
  // off the rear wheel along the kerb, flames on bash.
  const every = isAsk ? 0 : bash ? 2 : isTool ? 4 : 12
  const exhaust = isTool ? TOOL_COLOR[s.tool ?? 'other'] : SMOKE[1]!
  for (let a = 0; every && a < EXHAUST_LIFE; a++) {
    if (mod(t - a, every) === 0) plot(cv, leadX - 1 - a, 5 - a, a < 2 ? exhaust : SMOKE[a]!)
  }
  const dustEvery = !isTool || s.actAge < TURN_FRAMES ? 0 : bash ? 1 : 2
  for (let a = 0; dustEvery && a < DUST_LIFE; a++) {
    if (mod(t - a, dustEvery) !== 0) continue
    plot(cv, leadX + 1 - a, 7, DUST[Math.min(3, a)]!)
    if (a < 2) plot(cv, leadX - a, 6, DUST[a]!)
  }
  if (bash && s.actAge >= TURN_FRAMES) {
    plot(cv, leadX - 1, 5, frame(FLAME, t))
    if (mod(t, 2) === 0) plot(cv, leadX - 2, 5, frame(FLAME, t + 1))
  }
  // Layer 5: the lead car, spinning round a frame a step on a failed test, its wheels turning otherwise.
  const spinning = isFail && s.newsAge < SPIN_FRAMES
  const art = spinning ? SPIN[s.newsAge]! : SIDE
  const ink: Ink = { W: PINK_DARK, B: PINK, H: GOLD, N: PINK_PALE, T: TYRE }
  if (isPass && mod(t, 4) < 2) ink.B = GOLD
  draw(cv, leadX + ((LEAD_W - art[0]!.length) >> 1), 4, art, ink)
  if (!spinning) {
    wheel(cv, leadX + 1, 6, hub, bash)
    wheel(cv, leadX + 6, 6, hub + 1, bash)
  }
  // Layer 6: the wrench at the nose in the pits; the spin-out's smoke; the flags; a commit's confetti.
  if (isAsk && s.actAge >= ROOF_FRAMES >> 1) draw(cv, leadX + WRENCH_DX, 4, frame(WRENCH, t), { W: LIGHT, E: GOLD })
  for (let k = 0; isFail && k < SMOKE_XS.length; k++) {
    const a = s.newsAge - 2 * k
    if (a < 0 || a >= SMOKE_LIFE) continue
    const x = leadX + SMOKE_XS[k]! - (a >> 1)
    draw(cv, x, 6 - (a >> 1), ['SS'], { S: SMOKE[a >> 1]! })
  }
  if (chequer) flag(cv, leadX + FLAG_DX, t, CHEQUER)
  else if (isPass) flag(cv, leadX + FLAG_DX, t, GREEN_FLAG)
  for (let k = 0; isCommit && k < CONFETTI; k++) {
    const y = s.newsAge - (k >> 1)
    const x = leadX + frame(CONFETTI_DX, Math.floor(noise(k * 7 + 3) * 99))
    if (y >= 0 && y < cv.h && x < w - 7) plot(cv, x + (mod(y + k, 4) < 2 ? 0 : 1), y, frame(PALETTE, k))
  }

  const g = cells(cv)
  // The sign's box over the car, its text from the left; the lap board at the top right, yielding to the box.
  const sx = leadX + SIGN_DX
  for (let x = sx; x < Math.min(w, sx + SIGN_W); x++) g[0]![x] = { ch: ' ', bg: BOARD }
  const { text, c } = sign(t, s, age)
  put(g, sx, 0, text, { c, b: s.act !== 'think' || !!s.news, bg: BOARD })
  const readout = s.total > 0 ? `${s.done}/${s.total}` : ''
  const rx = w - readout.length
  if (readout && rx > sx + SIGN_W) {
    const flash = s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 2) === 0
    put(g, rx, 0, readout, { c: flash ? WHITE : allDone ? GOLD : LIGHT, b: true, bg: BOARD })
  }
  return g
}

/** A traffic cone: a pointed orange top, two white stripes widening down it, a wide dark rubber base. */
export const PET: PetArt = {
  body: ['.....OO.....', '....WWWW....', '...OOOOOO...', '..WWWWWWWW..', 'BBBBBBBBBBBB'],
  step: ['......OO....', '....WWWW....', '...OOOOOO...', '..WWWWWWWW..', 'BBBBBBBBBBBB'],
  colors: { O: '#ff7b00', W: WHITE, B: '#5c5f66' },
  eyes: [4, 7],
  eyeRow: 2,
  eye: '#1d1d1d',
  lid: '#ff7b00',
  blush: PINK,
  spark: GOLD,
}

export const RACETRACK: Theme = {
  name: 'racetrack',
  rows: SCENE_ROWS,
  color: PINK,
  accent: GOLD,
  sprite: {
    think: ['o=o>  ', ' o=o> ', '  o=o>', ' o=o> '],
    tool: ['≡o=o> ', '=o=o> ', '≡o=o> ', '-o=o> '],
    say: ['o=o> ♪', 'o=o> ♫'],
    wait: ['o=o> .', 'o=o> ..', 'o=o> ...'],
  },
  happy: 'o=o> ★',
  sad: 'o=o> …',
  dead: 'x=x>',
  sleep: 'o=o> zZ',
  confetti: ['▚', '▞', '·', '✦'],
  palette: PALETTE,
  scene: racetrackScene,
  pet: PET,
}
