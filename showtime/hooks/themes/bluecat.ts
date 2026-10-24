// Theme: bluecat. Its scene, its words and its pet.
//
// The scene: a blue robot cat hangs from a bamboo copter over a city at night, in the middle of the
// band. The copter's blades spin every frame (a wide and a narrow frame, a highlight sweeping along
// them), the bell on his collar swings every three frames, he blinks every thirty. Behind him two
// skies drift at two speeds: a far one (clouds, stars and a moon, slow) along the top and a near one
// (brighter clouds, faster) at face level; under him the rooftops scroll past with lit windows. The
// copter climbs with the tasks: with nothing done he hovers at the roofs, half done he is a row up,
// all done he is at the top, one pixel row a frame; `total` marks sit on the street at the left,
// `done` of them lit, the newest blinking, all waving when the last lands. Each subagent is a gadget
// that tumbled out of his pocket, bouncing on the rooftops at his right (a squash every eight frames,
// colors tumbling), each at its own slot from the first frame, the newest flashing white as it joins. While a tool runs he holds a pocket
// item beside his face: a wrench for bash, a pencil for edit, a lamp for search, a spark for the rest.
// A failed test stalls the copter: the blades stop and go grey, he sinks two pixels over six frames
// and recovers over six, a drop of sweat falling. A passing test: he hops twice, the bell rings white
// and every window in the city lights. A commit: a pink door pops out beside him, a column a frame,
// with light flickering inside and spilling out, for sixteen frames. Asking: a `?` beside his face;
// thinking: a trail of dots; saying: a note.
//
// Motion rules (tests/scenes.test.ts): every frame differs somewhere, and no run of cells may start
// more than one column from a run start in the frame before (same row or a neighbour). The rooftops
// fill pixel row 7 all the way across, so the bottom cell row is always one run and anything drawn
// there (gadgets, task marks) is free. The cat never leaves pixel rows 2–3 (he is 6 tall with two
// rows of air, and his face rows are 9 wide), so cell row 1 always starts within a column of his
// left column: that is the anchor for the rows beside it. A cloud parting from
// him in row 0 (behind the blades) or row 2 (behind his face) leaves his run start a row away from
// where the anchor was. Nothing else is ever drawn in row 1 except things fused to his right edge
// (glyph, item, door), so his anchor never moves. The far layer moves as one field (clouds, stars
// and the moon at one speed), so nothing in it parts from anything else; the near layer is clouds
// alone. Props grow out from his right edge a pixel a frame and shrink back the same way; the
// blades' narrow frame keeps its start within a column of the wide one and its right tip in place,
// and the head row under it has clear corners, so the flicker shows in every altitude (that is what
// makes every frame differ); the climb, the stall's sink
// and the hop move him a pixel row a frame, which keeps his column. The brief's climb of five rows
// (y = 6 − round(5·done/total)) is scaled to the two rows of air the canvas gives a 6-tall cat.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const CAT_W = 9
/** The copter's blades: a wide frame and a narrow one alternating every frame. The right tip stays
 * put (so a glyph beside it stays fused), the left one flickers a column (within the rule). */
const BLADES = ['PPPPPPPPP', '.PPPPPPPP']
/** The head, 9×5 under the blades: top with the copter's stem, cheeks, eyes, nose, collar. The top
 * row's corners are clear so the blades' flicker shows through the cell they share when he is low;
 * the three face rows are 9 wide, so his cell rows always start within a column of his left. */
const HEAD = '.BBBpBBB.'
const CHEEKS = 'BBWWWWWBB'
const EYES = 'BWKWWWKWB'
const EYES_SHUT = 'BWWWWWWWB'
const EYES_SAD = 'BWSWWWSWB'
const NOSE = 'BWWWRWWWB'
/** The collar: the bell's column swings 4 → 5 → 4 → 3 (every three frames; every frame when excited). */
const COLLAR = ['.', 'B', 'R', 'R', 'R', 'R', 'R', 'B', '.']
const BELL_SWING = [4, 5, 4, 3]
const BLUE = '#0096c7'
const BLUE_DARK = '#0077b6'
const WHITE = '#ffffff'
const RED = '#e63946'
const YELLOW = '#ffd60a'
const PALE = '#fff3b0'
const GREY = '#8d99ae'
const PINK = '#ff8fab'
const DROP = '#48cae4'
const CAT_COLORS = { B: BLUE, b: BLUE_DARK, p: '#8d6e3f', W: WHITE, K: '#22223b', S: DROP, R: RED, Y: YELLOW }
const BLINK_EVERY = 30
/** The cat's top pixel row: 0 at the top of the band, 2 with his collar on the roofs. */
const TOP_MAX = 2
/** Reaction lengths, in frames. */
const FAIL_FRAMES = 12
const PASS_FRAMES = 16
const COMMIT_FRAMES = 16
const DONE_FRAMES = 16
const TURN_FRAMES = 6
/** The stall's sink, a pixel row per frame of the fall and the recovery. */
const SINK = [0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0]
/** The far sky: clouds, stars and a moon, one field drifting slowly along the top two pixel rows. */
const FAR_SPEED = 0.12
const FAR_CLOUD = '#3a4a70'
const STAR = '#8ecae6'
const MOON = '#fff3b0'
/** The near sky: brighter clouds at face level, faster. */
const NEAR_SPEED = 0.3
const NEAR_CLOUD = '#5a6a90'
const NEAR_Y = 4
const LUMP = ['.CCC..', 'CCCCCC']
const LUMP_W = 6
/** The rooftops: a building every seven columns, one or two pixel rows tall, windows lit at random. */
const ROOF_SPEED = 0.35
const ROOF_PITCH = 7
const FACE = '#3d5287'
const SEAM = '#34477a'
const WINDOW = '#ffd166'
const MARK_LIT = YELLOW
const MARK_DIM = '#6b7a8a'
/** A subagent's gadget: two pixels wide on the roofs, two colors tumbling, squashing every eighth frame. */
const GADGET_COLORS: [string, string][] = [[PINK, WHITE], ['#80ffdb', YELLOW], ['#c77dff', WHITE], ['#f4a261', YELLOW]]
const GADGET_PITCH = 3
const MAX_AGENTS = 4
/** Frames the newest gadget flashes as its agent joins. */
const GREET_FRAMES = 12
/** Pocket items by tool kind, two frames each (a wobble every four frames), held beside his face.
 * Their first column is always inked, so they fuse to his right edge. */
const WRENCH = [['M.M', '.MM'], ['M.M', 'MM.']]
const PENCIL = [['.YYT', 'EYY.'], ['EYYT', '....']]
const LAMP = [['.L.', 'GLG'], ['LLL', 'GLG']]
const ITEMS: Record<string, string[][]> = { bash: WRENCH, edit: PENCIL, search: LAMP }
const ITEM_COLORS = { M: '#c0c0c0', Y: YELLOW, T: '#c9a26b', E: PINK, L: PALE, G: GREY }
/** The anywhere door: 3×6 on the roofs beside him, pink with light inside. */
const DOOR = ['PPP', 'PLP', 'PLP', 'PLP', 'PLP', 'PPP']
const DOOR_W = 3
const DOOR_Y = 2

/** Where the copter should hover for `done` of `total`: the roofs with nothing done, the top with all. */
function topFor(done: number, total: number): number {
  if (total <= 0 || done <= 0) return TOP_MAX
  return TOP_MAX - Math.round(TOP_MAX * Math.min(done, total) / total)
}

/** The copter's top pixel row: climbing from where the task before left him, a row a frame. */
function altitude(s: Signals): number {
  const target = topFor(s.done, s.total)
  if (s.done <= 0 || s.doneAge >= TOP_MAX) return target
  const from = topFor(s.done - 1, s.total)
  return from + Math.sign(target - from) * Math.min(s.doneAge, Math.abs(target - from))
}

/** Lumps of cloud at pixel row `y`, `count` of them spaced around a loop a little wider than the band, drifting left at `speed`. */
function lumps(cv: Canvas, t: number, count: number, speed: number, y: number, color: string, seed: number): void {
  const span = cv.w + LUMP_W + 2
  const pitch = span / count
  for (let i = 0; i < count; i++) {
    const base = i * pitch + noise(i + seed) * Math.max(0, pitch - LUMP_W - 2)
    draw(cv, mod(Math.floor(base) - Math.floor(t * speed), span) - LUMP_W, y, LUMP, { C: color })
  }
}

/** The far sky: clouds, stars and the moon drifting as one field along pixel rows 0–1. */
function farSky(cv: Canvas, t: number): void {
  const w = cv.w
  const off = Math.floor(t * FAR_SPEED)
  const span = w + LUMP_W + 2
  for (let i = 0; i < Math.max(3, Math.floor(w / 10)); i++) {
    const sx = mod(Math.floor(noise(i + 20) * span) - off, span) - LUMP_W
    const twinkle = mod(t + i * 7, 24) < 3
    plot(cv, sx, Math.floor(noise(i + 21) * 2), twinkle ? WHITE : STAR)
  }
  const mx = mod(Math.floor(noise(5) * span) - off, span) - LUMP_W
  draw(cv, mx, 0, ['MM', 'MM'], { M: MOON })
  lumps(cv, t, Math.max(2, Math.floor(w / 24)), FAR_SPEED, 0, FAR_CLOUD, 9)
}

/** The rooftops: pixel row 7 all the way, row 6 on the taller buildings, seams and windows; every window lit on `bright`. */
function roofs(cv: Canvas, t: number, bright: boolean): void {
  const off = Math.floor(t * ROOF_SPEED)
  for (let c = 0; c < cv.w; c++) {
    const u = c + off
    const b = Math.floor(u / ROOF_PITCH)
    const col = mod(u, ROOF_PITCH)
    const tall = noise(b) < 0.5
    const window = col === 2 || col === 4
    const lit = bright || noise(b * 5 + col) < 0.45
    plot(cv, c, 7, col === 0 ? SEAM : window && lit ? WINDOW : FACE)
    if (tall) plot(cv, c, 6, col === 0 ? SEAM : window && (bright || noise(b * 3 + col) < 0.45) ? WINDOW : FACE)
  }
}

/** The task marks along the street at the left, left of him: `total` of them, `done` lit; the newest blinks, all wave when the last lands. */
function marks(cv: Canvas, x: number, s: Signals): void {
  const n = Math.max(0, Math.min(s.total, Math.floor((x - 1) / 2)))
  const allDone = s.total > 0 && s.done >= s.total
  for (let i = 0; i < n; i++) {
    let color = i < s.done ? MARK_LIT : MARK_DIM
    if (allDone && s.doneAge < DONE_FRAMES && mod(s.doneAge - i, 6) < 2) color = WHITE
    else if (!allDone && i === s.done - 1 && s.doneAge < DONE_FRAMES && mod(s.doneAge, 2) === 0) color = WHITE
    plot(cv, 1 + 2 * i, 7, color)
  }
}

/** Subagents: a gadget each bouncing on the roofs at his right, three columns apart, each at its slot from
 * its first frame; the newest flashes white for GREET_FRAMES as it joins (an agent leaving moves no one). */
function gadgets(cv: Canvas, t: number, x: number, s: Signals): void {
  const n = Math.max(0, Math.min(s.agents, MAX_AGENTS, Math.floor((cv.w - 12 - x) / GADGET_PITCH) + 1))
  for (let i = 0; i < n; i++) {
    const gx = x + CAT_W + 1 + i * GADGET_PITCH
    const greet = i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    const [a, b] = greet ? [WHITE, WHITE] : GADGET_COLORS[i]!
    const flip = mod(t >> 1, 2) === 0
    const tall = mod(t + 2 * i, 8) < 5
    plot(cv, gx, 7, flip ? a : b)
    plot(cv, gx + 1, 7, flip ? b : a)
    if (tall) {
      plot(cv, gx, 6, flip ? b : a)
      plot(cv, gx + 1, 6, flip ? a : b)
    }
  }
}

/** The door of a commit: grows out from his right edge a column a frame, light flickering inside and spilling out, then shrinks back. */
function door(cv: Canvas, x: number, f: number): void {
  const width = Math.max(0, Math.min(DOOR_W, f + 1, COMMIT_FRAMES - f))
  const light = mod(f, 2) === 0 ? PALE : YELLOW
  for (let c = 0; c < width; c++) {
    for (let r = 0; r < DOOR.length; r++) plot(cv, x + CAT_W + c, DOOR_Y + r, DOOR[r]![c] === 'P' ? PINK : light)
  }
  if (width === DOOR_W && f >= 3 && f < COMMIT_FRAMES - 3 && mod(f, 2) === 0) {
    plot(cv, x + CAT_W + DOOR_W, DOOR_Y + 1, PALE)
    plot(cv, x + CAT_W + DOOR_W, DOOR_Y + 2, PALE)
  }
}

export function bluecatScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const x = Math.floor((w - CAT_W) / 2)
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const isFail = s.news === 'testFail' && s.newsAge < FAIL_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  const allDone = s.total > 0 && s.done >= s.total && s.doneAge < DONE_FRAMES
  const excited = s.actAge < TURN_FRAMES || isPass || isCommit || allDone

  // The skies, the roofs, and what sits on the roofs.
  farSky(cv, t)
  lumps(cv, t, Math.max(1, Math.floor(w / 32)), NEAR_SPEED, NEAR_Y, NEAR_CLOUD, 3)
  roofs(cv, t, isPass)
  marks(cv, x, s)
  gadgets(cv, t, x, s)

  // The cat: his altitude from the tasks, the stall's sink, the hop of a passing test (every other four frames).
  const base = altitude(s)
  const hop = isPass && mod(s.newsAge, 8) >= 2 && mod(s.newsAge, 8) < 6 ? 1 : 0
  const top = base + (isFail ? SINK[s.newsAge]! : 0) - hop
  // Blades: alternating wide and narrow with a highlight sweeping along; stopped and grey in a stall.
  if (isFail) draw(cv, x, top, [BLADES[0]!], { P: GREY })
  else {
    draw(cv, x, top, [frame(BLADES, t)], { P: YELLOW })
    const hx = mod(t * 2, CAT_W)
    if (frame(BLADES, t)[hx] === 'P') plot(cv, x + hx, top, excited ? WHITE : PALE)
  }
  const eyes = isFail ? EYES_SAD : mod(t, BLINK_EVERY) < 2 ? EYES_SHUT : EYES
  const collar = [...COLLAR]
  collar[frame(BELL_SWING, excited ? t : Math.floor(t / 3))] = 'Y'
  draw(cv, x, top + 1, [HEAD, CHEEKS, eyes, NOSE, collar.join('')], { ...CAT_COLORS, Y: isPass || isCommit ? (mod(t, 2) === 0 ? WHITE : YELLOW) : YELLOW })

  // Beside his face: the pocket item of the tool, the door of a commit, the sweat of a failed test.
  const arts = act === 'tool' && s.tool ? ITEMS[s.tool] : undefined
  const hasItem = !!arts && !isCommit && !isFail
  if (hasItem) draw(cv, x + CAT_W, top + 3, frame(arts!, t >> 2), ITEM_COLORS)
  if (isCommit) door(cv, x, s.newsAge)
  if (isFail) plot(cv, x + CAT_W, base + 2 + (s.newsAge >> 1), DROP)

  const g = cells(cv)
  // The glyph beside his face, fused to his right edge: a `?` while asking, a spark while a tool
  // without an item runs, dots while thinking, a note while saying; nothing beside an item, the door or a stall.
  const gx = x + CAT_W
  if (!hasItem && !isCommit && !isFail) {
    if (act === 'ask') { if (mod(t, 8) < 6) put(g, gx, 1, '?', { c: WINDOW, b: true }) }
    else if (act === 'tool') put(g, gx, 1, frame(['✦', '·', '✧', '·'], t >> 1), { c: YELLOW, b: true })
    else if (act === 'think') put(g, gx, 1, frame(['·', '··', '···', '··'], t >> 2), { c: '#9ab0c8' })
    else if (act === 'say') put(g, gx, 1, mod(t, 8) < 4 ? '♪' : '♫', { c: PALE, b: true })
    else put(g, gx, 1, frame(['.', '..', '...'], t >> 2), { c: '#9ab0c8' })
  }
  return g
}

/** A blue robot cat: white face, red nose, a bell on its collar. */
export const PET: PetArt = {
  body: ['..BBBBBBBB..', '.BBWWWWWWBB.', 'BBWWWWWWWWBB', 'BBWWWRRWWWBB', '.BRRRYYRRRB.'],
  colors: { B: '#0096c7', W: '#ffffff', R: '#e63946', Y: '#ffd60a' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#ffffff',
  mouth: [5, 3],
  blush: '#ff8fab',
  spark: '#80ffdb',
}

export const BLUECAT: Theme = {
  name: 'bluecat',
    rows: SCENE_ROWS,
    color: '#00b4d8',
    accent: '#e63946',
    sprite: {
      think: ['⊂(◉‿◉)つ  ', '⊂(◉‿◉)つ ?', '⊂(◔‿◔)つ ?'],
      tool: ['⊂(◉‿◉)つ✦  ', '⊂(◉‿◉)つ ✧ ', '⊂(◉‿◉)つ  ✦'],
      say: ['⊂(◕‿◕)つ ♪', '⊂(◕‿◕)つ ♫'],
      wait: ['⊂(◉‿◉)つ .  ', '⊂(◉‿◉)つ .. ', '⊂(◉‿◉)つ ...'],
    },
    happy: '⊂(◕‿◕)つ',
    sad: '⊂(╥﹏╥)つ',
    dead: '⊂(×﹏×)つ',
    sleep: '⊂(－‿－)つ zZ',
    confetti: ['✦', '✧', '●', '·', '+'],
    palette: ['#00b4d8', '#e63946', '#ffd60a', '#ffffff'],
    scene: bluecatScene,
  pet: PET,
}
