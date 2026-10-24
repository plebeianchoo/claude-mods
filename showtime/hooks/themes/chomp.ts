// Theme: chomp. Its scene, its words and its pet.
//
// The scene: a maze corridor between two blue walls. Pac runs in from the left when the band starts
// and holds the middle, chomping at the track that streams at him from the right: a dot every four
// pixels, `total` dots to the loop with `done` of them already eaten (gaps); every dot he passes
// scores ten, every task a hundred. Blinky chases a few pixels behind, creeping closer and back on a
// twelve-frame cycle, and each subagent adds a ghost of its own colour (four at most), in its slot
// behind the last from its first frame, the newest flashing white as it joins. While bash runs, every eighth dot is a power pellet pulsing and the ghosts turn blue.
// A failed test: the lead ghost lunges and touches him, he spins (right, up, left, down) for eight
// frames, shrinks to a pixel and grows back. A passing test: a cherry flies in from the right for
// twenty frames (eaten if it reaches him). A commit: the walls flash gold and the dots spark white.
// A task done: the score flashes and he chomps double-time; all done: the maze flashes white, the
// level cleared. Asking: READY! blinks over him; saying: a note.
//
// Motion rules (tests/scenes.test.ts): the walls fill the top and bottom cell rows, so only the two
// middle rows carry ink; every frame must differ in ink, and no run may start more than a column from
// a run start in the frame before. So: the mouth is cut through his middle rows (his ink shrinks and
// grows with it, a column a frame, on even frames) and the track steps a pixel on odd frames; the
// ghosts creep a pixel at a time and only once he is home (a creep plus his walk would be two); new
// ghosts appear in their slots (a flash, never a run-in: an agent leaving would send the rest back), the cherry from the right (its stem a single pixel, the only thing
// that crosses the dot row); the pellet sits above the dots, in the row the cherry's body never uses;
// his death keeps his ink's left edge within a column of where it was, and a ghost's lunge replaces
// its creep (the fail lasts two creep cycles, so the creep is back where it was when the lunge ends).
import { canvas, cells, draw, frame, mod, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const PAC_W = 7
/** Pac, 7×6, mouth to the right, cut through his middle rows: open, half, closed, half. His ink ends
 * at a different column in each neighbouring frame, so the chomp shows in the cells. */
const PAC = [
  ['.YYYYY.', 'YYYYY..', 'YYY....', 'YYY....', 'YYYYY..', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYY.', 'YYYY...', 'YYYY...', 'YYYYYY.', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYY.', 'YYYY...', 'YYYY...', 'YYYYYY.', '.YYYYY.'],
]
/** The death spin: mouth right, up, left, down. Each keeps every cell row one run, its left edge
 * within a column of the frame before (the left mouth is shallow for that). */
const SPIN = [
  PAC[0]!,
  ['.Y...Y.', 'YY...YY', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', '.YYYYYY', '...YYYY', '...YYYY', '.YYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YY...YY', '.Y...Y.'],
]
/** Shrinking to a pixel, a column off each side every two frames; then the same back out. */
const SHRINK: { dx: number; dy: number; art: string[] }[] = [
  { dx: 1, dy: 1, art: ['.YYY.', 'YYYYY', 'YYYYY', '.YYY.'] },
  { dx: 2, dy: 2, art: ['YYY', 'YYY'] },
  { dx: 3, dy: 2, art: ['Y', 'Y'] },
]
const PAC_COLORS = { Y: '#ffff00' }
const GHOST_W = 7
/** A ghost, 7×6, eyes looking right at him, the skirt alternating every two frames. */
const GHOST = [
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'G.GG.GG'],
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'GG.G.GG'],
]
/** The same, scared: blue, white eyes, a pink mouth. */
const SCARED = [
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'B.BB.BB'],
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'BB.B.BB'],
]
const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']
const MAX_GHOSTS = 4
/** Columns from a ghost's left edge to his, and between ghosts. */
const GHOST_GAP = 11
const GHOST_PITCH = 9
/** The chase: a ghost creeps a pixel closer and back on a twelve-frame cycle, one pixel at a time. */
const CHASE = [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0]
/** How far the lead ghost lunges to touch him: the gap between them. */
const LUNGE = GHOST_GAP - GHOST_W
/** Frames the newest ghost flashes white as its agent joins (in place: no run-in). */
const GREET_FRAMES = 12
const WALL = '#2121de'
const DOT = '#ffb8ae'
const DOT_PITCH = 4
const PELLET_EVERY = 8
/** The cherry, 3×3: a stem over the fruit. */
const FRUIT = ['.S.', 'RRR', 'RRR']
const FRUIT_COLORS = { S: '#5ad35a', R: '#ff2d55' }
/** Reaction lengths, in frames. */
const FAIL_FRAMES = 24   // 4 lunge + 8 spin + 6 shrink + 6 grow back: two creep cycles
const SPIN_AT = 4
const SHRINK_AT = SPIN_AT + 8
const PASS_FRAMES = 20
const COMMIT_FRAMES = 12
const DONE_FLASH_FRAMES = 8
const CLEAR_FRAMES = 16
/** The ghosts' eyes dart as the act turns. */
const TURN_FRAMES = 6

/** Where he stands once in: the middle of the band. */
const homeX = (w: number) => Math.floor((w + PAC_W) / 2) - PAC_W
/** His left edge at `t`: in from the left edge a pixel a frame (no ease: held frames with him still
 * off-screen would repeat, the track stepping only every other frame), then home. */
function pacX(t: number, w: number): number {
  return Math.min(homeX(w), t - PAC_W)
}
/** The frame he reaches home. */
const homeAt = (w: number) => homeX(w) + PAC_W

/** Ghost `i`'s creep at frame `tt`: nothing until he is home (a creep plus his walk would move two). */
function creep(i: number, tt: number, w: number): number {
  return frame(CHASE, Math.max(0, tt - homeAt(w) - i * 3))
}

/** The track: dots streaming left a pixel every other frame, eaten at his mouth; `total` to the loop,
 * `done` of them gone; every eighth a pulsing pellet while bash runs. Sparks on a commit, green on a pass. */
function track(cv: Canvas, t: number, off: number, mouthX: number, s: Signals, isCommit: boolean, isPass: boolean): void {
  const w = cv.w
  const bash = s.tool === 'bash'
  for (let k = Math.floor(off / DOT_PITCH); k * DOT_PITCH - off < w; k++) {
    const x = k * DOT_PITCH - off
    if (x < 0) continue
    // All done: the next level's dots are already laid.
    if (s.total > 0 && s.done < s.total && mod(k, s.total) < s.done) continue
    if (bash && mod(k, PELLET_EVERY) === 0) {
      if (x - 1 > mouthX) draw(cv, x - 1, 2, mod(t, 6) < 3 ? ['PP', 'PP'] : ['.P', '.P'], { P: mod(t, 6) < 3 ? '#ffffff' : DOT })
      continue
    }
    if (x <= mouthX) continue
    const glint = mod(t + k * 7, 16) < 2
    if (isCommit) draw(cv, x, 3, ['PP'], { P: mod(s.newsAge + k, 2) ? '#ffffff' : '#ffd60a' })
    else plot(cv, x, 3, glint ? '#ffffff' : isPass ? '#9ece6a' : DOT)
  }
}

/** The ghosts: Blinky always, one more per subagent (four at most), each its own colour, trailing him by
 * GHOST_PITCH each and creeping; a new one is in its slot from its first frame, flashing white for GREET_FRAMES. Scared (blue) while bash runs. The
 * lead one lunges to touch him on a failed test, its lunge standing in for its creep. */
function ghosts(cv: Canvas, t: number, x: number, s: Signals, failAge: number): void {
  const w = cv.w
  const n = Math.max(1, Math.min(s.agents, MAX_GHOSTS))
  const scared = s.tool === 'bash'
  const dart = s.actAge < TURN_FRAMES
  for (let i = n - 1; i >= 0; i--) {
    let shift = creep(i, t, w)
    if (i === 0 && failAge >= 0 && failAge < FAIL_FRAMES) {
      const c0 = creep(0, t - failAge, w)
      shift = Math.min(LUNGE, c0 + failAge, c0 + FAIL_FRAMES - failAge)
    }
    const gx = x - GHOST_GAP - i * GHOST_PITCH + shift
    if (gx <= -GHOST_W) continue
    const art = frame(scared ? SCARED : GHOST, (t >> 1) + i)
    const greet = i > 0 && i === n - 1 && s.agentsAge < GREET_FRAMES && mod(s.agentsAge, 2) === 0
    draw(cv, gx, 1, art, { G: greet ? '#ffffff' : GHOST_COLORS[i]!, W: dart ? WALL : '#ffffff', K: dart ? '#ffffff' : WALL, B: greet ? '#ffffff' : WALL, P: DOT })
  }
}

export function chompScene(t: number, w: number, s: Signals): Grid {
  const act = s.act
  const cv = canvas(w, SCENE_ROWS)
  const x = pacX(t, w)
  const mouthX = x + PAC_W - 1
  /** The track's offset: a pixel every other frame, on odd frames (his mouth moves on even ones). */
  const off = Math.floor((t + 1) / 2)
  const isCommit = s.news === 'commit' && s.newsAge < COMMIT_FRAMES
  const isPass = s.news === 'testPass' && s.newsAge < PASS_FRAMES
  /** Frames into his death: it starts when the news lands, or when he gets home if he was still walking
   * in (news older than the band is none of his). */
  const failAge = s.news === 'testFail' && s.newsAge <= t ? t - Math.max(t - s.newsAge, homeAt(w)) : -1
  const dying = failAge >= 0 && failAge < FAIL_FRAMES
  const allDone = s.total > 0 && s.done >= s.total
  const doneFlash = s.doneAge < DONE_FLASH_FRAMES && mod(s.doneAge, 4) < 2

  // The maze's walls, top and bottom: gold on a commit, white when the level is cleared.
  let wall = WALL
  if (isCommit) wall = mod(s.newsAge, 4) < 2 ? '#ffd60a' : '#fff3b0'
  else if (allDone && s.doneAge < CLEAR_FRAMES && mod(s.doneAge, 4) < 2) wall = '#ffffff'
  for (let c = 0; c < w; c++) {
    plot(cv, c, 0, wall)
    plot(cv, c, 7, wall)
  }
  track(cv, t, off, mouthX, s, isCommit, isPass)
  ghosts(cv, t, x, s, failAge)
  // The cherry: in from the right edge a pixel a frame, gone when it reaches him.
  if (isPass) {
    const fx = w - 1 - s.newsAge
    if (fx > mouthX + 1) draw(cv, fx, 3, FRUIT, FRUIT_COLORS)
  }
  // Pac: chomping on a four-frame cycle while a tool runs, eight otherwise, two for a moment when a task
  // lands; dying, he spins, shrinks and grows back.
  if (dying && failAge >= SHRINK_AT) {
    const step = [0, 1, 2, 1, 0, -1][(failAge - SHRINK_AT) >> 1]!
    if (step < 0) draw(cv, x, 1, PAC[2]!, PAC_COLORS)
    else draw(cv, x + SHRINK[step]!.dx, 1 + SHRINK[step]!.dy, SHRINK[step]!.art, PAC_COLORS)
  } else if (dying && failAge >= SPIN_AT) draw(cv, x, 1, frame(SPIN, (failAge - SPIN_AT) >> 1), PAC_COLORS)
  else if (x < homeX(w)) draw(cv, x, 1, PAC[2]!, PAC_COLORS)   // running in, mouth shut: a chomp could undo the column his step adds
  else if (s.doneAge < DONE_FLASH_FRAMES) draw(cv, x, 1, frame([PAC[0]!, PAC[2]!], t), PAC_COLORS)
  else draw(cv, x, 1, frame(PAC, act === 'tool' ? t : t >> 1), PAC_COLORS)

  const g = cells(cv)
  // The score at the top right: ten a dot passed, a hundred a task; it flashes as one lands.
  const score = String(mod(Math.floor(off / DOT_PITCH) * 10 + s.done * 100, 10000)).padStart(4, '0')
  const scoreColor = isPass ? '#9ece6a' : isCommit ? '#ffd60a' : doneFlash ? '#ffff00' : '#ffffff'
  put(g, w - score.length - 1, 0, score, { c: scoreColor, b: true })
  if (act === 'ask' && mod(t, 8) < 5) put(g, Math.max(0, x - 2), 0, 'READY!', { c: '#ffff00', b: true })
  else if (act === 'say') put(g, x + 2, 0, mod(t, 8) < 4 ? '♪' : '♫', { c: '#ffff00', b: true })
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
