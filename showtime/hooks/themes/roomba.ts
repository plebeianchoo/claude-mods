// Theme: roomba. Its scene, its words and its pet.
//
// The scene, seen from the floor: a robot vacuum (#adb5bd) cleaning a rug in front of a wainscot, furniture
// legs rising past it, dust motes drifting left in the dark above. It drives back and forth by `t` alone (a cell
// every four frames, eased at the ends), bumps the wall and turns over four frames at each end; its light and a
// sign on the left wall tell the act. A crumb per task (twelve at most, floor-scaled), gone as done, the newest
// sparkling; a suction trail in the tool's colour in a tool, a spinning brush on bash; a mini per agent at its
// dock right of the wall, beeping as it joins. testFail wedges it under a sofa (wheels spinning sixteen frames),
// backs it out and catches it up to its pass, both eased; a commit gives a cat a 24-frame ride, eased on and off.
// Motion rules: the wainscot and the rug fill pixel rows 2-7, so only the top cell row has shapes: single-column
// walls and legs, the sign (its tail dot blinking every frame) and motes that only drift left.
import { canvas, cells, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

/** Where the roomba is on its pass: left column, facing, the turn's frame (-1: none), the bump's (-1). */
type Pose = { x: number; face: 1 | -1; turn: number; bump: number }
type Look = { light: string; bumper: string; wheel: string; brush?: number; puff?: boolean }

/** Widths: the roomba, a mini, an agent's slot, the least pass; the most agents and crumbs; the sofa. */
const [ROOMBA_W, MINI_W, SLOT_W, MIN_MAIN, MAX_AGENTS, MAX_CRUMBS, SOFA_W] = [8, 4, 8, 26, 4, 12, 14]
/** τ per cell: the first and last two cells of a crossing, the rest; frames of the bump and the turn. */
const [SLOW, FAST, BUMP_FRAMES, TURN_FRAMES] = [8, 4, 4, 4]
/** Frames: an act's change, the trail's growth, a crumb's sparkle, an agent's beep, the 100% flash. */
const [CHANGE_FRAMES, TRAIL_LEN, SPARKLE_FRAMES, GREET_FRAMES, DONE_FLASH] = [4, 8, 8, 8, 16]
/** Frames of a failed test: wheels spinning, the sofa's; the whole reaction. Its τ a frame from newsAge 1 (four
 * is a cell a frame): held, backing out eased in and out, catching up eased in and out, one a frame from 28. */
const [STUCK, SOFA_TO, FAIL_FRAMES] = [16, 19, 30]
const FAIL_STEPS = [...Array(STUCK - 1).fill(0), -2, -4, -2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 2]
/** Frames of a passed test's flash and of the cat's ride, of which the first and last four ease it on and off. */
const [PASS_FRAMES, CAT_FRAMES, CAT_EASE] = [16, 24, 4]
/** The roomba's top pixel row (dome, body, base); the floor's (crumbs, trail), the wainscot's rail. */
const [R_Y, FLOOR_Y, RAIL_Y] = [4, 6, 2]
const [SHELL, DOME, BUMPER_INK, BASE, WHEEL] = ['#adb5bd', '#dee2e6', '#6c757d', '#495057', '#868e96']
const [WHITE, GOLD, SPARK, CRUMB, DUST, GREY] = ['#ffffff', '#ffd60a', '#ffe066', '#fff3b0', '#c9b99a', '#8d99ae']
const [WALL, LEG, LEG_LIGHT, TABLE_LEG] = ['#9a8c98', '#a47148', '#c8956b', '#cfc6b8']
const [RUG_TOP, SHEEN, RAIL, PANEL, PANEL_LINE] = ['#8c3b3b', '#e8b08a', '#6b6480', '#3f3b52', '#4a4560']
const [RUG, SOFA] = [['#6d2e46', '#d4a373', '#6d2e46', '#a5583a'], ['#6b8cae', '#4f6d8f', '#89a7c6']]
const [SOFA_LEG, SOFA_ARM] = ['#7f5539', '#3f5a7a']
const CAT_INK = { C: '#f4a261', A: '#f4a261', T: '#e76f51', E: '#3d405b' }
const LIGHTS = { think: '#4cc9f0', tool: '#80ed99', ask: '#ffd166', say: '#f72585', wait: '#5e7ce2' }
const SAY_LIGHTS = ['#f72585', '#ffd166', '#4cc9f0', '#80ed99']
const MINI_LIGHTS = ['#bb9af7', '#7dcfff', '#ff9e64', '#9ece6a']
const TRAIL: Record<ToolKind, string> = { bash: '#e0fbfc', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }
/** The bumper's columns and the light's, facing right, then the turn's four frames, as if turning left. */
const BUMPER_COLS = [[7], [6, 7], [4, 5, 6], [1, 2, 3], [0, 1]]
const LIGHT_COLS = [5, 5, 4, 3, 2]
/** A cat sitting on the roomba facing right, its head and ears at the front, its tail flicking up behind. */
const CAT = [['.T...A.A', 'T..CCAEA', '..CCCCC.'], ['T....A.A', 'T..CCAEA', '..CCCCC.']]
const mirror = (art: readonly string[]) => art.map(r => [...r].reverse().join(''))

/** Cells along a crossing of `d` cells after `u` τ: two slow cells, the rest a cell every FAST τ, two slow. */
function along(u: number, d: number): number {
  const ease = Math.min(2, d >> 1)
  const [head, mid] = [ease * SLOW, (d - 2 * ease) * FAST]
  if (u < head) return Math.floor(u / SLOW)
  if (u < head + mid) return ease + Math.floor((u - head) / FAST)
  return Math.min(d, d - ease + Math.floor((u - head - mid) / SLOW))
}

/** The pass at τ: right across `d` cells from `x0`, a bump, a turn; back left, a bump, a turn. */
function pose(tau: number, x0: number, d: number): Pose {
  const ease = Math.min(2, d >> 1)
  const cross = 2 * ease * SLOW + (d - 2 * ease) * FAST
  const leg = cross + BUMP_FRAMES + TURN_FRAMES
  const back = mod(tau, 2 * leg) >= leg
  const [u, face] = [mod(tau, leg), back ? -1 : 1] as const
  const at = (k: number) => (back ? x0 + d - k : x0 + k)
  if (u < cross) return { x: at(along(u, d)), face, turn: -1, bump: -1 }
  if (u < cross + BUMP_FRAMES) return { x: at(d), face, turn: -1, bump: u - cross }
  return { x: at(d), face, turn: u - cross - BUMP_FRAMES, bump: -1 }
}

/** How far τ trails `t` on a failed test: the frames so far less the τ stepped (zero again from newsAge 28). */
function lagOf(s: Signals): number {
  if (s.news !== 'testFail' || s.newsAge >= FAIL_FRAMES) return 0
  const a = Math.min(s.newsAge, FAIL_STEPS.length)
  return a - FAIL_STEPS.slice(0, a).reduce((sum, d) => sum + d, 0)
}

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** The roomba: dome and light, body and bumper, base and wheels; a brush at its front, a puff at its back. */
function roomba(cv: Canvas, x: number, face: 1 | -1, f: number, look: Look): void {
  const m = (c: number) => x + (face > 0 ? c : ROOMBA_W - 1 - c)
  for (let c = 1; c < 7; c++) plot(cv, m(c), R_Y, c === LIGHT_COLS[f] ? look.light : DOME)
  for (let c = 0; c < 8; c++) plot(cv, m(c), R_Y + 1, BUMPER_COLS[f]!.includes(c) ? look.bumper : SHELL)
  for (let c = 1; c < 7; c++) plot(cv, m(c), R_Y + 2, c === 1 || c === 6 ? look.wheel : BASE)
  if (look.brush !== undefined) plot(cv, m(7 + look.brush), R_Y + 2, SPARK)
  if (look.puff) plot(cv, m(-1), R_Y + 2, DUST)
}

/** Dust motes in the top row, spread out so no two touch: drifting left together a cell every other frame,
 * bobbing a pixel on twelve frames, hidden by the sign at the left wall. */
function motes(cv: Canvas, t: number): void {
  const n = Math.max(3, Math.floor(cv.w / 10))
  for (let i = 0; i < n; i++) {
    const x = mod(Math.floor((i * cv.w) / n + noise(i + 17) * Math.min(5, cv.w / n - 3)) - (t >> 1), cv.w)
    if (x < 4) continue
    plot(cv, x, mod(t + 5 * i, 12) < 6 ? 0 : 1, mod(t + 3 * i, 16) < 3 ? CRUMB : DUST)
  }
}

/** The wainscot (a rail over a panel) and the rug under it, a sheen sliding along it a cell every other frame. */
function rug(cv: Canvas, t: number): void {
  const sheen = mod(t >> 1, cv.w + 24) - 12
  for (let x = 0; x < cv.w; x++) {
    plot(cv, x, RAIL_Y, RAIL)
    for (let y = RAIL_Y + 1; y < FLOOR_Y; y++) plot(cv, x, y, mod(x, 6) === 0 ? PANEL_LINE : PANEL)
    plot(cv, x, FLOOR_Y, RUG_TOP)
    plot(cv, x, 7, Math.abs(x - sheen) <= 1 && mod(x, 2) === 1 ? SHEEN : RUG[mod(x, 4)]!)
  }
}

/** The room: the left wall, the wall the pass ends at, chair and table legs from above, a dock per slot. */
function room(cv: Canvas, wallX: number, slots: number, agents: number): void {
  const column = (x: number, top: number, ink: string, cap = ink) => {
    for (let y = top; y <= FLOOR_Y; y++) plot(cv, x, y, y === FLOOR_Y ? cap : ink)
  }
  column(0, 0, WALL)
  column(wallX, 0, WALL)
  if (wallX < cv.w - 1) column(cv.w - 1, 0, WALL)
  if (wallX >= 24) {
    const [chair, table] = [Math.round(0.2 * wallX), Math.round(0.55 * wallX)]
    for (const x of [chair, chair + 3]) column(x, 0, LEG, LEG_LIGHT)
    for (const x of [table, table + Math.round(0.25 * wallX)]) column(x, 0, TABLE_LEG, LEG)
  }
  for (let i = 0; i < slots; i++) {
    const dx = wallX + SLOT_W * (i + 1)
    column(dx, R_Y, BASE)
    plot(cv, dx, R_Y, i < agents ? '#52b788' : GREY)
  }
}

/** A mini per agent at its own dock: a short pass of three cells, its light at its front; the newest beeps. */
function minis(cv: Canvas, t: number, s: Signals, wallX: number, slots: number): void {
  const n = Math.min(s.agents, slots)
  for (let i = 0; i < n; i++) {
    const p = frame([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1], t + 5 * i)
    const face = frame([1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1], t + 5 * i + 2)
    const x = wallX + SLOT_W * i + 2 + p
    const beep = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    for (let c = 0; c < MINI_W; c++) plot(cv, x + c, FLOOR_Y, c === 0 || c === 3 ? BASE : SHELL)
    plot(cv, x + 1, FLOOR_Y - 1, face > 0 ? DOME : beep ? WHITE : MINI_LIGHTS[i]!)
    plot(cv, x + 2, FLOOR_Y - 1, face > 0 ? (beep ? WHITE : MINI_LIGHTS[i]!) : DOME)
    if (beep) plot(cv, x + (face > 0 ? 2 : 1), FLOOR_Y - 2, WHITE)
  }
}

/** The sofa it wedges under: cushions over a fringed skirt above its front three columns, arms and legs. */
function sofa(cv: Canvas, x: number, face: 1 | -1, wallX: number): void {
  const sx = face > 0 ? x + ROOMBA_W - 3 : x + 2 - (SOFA_W - 1)
  for (let c = 0; c < SOFA_W; c++) {
    const at = sx + c
    if (at < 1 || at >= wallX) continue
    const arm = c === 0 || c === SOFA_W - 1
    plot(cv, at, R_Y - 2, arm ? SOFA_ARM : mod(c, 6) === 0 ? SOFA[1]! : SOFA[0]!)
    plot(cv, at, R_Y - 1, arm ? SOFA_ARM : SOFA[mod(c, 2) + 1]!)
    if (arm) for (let y = R_Y; y <= FLOOR_Y; y++) plot(cv, at, y, SOFA_LEG)
  }
}

/** The sign on the left wall: the news first, else the act, a dot while the act changes; its tail dot
 * blinks on even frames in every case, so no frame can hold. */
function sign(s: Signals, t: number, age: number, k: { fail: boolean; pass: boolean; cat: boolean }) {
  const dot = mod(t, 2) === 0 ? '·' : ''
  if (k.fail) return { text: '×' + dot, c: GREY }
  if (k.pass) return { text: frame(['★', '☆'], t >> 1) + dot, c: GOLD }
  if (k.cat) return { text: '✓' + dot, c: GOLD }
  if (age < CHANGE_FRAMES) return { text: '·' + dot, c: DOME }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'] + dot, c: TRAIL[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?' + dot, c: LIGHTS.ask }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 1) + dot, c: LIGHTS.say }
  if (s.act === 'think') return { text: '·' + dot, c: LIGHTS.think }
  return { text: frame(['z', 'Z'], t >> 2) + dot, c: LIGHTS.wait }
}

/** The light by act: a slow pulse thinking, steady in a tool, blinking asking, cycling saying, dim waiting;
 * white flickers while the act changes, green on a passed test or at 100%, gold under the cat. */
function lightOf(s: Signals, t: number, age: number, flash: boolean, cat: boolean): string {
  if (flash) return mod(t, 2) === 0 ? WHITE : '#52b788'
  if (cat) return GOLD
  if (age < CHANGE_FRAMES) return mod(age, 2) === 0 ? WHITE : LIGHTS[s.act]
  if (s.act === 'think') return mod(t, 12) < 8 ? LIGHTS.think : '#2a9fc2'
  if (s.act === 'ask') return mod(t, 12) < 6 ? LIGHTS.ask : BASE
  if (s.act === 'say') return frame(SAY_LIGHTS, t >> 1)
  if (s.act === 'wait') return mod(t, 16) < 8 ? LIGHTS.wait : '#3f51a0'
  return LIGHTS.tool
}

export function roombaScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const slots = Math.max(0, Math.min(MAX_AGENTS, Math.floor((w - 2 - MIN_MAIN) / SLOT_W)))
  const wallX = slots > 0 ? w - 2 - slots * SLOT_W : w - 1
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCat = s.news === 'commit' && s.newsAge < CAT_FRAMES
  // The sign names the tool, so it turns on a tool change too; the trail and the light belong to the act.
  const age = Math.min(s.actAge, s.toolAge)
  const allDone = s.total > 0 && s.done >= s.total
  // Crumbs at fixed spots along the pass, floor-scaled; the eaten ones gone, the newest sparkling.
  const count = Math.min(s.total, MAX_CRUMBS, Math.max(0, Math.floor((wallX - 4) / 3)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)

  // Layer 1: the motes; layer 2: the wainscot, the rug and its sheen; the walls, the legs and the docks.
  motes(cv, t)
  rug(cv, t)
  room(cv, wallX, slots, s.agents)
  for (let k = 0; k < count; k++) {
    const x = 2 + Math.floor(((k + 0.5) * (wallX - 3)) / count)
    if (k >= lit) plot(cv, x, FLOOR_Y, CRUMB)
    else if (k === lit - 1 && s.doneAge < SPARKLE_FRAMES && lit > litOf(s.done - 1)) {
      const on = mod(s.doneAge, 2) === 0
      plot(cv, x, FLOOR_Y, on ? WHITE : GOLD)
      plot(cv, x - 1, FLOOR_Y, on ? GOLD : SPARK)
      plot(cv, x + 1, FLOOR_Y, on ? GOLD : SPARK)
    }
  }
  // Layer 3: the roomba, its pass by τ (= t but on a failed test); the trail where its back was in a tool.
  const [tau, d] = [t - lagOf(s), Math.max(0, wallX - ROOMBA_W - 1)]
  const at = pose(tau, 1, d)
  const f = at.turn >= 0 ? at.turn + 1 : 0
  if (s.act === 'tool') {
    // The cells its back was on 0..len-1 cells ago (FAST τ a cell), so the trail moves with the pass, turns
    // included, fading into the rug; grown a cell a frame as the act starts (it is the tool act's own).
    const ink = TRAIL[s.tool ?? 'other']
    for (let k = 0; k < Math.min(TRAIL_LEN, s.actAge + 1); k++) {
      const was = pose(tau - FAST * k, 1, d)
      const back = was.face > 0 ? was.x - 1 : was.x + ROOMBA_W
      if (back >= 1 && back < wallX) plot(cv, back, FLOOR_Y, mix(ink, RUG_TOP, k / TRAIL_LEN))
    }
  }
  if (isFail && s.newsAge < SOFA_TO) sofa(cv, at.x, at.face, wallX)
  const [stuck, flash] = [isFail && s.newsAge < STUCK, isPass || (allDone && s.doneAge < DONE_FLASH)]
  const bumping = at.bump >= 0 && at.bump < 2
  roomba(cv, at.x, at.face, f, {
    light: lightOf(s, t, s.actAge, flash, isCat),
    bumper: bumping ? WHITE : BUMPER_INK,
    wheel: stuck && mod(t, 2) === 0 ? DOME : WHEEL,
    brush: s.act === 'tool' && s.tool === 'bash' && !stuck ? mod(t, 2) : undefined,
    puff: stuck && mod(t, 4) < 2,
  })
  if (bumping) plot(cv, at.face > 0 ? at.x + ROOMBA_W - 1 : at.x, R_Y - 1, SPARK)
  if (isCat) {
    // On and off over CAT_EASE frames: fading in over what is under it, its tail still; the same leaving.
    const k = Math.min(1, (s.newsAge + 1) / (CAT_EASE + 1), (CAT_FRAMES - s.newsAge) / (CAT_EASE + 1))
    const art = CAT[k < 1 ? 0 : mod(t >> 2, 2)]!
    const rows = at.face > 0 ? art : mirror(art)
    rows.forEach((row, j) => [...row].forEach((key, c) => {
      const y = R_Y - 2 + j
      const ink = CAT_INK[key as keyof typeof CAT_INK]
      if (ink) plot(cv, at.x + c, y, mix(cv.px[y * w + at.x + c] ?? PANEL, ink, k))
    }))
  }
  minis(cv, t, s, wallX, slots)

  const g = cells(cv)
  if (s.total > 0) {
    const readout = `${s.done}/${s.total}`
    put(g, w - 1 - readout.length, 0, readout, { c: isCat || isPass ? GOLD : allDone ? '#80ed99' : DOME, b: true })
  }
  const { text, c } = sign(s, t, age, { fail: isFail, pass: isPass, cat: isCat })
  put(g, 1, 0, text, { c, b: s.act !== 'think' || isFail || isPass || isCat })
  return g
}

/** A dust bunny: a round grey fluff ball, tufts out at its sides and bottom, two ears splayed up and out
 * (pink tips), eyes in the fluff. */
export const PET: PetArt = {
  body: ['.P........P.', '..E.FFFF.E..', '..FFFFFFFF..', '.FGFFFFFFGF.', '..F.FFFF.F..'],
  step: ['..P......P..', '..E.FFFF.E..', '..FFFFFFFF..', '.GFFFFFFFFG.', '.F..FFFF..F.'],
  colors: { F: '#ced4da', G: '#adb5bd', E: '#9aa5b1', P: '#ffafcc' },
  eyes: [4, 7],
  eyeRow: 2,
  eye: '#343a40',
  lid: '#ced4da',
  mouth: [5, 4],
  blush: '#ffafcc',
  spark: DUST,
}

export const ROOMBA: Theme = {
  name: 'roomba',
  rows: SCENE_ROWS,
  color: SHELL,
  accent: LIGHTS.think,
  sprite: {
    think: ['▭·  ', '▭ · ', '▭  ·', '▭ · '], tool: ['▭≈  ', '▭ ≈ ', '▭  ≈', '▭ ≈ '],
    say: ['▭ ♪', '▭ ♫'], wait: ['▭ .', '▭ ..', '▭ ...'],
  },
  happy: '▭ ✓',
  sad: '▭ …',
  dead: '✗',
  sleep: '▭ zZ',
  confetti: ['·', '∘', '°', '+'],
  palette: [SHELL, LIGHTS.think, CRUMB, '#f4a261'],
  scene: roombaScene,
  pet: PET,
}
