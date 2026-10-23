// Theme: bunny. Its scene, its words and its pet.
import { blank, mod, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Signals, Theme } from '../themes'

export function bunnyScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    if (mod(x * 7 + 3, 11) === 0) put(g, x, 1, '"', { c: '#80b918', d: true })
  }
  const lap = w + 11
  const bx = mod(Math.floor(t * 0.5), lap) - 11
  // Carrots ahead of the bunny; the ones it has passed are eaten.
  for (let x = 6; x < w; x += 13) {
    if (x > bx + 9 || bx < -6) put(g, x, 1, 'ɣ', { c: '#ff9f1c', b: true })
  }
  const isUp = mod(t, 6) < 3
  put(g, bx, isUp ? 0 : 1, isUp ? '૮ ˶ᵔ ᵕ ᵔ˶ ა' : '૮ ˶• ᴗ •˶ ა', { c: '#f8f9fa', b: true })
  if (!isUp) put(g, bx - 2, 1, '⁎', { c: '#adb5bd', d: true })
  return withReactions(g, t, s, '#f1faee')
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#f1faee', L: '#f1faee', D: '#f1faee' }, lid: '#f1faee' }

export const BUNNY: Theme = {
  name: 'bunny',
    rows: 2,
    sleep: '૮ ˶- ᴗ -˶ ა zZ',
    color: '#f1faee',
    accent: '#ff9f1c',
    sprite: {
      think: ['૮ ˶• ᴗ •˶ ა  ', '૮ ˶- ᴗ -˶ ა ?', '૮ ˶• ᴗ •˶ ა ?'],
      tool: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ɣ', '૮ ˶ᵔ ᵕ ᵔ˶ აɣ ', '૮ ˶ᵔ ᵕ ᵔ˶ ა  '],
      say: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ♪', '૮ ˶ᵔ ᵕ ᵔ˶ ა ♫'],
      wait: ['૮ ˶• ᴗ •˶ ა .  ', '૮ ˶• ᴗ •˶ ა .. ', '૮ ˶• ᴗ •˶ ა ...'],
    },
    happy: '૮ ˶ᵔ ᵕ ᵔ˶ ა',
    sad: '૮ ˶; ﹏ ;˶ ა',
    dead: '૮ ˶x ﹏ x˶ ა',
    confetti: ['ɣ', '*', '·', '✦', '"'],
    palette: ['#ff9f1c', '#80b918', '#f1faee', '#ffbf69'],
    scene: bunnyScene,
  pet: PET,
}
