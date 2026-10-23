// Theme: neon. Its scene, its words and its pet.
import { blank, hsl, mod, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Signals, Theme } from '../themes'

export function neonScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const blocks = ' ▁▂▃▄▅▆▇█'
  for (let x = 0; x < w; x++) {
    const v = (Math.sin(x * 0.33 + t * 0.35) + Math.sin(x * 0.11 - t * 0.21) + 2) / 4
    const h = Math.round(v * 16)
    const c = hsl(mod(x * 7 + t * 9, 360), 0.95, 0.62)
    put(g, x, 1, blocks[Math.min(8, h)]!, { c })
    if (h > 8) put(g, x, 0, blocks[h - 8]!, { c })
  }
  return withReactions(g, t, s, '#f72585')
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#f72585', L: '#f72585', D: '#f72585' }, lid: '#f72585' }

export const NEON: Theme = {
  name: 'neon',
    rows: 2,
    sleep: '◢◤ zZ',
    color: '#f72585',
    accent: '#4cc9f0',
    isRainbow: true,
    sprite: {
      think: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(c => `${c} ◢◤◢◤`),
      tool: ['▰▱▱▱▱', '▰▰▱▱▱', '▱▰▰▱▱', '▱▱▰▰▱', '▱▱▱▰▰', '▱▱▱▱▰'],
      say: ['▁▃▅▇▅▃', '▃▅▇▅▃▁', '▅▇▅▃▁▃', '▇▅▃▁▃▅', '▅▃▁▃▅▇', '▃▁▃▅▇▅'],
      wait: ['◐ ◆', '◓ ◇', '◑ ◆', '◒ ◇'],
    },
    happy: '✦ ◢◤ ✦',
    sad: '▁▁▁',
    dead: '✕ ◢◤ ✕',
    confetti: ['✦', '✧', '+', '·', '◆'],
    palette: ['#f72585', '#b5179e', '#7209b7', '#4cc9f0', '#ffd60a'],
    scene: neonScene,
  pet: PET,
}
