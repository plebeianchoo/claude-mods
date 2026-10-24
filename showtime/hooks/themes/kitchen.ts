// Theme: kitchen. Its scene, its words and its pet.
//
// The scene: a chef in an amber apron (#ffb703) at a stove in the left of the band, a pot on the
// burner with steam rising from it in every act, a tiled wall behind (tiles two cells wide and a
// pixel tall, grout between and under them, lit tiles rolling across) and a counter along the bottom,
// glints stepping along it (light catches the stove, the pot, his hat, jacket and apron too). He taps a
// spoon on the pot's side on a twelve-frame cycle while thinking, holds it up and looks out while
// asking, waves it while saying, lets it sink while waiting, and blinks; a sign right of his hat reads
// the act (dots, a bobbing `?`, notes, the tool's mark). In a tool the pot boils: the soup takes the
// tool's colour, a bubble hops side to side every frame, the burner glows red and he stirs; on bash
// flames flicker under the pot and lick up beside it. Tasks: a plate per task along the counter
// (floor-scaled to what fits), the first `done` served with a dish on them, the rest under a dome;
// the newest served plate's dome lifts a pixel a frame and leaves the top; at 100% the dishes roll
// colours. Each subagent (four at most) is a sous-chef of its own hue at the right, chopping with a
// knife on a four-frame cycle, hopping a greeting in place with its jacket flashing as it joins. A
// failed test: a fire on the stove for sixteen frames, his spoon flung up, then smoke for fourteen
// under a `×`; a passed test: the soup and its bubbles gold under a `★`; a commit: a bell `!` swings
// beside his hat for eight frames and a plate slides out right along the counter a cell a frame.
//
// Motion rules (tests/scenes.test.ts): the tiles fill columns 1 and 2 of every four in cell rows 0–1
// and the counter fills row 3, so a run start at any column ≡ 0, 1 or 2 (mod 4) has a tile start
// within a cell in rows 0–1, and a single column of new ink at ≡ 3 joins the tile at its left. The
// grout is two columns wide, so one column of ink (the steam, a bubble, a flame) can never bridge two
// tiles and expose a start two off as it leaves; everything three wide that stands or lifts in rows
// 0–2 (the plates and their domes, the sous-chefs) stands at a column ≡ 1, where its left edge is a
// tile start and its right edge is the first grout column, so nothing it merges with or parts from
// exposes a start away from one. The grout column over the pot carries the steam, a puff every third
// frame rising a pixel a frame for four, so that column's ink mask differs in every frame and no
// frame can hold; in the fire the steam yields to the flames, whose tongue beside the pot swaps
// sides every frame instead. Everything else moves a pixel a frame at most or changes colour only.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Signals, Theme, ToolKind } from '../themes'

type Pose = 'level' | 'up' | 'sunk'

/** Tiles are TILE_W cells wide from column 1 of every TILE_PITCH; the steam rises in the grout over the pot. */
const TILE_PITCH = 4
const TILE_W = 2
const WALL_PX = 4
const SHIMMER_PERIOD = 4
/** The counter's glints: one every COUNTER_GLINT columns along its top, stepping right a column a frame. */
const COUNTER_GLINT = 14
const COUNTER_LIT = '#e6c98f'
/** Glints on the stove, and the light catching the chef's hat, jacket and apron. */
const [STOVE_LIT, HAT_SHADE, JACKET_SHADE, AMBER_LIT, SKIN_SHADE] = ['#9aa5b1', '#d8e2e8', '#c9d6df', '#ffd166', '#e0a84e']
const STOVE_X = 1
const POT_X = 2
const STEAM_X = 3
const STEAM_EVERY = 3
const STEAM_LIFE = 4
const CHEF_X = 7
/** His hand's column; the spoon reaches two cells left of it. */
const HAND_X = CHEF_X
const SIGN_X = 13
/** The plates' first column and the sous-chefs' columns are ≡ 1 (mod TILE_PITCH), see the header. */
const PLATE_L = 17
const PLATE_PITCH = 4
const AGENT_PITCH = 4
const MAX_AGENTS = 4
/** Pixel rows: the pot's rim, a plate on the counter, a dome's top, the counter's top. */
const POT_Y = 4
const PLATE_Y = 5
const DOME_Y = 3
const COUNTER_Y = 6
const DOME_LIFT_FRAMES = 8
const DONE_ROLL_FRAMES = 16
const GREET_FRAMES = 8
const HOP = [0, 1, 1, 1, 1, 0, 0, 0]
const FIRE_FRAMES = 16
const FAIL_FRAMES = 30
const PASS_FRAMES = 16
const BELL_FRAMES = 8
const BELL_SWING = [0, 1, 1, 0, 0, 1, 1, 0]
const COMMIT_FRAMES = 30
const COMMIT_FADE = 6
const TURN_FRAMES = 4
const BLINK_CYCLE = 12

const WHITE = '#ffffff'
const JACKET = '#e8e8f0'
const SKIN = '#f6bd60'
const EYE = '#1d1d1d'
const AMBER = '#ffb703'
const LEGS = '#4a4e69'
const SPOON = '#b5651d'
const SOUP = '#d08c60'
const STEEL = '#b0bec5'
const STEEL_DARK = '#6c757d'
const STOVE = '#4a4e69'
const BURNER = '#5c677d'
const TILE = '#3f5f70'
const TILE_DARK = '#36505f'
const TILE_LIT = '#5a8599'
const COUNTER_TOP = '#c9a66b'
const COUNTER_FRONT = '#8b6b3e'
const STEAM = '#cfd8dc'
const STEAM_DIM = '#8d99ae'
const SMOKE = '#6c757d'
const SMOKE_DIM = '#4a4e69'
const PLATE = '#f1faee'
const DOME = '#cfd8dc'
const RED = '#e63946'
const GREEN = '#9ece6a'
const ORANGE = '#fb8500'
const GOLD = '#ffd60a'
const PALE = '#fff3b0'
const GREY = '#8d99ae'
const FLAME = [RED, ORANGE, GOLD, ORANGE]
const PALETTE = [AMBER, RED, GREEN, '#7dcfff', PALE]
const TOOL_COLOR: Record<ToolKind, string> = {
  bash: RED, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7', other: GREEN,
}
const TOOL_SIGN: Record<ToolKind, string> = {
  bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎', other: '✦',
}
/** Each sous-chef's jacket. */
const HUES = ['#7dcfff', '#bb9af7', '#ff9e64', '#f7768e']

/** The chef, 5×6 from the top of the band: toque, face in profile (both eyes when he looks out), his
 * hand and jacket, apron, legs. */
const CHEF = ['HHHHH', '.HHH.', '.EFF.', 'SWWW.', '.AAA.', '.L.L.']
const CHEF_OUT = ['HHHHH', '.HHH.', '.EFE.', 'SWWW.', '.AAA.', '.L.L.']
const CHEF_COLORS = { H: WHITE, E: EYE, F: SKIN, S: SKIN, W: JACKET, A: AMBER, L: LEGS }
/** A sous-chef, 3×4 from pixel row 2: cap, face, jacket in its hue, trousers (solid, so its hop keeps
 * one run in row 2). */
const SOUS = ['HHH', 'EFE', 'CCC', 'LLL']
const SOUS_COLORS = { H: WHITE, E: EYE, F: SKIN, L: LEGS }
/** The pot, 3×2: a steel rim around the soup over a dark body; the stove, 5×2, its burner mid-top. */
const POT = ['SCS', 'BBB']
const STOVE_ART = ['GGBGG', 'GGGGG']
const PLATE_ART = ['PPP']
const DOME_ART = ['.D.', 'DDD']
const DISH = ['RGR']
/** The spoon's pixel row over a twelve-frame cycle (four in a tool, where only its tip bobs): a tap
 * on the pot's side while thinking, a wave while saying, a slow sink while waiting. */
const SPOON_ROWS: Record<Act, readonly number[]> = {
  think: [3, 3, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3],
  tool: [3, 3, 4, 4],
  ask: [3],
  say: [2, 2, 2, 3, 3, 3, 2, 2, 3, 3, 3, 3],
  wait: [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4],
}

/** The wall: tiles two cells wide and a pixel tall in two rows, two columns of grout between and a
 * pixel row of grout under each, lit tiles every SHIMMER_PERIOD tiles rolling right one tile every four
 * frames, so every tile lights once in sixteen frames. */
function wall(cv: Canvas, t: number): void {
  for (let x = 0; x < cv.w; x++) {
    if (mod(x - 1, TILE_PITCH) >= TILE_W) continue
    const lit = mod(Math.floor(x / TILE_PITCH) - (t >> 2), SHIMMER_PERIOD) === 0
    const color = lit ? TILE_LIT : mod(x - 1, TILE_PITCH) === 0 ? TILE : TILE_DARK
    for (let y = 0; y < WALL_PX; y += 2) plot(cv, x, y, color)
  }
}

/** The stove on the counter and the pot on it: flames under the pot and licking up beside it when
 * `flaming`, a red burner when `boiling`; the soup in `soup`, a bubble hopping side to side over it
 * while it boils, two tongues of flame over it in a fire. */
function stove(cv: Canvas, t: number, boiling: boolean, flaming: boolean, soup: string, isFire: boolean): void {
  draw(cv, STOVE_X, COUNTER_Y, STOVE_ART, { G: STOVE, B: boiling || flaming ? RED : BURNER })
  // A glint along the stove's front and the pot's base (colour only), a pixel a frame, then a rest: 14 frames.
  const shine = mod(t, 14)
  if (shine < 5) plot(cv, STOVE_X + shine, COUNTER_Y + 1, STOVE_LIT)
  if (flaming) {
    for (let i = 0; i < 3; i++) plot(cv, POT_X + i, COUNTER_Y, frame(FLAME, t + 2 * i + Math.floor(noise(t + i) * 2)))
    plot(cv, mod(t, 2) === 0 ? POT_X - 1 : POT_X + 3, PLATE_Y, frame(FLAME, t >> 1))
  }
  draw(cv, POT_X, POT_Y, POT, { S: STEEL, C: soup, B: STEEL_DARK })
  if (shine >= 7 && shine < 10) plot(cv, POT_X + shine - 7, POT_Y + 1, STEEL)
  if (isFire) {
    plot(cv, POT_X, POT_Y - 1, frame(FLAME, t))
    plot(cv, POT_X + 2, POT_Y - 1, frame(FLAME, t + 2))
    plot(cv, mod(t, 2) === 0 ? POT_X : POT_X + 2, POT_Y - 2, frame(FLAME, t + 1))
  } else if (boiling) plot(cv, POT_X + (mod(t, 2) === 0 ? 0 : 2), POT_Y - 1, soup)
}

/** The steam: a puff every third frame rising a pixel a frame from over the rim to the top, paling as
 * it goes; smoke after a fire, darker, with puffs drifting left over the tiles on the other phases. */
function steam(cv: Canvas, t: number, isSmoke: boolean): void {
  for (let age = 0; age < STEAM_LIFE; age++) {
    const y = POT_Y - 1 - age
    const fresh = age < 2
    const color = isSmoke ? (fresh ? SMOKE : SMOKE_DIM) : fresh ? STEAM : STEAM_DIM
    if (mod(t - age, STEAM_EVERY) === 0) plot(cv, STEAM_X, y, color)
    if (isSmoke && mod(t - age + 1, STEAM_EVERY) === 0) plot(cv, STEAM_X - 1 - (age >> 1), y, SMOKE_DIM)
  }
}

/** The chef and his spoon: upright when he looks out or at news, sunk in the smoke, else at the act's
 * row (in a tool the handle stays while the tip stirs); a white tink where the tap meets the pot. */
function chef(cv: Canvas, t: number, s: Signals, age: number, pose: Pose, blink: boolean): void {
  const colors = blink ? { ...CHEF_COLORS, E: SKIN } : CHEF_COLORS
  draw(cv, CHEF_X, 0, s.act === 'ask' ? CHEF_OUT : CHEF, colors)
  // Light catching him (colour only): a crease along his hat, a fold down his jacket, a stripe along his apron,
  // each a pixel stepping across on a sixteen-frame cycle.
  const step = mod(t, 16) >> 1
  if (step < 5) plot(cv, CHEF_X + step, 0, HAT_SHADE)
  if (step < 4) plot(cv, CHEF_X + step, 3, step === 0 ? SKIN_SHADE : JACKET_SHADE)
  if (step >= 4 && step < 7) plot(cv, CHEF_X + step - 3, 4, AMBER_LIT)
  if (pose === 'up') {
    plot(cv, HAND_X - 1, 3, SPOON)
    plot(cv, HAND_X - 1, 2, mod(t, 16) < 2 ? WHITE : SPOON)   // the raised spoon's bowl catches the light
    return
  }
  const sy = pose === 'sunk' ? 4 : age < TURN_FRAMES ? 3 : frame(SPOON_ROWS[s.act], t)
  plot(cv, HAND_X - 1, s.act === 'tool' ? 3 : sy, SPOON)
  plot(cv, HAND_X - 2, sy, SPOON)
  if (s.act === 'think' && sy === 4 && age >= TURN_FRAMES) plot(cv, HAND_X - 2, POT_Y - 1, WHITE)
}

/** The plates along the counter from PLATE_L to `plateR`: `count` of them (floor-scaled), the first
 * `lit` served with a dish, the rest under a dome; the newest served one's dome lifts a pixel a frame
 * and leaves the top, its dish showing beneath; the dishes roll colours at 100%. */
function plates(cv: Canvas, s: Signals, plateR: number, allDone: boolean): void {
  const count = Math.min(s.total, Math.max(0, Math.floor((plateR - PLATE_L - 2) / PLATE_PITCH) + 1))
  const lit = s.total > count ? Math.floor(s.done * count / s.total) : Math.min(s.done, count)
  for (let j = 0; j < count; j++) {
    const x = PLATE_L + j * PLATE_PITCH
    draw(cv, x, PLATE_Y, PLATE_ART, { P: PLATE })
    const lift = j < lit ? (j === lit - 1 && s.doneAge < DOME_LIFT_FRAMES ? s.doneAge : DOME_LIFT_FRAMES) : 0
    if (lift >= 1) {
      const roll = allDone && s.doneAge < DONE_ROLL_FRAMES
      const k = j + (s.doneAge >> 1)
      const dish = roll ? { R: frame(PALETTE, k), G: frame(PALETTE, k + 2) } : { R: RED, G: GREEN }
      draw(cv, x, POT_Y, DISH, dish)
    }
    if (lift <= DOME_Y + 1) draw(cv, x, DOME_Y - lift, DOME_ART, { D: DOME })
  }
}

/** The sous-chefs from the right leftward (the first at the last column ≡ 1 with room for its knife),
 * each where it fits right of the plates' start: a cap, a face, a jacket in its hue, and a knife in
 * the gap column chopping on a four-frame cycle out of step; the newest hops in place with its jacket
 * flashing and its knife held up as it joins (and again, harmlessly, when one leaves). Returns the
 * leftmost one's column, or the width. */
function agents(cv: Canvas, t: number, s: Signals): number {
  const n = Math.min(s.agents, MAX_AGENTS)
  const first = cv.w - AGENT_PITCH - mod(cv.w - AGENT_PITCH - 1, TILE_PITCH)
  let left = cv.w
  for (let i = 0; i < n; i++) {
    const x0 = first - AGENT_PITCH * i
    if (x0 < PLATE_L) break
    left = x0
    const newest = i === n - 1 && s.agentsAge < GREET_FRAMES
    const hop = newest ? HOP[s.agentsAge]! : 0
    const jacket = newest && mod(s.agentsAge, 2) === 0 ? WHITE : HUES[i]!
    draw(cv, x0, 2 - hop, SOUS, { ...SOUS_COLORS, C: jacket })
    const up = newest || mod((t >> 1) + i, 2) === 0
    plot(cv, x0 + 3, (up ? POT_Y : PLATE_Y) - hop, STEEL)
  }
  return left
}

/** The plate going out on a commit: a dish on a plate sliding right from beside the chef a cell a
 * frame, dimming over its last frames. */
function goingOut(cv: Canvas, s: Signals): void {
  const x = SIGN_X - 1 + s.newsAge
  if (x + 2 >= cv.w) return
  const fade = s.newsAge >= COMMIT_FRAMES - COMMIT_FADE
  const colors = fade ? { R: GREY, G: GREY, P: STEEL_DARK } : { R: RED, G: GREEN, P: PLATE }
  draw(cv, x, POT_Y, [...DISH, ...PLATE_ART], colors)
}

/** The sign right of his hat: the news first (the bell swinging a column for eight frames), else the
 * act, dots while the act turns. Each changes its ink every other frame at least. */
function sign(
  s: Signals, t: number, age: number, isFail: boolean, isPass: boolean, isCommit: boolean,
): { text: string; c: string; row: number; dx: number } {
  const row = age === 0 ? 1 : 0
  if (isFail) return { text: frame(['×', '×·'], t >> 1), c: GREY, row, dx: 0 }
  if (isPass) return { text: frame(['★', '★·', '☆', '☆·'], t >> 1), c: GOLD, row, dx: 0 }
  if (isCommit && s.newsAge < BELL_FRAMES) return { text: '!', c: GOLD, row, dx: BELL_SWING[s.newsAge]! }
  if (isCommit) return { text: frame(['✓', '✓·'], t >> 1), c: GOLD, row, dx: 0 }
  if (age < TURN_FRAMES) return { text: frame(['·', '··'], t), c: PALE, row, dx: 0 }
  if (s.act === 'tool') {
    return { text: TOOL_SIGN[s.tool ?? 'other'] + frame(['', '·', '··', '·'], t), c: GOLD, row, dx: 0 }
  }
  if (s.act === 'ask') return { text: '?', c: GOLD, row: mod(t, 4) < 2 ? 0 : 1, dx: 0 }
  if (s.act === 'say') return { text: frame(['♪', '♪♫', '♫', '♫♪'], t >> 1), c: GREEN, row, dx: 0 }
  if (s.act === 'think') return { text: frame(['·', '··', '···', '··'], t >> 1), c: STEAM, row, dx: 0 }
  return { text: frame(['.', '..', '...', '..'], t >> 1), c: STEAM, row, dx: 0 }
}

export function kitchenScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isTool = s.act === 'tool'
  const isFire = s.news === 'testFail' && s.newsAge < FIRE_FRAMES
  const isSmoke = s.news === 'testFail' && s.newsAge >= FIRE_FRAMES && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const isBell = isCommit && s.newsAge < BELL_FRAMES
  const age = Math.min(s.actAge, s.toolAge)
  const allDone = s.total > 0 && s.done >= s.total
  const boiling = isTool || isPass
  const soup = isFire ? RED : isPass ? GOLD : isTool ? TOOL_COLOR[s.tool ?? 'other'] : SOUP
  const pose: Pose = isFire || isPass || isBell || s.act === 'ask' ? 'up' : isSmoke ? 'sunk' : 'level'

  // Layer 1: the wall with its rolling lit tiles, and the counter along the bottom, glints stepping along its
  // top (colour only: the counter fills its row).
  wall(cv, t)
  for (let x = 0; x < w; x++) {
    plot(cv, x, COUNTER_Y, mod(x - t, COUNTER_GLINT) === 0 ? COUNTER_LIT : COUNTER_TOP)
    plot(cv, x, COUNTER_Y + 1, COUNTER_FRONT)
  }
  // Layer 2: the stove and the pot, the steam (smoke after a fire, none in it) rising from it.
  stove(cv, t, boiling, (isTool && s.tool === 'bash') || isFire, soup, isFire)
  if (!isFire) steam(cv, t, isSmoke)
  // Layer 3: the chef, blinking as the act turns and on a twelve-frame cycle.
  chef(cv, t, s, age, pose, age < TURN_FRAMES || mod(t, BLINK_CYCLE) < 2)
  // Layer 4: the sous-chefs, the plates along the counter left of them, the plate going out over all.
  const agentsL = agents(cv, t, s)
  plates(cv, s, agentsL - 2, allDone)
  if (isCommit) goingOut(cv, s)

  const g = cells(cv)
  const sg = sign(s, t, age, isFire || isSmoke, isPass, isCommit)
  const { text, row, dx } = sg
  // The sign's mark glows white two frames in sixteen, so even its first glyph never holds still.
  const c = mod(t, 16) < 2 ? WHITE : sg.c
  put(g, SIGN_X + dx, row, text, { c, b: s.act !== 'think' || isFire || isSmoke || isPass || isCommit })
  return g
}

/** A dumpling: a crimped top over a plump pale body. */
export const PET: PetArt = {
  body: ['...P.P.P.P..', '..PDPDPDPDP.', '.DDDDDDDDDD.', '.DDDDDDDDDD.', '..DDDDDDDD..'],
  step: ['...P.P.P.P..', '..PDPDPDPDP.', '.DDDDDDDDDD.', '.DDDDDDDDDD.', '...DDDDDDD..'],
  colors: { D: '#f4e1c1', P: '#d4b483' },
  eyes: [4, 7],
  eyeRow: 2,
  eye: EYE,
  lid: '#f4e1c1',
  mouth: [5, 4],
  blush: '#ffb3c1',
  spark: AMBER,
}

export const KITCHEN: Theme = {
  name: 'kitchen',
  rows: SCENE_ROWS,
  color: AMBER,
  accent: RED,
  sprite: {
    think: ['[o  ]', '[ o ]', '[  o]', '[ o ]'],
    tool: ['[oo ]', '[ oo]', '[o o]', '[oo ]'],
    say: ['[o ♪]', '[o ♫]'],
    wait: ['[.  ]', '[.. ]', '[...]'],
  },
  happy: '[★ ]',
  sad: '[.. ]',
  dead: '[xx]',
  sleep: '[__] zZ',
  confetti: ['✦', '·', '°', '+'],
  palette: PALETTE,
  scene: kitchenScene,
  pet: PET,
}
