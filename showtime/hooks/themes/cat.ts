// Theme: cat. Its scene, its words and its pet.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import type { Theme } from '../themes'

export function catScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    const n = noise(x + 1000 * Math.floor((x + t) / w))
    if (mod(x + t, 7) === 0) put(g, x, 1, n < 0.5 ? '˙' : ',', { c: '#7fb069', d: true })
  }
  const lap = w + 8
  const cx = mod(Math.floor(t * 0.6), lap) - 6
  put(g, cx, 1, 'ᓚᘏᗢ', { c: frame(['#ffb3c6', '#ffc8dd'], t >> 1), b: true })
  put(g, cx + 5, 1, frame(['◐', '◓', '◑', '◒'], t), { c: '#ffd166' })
  // Hearts float up behind the cat and fade.
  for (let i = 0; i < 3; i++) {
    const age = mod(t + i * 5, 15)
    if (age < 10) put(g, cx - 2 - Math.floor(age / 3), 0, age < 6 ? '♡' : '·', { c: '#ff8fab', d: age >= 6 })
  }
  if (mod(t, 40) < 20) put(g, cx + 3, 0, frame(['♪', '♫'], t >> 2), { c: '#cdb4db' })
  return g
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#ffb3c6', L: '#ffb3c6', D: '#ffb3c6' }, lid: '#ffb3c6' }

export const CAT: Theme = {
  name: 'cat',
    rows: 2,
    sleep: '(=－ω－=) zZ',
    color: '#ffb3c6',
    accent: '#ffd166',
    sprite: {
      think: ['(=^･ω･^=)   ', '(=^･ω･^=) ? ', '(=^-ω-^=) ? ', '(=^･ω･^=) ?!'],
      tool: ['ฅ(=^･ω･^=) ', ' (=^･ω･^=)ฅ', 'ฅ(=^･ω･^=)ฅ'],
      say: ['(=^･ω･^=)ﾉ ♪', '(=^･ω･^=)ﾉ  ♫', '(=^▽^=)ﾉ ♪'],
      wait: ['(=^･ω･^=) .  ', '(=^･ω･^=) .. ', '(=^･ω･^=) ...'],
    },
    happy: '(=^▽^=)ﾉ',
    sad: '(=；ω；=)',
    dead: '(=×ω×=)',
    confetti: ['✿', '♡', '*', '·', '✦'],
    palette: ['#ffb3c6', '#ffd166', '#cdb4db', '#a2d2ff', '#ff8fab'],
    scene: catScene,
  pet: PET,
}
