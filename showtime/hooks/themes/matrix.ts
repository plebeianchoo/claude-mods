// Theme: matrix. Its scene, its words and its pet.
import { blank, mod, noise, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import { withReactions } from '../reactions'
import type { Signals, Theme } from '../themes'

export function matrixScene(t: number, w: number, s: Signals): Grid {
  const g = blank(w, 2)
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ﾊﾋﾌﾍﾎ'
  for (let x = 0; x < w; x++) {
    const speed = 1 + Math.floor(noise(x) * 3)
    const head = mod(Math.floor(t / speed) + Math.floor(noise(x + 50) * 20), 14)
    for (let y = 0; y < 2; y++) {
      const age = head - y
      if (age < 0 || age > 6) continue
      const ch = glyphs[Math.floor(noise(x * 31 + y + Math.floor(t / 3)) * glyphs.length)]!
      put(g, x, y, ch, age === 0 ? { c: '#d8f3dc', b: true } : { c: age < 3 ? '#52b788' : '#2d6a4f', d: age >= 3 })
    }
  }
  return withReactions(g, t, s, '#52b788')
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#52b788', L: '#52b788', D: '#52b788' }, lid: '#52b788' }

export const MATRIX: Theme = {
  name: 'matrix',
    rows: 2,
    sleep: '⟦IDLE⟧',
    color: '#52b788',
    accent: '#d8f3dc',
    sprite: {
      think: ['ｱ1ｳ0', '1ｳ0ｶ', 'ｳ0ｶ1', '0ｶ1ｱ'].map(s => `⟦${s}⟧`),
      tool: ['⟦▓▒░ ⟧', '⟦ ▓▒░⟧', '⟦░ ▓▒⟧', '⟦▒░ ▓⟧'],
      say: ['⟦>_  ⟧', '⟦>_▌ ⟧', '⟦>__▌⟧'],
      wait: ['⟦·   ⟧', '⟦··  ⟧', '⟦··· ⟧'],
    },
    happy: '⟦ OK ⟧',
    sad: '⟦ ^C ⟧',
    dead: '⟦ERR!⟧',
    confetti: ['ｱ', '0', '1', 'ﾊ', '·'],
    palette: ['#52b788', '#d8f3dc', '#2d6a4f', '#95d5b2'],
    scene: matrixScene,
  pet: PET,
}
