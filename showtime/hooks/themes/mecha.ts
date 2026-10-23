// Theme: mecha. Its scene, its words and its pet.
import { blank, frame, mod, put } from '../cells'
import type { Grid } from '../cells'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import type { Theme } from '../themes'

export function mechaScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const cycle = 36
  const phase = mod(t, cycle)
  const score = Math.floor(t / cycle)
  const rx = 2
  put(g, rx - 2, 1, frame(['≋', '≈', '∼'], t), { c: frame(['#ff9f1c', '#ffbf69', '#ff595e'], t) })
  put(g, rx, 1, frame(['[◉_◉]', '[◉_◉]', '[◎_◎]'], t >> 1), { c: '#4cc9f0', b: true })
  const near = rx + 9
  const tx = Math.max(near, Math.round(w - 2 - phase * 2))
  if (tx > near) {
    put(g, tx, 1, frame(['◇', '◆'], t >> 1), { c: '#f72585' })
  } else {
    const boom = phase - Math.ceil((w - 2 - near) / 2)
    if (boom < 3) put(g, rx + 5, 1, '━'.repeat(Math.max(0, tx - rx - 5)), { c: '#4cc9f0', b: true })
    if (boom >= 2 && boom < 8) put(g, tx - (boom > 4 ? 1 : 0), 1, boom > 4 ? '· ✶ ·' : '✶', { c: '#ffd60a', b: true })
  }
  // A radar sweep and a target counter across the top.
  const sweep = mod(t, Math.max(1, w - 14))
  put(g, 0, 0, '▕', { c: '#4361ee', d: true })
  for (let x = 1; x < w - 13; x++) {
    const dist = sweep - x
    if (dist >= 0 && dist < 6) put(g, x, 0, '▔▁▂▃▅▇'[5 - dist]!, { c: '#4cc9f0', d: dist > 2 })
  }
  put(g, w - 12, 0, `TGT ${String(score).padStart(4, '0')}`, { c: '#4361ee', b: true })
  return g
}

/** No pet of its own: Clawd's shape in this theme's color. */
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: '#4cc9f0', L: '#4cc9f0', D: '#4cc9f0' }, lid: '#4cc9f0' }

export const MECHA: Theme = {
  name: 'mecha',
    rows: 2,
    sleep: '[-_-] zZ',
    color: '#4cc9f0',
    accent: '#f72585',
    sprite: {
      think: ['[◉_◉] ▖', '[◉_◉] ▘', '[◉_◉] ▝', '[◉_◉] ▗'],
      tool: ['[◉_◉]⊃━   ', '[◉_◉]⊃━━  ', '[◉_◉]⊃━━━☆'],
      say: ['[◕‿◕] ▸  ', '[◕‿◕] ▸▸ ', '[◕‿◕] ▸▸▸'],
      wait: ['[○_○] ·  ', '[◎_◎] ·· ', '[◉_◉] ···'],
    },
    happy: '[◕‿◕]b',
    sad: '[╥_╥]',
    dead: '[×_×]',
    confetti: ['✶', '✦', '+', '·', '◆'],
    palette: ['#4cc9f0', '#f72585', '#ffd60a', '#4361ee'],
    scene: mechaScene,
  pet: PET,
}
