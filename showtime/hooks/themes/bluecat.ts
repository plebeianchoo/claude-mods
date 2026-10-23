// Theme: bluecat. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS, clouds } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

const ROBOCAT = [
  ['..PPPPPPP..', '.....p.....', '..BBBBBBB..', '.BBWWBWWBB.', 'BBWKWRWKWBB', 'BBWWWWWWWBB', '.BRRRYRRRB.'],
  ['....PPP....', '.....p.....', '..BBBBBBB..', '.BBWWBWWBB.', 'BBWKWRWKWBB', 'BBWWWWWWWBB', '.BRRRYRRRB.'],
]
const GADGETS = ['#ff8fab', '#ffd60a', '#80ffdb', '#c77dff', '#f4a261']

export function bluecatScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  clouds(cv, t, Math.max(2, Math.floor(w / 20)), 0.2, '#2b3a55', 3, 9)
  // Rooftops far below, scrolling past.
  const off = Math.floor(t * 0.4)
  for (let x = 0; x < w; x++) {
    const b = Math.floor((x + off) / 7)
    const h = 1 + Math.floor(noise(b) * 3)
    for (let y = 8 - h; y < 8; y++) plot(cv, x, y, mod(x + off, 7) === 0 ? '#14213d' : '#1f2a44')
    if (h > 1 && noise(b * 3 + y0(x + off)) < 0.25) plot(cv, x, 8 - h + 1, '#ffd166')
  }
  const x = Math.floor(w * 0.3) + Math.round(Math.sin(t * 0.08) * (w * 0.15))
  const y = Math.round(Math.sin(t * 0.25)) + (act === 'ask' ? 1 : 0)
  // Gadgets tumble out of the pocket while a tool runs.
  if (act === 'tool') {
    for (let i = 0; i < 5; i++) {
      const age = mod(t + i * 4, 16)
      plot(cv, x + 5 - age, y + 6 + Math.floor(age / 4), frame(GADGETS, i + Math.floor(t / 16)))
      plot(cv, x + 4 - age, y + 6 + Math.floor(age / 4), frame(GADGETS, i + Math.floor(t / 16)))
    }
  }
  draw(cv, x, y, frame(ROBOCAT, t), { P: '#d4a373', p: '#8d6e3f', B: '#0096c7', W: '#ffffff', K: '#1b1b1b', R: '#e63946', Y: '#ffd60a' })
  const g = cells(cv)
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 12, 0, '?', { c: '#ffd166', b: true })
  return g
}

/** Which window row of a building lights up. */
function y0(n: number): number {
  return Math.floor(n / 3)
}

/** A blue robot cat: white face, red nose, a bell on its collar. */
export const PET: PetArt = {
  body: ['..BBBBBBBB..', '.BBWWWWWWBB.', 'BBWWWWWWWWBB', 'BBWWWRRWWWBB', '.BRRRYYRRRB.'],
  colors: { B: '#0096c7', W: '#ffffff', R: '#e63946', Y: '#ffd60a' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#ffffff',
  mouth: [5, 3],
  blush: '#ff8fab',
  spark: '#80ffdb',
}

export const BLUECAT: Theme = {
  name: 'bluecat',
    rows: SCENE_ROWS,
    color: '#00b4d8',
    accent: '#e63946',
    sprite: {
      think: ['⊂(◉‿◉)つ  ', '⊂(◉‿◉)つ ?', '⊂(◔‿◔)つ ?'],
      tool: ['⊂(◉‿◉)つ✦  ', '⊂(◉‿◉)つ ✧ ', '⊂(◉‿◉)つ  ✦'],
      say: ['⊂(◕‿◕)つ ♪', '⊂(◕‿◕)つ ♫'],
      wait: ['⊂(◉‿◉)つ .  ', '⊂(◉‿◉)つ .. ', '⊂(◉‿◉)つ ...'],
    },
    happy: '⊂(◕‿◕)つ',
    sad: '⊂(╥﹏╥)つ',
    dead: '⊂(×﹏×)つ',
    sleep: '⊂(－‿－)つ zZ',
    confetti: ['✦', '✧', '●', '·', '+'],
    palette: ['#00b4d8', '#e63946', '#ffd60a', '#ffffff'],
    scene: bluecatScene,
  pet: PET,
}
