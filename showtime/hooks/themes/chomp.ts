// Theme: chomp. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

const PAC = [
  ['.YYYYY.', 'YYYYYYY', 'YYYY...', 'YYYY...', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYY.', 'YYYYYY.', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYY.', 'YYYYYY.', 'YYYYYYY', '.YYYYY.'],
]
const GHOST = [
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'G.GG.GG'],
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'GG.G.GG'],
]
const SCARED = [
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'B.BB.BB'],
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'BB.B.BB'],
]

export function chompScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // The maze's walls, double lines top and bottom.
  for (let x = 0; x < w; x++) {
    plot(cv, x, 0, '#2121de')
    plot(cv, x, 7, '#2121de')
  }
  const speed = act === 'tool' ? 1 : act === 'ask' ? 0.25 : 0.6
  const lap = w + 50
  const px = mod(Math.floor(t * speed), lap) - 8
  const pellet = Math.floor(w * 0.55)
  for (let x = 4; x < w; x += 4) if (x > px + 6 && Math.abs(x - pellet) > 2) plot(cv, x, 3, '#ffb8ae')
  if (pellet > px + 6 && mod(t, 6) < 4) draw(cv, pellet - 1, 3, ['PP', 'PP'], { P: '#ffb8ae' })
  const isScared = px >= pellet && px < pellet + 45
  const colors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']
  colors.forEach((color, i) => {
    const gx = px - 11 - i * 9
    const art = isScared ? frame(SCARED, (t >> 1) + i) : frame(GHOST, (t >> 1) + i)
    const flash = isScared && px > pellet + 30 && mod(t, 4) < 2
    draw(cv, gx, 1, art, { G: color, W: '#ffffff', K: '#2121de', B: flash ? '#ffffff' : '#2121de', P: '#ffb8ae' })
  })
  draw(cv, px, 1, frame(PAC, t), { Y: '#ffff00' })
  const g = cells(cv)
  const score = String(Math.max(0, Math.floor(px / 4)) * 10 + Math.floor(mod(t, lap) / lap) * 200).padStart(4, '0')
  put(g, w - score.length - 1, 0, score, { c: '#ffffff', b: true })
  if (act === 'ask' && mod(t, 8) < 5) put(g, Math.max(0, px - 2), 0, 'READY!', { c: '#ffff00', b: true })
  return g
}

/** A maze ghost, its skirt rippling. */
export const PET: PetArt = {
  body: ['...GGGGGG...', '..GWWGGWWG..', '.GGWWGGWWGG.', '.GGGGGGGGGG.', '.G.GG.GG.GG.'],
  step: ['...GGGGGG...', '..GWWGGWWG..', '.GGWWGGWWGG.', '.GGGGGGGGGG.', '.GG.GG.GG.G.'],
  colors: { G: '#ff5d8f', W: '#ffffff' },
  eyes: [4, 8],
  eyeRow: 1,
  eye: '#2121de',
  lid: '#ffffff',
  mouth: [5, 3],
  spark: '#ffff00',
}

export const CHOMP: Theme = {
  name: 'chomp',
    rows: SCENE_ROWS,
    color: '#ffd60a',
    accent: '#ff595e',
    sprite: {
      think: ['ᗧ • • •', '● • • •'],
      tool: ['ᗧ•••  ᗣ', '●••  ᗣ ', 'ᗧ•  ᗣ  ', '● ᗣ    '],
      say: ['ᗧ ♪ ', '●  ♫'],
      wait: ['ᗧ .  ', '● .. ', 'ᗧ ...'],
    },
    happy: 'ᗧ ᗣᗣᗣ',
    sad: 'ᗣ ᗧ',
    dead: '✕ᗧ✕',
    sleep: 'ᗧ zZ',
    confetti: ['•', '●', '·', 'ᗣ', '+'],
    palette: ['#ffd60a', '#ff595e', '#ffafcc', '#00f5d4', '#ff9f1c'],
    scene: chompScene,
  pet: PET,
}
