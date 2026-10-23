// Theme: dino. Its scene, its words and its pet.
import { blank, cells, frame, mod, noise, put, textWidth } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import type { Theme } from '../themes'

export function dinoScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const rx = 4
  const body = 'ᕕ(ᐛ)ᕗ'
  for (let x = 0; x < w; x++) {
    if (mod(x + t, 9) === 0) put(g, x, 1, '_', { c: '#6c757d', d: true })
  }
  for (let x = 0; x < w; x += 23) {
    put(g, mod(x - Math.floor(t * 0.3), w + 6) - 3, 0, '~~', { c: '#adb5bd', d: true })
  }
  // A cactus every 20 cells or so; the runner jumps the ones in reach.
  let isAirborne = false
  const first = Math.floor((t - rx - 10) / 20)
  for (let k = Math.max(0, first); k * 20 < t + w; k++) {
    const x = k * 20 + Math.floor(noise(k) * 10) + 30 - t
    if (x < 0 || x >= w) continue
    put(g, x, 1, 'ψ', { c: '#2a9d8f', b: true })
    if (x >= rx - 1 && x <= rx + textWidth(body) + 1) isAirborne = true
  }
  put(g, rx, isAirborne ? 0 : 1, isAirborne ? 'ᕕ(ᐛ)ᕗ' : frame(['ᕕ(ᐛ)ᕗ', 'ᕕ( ᐛ)ᕗ'], t >> 1), { c: '#e9c46a', b: true })
  put(g, w - 9, 0, `HI ${String(t).padStart(5, '0')}`, { c: '#adb5bd' })
  return g
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#e9c46a', L: '#e9c46a', D: '#e9c46a' }, lid: '#e9c46a' }

export const DINO: Theme = {
  name: 'dino',
    rows: 2,
    sleep: 'ᕕ(-ᐛ-)ᕗ zZ',
    color: '#e9c46a',
    accent: '#2a9d8f',
    sprite: {
      think: ['ᕕ(ᐛ)ᕗ   ', 'ᕕ(ᐛ)ᕗ ? ', 'ᕕ( ᐛ)ᕗ ?'],
      tool: ['ᕕ(ᐛ)ᕗ  ψ', 'ᕕ(ᐛ)ᕗ ψ ', ' ᕕ(ᐛ)ᕗψ '],
      say: ['ᕕ(ᐛ)ᕗ ε=', 'ᕕ(ᐛ)ᕗε=ε='],
      wait: ['ᕕ(ᐛ)ᕗ .  ', 'ᕕ(ᐛ)ᕗ .. ', 'ᕕ(ᐛ)ᕗ ...'],
    },
    happy: 'ヽ(ᐛ)ノ',
    sad: '(ᐛ；)',
    dead: '(×ᐛ×)',
    confetti: ['ψ', '*', '+', '·', '✦'],
    palette: ['#e9c46a', '#2a9d8f', '#f4a261', '#e76f51'],
    scene: dinoScene,
  pet: PET,
}
