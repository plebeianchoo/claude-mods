// Theme: thunder. Its scene, its words and its pet.
//
// The scene: a jet at the left bobbing on a twelve-frame sine, its exhaust flickering every frame,
// firing at an invader wave that flies in from the right edge over stars streaming past at two
// speeds. Each subagent adds a wave of small invaders in the top lane. The score at the top right
// reads done/total, and a small ship icon per task sits along the bottom edge, `done` of them lit.
// The fire rate follows the tool (bash every 2 frames, edit 4, else 6); while asking, the jet holds
// fire and the invaders slip past. A failed test hits the jet (it flashes red/transparent, drops a
// pixel, recovers); a commit drops a bomb that clears every invader in a twelve-frame flash; a
// passing test sends the jet climbing on a green afterburner.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same row or a neighbour). So: everything
// moves at most a pixel a frame (foes 0.75, minis 0.5, stars 0.5 and 1, shots 1), invaders enter at
// the right edge, shots leave the cannon tip (a run of its own, so a new shot is one column from it),
// explosions grow in place and their debris flies left, and the bob is a one-pixel hop.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

/** The jet at the left edge, 12 px wide: fins and exhaust at the edge (so a mini invader passing the
 * top fin leaves its run start at a border column), the body to column 9, a gap, the cannon at 11. */
const JET = ['AA..........', '.FBBBBBWW...', 'FFBBBBBBB.C.', '.FBBBBBBB...', 'AA..........']
/** The same with the exhaust tail gone: the two alternate, a flicker every frame. */
const JET_SHORT = ['AA..........', '.FBBBBBWW...', '.FBBBBBBB.C.', '.FBBBBBBB...', 'AA..........']
const JET_COLORS = { A: '#4361ee', B: '#4cc9f0', W: '#e0fbfc', C: '#f72585' }
const HIT_COLORS = { A: '#f72585', B: '#f72585', W: '#ff8fab', C: '#ffffff', F: '#f72585' }
const JET_X = 0
const CANNON_X = JET_X + 10
/** Where shots appear: one column past the cannon tip, a run of its own. */
const NOSE_X = CANNON_X + 1
/** The bob: a twelve-frame cycle, one pixel at a time. */
const BOB = [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0]
const FLAME = ['#ff9f1c', '#ffd60a', '#ff6b35', '#fff3b0']
/** Invaders, 4 px tall, two frames each (legs, or the saucer's lights). */
const FOE = [
  ['.RRRR.', 'RYRRYR', 'RRRRRR', '.R..R.'],
  ['.RRRR.', 'RYRRYR', 'RRRRRR', 'R....R'],
]
const SAUCER = [['..PP..', '.PPPP.', 'PWPWPW', '.PPPP.'], ['..PP..', '.PPPP.', 'WPWPWP', '.PPPP.']]
const FOE_Y = 2
const FOE_COLORS = { R: '#f72585', Y: '#ffd60a', P: '#9d4edd', W: '#80ffdb' }
/** A subagent's small invader, 2 px tall, flying the top lane. */
const MINI = [['M.M.M', '.MMM.'], ['.MMM.', 'M.M.M']]
const MINI_W = 5
const MINI_COLORS = ['#ff9f1c', '#80ffdb', '#bb9af7', '#ffd60a']
/** An explosion in place: a spark, a ring, a bigger ring, then debris flung left. Each row's left edge moves one column a frame. */
const BOOM: { dx: number; dy: number; art: string[] }[] = [
  { dx: 2, dy: 1, art: ['WW', 'WW'] },
  { dx: 1, dy: 0, art: ['.YY.', 'YWWY', 'YWWY', '.YY.'] },
  { dx: 0, dy: 0, art: ['.OOOO.', 'OYYYYO', 'OYYYYO', '.OOOO.'] },
  { dx: -1, dy: 0, art: ['R.....', 'RR....', 'RR....', 'R.....'] },
]
const BOOM_COLORS = { W: '#ffffff', Y: '#ffd60a', O: '#ff9f1c', R: '#e85d04' }
const BOOM_FRAMES = BOOM.length
/** A task's ship icon along the bottom edge. */
const SHIP = ['.S.', 'SSS']
const SHIP_X0 = 6
const SHIP_PITCH = 4
/** Invader motion: one wave, a foe every GAP frames at SPEED px a frame (constant across acts, so an act change never moves one). */
const GAP = 16
const SPEED = 0.75
const MINI_GAP = 14
/** Reaction lengths, in frames. */
const HIT_FRAMES = 10
const PASS_FRAMES = 16
const COMMIT_FRAMES = 12
const FLASH = ['#ffffff', '#fff3b0', '#ffd60a', '#ffd60a', '#ff9f1c', '#ff9f1c', '#e85d04', '#e85d04', '#9d4edd', '#9d4edd', '#5c677d', '#5c677d']
/** Frames between shots while a tool runs, by tool; thinking fires slower, saying as a plain tool, asking not at all. */
function fireRate(s: Signals): number {
  if (s.act === 'ask' || s.act === 'wait') return 0
  if (s.act === 'tool') return s.tool === 'bash' ? 2 : s.tool === 'edit' ? 4 : 6
  return s.act === 'say' ? 6 : 8
}
/** The rate shots fired before the act turned are assumed to have had. */
const OLD_RATE = 6

/** A foe of the wave: alive at `x`, or exploding there (`age` frames in; past BOOM_FRAMES, gone, kept so shots it ate stay eaten). */
type Foe = { x: number; k: number; alive: boolean; age: number }

/** The jet's top row at time `tt`: the bob, a pixel down while hit, climbing on a passing test. */
function jetY(tt: number, s: Signals, now: number): number {
  const since = (age: number) => tt - (now - age)   // frames from that news to `tt`
  if (s.news === 'testPass' && since(s.newsAge) >= 0 && since(s.newsAge) < PASS_FRAMES) return 0
  const y = frame(BOB, tt)
  if (s.news === 'testFail' && since(s.newsAge) >= 0 && since(s.newsAge) < HIT_FRAMES) return y + 1
  return y
}

/** Stars streaming past at two speeds, a pixel each: a pixel may cross or overtake anything without
 * leaving a run start behind, a wider thing may not. The slow ones keep to the top and bottom rows: in
 * the battle rows a foe would overtake one and it would drift out of the foe's far side. None in the
 * jet's zone: one in the gap before its cannon would fuse the cannon to the body, then split it off. */
function stars(cv: Canvas, t: number): void {
  const w = cv.w
  const SKY = [0, 1, 6, 7]
  for (let i = 0; i < w / 8; i++) {
    const x = mod(Math.floor(noise(i + 50) * w * 2) - Math.floor(t / 2), w)
    if (x >= NOSE_X) plot(cv, x, SKY[Math.floor(noise(i * 3 + 1) * 4)]!, '#4a4e69')
  }
  for (let i = 0; i < w / 10; i++) {
    const x = mod(Math.floor(noise(i + 150) * w * 2) - t, w)
    if (x >= NOSE_X) plot(cv, x, Math.floor(noise(i * 3 + 2) * cv.h), '#8d99ae')
  }
}

/** The wave: foe k enters at the right edge at tick k * GAP and is shot down where it is fated to be, unless asked or bombed. */
function wave(t: number, w: number, s: Signals): Foe[] {
  const travel = (w + 8) / SPEED
  const bombAt = s.news === 'commit' ? t - s.newsAge : -Infinity
  const foes: Foe[] = []
  for (let k = Math.max(0, Math.floor((t - travel) / GAP)); k <= Math.floor(t / GAP); k++) {
    const spawn = k * GAP
    const at = (tt: number) => w + 2 - (tt - spawn) * SPEED
    const killX = w * (0.35 + noise(k + 11) * 0.4)
    let deadAt = s.act === 'ask' || s.act === 'wait' ? Infinity : spawn + (w + 2 - killX) / SPEED
    if (bombAt >= spawn && bombAt < deadAt) deadAt = bombAt
    if (t < deadAt) foes.push({ x: at(t), k, alive: true, age: 0 })
    else foes.push({ x: Math.round(at(deadAt)), k, alive: false, age: Math.floor(t - deadAt) })
  }
  return foes
}

/** Shots: fired every `rate` frames from the cannon tip, a pixel a frame, gone when they meet a foe. */
function shots(cv: Canvas, t: number, s: Signals, foes: Foe[], flash: boolean, isPass: boolean): void {
  const w = cv.w
  const rate = fireRate(s)
  const actStart = t - s.actAge
  const hitStart = s.news === 'testFail' ? t - s.newsAge : -Infinity
  const color = isPass ? ['#9ece6a', '#c3e88d'] : s.tool === 'edit' ? ['#4cc9f0', '#e0fbfc'] : s.tool === 'bash' ? ['#ffd60a', '#fff3b0'] : ['#ff9f1c', '#ffd60a']
  for (let f = t; f > t - (w - NOSE_X); f--) {
    const fired = f < actStart ? mod(f, OLD_RATE) === 0 : rate > 0 && mod(f - actStart, rate) === 0
    if (!fired || (f >= hitStart && f < hitStart + HIT_FRAMES)) continue
    const x = NOSE_X + (t - f)
    const absorbed = foes.some(foe => {
      const spawn = foe.k * GAP
      const meet = (w - NOSE_X + 2 + f + spawn * SPEED) / (1 + SPEED)
      const deadAt = foe.alive ? Infinity : t - foe.age
      return meet >= f && meet <= t && meet < deadAt + BOOM_FRAMES
    })
    if (absorbed) continue
    const y = jetY(f, s, t) + 2
    plot(cv, x, y, flash ? '#ffffff' : color[0]!)
    plot(cv, x + 1, y, flash ? '#ffffff' : color[1]!)
    // The muzzle flash: a pixel over and under the shot as it leaves; one of them lands in the cell row
    // next to the shot's, a run start the shot is one column from once it has separated from the cannon.
    if (f === t) {
      plot(cv, NOSE_X, y - 1, '#fff3b0')
      plot(cv, NOSE_X, y + 1, '#fff3b0')
    }
  }
}

/** Subagents: a wave of small invaders each in the top lane, entering at the right edge when the agent
 * arrives. They step on the frames the slow stars step on (every other `t`), so a star never drifts
 * out of one from its far side. */
function minis(cv: Canvas, t: number, s: Signals): void {
  const w = cv.w
  for (let i = 0; i < Math.min(s.agents, 4); i++) {
    const start = t - s.agentsAge + i * 5   // when this wave's first mini enters
    const a = t - start
    if (a < 0) continue
    const art = MINI_COLORS[i]!
    for (let n = Math.max(0, Math.floor((a - 2 * (w + MINI_W + 2)) / MINI_GAP)); n * MINI_GAP <= a; n++) {
      const x = w + 1 - (Math.floor(t / 2) - Math.floor((start + n * MINI_GAP) / 2))
      if (x > -MINI_W) draw(cv, x, 0, frame(MINI, (a - n * MINI_GAP) >> 1), { M: art })
    }
  }
}

/** Task ships along the bottom edge, left of the score: `total` of them, `done` lit; the newest pulses, all wave when the last lands, all flash on a commit. */
function ships(cv: Canvas, s: Signals, isCommit: boolean, isPass: boolean, scoreW: number): void {
  const n = Math.min(s.total, Math.max(0, Math.floor((cv.w - SHIP_X0 - scoreW - 2) / SHIP_PITCH)))
  const allDone = s.total > 0 && s.done >= s.total
  for (let i = 0; i < n; i++) {
    let color = i < s.done ? '#4cc9f0' : '#4a4e69'
    if (isCommit && mod(s.newsAge, 4) < 2) color = '#ffffff'
    else if (isPass && mod(s.newsAge - i, 6) < 3) color = '#9ece6a'
    else if (allDone && s.doneAge < 16 && mod(s.doneAge - i, 8) < 2) color = '#e0fbfc'
    else if (!allDone && i === s.done - 1 && s.doneAge < 8 && mod(s.doneAge, 4) < 2) color = '#e0fbfc'
    draw(cv, SHIP_X0 + i * SHIP_PITCH, 6, SHIP, { S: color })
  }
}

export function thunderScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const isHit = s.news === 'testFail' && s.newsAge < HIT_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  stars(cv, t)
  // The bomb: the top and bottom pixel rows flash, fading over twelve frames.
  if (isCommit) for (let x = 0; x < w; x++) { plot(cv, x, 0, FLASH[s.newsAge]!); plot(cv, x, 7, FLASH[s.newsAge]!) }
  minis(cv, t, s)
  const score = `${s.done}/${s.total}`
  ships(cv, s, isCommit, isPass, score.length)
  const foes = wave(t, w, s)
  shots(cv, t, s, foes, isCommit && s.newsAge < 2, isPass)
  // The jet, bobbing; while hit it shows on even frames only. Its exhaust: a new color every frame, the tail
  // pixel every other frame; an afterburner (tail on, white) as the act turns and on a passing test.
  const jy = jetY(t, s, t)
  const burner = s.actAge < 6 || isPass
  const flame = isPass ? (mod(t, 2) ? '#9ece6a' : '#e0fbfc') : burner ? (mod(t, 2) ? '#fff3b0' : '#ffd60a') : frame(FLAME, t)
  if (!isHit || mod(s.newsAge, 2) === 0) {
    draw(cv, JET_X, jy, burner || mod(t, 2) === 0 ? JET : JET_SHORT, isHit ? HIT_COLORS : { ...JET_COLORS, F: flame })
    // The cannon glows as the act turns.
    if (s.actAge < 6) plot(cv, CANNON_X, jy + 2, '#fff3b0')
  }
  for (const foe of foes) {
    if (foe.alive) {
      // A foe that gets past the jet (asking: it holds fire) slides in behind its nose.
      const x = Math.max(Math.round(foe.x), NOSE_X)
      const clip = x - Math.round(foe.x)
      draw(cv, x, FOE_Y, frame(foe.k % 3 === 2 ? SAUCER : FOE, t >> 1).map(row => row.slice(clip)), FOE_COLORS)
    } else if (foe.age < BOOM_FRAMES) {
      const b = BOOM[foe.age]!
      draw(cv, foe.x + b.dx, FOE_Y + b.dy, b.art, BOOM_COLORS)
    }
  }
  const g = cells(cv)
  // The score at the bottom right, after the ships: done/total.
  const scoreColor = isPass ? '#9ece6a' : isCommit && mod(s.newsAge, 4) < 2 ? '#ffffff' : s.doneAge < 8 && mod(s.doneAge, 4) < 2 ? '#fff3b0' : '#fca311'
  put(g, w - score.length - 1, SCENE_ROWS - 1, score, { c: scoreColor, b: true })
  // Asking: a question mark over the cannon, blinking.
  if (act === 'ask' && mod(t, 8) < 6) put(g, NOSE_X, 0, '?', { c: '#ffd166', b: true })
  return g
}

/** A small fighter with a face in its canopy, its exhaust flickering. */
export const PET: PetArt = {
  body: ['..AA........', '.ABBBBWWWW..', 'FBBBBBWWWWBC', '.ABBBBBBBB..', '..AA........'],
  step: ['..AA........', '.ABBBBWWWW..', 'GBBBBBWWWWBC', '.ABBBBBBBB..', '..AA........'],
  colors: { A: '#4361ee', B: '#4cc9f0', W: '#e0fbfc', C: '#f72585', F: '#ff9f1c', G: '#ffd60a' },
  eyes: [7, 9],
  eyeRow: 1,
  eye: '#14213d',
  lid: '#e0fbfc',
  mouth: [7, 3],
  blush: '#ff8fab',
  spark: '#ffd60a',
}

export const THUNDER: Theme = {
  name: 'thunder',
    rows: SCENE_ROWS,
    color: '#4cc9f0',
    accent: '#ffd60a',
    sprite: {
      think: ['=▷ ·    ', '=▷  ·   ', '=▷   ·  ', '=▷    · '],
      tool: ['=▷━   ◆', '=▷ ━  ◆', '=▷  ━ ◆', '=▷    ✶'],
      say: ['=▷ ⁘ ⁘ ', '=▷⁘ ⁘ ⁘'],
      wait: ['=▷ .  ', '=▷ .. ', '=▷ ...'],
    },
    happy: '=▷ ✶✶✶',
    sad: '=▷ ...',
    dead: '=▷ ✕',
    sleep: '=▷ zZ',
    confetti: ['✶', '✦', '+', '·', '◆'],
    palette: ['#4cc9f0', '#ffd60a', '#f72585', '#ff9f1c'],
    scene: thunderScene,
  pet: PET,
}
