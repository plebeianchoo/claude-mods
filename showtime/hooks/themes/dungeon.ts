// Theme: dungeon. Its scene, its words and its pet.
//
// The scene: a party of three (mage, rogue, warrior) walking in place at the left third of a torchlit corridor,
// #ffd166 torches on #343a40 bricks with a lighter mortar; bricks and torches scroll a cell every other frame, the
// flagstones a cell a frame under a four-frame step. A door per task (six at most) at a fixed pitch past the party,
// open and lit once done, the newest flaring; a monster per agent (four at most) in a fixed slot ahead, bobbing on
// six frames, flashing as it arrives and as a spell hits it. think: the torches flare, the staff glows on twelve
// frames; tool: a spell in the tool's colour grows from the staff a cell a frame, the warrior's blade takes the
// tint; ask raises a ?, say a speech bubble, wait a rising z. testFail: spikes spring under the party (8 frames),
// which hops back a pixel and returns; testPass: a cheer; 100%: a chest opens (16 frames); commit: a d20 rolls
// twelve cells, lands on 20, fades by 28. Motion: pixel rows 0-5 are wall and always full, so the motion test
// sees the floor's seams; the shape check tracks every mover by colour.
import { canvas, cells, draw, mod, noise, plot } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = Record<string, string>

/** Pixel rows: the floor's top (the wall is rows 0-5). Columns: a door and its pitch, doors at most; a monster's
 * slot pitch, monsters at most; the party's width, the cue gap after it; bricks' and torches' world spacing. */
const FLOOR_Y = 6
const [DOOR_W, DOOR_PITCH, MAX_DOORS, MON_PITCH, MAX_MONSTERS] = [5, 8, 6, 6, 4]
const [PARTY_W, GAP_W, BRICK, TORCH_GAP] = [15, 7, 6, 16]
/** Frames: a door's flare, a greeting's flash, the chest, testPass's cheer, the spell's sparkle cycle. */
const [FLARE, GREET, CHEST, CHEER, SPARK] = [8, 8, 16, 12, 12]
/** testFail by newsAge: the spikes' height (8 frames), the party's hop (up) and its pixel back. */
const SPIKES = [1, 2, 3, 3, 3, 2, 1, 0]
const HOP = [0, 1, 1, 1, 0]
const [BACK_FROM, BACK_TO] = [1, 22]
/** commit by newsAge: rolling 0-11 (a cell a frame), resting on 20 to 19, fading 20-27. */
const [ROLL, REST, GONE] = [12, 20, 28]

const [WALL, WALL2, MORTAR, GLOW] = ['#343a40', '#383f46', '#5a6169', '#5e5243']
const [TORCH, FLAME, BRACKET] = ['#ffd166', '#f77f00', '#8b5e34']
const [FLOOR, FLOOR2, EDGE] = ['#6c757d', '#7d868e', '#495057']
const [STONE, DOOR, DOOR2, RING] = ['#868e96', '#8b5e34', '#6f4518', '#e9c46a']
const [LIT, LIT_LOW, FLASH] = ['#f4a261', '#ffd166', '#fff3b0']
const [WHITE, STEEL, SKIN] = ['#ffffff', '#ced4da', '#ffddd2']
const [ORB, HALO, SIGN, BUBBLE, DOT, ZED] = ['#c77dff', '#e0aaff', '#ffd166', '#f8f9fa', '#6c757d', '#8d99ae']
const [DIE, DIE_LIT, DIE_DARK] = ['#d62839', '#ffccd5', '#9d0208']
const TOOL_INK: Record<ToolKind, string> = {
  bash: '#caffbf', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff', agent: '#bb9af7', web: '#7aa2f7',
  other: '#ff5d8f',
}

/** The party facing right, each 5 wide, pixel rows 1-5 (a pixel of headroom for a hop), in two step poses. */
const MAGE = ['..P.O', '.PPPs', '.FFhs', 'PPPPs']
const ROGUE = ['.GG..', 'GGF..', 'gGGD.', '.GG..']
const WARRIOR = ['.HH.B', '.HF.B', 'SRRhY', 'SRR..']
const LEGS = { mage: ['P..Ps', '.PP.s'], rogue: ['G..G.', '.GG..'], warrior: ['R..R.', '.RR..'] }
const PARTY: Ink = {
  O: ORB, P: '#9d4edd', s: '#a47148', F: SKIN, h: SKIN, G: '#52b788', g: '#40916c', D: STEEL,
  H: '#adb5bd', R: '#4895ef', S: '#e63946', B: '#e9ecef', Y: RING,
}
/** Monsters facing left, bottoms on the floor (the bat flies): slime, skeleton, goblin, bat (wings up, down). */
const MONSTERS: { art: string[][]; ink: Ink; fly?: boolean }[] = [
  { art: [['.SS.', 'ESSS', 'SSSS']], ink: { S: '#80ed99', E: WHITE } },
  { art: [['.BB.', 'EBB.', 'BBBB', 'B.B.']], ink: { B: '#e9ecef', E: '#ff595e' } },
  { art: [['.GG.', 'EGGc', 'GGGc', 'G.G.']], ink: { G: '#a7c957', E: '#ff595e', c: '#bc6c25' } },
  { art: [['V..V', 'VEEV', '.VV.'], ['....', 'VEEV', 'VVVV']], ink: { V: '#b185db', E: '#ff595e' }, fly: true },
]
/** The d20 tumbling (face-on, tilted one way, the other) and at rest with its number; the chest. */
const D20 = [['.SLS.', 'SLLLS', 'SLLLS', '.sss.'], ['.SS..', 'SLLS.', '.SLLS', '..ss.'], ['..SS.', '.SLLS',
  'SLLS.', '.ss..']]
const D20_REST = ['.SLS.', 'SLNLS', 'SLLLS', '.sss.']
const QUESTION = ['YYY', '..Y', '.YY', '...', '.Y.']
const Z_ART = ['ZZZ', '.Z.', 'ZZZ']

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}
const clamp = (k: number) => Math.max(0, Math.min(1, k))
/** Every key of `ink` blended toward `to` by `k`. */
const tint = (ink: Ink, to: string, k: number): Ink =>
  k <= 0 ? ink : Object.fromEntries(Object.entries(ink).map(([key, c]) => [key, mix(c, to, k)]))

/** The wall: courses of bricks two pixels tall over a mortar row, joints staggered, scrolling a cell every
 * other frame; a torch every TORCH_GAP columns warming the bricks beside it, its flame flickering on two
 * frames and flaring a pixel higher while it thinks; dimmer while it waits. */
function wall(cv: Canvas, t: number, s: Signals): void {
  const off = t >> 1
  for (let x = 0; x < cv.w; x++) {
    const u = x + off
    for (let y = 0; y < FLOOR_Y; y++) {
      const course = y < 2 ? 0 : y < 5 ? 1 : 2
      const joint = mod(u + course * 3, BRICK) === 0
      const brick = Math.floor((u + course * 3) / BRICK) * 3 + course
      plot(cv, x, y, y === 2 || y === 5 || joint ? MORTAR : noise(brick) < 0.5 ? WALL : WALL2)
    }
  }
  const flare = s.act === 'think' && s.actAge >= 2
  for (let k = Math.floor(off / TORCH_GAP) - 1; k * TORCH_GAP - off < cv.w + 2; k++) {
    const x = k * TORCH_GAP + 8 - off
    for (const dx of [-1, 1]) for (const y of [1, 3]) plot(cv, x + dx, y, GLOW)
    plot(cv, x, 3, BRACKET)
    plot(cv, x, 2, s.act === 'wait' ? FLAME : TORCH)
    plot(cv, x, 1, mod(t + k, 2) === 0 ? TORCH : FLAME)
    if (flare && mod(t + k, 2) === 0) plot(cv, x, 0, FLAME)
  }
}

/** A door per task at a fixed pitch from `x0`, past the party (floor-scaled when more than fit): stone frame, a
 * closed door of planks with a ring, or once done an open doorway lit inside, the newest flashing in. */
function doors(cv: Canvas, t: number, s: Signals, x0: number): void {
  const count = Math.min(s.total, MAX_DOORS, Math.floor((cv.w - x0 + DOOR_PITCH - DOOR_W) / DOOR_PITCH))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const fresh = s.doneAge < FLARE && lit > litOf(s.done - 1)
  for (let k = 0; k < count; k++) {
    const x = x0 + k * DOOR_PITCH
    for (let dx = 1; dx < DOOR_W - 1; dx++) plot(cv, x + dx, 0, STONE)
    for (let y = 1; y < FLOOR_Y; y++) {
      plot(cv, x, y, STONE)
      plot(cv, x + DOOR_W - 1, y, STONE)
      for (let dx = 1; dx < DOOR_W - 1; dx++) {
        let c = dx === 2 ? DOOR2 : DOOR
        if (k < lit) c = y >= 4 ? (dx === 2 && mod(t + k * 5, 6) < 3 ? FLASH : LIT_LOW) : LIT
        if (k === lit - 1 && fresh) c = mix(FLASH, c, s.doneAge / FLARE)
        plot(cv, x + dx, y, c)
      }
    }
    if (k >= lit) plot(cv, x + 3, 3, RING)
  }
}

/** The flagstones a cell a frame, seams between slabs of six or three columns, both pixel rows clear there. */
function floor(cv: Canvas, t: number): void {
  for (let x = 0; x < cv.w; x++) {
    const u = x + t
    const slab = Math.floor(u / 6)
    if (mod(u, 6) === 0 || (mod(u, 6) === 3 && noise(slab * 3 + 1) < 0.45)) continue
    plot(cv, x, FLOOR_Y, noise(slab) < 0.5 ? FLOOR : FLOOR2)
    plot(cv, x, FLOOR_Y + 1, EDGE)
  }
}

export function dungeonScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const isFail = s.news === 'testFail' && s.newsAge < BACK_TO + 1
  const isTool = s.act === 'tool'
  const ink = TOOL_INK[s.tool ?? 'other']
  // Fixed places: the party at the left third, the cue gap after it, the monsters' first slot after that.
  const px = Math.max(1, Math.floor(w / 3) - PARTY_W)
  const gx = px + PARTY_W + 1
  const mx = gx + GAP_W - 1
  const fit = [0, 1, 2, 3].filter(i => mx + MON_PITCH * i + 4 <= w).length
  const monsters = Math.min(s.agents, MAX_MONSTERS, fit)

  // Layers 1-3: the wall and its torches, the doors, the floor.
  wall(cv, t, s)
  doors(cv, t, s, mx)
  floor(cv, t)

  // testFail: the party hops and lands a pixel back (the spikes spring up in front of its feet, below).
  const back = isFail && s.newsAge >= BACK_FROM && s.newsAge < BACK_TO ? 1 : 0
  const hop = isFail ? (HOP[s.newsAge] ?? 0) : 0

  // The tool act's own, grown on actAge and kept through any reaction: a spell from the staff's orb to the first
  // monster's slot (a cell a frame, over the party's heads), a white spark along it, the orb and blade tinted.
  const ox = px - back + 5
  const spell = isTool ? Math.min(mx - ox, s.actAge + 1) : 0
  const reached = isTool && spell >= mx - ox

  // Layer 4: the party, stepping on four frames (the three out of phase), cheering a hop each on testPass.
  const glow = s.act === 'think' && s.actAge >= 4 ? Math.abs(mod(t, 12) - 6) / 6 : 0
  const blade = isTool ? mix(PARTY.B!, ink, 0.7) : PARTY.B!
  const passing = s.news === 'testPass' && s.newsAge < CHEER
  const orb = isTool ? ink : passing ? WHITE : mix(ORB, WHITE, glow)
  const party: Ink = { ...PARTY, O: orb, B: passing ? WHITE : blade }
  const step = (i: number) => (mod(t + 2 * i, 4) < 2 ? 0 : 1)
  const cheer = (i: number) => (s.news === 'testPass' && s.newsAge < CHEER && mod(s.newsAge - i, 6) < 3 ? 1 : 0)
  const figs = [[MAGE, LEGS.mage], [ROGUE, LEGS.rogue], [WARRIOR, LEGS.warrior]] as const
  figs.forEach(([art, legs], i) => draw(cv, px - back + 5 * i, 1 - hop - cheer(i), [...art, legs[step(i)]!], party))
  if (glow > 0.5) for (const [dx, dy] of [[-1, 1], [1, 1], [0, 0]] as const) plot(cv, px - back + 4 + dx, dy, HALO)
  for (let j = 0; j < spell; j++) plot(cv, ox + j, 0, mod(t, SPARK) === j % SPARK ? WHITE : ink)
  if (reached && mod(t, 4) < 2) plot(cv, mx - 1, 1, WHITE)
  // The trap's spikes at the party's fixed spot, in front of its feet, rising and sinking a pixel a frame.
  if (s.news === 'testFail' && s.newsAge < SPIKES.length) {
    for (let j = 0; j < 5; j++) for (let k = 0; k < SPIKES[s.newsAge]!; k++) {
      plot(cv, px + 6 + 2 * j, FLOOR_Y - 1 - k, k === SPIKES[s.newsAge]! - 1 ? WHITE : STEEL)
    }
  }

  // Layer 5: the monsters in their slots, bobbing on six frames; the newest flashes as it arrives, the first as the
  // spell hits it.
  for (let i = 0; i < monsters; i++) {
    const m = MONSTERS[i]!
    const bob = mod(t + 2 * i, 6) < 3 ? 0 : 1
    const art = m.art[m.fly ? bob : 0]!
    const flash = (i === monsters - 1 && s.agentsAge < GREET && mod(s.agentsAge, 4) < 2) ||
      (i === 0 && reached && mod(t, 12) < 2)
    const y = m.fly ? 1 + bob : FLOOR_Y - art.length - bob
    draw(cv, mx + MON_PITCH * i, y, art, flash ? tint(m.ink, WHITE, 1) : m.ink)
  }

  // The act cues in the gap: ask's ? drawn in row by row, say's bubble growing and its dots filling on twelve
  // frames, wait's z rising.
  if (s.act === 'ask') {
    const rows = QUESTION.slice(0, Math.min(QUESTION.length, s.actAge + 1))
    draw(cv, gx + 1, 0, rows, { Y: mod(t, 12) < 9 || rows.length < 5 ? SIGN : '#fff3b0' })
  } else if (s.act === 'say') {
    const wide = Math.min(5, s.actAge + 1)
    for (let dx = 0; dx < wide; dx++) for (let y = 0; y < 3; y++) plot(cv, gx + dx, y, BUBBLE)
    for (let k = 0; k < 3 && wide === 5; k++) if (mod(t, 12) >= 3 * (k + 1)) plot(cv, gx + 1 + k, 1, DOT)
    if (wide === 5) plot(cv, gx - 1, 3, BUBBLE)
  } else if (s.act === 'wait') {
    draw(cv, gx + 1, 3 - (mod(t, 12) >> 2), Z_ART.slice(0, Math.min(3, s.actAge + 1)), { Z: ZED })
  }

  // 100%: a chest in the gap, eased in from the wall behind it over three frames, its lid lifting a pixel every
  // other frame, gold and a glint rising out of it, eased back into the wall by its last frame.
  if (s.total > 0 && s.done >= s.total && s.doneAge < CHEST) {
    const a = s.doneAge
    const k = clamp(Math.min(a, CHEST - 1 - a) / 3)
    const box = (x: number, y: number, c: string) => plot(cv, x, y, mix(cv.px[y * w + x] ?? WALL, c, k))
    const lift = Math.min(2, Math.max(0, (a - 3) >> 1))
    for (let dx = 0; dx < 4; dx++) {
      box(gx + dx, 3 - lift, '#bc6c25')
      if (lift > 0) box(gx + dx, 3, TORCH)
      box(gx + dx, 4, dx === 1 ? RING : DOOR)
      box(gx + dx, 5, DOOR2)
    }
    if (a >= 7 && a < 13) box(gx + 1 + (a & 1), 2 - ((a - 7) >> 1), WHITE)
  }

  // commit: the d20 rolls from the gap a cell a frame, tumbling, rests on 20 (its number flashing), fades; at a
  // narrow band, where its roll would leave the band, it fades as it goes.
  if (s.news === 'commit' && s.newsAge < GONE) {
    const a = s.newsAge
    const room = w - 5 - gx
    const x = gx + Math.min(a, ROLL - 1)
    const art = a < ROLL ? D20[a % 3]! : D20_REST
    const k = Math.max(a >= REST ? (a - REST + 1) / (GONE - REST) : 0, room < ROLL ? a / Math.max(1, room) : 0)
    const n = mod(a, 4) < 2 ? DIE_DARK : TORCH
    if (k < 1) draw(cv, x, 2, art, tint({ S: DIE, s: DIE_DARK, L: DIE_LIT, N: n }, WALL, clamp(k)))
  }

  return cells(cv)
}

/** A d20 face-on, 7 wide and 5 tall: a hexagon pointed top and bottom, red upper side facets, dark lower ones, a
 * pale triangle up the middle with its number (a red pixel) and the eyes on its flanks. */
export const PET: PetArt = {
  body: ['....STS....', '..SSTTTSS..', '..STTTTTS..', '..dTTNTTd..', '....ddd....'],
  colors: { S: DIE, T: DIE_LIT, N: DIE, d: DIE_DARK },
  eyes: [4, 6],
  eyeRow: 1,
  eye: '#2b2d42',
  lid: DIE_LIT,
  blush: '#ff758f',
  spark: TORCH,
}

export const DUNGEON: Theme = {
  name: 'dungeon',
  rows: SCENE_ROWS,
  color: TORCH,
  accent: DIE,
  sprite: {
    think: ['†·  ', '† · ', '†  ·', '† · '],
    tool: ['†-  ', '†=  ', '†≡  ', '†=  '],
    say: ['† ♪', '† ♫'],
    wait: ['† .', '† ..', '† ...'],
  },
  happy: '† ✓',
  sad: '† …',
  dead: '✕',
  sleep: '† zZ',
  confetti: ['✦', '◆', '·', '+'],
  palette: [TORCH, DIE, '#9d4edd', '#52b788'],
  scene: dungeonScene,
  pet: PET,
}
