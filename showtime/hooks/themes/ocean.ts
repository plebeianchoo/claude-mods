// Theme: ocean. Its scene, its words and its pet.
import { blank, frame, mod, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Signals, Theme } from '../themes'

export function oceanScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    put(g, x, 0, mod(x + Math.floor(t / 2), 6) < 3 ? '~' : '≈', { c: '#48cae4', d: mod(x - t, 5) !== 0 })
  }
  const fx = mod(Math.floor(t * 0.5), w + 10) - 8
  put(g, fx, 1, frame(['><(((º>', '><(((°>'], t >> 2), { c: '#ffb703', b: true })
  const sx = w - 1 - mod(Math.floor(t * 0.8), w + 5)
  put(g, sx, 1, '<><', { c: '#fb8500' })
  for (let i = 0; i < 3; i++) {
    const age = mod(t + i * 4, 12)
    const bx = fx + 8 + (i % 2)
    if (age < 4) put(g, bx, 1, 'o', { c: '#caf0f8', d: true })
    else if (age < 8) put(g, bx + 1, 0, '°', { c: '#caf0f8' })
  }
  return withReactions(g, t, s, '#ffb703')
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#ffb703', L: '#ffb703', D: '#ffb703' }, lid: '#ffb703' }

export const OCEAN: Theme = {
  name: 'ocean',
    rows: 2,
    sleep: '><(((-> zZ',
    color: '#ffb703',
    accent: '#48cae4',
    sprite: {
      think: ['><(((º>   ', '><(((º> o ', '><(((º>  °'],
      tool: ['><(((º>~  ', '><(((º>≈≈ ', '><(((º>~≈~'],
      say: ['><(((º> ♪', '><(((º>  ♫'],
      wait: ['><(((º> .  ', '><(((º> .. ', '><(((º> ...'],
    },
    happy: '><(((º> ♪',
    sad: '><(((;>',
    dead: '><(((×>',
    confetti: ['°', 'o', '~', '≈', '·'],
    palette: ['#48cae4', '#caf0f8', '#ffb703', '#fb8500'],
    scene: oceanScene,
  pet: PET,
}
