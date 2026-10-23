// Theme: thunder. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS, glyphStars } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

const JET = ['..AA........', '.FBBBBWW....', 'FFBBBBBBBBC.', '.FBBBBBB....', '..AA........']
const FOE = [
  ['.RRRR.', 'RYRRYR', 'RRRRRR', 'R.RR.R', '.R..R.'],
  ['.RRRR.', 'RYRRYR', 'RRRRRR', 'R.RR.R', 'R....R'],
]
const SAUCER = [['..PP..', '.PPPP.', 'PWPWPW', '.PPPP.'], ['..PP..', '.PPPP.', 'WPWPWP', '.PPPP.']]

const H = SCENE_ROWS * 2

export function thunderScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // Three layers of stars streaming past.
  for (let layer = 1; layer < 3; layer++) {
    const speed = [0.5, 1, 2][layer]!
    const color = ['#2b2d42', '#3d405b', '#8d99ae'][layer]!
    for (let i = 0; i < w / (layer === 2 ? 14 : 9); i++) {
      const y = Math.floor(noise(i * 3 + layer) * H)
      const x = mod(Math.floor(noise(i + layer * 50) * w * 2 - t * speed), w)
      plot(cv, x, y, color)
      if (layer === 2) plot(cv, x + 1, y, color)
    }
  }
  // Foe k flies in at tick k * GAP and is shot down where it is fated to be.
  const GAP = act === 'tool' ? 9 : 14
  const SPEED = act === 'ask' ? 0.3 : 0.9
  const travel = (w + 8) / SPEED
  const foes: { x: number; y: number; k: number; isAlive: boolean; age: number }[] = []
  let kills = Math.max(0, Math.floor((t - travel) / GAP))
  for (let k = kills; k <= Math.floor(t / GAP); k++) {
    const y = 2 + Math.floor(noise(k) * 2)
    const killX = w * (0.35 + noise(k + 11) * 0.4)
    const x = w + 2 - (t - k * GAP) * SPEED
    const deadAt = k * GAP + (w + 2 - killX) / SPEED
    if (deadAt <= t) kills++
    if (x > killX) foes.push({ x, y, k, isAlive: true, age: 0 })
    else if (t - deadAt < 6) foes.push({ x: killX, y, k, isAlive: false, age: t - deadAt })
  }
  const target = foes.filter(f => f.isAlive).sort((a, b) => a.x - b.x)[0]
  const jy = target ? Math.max(0, Math.min(3, target.y - 0)) : 1 + Math.round(Math.sin(t * 0.2))
  // Shots: a stream toward the nearest foe.
  if (act !== 'ask') {
    for (let f = t - mod(t, 2); f > t - w / 4; f -= 2) {
      const bx = 12 + (t - f) * 4
      if (target && bx >= target.x) continue
      plot(cv, bx, jy + 2, '#ffd60a')
      plot(cv, bx + 1, jy + 2, '#fff3b0')
    }
  }
  const flame = frame(['#ff9f1c', '#ffd60a', '#ff6b35'], t)
  draw(cv, 1, jy, JET, { A: '#4361ee', B: '#4cc9f0', W: '#e0fbfc', C: '#f72585', F: flame })
  plot(cv, 0, jy + 2, mod(t, 2) ? '#ffd60a' : '#ff6b35')
  for (const foe of foes) {
    if (foe.isAlive) {
      if (foe.k % 3 === 2) draw(cv, foe.x, foe.y, frame(SAUCER, t >> 1), { P: '#9d4edd', W: '#80ffdb' })
      else draw(cv, foe.x, foe.y, frame(FOE, t >> 1), { R: '#f72585', Y: '#ffd60a' })
    } else {
      const r = foe.age
      const color = frame(['#ffffff', '#fff3b0', '#ffd60a', '#ff9f1c', '#e85d04', '#9d0208'], r)
      for (let a = 0; a < 10; a++) plot(cv, foe.x + 3 + Math.cos(a * 0.628) * r * 1.6, foe.y + 2 + Math.sin(a * 0.628) * r * 0.8, color)
      if (r < 2) draw(cv, foe.x + 2, foe.y + 1, ['WW', 'WW'], { W: '#ffffff' })
    }
  }
  const g = cells(cv)
  glyphStars(g, t, Math.floor(w / 4), 0.5, ['·', '✦'], ['#5c677d', '#8d99ae'], 21)
  const score = `SCORE ${String(kills * 100).padStart(6, '0')}`
  put(g, w - score.length - 1, 0, score, { c: '#fca311', b: true })
  if (act === 'ask' && mod(t, 8) < 5) put(g, 14, 0, '! READY?', { c: '#ffd166', b: true })
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
