// Theme: nyan. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

const NYAN_ART = [
  ['.TTTTTTTT.....', 'TPPSPPSPT.G..G', 'TPSPPPPPTGGGGG', 'TPPPPSPPTGKGGK', 'TPSPPPPSTGPGGP', '.TTTTTTTT.GGG.', '..L.L..L.L....'],
  ['.TTTTTTTT.....', 'TPPSPPSPT.G..G', 'TPSPPPPPTGGGGG', 'TPPPPSPPTGKGGK', 'TPSPPPPSTGPGGP', '.TTTTTTTT.GGG.', '.L.L..L.L.....'],
]
const RAINBOW = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#6633ff']
const SPARKLE = [['.W.', 'W.W', '.W.'], ['...', '.W.', '...'], ['W.W', '...', 'W.W']]

export function nyanScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const speed = act === 'tool' ? 3 : act === 'ask' ? 0.5 : 2
  const x = Math.floor(w * 0.45) + Math.round(Math.sin(t * 0.15) * 3)
  for (let i = 0; i < Math.floor(w / 10); i++) {
    const sx = mod(Math.floor(noise(i + 40) * w * 2) - Math.floor(t * speed), w)
    if (sx > x + 14) draw(cv, sx, Math.floor(noise(i + 3) * 6), frame(SPARKLE, t + i), { W: i % 3 ? '#ffffff' : '#ffd6ff' })
  }
  const bob = mod(Math.floor(t / 3), 2)
  for (let tx = 0; tx < x + 1; tx++) {
    const wave = mod(Math.floor((tx - t * speed * 0.5) / 4), 2)
    for (let i = 0; i < 6; i++) plot(cv, tx, i + wave + 1, RAINBOW[i]!)
  }
  draw(cv, x, bob, frame(NYAN_ART, t >> 1), { T: '#ffcc99', P: '#ff99cc', S: '#ff3399', G: '#999999', K: '#1b1b1b', L: '#999999' })
  const g = cells(cv)
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 15, 0, '?', { c: '#ffd166', b: true })
  return g
}

/** A pop-tart cat, its head poking out on the right. */
export const PET: PetArt = {
  body: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', '.L.L.L..L.L.'],
  step: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', 'L.L.L..L.L..'],
  colors: { T: '#ffcc99', P: '#ff99cc', S: '#ff3399', G: '#a0a0a0', L: '#a0a0a0' },
  eyes: [8, 10],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#a0a0a0',
  blush: '#ff99cc',
  spark: '#ffff00',
}

export const NYAN: Theme = {
  name: 'nyan',
    rows: SCENE_ROWS,
    color: '#ff99cc',
    accent: '#999999',
    isRainbow: true,
    sprite: {
      think: ['~=[,,_,,]:3', '=~[,,_,,]:3'],
      tool: ['~=[,,_,,]:3 *', '=~[,,_,,]:3 +'],
      say: ['~=[,,o,,]:3', '=~[,,_,,]:3'],
      wait: ['~=[,,_,,]:3 .  ', '=~[,,_,,]:3 .. ', '~=[,,_,,]:3 ...'],
    },
    happy: '~=[,,^,,]:3',
    sad: '~=[,,;,,]:3',
    dead: '~=[,,x,,]:3',
    sleep: '~=[,,-,,]:3 zZ',
    confetti: ['*', '+', '·', '✦', '✧'],
    palette: RAINBOW,
    scene: nyanScene,
  pet: PET,
}
