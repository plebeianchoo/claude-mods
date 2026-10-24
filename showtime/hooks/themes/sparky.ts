// Theme: sparky. Its scene, its words and its pet.
//
// The scene: an electric mouse runs in from the left and holds the middle of a meadow, running on
// the spot while the grass streams under his feet, hills roll by behind him and clouds drift over.
// His tail wags on a six-frame cycle, an ear twitches every twenty-four frames and he blinks every
// thirty. Each subagent is a smaller mouse trailing him, six pixels behind the last, bobbing out of
// phase with the others. The tasks are marks at the top right (`total` of them, `done` lit), and a
// thunderbolt strikes down from a cloud for each task done (which cloud moves with `done`); while a
// tool runs a bolt strikes every sixteen frames anyway, and his cheeks crackle while bash runs. A
// failed test: a grey cloud grows over him and rains on him for twenty frames. A passing test: he
// hops twice and sparks fly out from his cheeks. A commit: one big bolt across the whole band, with
// two bolts down onto him, for eight frames. Asking: a `?` over his head; thinking: a trail of dots.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same row or a neighbour). The hills
// fill pixel row 5 and the grass rows 6 and 7, so the lower two cell rows are always one run and
// anything drawn there is free; only the two sky rows carry the rule. So: he enters from the left
// edge a pixel a frame; his ears are two pixels wide, so a hop leaves their run starts where they
// were; the tail tip grows a pixel a frame out from his back and shrinks back (every length differs
// from its neighbours, so every frame differs); bolts are one pixel wide where they cross the sky
// rows and come down from a cloud's left column, a run start already there; the rain cloud grows out
// from over his ears and its drops fall beside them; the minis' ear tips are two pixels tall, so a
// bob keeps them in the same cell row; and glyphs sit over his head, a column from his right ear.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS, ground } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const MOUSE_W = 8
/** The mouse, 8×7, standing at pixel row 1: ear tips in the top sky row over ears two wide (the tips
 * are a pixel each, safe because the ears' run starts sit under them), head, eyes, cheeks, feet. */
const MOUSE = ['K......K', 'YY....YY', 'YY....YY', '.YYYYYY.', 'YKKYYKKY', 'RRYYYYRR', '.Y.YY.Y.']
const MOUSE_STEP = ['K......K', 'YY....YY', 'YY....YY', '.YYYYYY.', 'YKKYYKKY', 'RRYYYYRR', 'Y..YY..Y']
const MOUSE_Y = 1
const EYES_ROW = 4
/** The right ear's tip leans in: the twitch (a column, over the ear's run). */
const EARS_TWITCH = 'K.....K.'
const EYES_SHUT = 'YYYYYYYY'
const EYES_SAD = 'YSSYYSSY'
const YELLOW = '#ffd60a'
const DARK = '#5a3a22'
const CHEEK = '#e63946'
const PALE = '#fff3b0'
const MOUSE_COLORS = { K: DARK, Y: YELLOW, R: CHEEK, S: '#8ecae6' }
/** The tail at his back, 6 wide from pixel row 4: a thin stroke rising from a brown base on the ground
 * to his back (one pixel in its top row, so a hop lifts only that pixel into the sky row, next to his
 * ear); its tip wags in the row above. */
const TAIL = ['.....Y', '...YY.', '.YY...', 'BB....']
const TAIL_W = 6
const TAIL_COLORS = { Y: YELLOW, B: '#a0522d' }
/** The tip's length each frame of the wag: every neighbour differs, so every frame differs. */
const WAG = [0, 1, 2, 3, 2, 1]
const TWITCH_EVERY = 24
const BLINK_EVERY = 30
/** A subagent's mouse, 5×5: ear tips two pixels tall, so a bob keeps them in one cell row. */
const MINI = ['K...K', 'Y...Y', 'YYYYY', 'RYKYR', '.Y.Y.']
const MINI_STEP = ['K...K', 'Y...Y', 'YYYYY', 'RYKYR', 'Y...Y']
const MINI_W = 5
const MINI_PITCH = 6
const MAX_AGENTS = 4
/** Frames the newest mini mouse flashes as its agent joins, and its colours on those frames. */
const GREET_FRAMES = 12
const MINI_FLASH = { K: '#ffffff', Y: '#ffffff', R: '#ffffff', S: '#ffffff' }
/** Clouds: 6×2 lumps along the top, drifting left. */
const CLOUD = ['.CCC..', 'CCCCCC']
const CLOUD_W = 6
const CLOUD_SPEED = 0.15
const CLOUD_COLOR = '#4a5a70'
const RAIN_COLOR = '#8d99ae'
const DROP = '#8ecae6'
const HILL = '#2f5a44'
const CREST = '#3a7a55'
const GRASS = ['#4caf50', '#43a047', '#66bb6a', '#4caf50', '#e9c46a']
const GRASS_FAR = ['#3f8f44', '#2f7a3a']
/** A bolt's sideways step at each pixel row below a cloud: straight through the sky rows (one pixel wide there), a zigzag over the hills. */
const BOLT_DX = [0, 0, 1, 0, 1, 0]
const BOLT_TOP = 2
/** Reaction lengths, in frames. */
const STRIKE_FRAMES = 10
const FAIL_FRAMES = 20
const PASS_FRAMES = 16
const COMMIT_FRAMES = 8
const DONE_WAVE_FRAMES = 16
/** The cheeks sparkle as the act turns. */
const TURN_FRAMES = 6
/** Frames between the ambient strikes, by act (none while asking). */
const STRIKE_EVERY: Record<string, number> = { tool: 16, think: 36, say: 36, wait: 60 }

const cloudCount = (w: number) => Math.max(2, Math.floor(w / 25))

/** Where cloud `i` of `n` is at `t`: spaced around a loop of w + 8, jittered, never touching another. */
function cloudX(i: number, n: number, w: number, t: number): number {
  const span = w + CLOUD_W + 2
  const pitch = span / n
  const base = i * pitch + noise(i + 4) * Math.max(0, pitch - CLOUD_W - 2)
  return mod(Math.floor(base) - Math.floor(t * CLOUD_SPEED), span) - CLOUD_W
}

/** The cloud a bolt comes from: the `k`-th of those on screen at `t0`, or of all of them when none is. */
function strikeCloud(k: number, w: number, t0: number): number {
  const n = cloudCount(w)
  const on: number[] = []
  for (let i = 0; i < n; i++) {
    const cx = cloudX(i, n, w, t0)
    if (cx >= 0 && cx + CLOUD_W <= w) on.push(i)
  }
  return on.length ? on[mod(k, on.length)]! : mod(k, n)
}

/** A strike: the cloud it comes from and how many frames in. */
type Strike = { cloud: number; f: number }

/** Strikes under way at `t`: one for a task just done, else the ambient one of the act. None while he
 * is still running in: his ear passing a bolt would leave its run start two columns from theirs. */
function strikes(t: number, w: number, s: Signals, walking: boolean): Strike[] {
  const out: Strike[] = []
  if (walking) return out
  if (s.done > 0 && s.doneAge < STRIKE_FRAMES) return [{ cloud: strikeCloud(s.done, w, t - s.doneAge), f: s.doneAge }]
  const every = STRIKE_EVERY[s.act] ?? 0
  if (every > 0 && mod(t, every) < STRIKE_FRAMES) out.push({ cloud: strikeCloud(Math.floor(t / every), w, t - mod(t, every)), f: mod(t, every) })
  return out
}

/** A bolt from the cloud's left column: a pixel row a frame down to the grass, white, then fading; a flare on the grass as it lands. */
function bolt(cv: Canvas, cx: number, f: number): void {
  const color = f < 4 ? '#ffffff' : f < 7 ? YELLOW : '#ff9f1c'
  const rows = Math.min(BOLT_DX.length, f + 1)
  for (let r = 0; r < rows; r++) plot(cv, cx + BOLT_DX[r]!, BOLT_TOP + r, color)
  if (f >= 5 && f < 8) for (let i = -2; i <= 2; i++) plot(cv, cx + i, 7, f === 5 ? '#ffffff' : PALE)
}

/** Subagents: a small mouse each trailing him, six pixels behind the last, bobbing out of phase on an
 * eight-frame cycle, each in its slot from its first frame; the newest flashes white for GREET_FRAMES as it
 * joins (an agent leaving moves no one). */
function minis(cv: Canvas, t: number, x: number, s: Signals): void {
  const n = Math.min(s.agents, MAX_AGENTS)
  for (let i = 0; i < n; i++) {
    const mx = x - TAIL_W - 1 - MINI_W - i * MINI_PITCH
    if (mx <= -MINI_W) continue
    const up = mod(t + i * 4, 8) < 4 ? 1 : 0
    const greet = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    draw(cv, mx, 3 - up, frame([MINI, MINI_STEP], t >> 1), greet ? MINI_FLASH : MOUSE_COLORS)
  }
}

/** The task marks along the top right: `total` of them, `done` lit; the newest blinks, all wave when the last lands, all white on a commit. */
function marks(cv: Canvas, s: Signals, isCommit: boolean): void {
  const n = Math.min(s.total, Math.max(0, Math.floor((cv.w - 4) / 2)))
  const allDone = s.total > 0 && s.done >= s.total
  for (let i = 0; i < n; i++) {
    let color = i < s.done ? YELLOW : '#6b7a8a'
    if (isCommit && mod(s.newsAge, 2) === 0) color = '#ffffff'
    else if (allDone && s.doneAge < DONE_WAVE_FRAMES && mod(s.doneAge - i, 6) < 2) color = '#ffffff'
    else if (!allDone && i === s.done - 1 && s.doneAge < STRIKE_FRAMES && mod(s.doneAge, 2) === 0) color = '#ffffff'
    plot(cv, cv.w - 2 - 2 * (n - 1 - i), 1, color)
  }
}

/** The rain cloud of a failed test: puffs grow out from over each ear and join (three frames), it rains
 * beside his ears, and it shrinks back the same way at the end. Drops are a pixel wide and two tall. */
function rainCloud(cv: Canvas, x: number, f: number): void {
  const g = f < 2 ? f : f >= FAIL_FRAMES - 2 ? FAIL_FRAMES - 1 - f : 2
  if (g < 2) {
    const puff = ['C'.repeat(2 + 2 * g), 'C'.repeat(2 + 2 * g)]
    draw(cv, x - g, 0, puff, { C: RAIN_COLOR })
    draw(cv, x + MOUSE_W - 2 - g, 0, puff, { C: RAIN_COLOR })
    return
  }
  draw(cv, x - 2, 0, ['.CCCC.CCCC..', 'CCCCCCCCCCCC'], { C: RAIN_COLOR })
  const started = f - 3
  if (started < 0) return
  const columns: [number, number][] = [[x - 2, 0], [x, 2], [x + MOUSE_W - 3, 1], [x + MOUSE_W - 1, 3]]
  for (const [col, phase] of columns) {
    for (let spawn = phase; spawn <= started; spawn += 4) {
      const p = BOLT_TOP + started - spawn
      if (p > 6) continue
      plot(cv, col, p, DROP)
      plot(cv, col, p + 1, DROP)
    }
  }
}

/** The commit's big bolt: a zigzag across the whole band over the hills, and two bolts down onto him
 * from the top, a cell row a frame, all blinking white and yellow. */
function bigBolt(cv: Canvas, x: number, f: number): void {
  const color = mod(f, 2) === 0 ? '#ffffff' : YELLOW
  for (let c = 0; c < cv.w; c++) plot(cv, c, 4 + mod(Math.floor((c + f) / 3), 2), color)
  const depth = Math.min(8, 2 * (f + 1))
  for (const col of [x - 1, x + MOUSE_W - 3]) for (let r = 0; r < depth; r++) plot(cv, col, r, color)
}

export function sparkyScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const home = Math.floor((w + MOUSE_W) / 2) - MOUSE_W
  const x = Math.min(home, t - MOUSE_W)
  const walking = x < home
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const bash = act === 'tool' && s.tool === 'bash'
  const hits = strikes(t, w, s, walking)

  // The sky: clouds drifting left, lit as a bolt leaves them and on a commit.
  const n = cloudCount(w)
  for (let i = 0; i < n; i++) {
    const lit = hits.some(h => h.cloud === i && h.f < 3) || (isCommit && mod(s.newsAge, 2) === 0)
    draw(cv, cloudX(i, n, w, t), 0, CLOUD, { C: lit ? PALE : CLOUD_COLOR })
  }
  // The hills: crests on pixel row 4 over a solid row 5, rolling by slowly; the grass under them at two speeds.
  for (let c = 0; c < w; c++) {
    const u = c + t * CLOUD_SPEED
    if (Math.sin(u * 0.11 + 1) * 0.5 + Math.sin(u * 0.27) * 0.5 > 0.2) plot(cv, c, 4, CREST)
    plot(cv, c, 5, HILL)
  }
  ground(cv, t, 6, 0.5, GRASS_FAR)
  ground(cv, t, 7, 1, isCommit && s.newsAge < 2 ? [PALE] : GRASS)
  minis(cv, t, x, s)

  // The mouse: running (feet alternating every two frames), a hop on a passing test; a twitch, a blink;
  // cheeks that crackle while bash runs, sparkle as the act turns and on a pass, go pale with the rain.
  const hop = isPass && mod(s.newsAge, 8) < 4 ? 1 : 0
  const my = MOUSE_Y - hop
  const art = [...(mod(t, 4) < 2 ? MOUSE : MOUSE_STEP)]
  // No ear tips while he runs in (the right one, passing a cloud, would fuse with it and then part
  // from it two columns from any run start under it), nor on the frame he stops (the ear's start was
  // two columns back the frame before).
  if (t - MOUSE_W <= home) art[0] = '........'
  else if (mod(t, TWITCH_EVERY) < 2) art[0] = EARS_TWITCH
  if (isFail) art[EYES_ROW] = EYES_SAD
  else if (mod(t, BLINK_EVERY) < 2) art[EYES_ROW] = EYES_SHUT
  let cheek = CHEEK
  if (isFail) cheek = '#b5838d'
  else if (bash || isPass || isCommit || s.actAge < TURN_FRAMES) cheek = mod(t, 2) === 0 ? '#ffffff' : CHEEK
  draw(cv, x - TAIL_W, my + 3, TAIL, TAIL_COLORS)
  const tip = walking ? 0 : frame(WAG, t)
  for (let k = 0; k < tip; k++) plot(cv, x - 1 - k, my + 2, YELLOW)
  draw(cv, x, my, art, { ...MOUSE_COLORS, R: cheek })
  // Crackle: a spark beside one cheek, then the other.
  if (bash) plot(cv, mod(t, 2) === 0 ? x - 1 : x + MOUSE_W, 5, PALE)
  // A pass: sparks fly out from both cheeks along the hill row, a pixel a frame, a second pair behind.
  if (isPass) for (const lag of [0, 4]) {
    const d = s.newsAge - lag
    if (d < 0) continue
    const color = mod(d, 2) === 0 ? '#ffffff' : YELLOW
    plot(cv, x - 1 - d, 5, color)
    plot(cv, x + MOUSE_W + d, 5, color)
  }
  for (const h of hits) bolt(cv, cloudX(h.cloud, n, w, t), h.f)
  if (isFail) rainCloud(cv, x, s.newsAge)
  if (isCommit) bigBolt(cv, x, s.newsAge)
  marks(cv, s, isCommit)

  const g = cells(cv)
  // Over his head, a column from his right ear: a `?` while asking, a spark while a tool runs, a trail
  // of dots while thinking, a note while saying; nothing under the rain cloud or the big bolt.
  const gx = x + MOUSE_W - 3
  if (!isFail && !isCommit) {
    if (act === 'ask') { if (mod(t, 8) < 6) put(g, gx, 0, '?', { c: '#ffd166', b: true }) }
    else if (act === 'tool') put(g, gx, 0, s.actAge < TURN_FRAMES - 2 ? '·' : frame(['ϟ', '✦'], t >> 2), { c: YELLOW, b: true })
    else if (act === 'think') put(g, gx, 0, frame(['·', '··', '···', '··'], t >> 1), { c: '#c9b458' })
    else if (act === 'say') put(g, gx, 0, mod(t, 8) < 4 ? '♪' : '♫', { c: PALE, b: true })
    else put(g, gx, 0, frame(['.', '..', '...'], t >> 2), { c: '#c9b458' })
  }
  return g
}

/** An electric mouse: black-tipped ears, red cheeks. */
export const PET: PetArt = {
  body: ['KY.....YK.Y.', '.YYYYYYY.YY.', 'YYYYYYYYY.Y.', 'RYYYYYYYR...', '.YY.YY.YY...'],
  step: ['KY.....YK..Y', '.YYYYYYY.YY.', 'YYYYYYYYYY..', 'RYYYYYYYR...', 'YY..YY..YY..'],
  colors: { K: '#5a3a22', Y: '#ffd60a', R: '#e63946' },
  eyes: [2, 6],
  eyeRow: 1,
  eye: '#5a3a22',
  lid: '#ffd60a',
  blush: '#ff8fab',
  spark: '#fff3b0',
}

export const SPARKY: Theme = {
  name: 'sparky',
    rows: SCENE_ROWS,
    color: '#ffd60a',
    accent: '#e63946',
    sprite: {
      think: ['ϟ(•ᴥ•)  ', 'ϟ(•ᴥ•) ?', ' (•ᴥ•)ϟ?'],
      tool: ['ϟϟ(>ᴥ<)ϟϟ', ' ϟ(>ᴥ<)ϟ '],
      say: ['(•ᴥ•)ﾉϟ ', '(•ᴥ•)ﾉ ϟ'],
      wait: ['(•ᴥ•) .  ', '(•ᴥ•) .. ', '(•ᴥ•) ...'],
    },
    happy: 'ϟ(^ᴥ^)ϟ',
    sad: '(;ᴥ;)',
    dead: '(×ᴥ×)',
    sleep: '(-ᴥ-) zZ',
    confetti: ['ϟ', '✦', '*', '·', '+'],
    palette: ['#ffd60a', '#e63946', '#fff3b0', '#c68b59'],
    scene: sparkyScene,
  pet: PET,
}
