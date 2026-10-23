// Theme: clawd. Its scene, its words and its pet.
import { canvas, cells, draw, frame, mod, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS, glyphStars, ground, stroll } from '../draw'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const CLAUDE = '#d77757'
const CLAWD_ART = {
  stand: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  step: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '..D.D....D.D..'],
  blink: ['..LLOOOOOOOO..', '..OOOOOOOOOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  work: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', '.OOOOOOOOOOOOO', 'O.OOOOOOOOOO.O', '..DDDDDDDDDD..', '...D.D..D.D...'],
}
const CLAWD_COLORS = { O: CLAUDE, L: '#eb9b80', D: '#b05d42', E: '#2b1d18' }
const BLOCK_COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff']
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']

export function clawdScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  // A plank floor scrolling under his feet.
  ground(cv, t, 7, 0.5, ['#6b4f43', '#5a4238', '#6b4f43', '#7a5a4c', '#5a4238'])
  const { x, isWalking } = stroll(t, w, 16, act === 'tool' ? 60 : 40)
  const bench = x + 15
  // While a tool runs, code blocks stack up on the bench beside him and slide away.
  if (!isWalking && act === 'tool') {
    for (let i = 0; i < 4; i++) {
      const age = mod(t - i * 6, 24)
      const bx = bench + 2 + Math.floor(age / 2)
      draw(cv, bx, 5 - (i % 2), ['BBB'], { B: BLOCK_COLORS[(i + Math.floor(t / 24)) % BLOCK_COLORS.length]! })
    }
    draw(cv, bench, 6, ['TTTTTTTT'], { T: '#6b4f43' })
  }
  const blink = mod(t, 30) < 2
  const art = isWalking ? (mod(t, 4) < 2 ? CLAWD_ART.stand : CLAWD_ART.step) : blink ? CLAWD_ART.blink : act === 'tool' && mod(t, 4) < 2 ? CLAWD_ART.work : CLAWD_ART.stand
  const bob = isWalking && mod(t, 4) < 2 ? 0 : 1
  draw(cv, x, bob, art, CLAWD_COLORS)
  const g = cells(cv)
  glyphStars(g, t, Math.floor(w / 4), 0.05, ['·', '✻'], ['#8a6a5c', '#a97c68', '#6b5248'], 3)
  if (!isWalking) {
    const above = x + 15
    if (act === 'think') put(g, above, 0, frame(SPIN, t), { c: CLAUDE, b: true })
    else if (act === 'ask') put(g, above, 0, mod(t, 8) < 6 ? '?' : ' ', { c: '#ffd166', b: true })
    else if (act === 'say') put(g, above, 0, frame(['✎', '✎·', '✎··', '✎···'], t >> 1), { c: '#e9b49a' })
    else if (act === 'tool') put(g, above, 0, frame(['⁘', '✦', '·', '✶'], t), { c: '#f4a261', b: true })
  }
  return g
}

/** Clawd, as Claude Code draws him: a warm orange body, arms out, four legs. */
export const PET: PetArt = {
  ...CLAWD_SHAPE,
  colors: { O: '#d77757', L: '#e8957a', D: '#a9553b' },
  lid: '#d77757',
}

export const CLAWD: Theme = {
  name: 'clawd',
    rows: SCENE_ROWS,
    color: CLAUDE,
    accent: '#e9b49a',
    sprite: {
      think: ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'].map(s => `▐▛█▜▌ ${s}`),
      tool: ['▐▛█▜▌▭▭', '▐▛█▜▌▬▭', '▐▛█▜▌▭▬'],
      say: ['▐▛█▜▌ ✎  ', '▐▛█▜▌ ✎· ', '▐▛█▜▌ ✎··'],
      wait: ['▐▛█▜▌ .  ', '▐▛█▜▌ .. ', '▐▛█▜▌ ...'],
    },
    happy: '▐▛█▜▌ ✻',
    sad: '▐▀█▀▌',
    dead: '▐x█x▌',
    sleep: '▐▄█▄▌ zZ',
    confetti: ['✻', '✶', '✳', '·', '✢'],
    palette: [CLAUDE, '#e9b49a', '#f5e6d3', '#c15f3c'],
    scene: clawdScene,
  pet: PET,
}
