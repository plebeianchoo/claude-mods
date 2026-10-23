// Theme: sakura. Its scene, its words and its pet.
import { blank, frame, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Signals, Theme } from '../themes'

export function sakuraScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const pinks = ['#ffb7c5', '#ff8fab', '#fb6f92', '#ffc2d1', '#ffe5ec']
  const count = Math.max(6, Math.floor(w / 5))
  const gust = Math.sin(t * 0.05) * 0.4
  for (let i = 0; i < count; i++) {
    const speed = 0.25 + noise(i) * 0.45 + gust
    const x = mod(noise(i + 7) * w - t * speed + Math.sin(t * 0.2 + i) * 1.5, w)
    const y = mod(Math.floor(t * (0.05 + noise(i + 3) * 0.08) + i), 2)
    put(g, x, y, frame(['✿', '❀', '❁', '✾', '·'], i + (t >> 3)), { c: frame(pinks, i) })
  }
  const walker = mod(Math.floor(t * 0.2), w + 12) - 10
  put(g, walker, 1, frame(['(˶ᵔ ᵕ ᵔ˶)', '(˶ᵔ ᵕ ᵔ˶)~'], t >> 3), { c: '#ffafcc', b: true })
  return withReactions(g, t, s, '#ff8fab')
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#ff8fab', L: '#ff8fab', D: '#ff8fab' }, lid: '#ff8fab' }

export const SAKURA: Theme = {
  name: 'sakura',
    rows: 2,
    sleep: '(˶- ᵕ -˶) zZ',
    color: '#ff8fab',
    accent: '#ffc2d1',
    sprite: {
      think: ['✿ (˶ᵔ ᵕ ᵔ˶)', '❀ (˶ᵔ ᵕ ᵔ˶)?', '❁ (˶- ᵕ -˶)?'],
      tool: ['✿ (˶•ᴗ•˶)و ', '❀ (˶•ᴗ•˶)و✧'],
      say: ['✿ (˶ᵔ ᵕ ᵔ˶) ♪', '❀ (˶ᵔ ᵕ ᵔ˶) ♫'],
      wait: ['✿ (˶ᵔ ᵕ ᵔ˶) .  ', '❀ (˶ᵔ ᵕ ᵔ˶) .. ', '❁ (˶ᵔ ᵕ ᵔ˶) ...'],
    },
    happy: '(˶ᵔ ᵕ ᵔ˶)✿',
    sad: '(˶; ᴗ ;˶)',
    dead: '(˶x ᴗ x˶)',
    confetti: ['✿', '❀', '❁', '✾', '·'],
    palette: ['#ffb7c5', '#ff8fab', '#fb6f92', '#ffe5ec'],
    scene: sakuraScene,
  pet: PET,
}
