// Frame tables and scenes, shared by the hooks module and both surface modules
// (sprite.tsx draws the spinner's mascot, stage.tsx the band). Pure:
// everything here is a function of the theme, the tick and the width.
import { blank, frame, hsl, mod, noise, padTo, put, textWidth } from './cells'
import type { Grid, Style } from './cells'
import type { ToolKind } from './feed'
import type { News } from './pet'
import type { PetArt } from './pets'
import { CLAWD } from './themes/clawd'
import { THUNDER } from './themes/thunder'
import { CHOMP } from './themes/chomp'
import { SPARKY } from './themes/sparky'
import { BLUECAT } from './themes/bluecat'
import { NYAN } from './themes/nyan'
import { CAT } from './themes/cat'
import { BUNNY } from './themes/bunny'
import { SAKURA } from './themes/sakura'
import { MECHA } from './themes/mecha'
import { NEON } from './themes/neon'
import { DINO } from './themes/dino'
import { OCEAN } from './themes/ocean'
import { MATRIX } from './themes/matrix'
import { STACK } from './themes/stack'
import { PLUMBER } from './themes/plumber'
import { SNAKE } from './themes/snake'
import { LAUNCH } from './themes/launch'
import { FROGGER } from './themes/frogger'
import { KITCHEN } from './themes/kitchen'
import { RAILWAY } from './themes/railway'
import { GARDEN } from './themes/garden'
import { RACETRACK } from './themes/racetrack'
import { AQUARIUM } from './themes/aquarium'
import { SUBMARINE } from './themes/submarine'
import { ORCHESTRA } from './themes/orchestra'
import { ROOMBA } from './themes/roomba'
import { COFFEE } from './themes/coffee'
import { UFO } from './themes/ufo'

export * from './cells'
export type { ToolKind } from './feed'
export type NewsKind = News

export const THEME_NAMES = [
  'clawd',
  'thunder',
  'chomp',
  'sparky',
  'bluecat',
  'nyan',
  'cat',
  'bunny',
  'sakura',
  'mecha',
  'neon',
  'dino',
  'ocean',
  'matrix',
  'stack',
  'plumber',
  'snake',
  'launch',
  'frogger',
  'kitchen',
  'railway',
  'garden',
  'racetrack',
  'aquarium',
  'submarine',
  'orchestra',
  'roomba',
  'coffee',
  'ufo',
] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'
export type Pose = 'think' | 'tool' | 'say' | 'wait'
/** What the turn is doing, as the band's companion tells it. */
export type Act = 'think' | 'tool' | 'ask' | 'say' | 'wait'
/** What a scene reacts to. Ages are frames since that field last changed, counted by the stage. */
export type Signals = {
  act: Act
  tool?: ToolKind
  agents: number
  done: number
  total: number
  news?: NewsKind
  newsAge: number
  actAge: number
  doneAge: number
  agentsAge: number
  /** Frames since `tool` last changed; 999 when none. */
  toolAge: number
}
export const IDLE_SIGNALS: Signals = { act: 'think', agents: 0, done: 0, total: 0, newsAge: 999, actAge: 999, doneAge: 999, agentsAge: 999, toolAge: 999 }
export type Finale = 'answer' | 'aborted' | 'error'
/** The companion's mood between turns. */
export type Mood = 'hello' | 'ready' | 'aborted' | 'error' | 'sleep'

export type Theme = {
  name: ThemeName
  /** The mascot's color, and a second one for its props. */
  color: string
  accent: string
  /** Frames of the mascot beside the spinner's word, by what the turn is doing. */
  sprite: Record<Pose, string[]>
  /** Each character of the mascot in its own color, cycling. */
  isRainbow?: boolean
  happy: string
  sad: string
  dead: string
  sleep: string
  /** Particles of the finale's burst, and their colors. */
  confetti: string[]
  palette: string[]
  /** Rows the scene takes in the band. */
  rows: number
  /** The companion's body and face in this theme. */
  pet: PetArt
  /** The band's scene while a turn runs: `rows` rows of `w` cells. */
  scene: (t: number, w: number, s: Signals) => Grid
}

/** Milliseconds per frame: the mascot's, the band's, the companion's between turns. */
export const SPRITE_MS = 140
export const STAGE_MS = 100
export const IDLE_MS = 400
/** How long the finale stays after a turn ends. */
export const FINALE_MS = 3000

export function poseOf(mode: string): Pose {
  if (mode === 'thinking' || mode === 'think') return 'think'
  if (mode === 'tool-use' || mode === 'tool-input' || mode === 'tool') return 'tool'
  if (mode === 'responding' || mode === 'say') return 'say'
  return 'wait'
}

export function isThemeName(name: unknown): name is ThemeName {
  return typeof name === 'string' && (THEME_NAMES as readonly string[]).includes(name)
}

/** A theme drawn from `seed`, for the `random` choice. */
export function pickRandom(seed: number): ThemeName {
  const pool = THEME_NAMES
  return pool[Math.floor(noise(seed) * pool.length)]!
}

/** The theme after `current`, for the `rotate` choice: the same pool as random, wrapping. */
export function nextTheme(current: ThemeName): ThemeName {
  const pool = THEME_NAMES
  return pool[(pool.indexOf(current) + 1) % pool.length]!
}

// ---- themes --------------------------------------------------------------

export const THEMES: Record<ThemeName, Theme> = {
  clawd: CLAWD, thunder: THUNDER, chomp: CHOMP, sparky: SPARKY, bluecat: BLUECAT, nyan: NYAN,
  cat: CAT, bunny: BUNNY, sakura: SAKURA, mecha: MECHA, neon: NEON, dino: DINO, ocean: OCEAN, matrix: MATRIX,
  stack: STACK, plumber: PLUMBER, snake: SNAKE, launch: LAUNCH, frogger: FROGGER, kitchen: KITCHEN, railway: RAILWAY, garden: GARDEN,
  racetrack: RACETRACK,
  aquarium: AQUARIUM,
  submarine: SUBMARINE,
  orchestra: ORCHESTRA,
  roomba: ROOMBA,
  coffee: COFFEE,
  ufo: UFO,
}

export function themeOf(name: unknown): Theme {
  return isThemeName(name) ? THEMES[name] : THEMES.clawd
}

// ---- finale --------------------------------------------------------------

/** After a turn: a burst of the theme's confetti around its mascot and the label. */
export function finaleScene(theme: Theme, kind: Finale, label: string, t: number, w: number): Grid {
  const rows = theme.rows
  const g = blank(w, rows)
  const face = kind === 'answer' ? theme.happy : kind === 'aborted' ? theme.sad : theme.dead
  const text = `${face}  ${label}`
  const tw = textWidth(text)
  const cx = Math.floor(w / 2)
  const left = Math.max(0, cx - Math.floor(tw / 2))
  const mid = Math.floor(rows / 2)

  if (kind === 'answer') {
    const count = Math.min(40 * rows / 2, Math.max(12, Math.floor((w / 3) * rows / 2)))
    for (let i = 0; i < count; i++) {
      const dir = noise(i) < 0.5 ? -1 : 1
      const speed = 0.8 + noise(i + 9) * 2.2
      const reach = Math.min(t, 18) * speed
      const x = cx + dir * (tw / 2 + reach + noise(i + 4) * 3)
      const y = Math.floor(noise(i + 2) * rows)
      const isFading = t > 18 + noise(i + 6) * 8
      put(g, x, y, frame(theme.confetti, i + (t >> 2)), { c: frame(theme.palette, i), d: isFading })
    }
  } else if (kind === 'aborted') {
    for (let x = 0; x < w; x += 4) put(g, mod(x + (t >> 1), w), mod(x, rows), '·', { c: '#6c757d', d: true })
  } else {
    for (let x = 0; x < w; x++) if (noise(x + t) < 0.08) put(g, x, mod(x, rows), frame(['▚', '▞', '░'], x + t), { c: '#e63946', d: true })
  }

  const style: Style = kind === 'answer' ? { c: theme.color, b: true } : kind === 'aborted' ? { c: '#adb5bd' } : { c: '#e63946', b: true }
  const flicker = kind === 'error' && mod(t, 6) === 0
  put(g, left - 1, mid, ' '.repeat(tw + 2))
  if (!flicker) put(g, left, mid, text, style)
  return g
}

// ---- companion -----------------------------------------------------------

/** What the companion row shows: the turn's act while it runs, else the mood. */
export type PetView = {
  state: Act | Mood
  /** The bubble beside the mascot, already in the person's language. */
  bubble: string
  /** `Lv.3 ♥12`. */
  stats: string
}

const BUBBLE: Partial<Record<Act | Mood, Style>> = {
  ask: { c: '#ffd166', b: true },
  error: { c: '#e63946' },
  aborted: { c: '#adb5bd' },
  sleep: { c: '#6c757d', d: true },
}

/** One row: the mascot in its current mood, its bubble, its level and affection; hearts after a pat. */
export function petRow(theme: Theme, pet: PetView, t: number, w: number, hearts: number): Grid {
  const g = blank(w, 1)
  const s = pet.state
  let face: string
  if (s === 'think' || s === 'tool' || s === 'say' || s === 'wait' || s === 'ask') {
    const frames = theme.sprite[poseOf(s)]
    face = padTo(frame(frames, t), Math.max(...frames.map(textWidth)))
  } else {
    face = s === 'error' ? theme.dead : s === 'aborted' ? theme.sad : s === 'sleep' ? theme.sleep : theme.happy
  }
  const faceStyle = (i: number): Style =>
    theme.isRainbow ? { c: hsl((i * 40 + t * 24) % 360, 0.95, 0.62), b: true } : { c: theme.color, b: true }
  let x = 0
  Array.from(face).forEach((ch, i) => {
    put(g, x, 0, ch, faceStyle(i))
    x += textWidth(ch)
  })
  x += 1
  if (hearts > 0) {
    put(g, x, 0, frame(['♡', '♥', '♡ ♥', '♥ ♡'], hearts), { c: '#ff8fab', b: true })
    x += 4
  }
  if (pet.bubble) put(g, x, 0, `${s === 'ask' ? '❯ ' : '· '}${pet.bubble}`, BUBBLE[s] ?? { c: '#b8b8be' })
  put(g, w - textWidth(pet.stats) - 1, 0, pet.stats, { c: '#6c757d' })
  return g
}
