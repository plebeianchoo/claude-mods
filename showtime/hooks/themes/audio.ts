// Theme: audio. Its scene, its words and its pet.
import { blank, cells, frame, hsl, mod, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import { AUDIO_BANDS, demoView } from '../audio'
import type { AudioFeed } from '../audio'
import type { PetArt } from '../pets'
import type { Act, Theme } from '../themes'

/**
 * The computer's sound as a spectrum: a bar per band, its peak falling above
 * it, and a dancer on the left who moves on the beat. Without a tap (`null`)
 * the bars lie flat and say so; with no feed at all, a made-up signal plays.
 */
export function audioScene(t: number, w: number, act: Act, audio?: AudioFeed): Grid {
  const rows = SCENE_ROWS
  const g = blank(w, rows)
  const view = audio === undefined ? demoView(t) : audio
  const isLive = view !== null && view.b.some(v => v > 0)

  // The dancer: on the beat while sound plays, else as the turn goes.
  const hasDancer = w >= 32
  const x0 = hasDancer ? 13 : 0
  if (hasDancer) {
    const beat = view?.beat ?? 0
    const pose =
      view === null
        ? '(－ω－) zZ'
        : isLive
          ? frame(['♪┏(・o・)┛', '♫┗(・o・)┓'], beat)
          : act === 'ask'
            ? '(・ω・)?'
            : act === 'tool'
              ? frame(['(・ω・)ノ', '(・ω・)ﾉ'], t >> 2)
              : frame(['(・ω・) ', '(・ω・).'], t >> 3)
    put(g, 0, rows - 1, pose, { c: '#e0aaff', b: true })
    if (isLive) {
      // Notes float up from the dancer, one per beat.
      for (let i = 0; i < 3; i++) {
        const age = mod(t + i * 4, 12)
        if (age < 9) put(g, 2 + i * 3 + (age >> 2), rows - 2 - (age >> 2), frame(['♪', '♫', '♬'], beat + i), { c: frame(['#c77dff', '#4cc9f0', '#ff8fab'], i), d: age > 5 })
      }
    }
  }

  const span = w - x0
  if (view === null) {
    for (let x = 0; x < span; x += 2) put(g, x0 + x, rows - 1, '·', { c: '#6c757d', d: true })
    return g
  }
  // Wide enough: bars two cells wide with a gap; narrower, one band per column.
  const per = span / AUDIO_BANDS
  const blocks = ' ▁▂▃▄▅▆▇█'
  const full = rows * 8
  for (let x = 0; x < span; x++) {
    const band = Math.min(AUDIO_BANDS - 1, Math.floor(x / per))
    if (per >= 3 && x - Math.floor(band * per) >= Math.floor(per) - 1) continue
    const h = Math.round(((view.b[band] ?? 0) * full) / 99)
    const peak = Math.round(((view.p[band] ?? 0) * full) / 99)
    const hue = 290 - (band / AUDIO_BANDS) * 200
    if (h === 0 && peak === 0) {
      put(g, x0 + x, rows - 1, '▁', { c: '#3c3c44' })
      continue
    }
    for (let r = 0; r < rows; r++) {
      const y = rows - 1 - r
      const fill = Math.max(0, Math.min(8, h - r * 8))
      if (fill > 0) put(g, x0 + x, y, blocks[fill]!, { c: hsl(hue, 0.85, 0.5 + r * 0.06), b: r === rows - 1 })
    }
    // The peak's cap, where nothing of the bar is.
    const pr = Math.min(rows - 1, Math.floor(Math.max(0, peak - 1) / 8))
    if (peak > h && peak - pr * 8 > Math.max(0, h - pr * 8)) put(g, x0 + x, rows - 1 - pr, '▔', { c: '#f8f9fa', d: true })
  }
  return g
}

/** A round listener in big headphones, swaying to whatever plays. */
export const PET: PetArt = {
  body: ['..HHHHHHHH..', '.H.BBBBBB.H.', 'CCBBBBBBBBCC', 'CCBBBBBBBBCC', '.B.B....B.B.'],
  step: ['..HHHHHHHH..', '.H.BBBBBB.H.', 'CCBBBBBBBBCC', 'CCBBBBBBBBCC', '..B.B..B.B..'],
  colors: { H: '#5a189a', C: '#c77dff', B: '#e0aaff' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#240046',
  lid: '#e0aaff',
  mouth: [5, 3],
  blush: '#ff8fab',
  spark: '#4cc9f0',
}

export const AUDIO: Theme = {
  name: 'audio',
    rows: SCENE_ROWS,
    color: '#c77dff',
    accent: '#4cc9f0',
    sprite: {
      think: ['♪(・ω・)  ', '♪(・ω・) ?', '♫(・ω・) ?'],
      tool: ['♪┏(・o・)┛', '♫┗(・o・)┓'],
      say: ['(・▽・)ノ♪ ', '(・▽・)ノ ♫'],
      wait: ['(・ω・) .  ', '(・ω・) .. ', '(・ω・) ...'],
    },
    happy: '♪ヽ(・▽・)ノ♫',
    sad: '(・へ・)',
    dead: '(×_×)',
    sleep: '(－ω－) zZ',
    confetti: ['♪', '♫', '♬', '·', '✦'],
    palette: ['#c77dff', '#4cc9f0', '#ff8fab', '#ffd60a'],
    scene: audioScene,
  pet: PET,
}
