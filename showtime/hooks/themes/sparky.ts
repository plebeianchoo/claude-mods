// Theme: sparky. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS, clouds, ground, ridge } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

const MOUSE = [
  ['K.....K...', 'YY...YY...', '.YYYYYY...', 'YYKYYKYY..', 'RYYYKYYR..', '.YYYYYY...', '.Y.YY.Y...'],
  ['K.....K...', 'YY...YY...', '.YYYYYY...', 'YYKYYKYY..', 'RYYYKYYR..', '.YYYYYY...', 'Y..YY..Y..'],
]
const TAIL = ['...YYY', '..YY..', '.YYYY.', '...YY.', '..BB..']
const BOLT = ['..WW', '.WW.', 'WWWW', '..W.', '.W..', 'W...', 'W...', '....']

export function sparkyScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  clouds(cv, t, Math.max(2, Math.floor(w / 25)), 0.15, '#3a4a5c', 2, 4)
  ridge(cv, t, 6, 3, 0.15, '#2d4a3e', 2)
  ground(cv, t, 7, 0.7, ['#4caf50', '#43a047', '#66bb6a', '#4caf50', '#e9c46a'])
  // Every so often (often while a tool runs) a bolt strikes ahead of it.
  const every = act === 'tool' ? 10 : 34
  const strike = mod(t, every)
  const speed = act === 'ask' ? 0.2 : act === 'tool' ? 0.9 : 0.6
  const x = mod(Math.floor(t * speed), w + 18) - 10
  if (strike < 4) {
    const bx = Math.floor(noise(Math.floor(t / every)) * (w - 12)) + 6
    draw(cv, bx, 0, BOLT, { W: strike < 2 ? '#ffffff' : '#ffd60a' })
    if (strike < 2) for (let i = -3; i <= 3; i++) plot(cv, bx + i, 7, '#fff3b0')
  }
  draw(cv, x - 7, 1 + (mod(t, 4) < 2 ? 0 : 1), TAIL, { Y: '#f4c430', B: '#8d6e3f' })
  const cheek = act === 'tool' && mod(t, 4) < 2 ? '#fff3b0' : '#e63946'
  draw(cv, x, mod(t, 4) < 2 ? 0 : 1, frame(MOUSE, t >> 1), { K: '#1b1b1b', Y: '#ffd60a', R: cheek })
  const g = cells(cv)
  if (act === 'tool' && mod(t, 4) < 2) put(g, x + 9, 0, 'ϟ', { c: '#ffd60a', b: true })
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 9, 0, '?', { c: '#ffd166', b: true })
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
