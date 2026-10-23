// Theme: clawd. Its scene, its words and its pet.
//
// The scene: Clawd strolls in over a plank floor to his workbench, a counter that runs from
// where he stops to the right edge. His sign (what he is doing) floats at his left with a trail
// of thought dots. On the bench: task tiles above, a tool prop under his hand, one small Clawd
// per subagent typing, and code blocks sliding in from the right while a tool runs.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may
// start more than one column from a run start in the frame before. So: nothing pops in away from
// an edge, things grow out of what is already drawn (the prop out of his arm, the trail out of the
// sign, blocks in from the border), and the embers drift one cell at a time.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS, glyphStars, ground, stroll } from '../draw'
import { CLAWD_SHAPE } from '../pets'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

const CLAUDE = '#d77757'
const CLAWD_ART = {
  stand: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  step: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '..D.D....D.D..'],
  blink: ['..LLOOOOOOOO..', '..OOOOOOOOOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  work: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', '.OOOOOOOOOOOOO', 'O.OOOOOOOOOO.O', '..DDDDDDDDDD..', '...D.D..D.D...'],
  // Eyes toward the sign at his left: the act just changed.
  turn: ['..LLOOOOOOOO..', '..OEOOOOEOOO..', '..OEOOOOEOOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  // Lids down: a test failed.
  sad: ['..LLOOOOOOOO..', '..OODOOOODOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  // The right arm comes up over three steps into a thumbs up.
  thumbs1: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOOOO', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  thumbs2: ['..LLOOOOOOOO..', '..OOEOOOOEOOO.', '..OOEOOOOEOOOO', 'OOOOOOOOOOOOO.', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  thumbs: ['..LLOOOOOOOOL.', '..OOEOOOOEOOO.', '..OOEOOOOEOOOO', 'OOOOOOOOOOOO..', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
}
const CLAWD_COLORS = { O: CLAUDE, L: '#eb9b80', D: '#b05d42', E: '#2b1d18' }
/** A subagent: a six-pixel Clawd on the bench. */
const MINI = ['.LOO.', 'OEOEO', '.D.D.']
const BLOCK_COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff']
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const PLANKS = ['#6b4f43', '#5a4238', '#6b4f43', '#7a5a4c', '#5a4238']
const BENCH = '#8a6a5c'
const TILE_OFF = '#7a5a4c'
const TILE_ON = '#9ece6a'
const TILE_BRIGHT = '#c3e88d'
const TILE_FLASH = '#f5e6d3'
/** Thought-dot counts, one a frame: every neighbour differs, so every frame differs (a twelve-frame cycle). */
const TRAIL = [0, 1, 2, 3, 2, 3, 2, 1, 0, 1, 0, 1]
const SIGN: Record<string, { glyph: (t: number) => string; c: string; trail: string }> = {
  think: { glyph: t => frame(SPIN, t), c: CLAUDE, trail: '#a97c68' },
  tool: { glyph: t => frame(['⁘', '✦', '·', '✶'], t >> 1), c: '#f4a261', trail: '#c98a5e' },
  ask: { glyph: () => '?', c: '#ffd166', trail: '#b89a5c' },
  say: { glyph: t => (mod(t, 8) < 6 ? '✎' : '✐'), c: '#e9b49a', trail: '#b08a78' },
  wait: { glyph: t => frame(['.', '·', '˙', '·'], t >> 1), c: '#a97c68', trail: '#8a6a5c' },
}
const HERO_W = 14
/** Frames he stands at the bench each lap, in every act (one value, so an act change never jumps his stroll). */
const STOP = 48
/** Reaction lengths, in frames. */
const COMMIT_FRAMES = 12
const FAIL_FRAMES = 24   // 4 falling + 20 lying
const PASS_FRAMES = 16
const PROP_W = 5
const PROP_COLORS = {
  S: '#bfc7d5', K: '#5b7fb5', C: '#eef3ff', B: '#9aa3b2', // laptop: frame, screen, cursor, base
  T: '#3f4a63', G: '#9ece6a',                            // terminal: screen, prompt
  R: '#e0af68', L: '#9fd3ff', W: '#ffffff', H: '#b05d42', // magnifier: ring, lens, glint, handle
  P: '#e8dcc8', I: '#9c8f7a', F: '#fbf6ea', V: '#8c4f3a', // book: page, ink, flipping page, cover
  X: '#9aa3b2', Y: '#e0af68',                            // toolbox: box, latch
}

/** The tool prop beside him, animated: a laptop (edit), a terminal (bash), a magnifier (search), a book (read), a toolbox otherwise. */
function propArt(tool: ToolKind | undefined, t: number): string[] {
  const k = mod(t >> 2, 3)
  switch (tool) {
    case 'edit': {
      const cursor = k < 2 ? 'CK' : 'KC'
      return ['SSSS.', `S${cursor}S.`, 'SSSS.', 'BBBBB']
    }
    case 'bash': {
      const line = ['GCT', 'GTC', 'GTT'][k]!
      return ['SSSSS', `S${line}S`, 'STTTS', 'SSSSS']
    }
    case 'search': {
      const lens = ['WLL', 'LWL', 'LLW'][k]!
      return ['.RRR.', `R${lens}R`, '.RRR.', '...HH']
    }
    case 'read': {
      const page = ['FII', 'IFI', 'IIF'][k]!
      return ['.....', '.....', `P${page}P`, 'VVVVV']
    }
    default:
      return ['..Y..', 'XXXXX', `X${k === 1 ? 'Y' : 'X'}XXX`, 'XXXXX']
  }
}

/** Task tiles over the bench: `total` of them, `done` lit; the newest pulses, all of them wave when the last lands, and they flash white on a commit. */
function tiles(cv: Canvas, benchX: number, s: Signals, isCommit: boolean): void {
  const fits = Math.max(0, Math.floor((cv.w + 1 - benchX) / 3))
  const n = Math.min(s.total, fits)
  const allDone = s.total > 0 && s.done >= s.total
  for (let i = 0; i < n; i++) {
    let color = i < s.done ? TILE_ON : TILE_OFF
    if (isCommit && mod(s.newsAge, 4) < 2) color = TILE_FLASH
    else if (allDone && s.doneAge < 16 && mod(s.doneAge - i, 8) < 2) color = TILE_BRIGHT
    else if (!allDone && i === s.done - 1 && s.doneAge < 8 && mod(s.doneAge, 4) < 2) color = TILE_BRIGHT
    draw(cv, benchX + i * 3, 0, ['BB', 'BB'], { B: color })
  }
}

/** Code blocks sliding in from the right edge along the bench, into the prop. */
function blocks(cv: Canvas, t: number, benchX: number): void {
  const span = cv.w - benchX
  if (span < 4) return
  const n = Math.min(6, Math.ceil(span / 8))
  for (let k = 0; k < n; k++) {
    const pos = mod(Math.floor(t / 2) + k * 8, span)
    const bx = cv.w - 1 - pos
    if (bx < benchX - 1) continue
    const lap = Math.floor((Math.floor(t / 2) + k * 8) / span)
    draw(cv, bx, 4, ['BBB', 'BBB'], { B: BLOCK_COLORS[mod(k + lap, BLOCK_COLORS.length)]! })
  }
}

/** Subagents: a small Clawd each on the bench, typing (a bob every four frames), grown up from the bench when they arrive. */
function agents(cv: Canvas, t: number, benchX: number, s: Signals): void {
  const start = benchX + 3
  const fits = Math.max(0, Math.floor((cv.w + 1 - start) / 6))
  const n = Math.min(s.agents, fits)
  const rows = s.agentsAge < 2 ? 1 : s.agentsAge < 4 ? 2 : 3
  for (let i = 0; i < n; i++) {
    const up = mod(t + i * 3, 8) < 4 ? 1 : 0
    const art = MINI.slice(MINI.length - rows)
    draw(cv, start + i * 6, 6 - rows - up, art, CLAWD_COLORS)
  }
}

export function clawdScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const lap = w + HERO_W
  const mid = Math.floor(lap / 2)
  const benchX = mid - HERO_W + 15
  const { x, isWalking } = stroll(t, w, HERO_W, STOP)
  const lapLen = lap + STOP
  const p = mod(t, lapLen)
  /** Frames since he stopped at the bench (-1 while walking). */
  const stood = isWalking ? -1 : p - mid
  /** Frames so far in which he did not move: the stand, plus two pauses in stroll's ease-in. Embers drift on those. */
  const still = Math.floor((t - p) / lapLen) * (STOP + 2) + (p >= 1 ? 1 : 0) + (p >= 3 ? 1 : 0) + Math.max(0, Math.min(STOP, p - mid))

  // The plank floor scrolling under his feet, always.
  ground(cv, t, 7, 0.5, PLANKS)
  for (let bx = benchX; bx < w; bx++) plot(cv, bx, 6, mod(bx - benchX, 8) < 7 ? BENCH : '#7a5a4c')
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  tiles(cv, benchX, s, isCommit)
  if (act === 'tool') blocks(cv, t, benchX)
  agents(cv, t, benchX, s)

  // The prop under his right hand, columns revealed from his arm outward when he arrives or the act turns.
  const dropping = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  if (act === 'tool' && !isWalking && !dropping) {
    const since = Math.min(s.actAge, stood)
    const cols = Math.min(PROP_W, since + 1)
    draw(cv, x + 12, 2, propArt(s.tool, t).map(row => row.slice(0, cols)), PROP_COLORS)
  }
  // A failed test: whatever he holds (a laptop when no tool runs) drops out of his hand, a pixel a
  // frame, and lies on the floor, its bottom two rows up.
  if (dropping) {
    const held = propArt(s.tool ?? 'edit', t)
    const at = stroll(t - s.newsAge, w, HERO_W, STOP).x + 12
    if (s.newsAge < 4) draw(cv, at, 2 + s.newsAge, held, PROP_COLORS)
    else draw(cv, at, 6, held.slice(2), PROP_COLORS)
  }

  const blink = mod(t, 30) < 2
  let art = CLAWD_ART.stand
  if (isWalking) art = mod(t, 4) < 2 ? CLAWD_ART.stand : CLAWD_ART.step
  else if (dropping) art = CLAWD_ART.sad
  else if (s.news === 'testPass' && s.newsAge < PASS_FRAMES) art = s.newsAge < 2 ? CLAWD_ART.thumbs1 : s.newsAge < 4 ? CLAWD_ART.thumbs2 : CLAWD_ART.thumbs
  else if (blink) art = CLAWD_ART.blink
  else if (s.actAge < 6) art = CLAWD_ART.turn
  else if (act === 'tool' && mod(t, 4) < 2) art = CLAWD_ART.work
  const hop = !isWalking && isCommit && mod(s.newsAge, 6) < 3
  const y = hop ? 0 : 1   // no bob while walking: his arms row would hop between cell rows
  draw(cv, x, y, art, CLAWD_COLORS)

  const g = cells(cv)
  glyphStars(g, t, Math.floor(w / 4), 0.05, ['·', '✻'], ['#8a6a5c', '#a97c68', '#6b5248'], 3)
  // Two embers drifting left a cell at a time, on the frames he stands still (he is the motion
  // otherwise); they pass behind whatever is drawn and over the stars.
  for (let k = 0; k < 2; k++) {
    const ex = mod(Math.floor(noise(90 + k) * w) + k * Math.floor(w / 2) - Math.floor((still + k) / 2), w)
    const rowCells = g[k]!
    // Never in a one-cell gap: it would fuse its neighbours' runs, and split them again when it moves on.
    const wedged = ex > 0 && ex < w - 1 && rowCells[ex - 1]!.ch !== ' ' && rowCells[ex + 1]!.ch !== ' '
    if (!'▀▄█'.includes(rowCells[ex]!.ch) && !wedged) put(g, ex, k, mod(t + k * 9, 16) < 2 ? '✦' : '·', { c: k ? '#e9b49a' : '#f4a261', d: mod(t + k * 9, 16) >= 2 })
  }
  /** Clears a glyph (a star or an ember, never a pixel) so a moving shape never fuses with one. */
  const clear = (cx: number, row: number) => {
    if (cx >= 0 && cx < w && !'▀▄█'.includes(g[row]![cx]!.ch)) g[row]![cx] = { ch: ' ' }
  }
  // His sign at his left with its trail: the zone is kept clear so the trail can grow and shrink
  // without a star fusing with it or popping into it.
  // No stars at bench level (they are sky): a block sliding past one would fuse with it, then split from it.
  for (let c = 0; c < w; c++) clear(c, 2)
  const signX = x - 5
  const signRow = s.actAge < 3 ? 1 : 0   // the sign rises into place as the act turns
  for (let c = signX; c <= signX + 4; c++) clear(c, 0)
  // While he walks, nothing may sit flush against his left or the sign's: it would hide his edge.
  if (isWalking) {
    clear(x + 1, 0)
    clear(x + 1, 1)
    clear(x - 1, 2)
    clear(signX - 1, signRow)
  }
  const sign = SIGN[act] ?? SIGN.think!
  put(g, signX, signRow, isCommit ? '✓' : sign.glyph(t), { c: isCommit ? '#ffd166' : sign.c, b: true })
  if (signRow === 0) put(g, signX + 1, 0, '·'.repeat(frame(TRAIL, t)), { c: sign.trail })
  // A commit: sparks over the bench for twelve frames, in the gaps between the tiles.
  if (isCommit) {
    for (let i = 0; i * 5 + benchX + 2 < w; i++) {
      const c = benchX + 2 + i * 5
      if (g[0]![c]!.ch === ' ') put(g, c, 0, mod(s.newsAge + i, 4) < 2 ? '✦' : '✧', { c: '#ffd166', b: true })
    }
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
