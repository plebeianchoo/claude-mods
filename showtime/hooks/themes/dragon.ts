// Theme: dragon. Its scene, its words and its pet.
//
// The scene: a red dragon (#e63946, gold #ffb703 wing) flying a figure-eight over a castle by `t` alone, out high
// and back a cell lower, its wing beating on six frames; a keep at the left whose brazier sheds embers, the moon at
// the right, clouds drifting left, a sign reading the act. bash: a fire cone from its jaws, grown on `actAge`,
// flickering on two frames; other tools: sparks at its nose in the tool's colour; ask: the brazier flares; say: its
// jaws work. A tower per task, its window lit when done; a wyvern per agent trailing it on its path, greeting in
// place. testFail: an arrow hits it, it dips a cell six frames, a puff where it was hit; testPass: its wing
// flashes; commit: it fades onto the keep, roars twelve frames, fades back. Motion rules: flyers rise and fall a
// whole cell; clouds hide in a flyer's columns; a flyer's tail tip stands alone in its cell row and its rows' run
// starts mirror, so what it leaves parts by an edge and it turns in place; the cone grows only on frames it holds
// still.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme, ToolKind } from '../themes'

type Ink = (c: string) => string
/** A flyer on the figure-eight: its left column, top pixel row, facing, frames since its last turn and to its next. */
type Fly = { x: number; y: number; face: 1 | -1; since: number; until: number }
/** The figure-eight: its middle column, its swing either side, its period in frames. */
type Geo = { cx: number; a: number; p: number }

/** The dragon facing right, 11×4: a wing over its back (tip d, base a), its tail flicking up at the end (F),
 * body, neck and a raised head (horn K, eye E, snout S, jaw J), a belly (L) under its wing. It beats its wing in
 * colour on six frames, lighting the tip and base, the base, then the belly (the wing down); the silhouette stays
 * put. Rows 0-1 and 2-3 share a cell row at both heights; each pair's run starts sit where its mirror's do, so it
 * turns in place, and the tail's tip stands alone in its cell row. */
const DRAGON_ART = ['....ddd...K', 'F..aaaaa.EH', '.TTBBBBBNHS', '...LLLLL.J.']
const WING_LIT = ['da', 'da', 'a', 'L', 'L', 'a']
const WING_DIM: Record<string, string> = { d: '#9d0208', a: '#b5172b', L: '#c1121f' }
/** A wyvern facing right, 6×3, forked the same way; a wing stub over and under its body (d), the upper or the
 * lower lit (W) on four frames, so it beats in colour and keeps its shape. */
const WYVERN = ['F.dd.H', '.TBBNS', 'F.dd.J']
const [DRAGON_W, WYVERN_W, WYVERN_DX, MAX_WYVERNS] = [11, 6, 2, 4]
/** The keep's left column and width; the flyers' zone from ZONE_X to w - ZONE_R; the most swing; the sign. */
const [KEEP_X, KEEP_W, ZONE_X, ZONE_R, MAX_A, SIGN_X, MAX_TOWERS] = [5, 7, 14, 7, 22, 1, 12]
/** Frames: an act's change; the cone's columns (grown one a still frame); a greeting, a window brightening. */
const [CHANGE, CONE, GREET, BRIGHT] = [4, 4, 8, 8]
/** testFail: the arrow's flight; the dip a frame from the hit (a cell for six frames); the puff; testPass. */
const [HIT, DIP, PUFF, PASS] = [4, [0, 2, 2, 2, 2, 2, 2, 0], 12, 12] as const
/** commit (newsAge bounds): fading off its path, onto the keep, roaring, off the keep, back onto its path. */
const [OFF, ON, ROAR, LEAVE, BACK, ROAR_LEN] = [4, 8, 20, 24, 28, 6]

const [RED, GOLD, EMBER, DEEP_EMBER, FLAME, PALE, WHITE] =
  ['#e63946', '#ffb703', '#fb8500', '#e85d04', '#ffd60a', '#fff3b0', '#ffffff']
const [STONE, STONE_DARK, STONE_TOP, TOWER, KEEP, KEEP_TOP, GATE, BOWL] =
  ['#5c636a', '#4f555c', '#7d8597', '#6d7389', '#7a7f96', '#9aa0b8', '#7f5539', '#8d99ae']
const [WINDOW_OFF, LAMP, MOON, CRATER, CLOUD, CLOUD_TOP, FADE_TO] =
  ['#4a4e69', '#ffd166', '#f1faee', '#cfd8dc', '#5c677d', '#6c7a93', '#262a36']
/** The arrow (head, shaft), the puff, the roar's rings, the wyverns' hues. */
const [STEEL, SHAFT, PUFF_INK] = ['#e9ecef', '#a47148', ['#f8f9fa', '#dee2e6', '#adb5bd']] as const
const RING_INK = [PALE, LAMP, GOLD, EMBER, DEEP_EMBER, '#bc6c25']
const HUES = ['#52b788', '#b185db', '#4cc9f0', '#f4a261']
const DRAGON_INK: Record<string, string> = { F: GOLD, T: RED, B: RED, N: RED, H: RED, K: LAMP, E: PALE, S: '#ff758f',
  J: '#a4161a', M: '#6a040f' }
const TOOL_INK: Record<ToolKind, string> = { bash: FLAME, edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** The figure-eight for width `w`: centred in the zone, a swing of up to MAX_A columns, a period long enough that
 * it never moves more than 0.7 of a column a frame (a multiple of four, so the turns fall on whole frames). */
function geoOf(w: number): Geo {
  const room = w - ZONE_R - ZONE_X - DRAGON_W
  const a = Math.max(0, Math.min(MAX_A, room >> 1))
  return { cx: ZONE_X + (room >> 1), a, p: 4 * Math.round(Math.max(48, Math.min(192, 9 * a)) / 4) }
}

/** Where a flyer is at frame `t`: across by sin, high on the way out and a cell lower on the way back by sin 2θ
 * (a whole cell, so its rows keep their cells, three frames after each turn); it faces the way it goes. */
function fly(t: number, g: Geo): Fly {
  const th = (2 * Math.PI * t) / g.p
  const [half, s] = [g.p / 2, mod(t + g.p / 4, g.p)]
  const y = Math.sin(2 * th - (12 * Math.PI) / g.p) > 0 ? 0 : 2
  const since = mod(s, half)
  return { x: g.cx + Math.round(g.a * Math.sin(th)), y, face: s < half ? 1 : -1, since, until: half - since }
}

/** How long the cone has grown over the last `window` frames: a column on each frame the dragon held its column,
 * so its tip never moves two in a frame (CONE at most). */
function grown(t: number, g: Geo, window: number): number {
  let n = 0
  for (let j = 0; j < window && n < CONE; j++) if (fly(t - j, g).x === fly(t - j - 1, g).x) n++
  return n
}

/** Draws `art` (rows of keys) at (x, y), mirrored when facing left, each key's colour through `ink`. */
function sprite(cv: Canvas, x: number, y: number, face: 1 | -1, art: string[][], keys: Record<string, string>,
  ink: Ink): void {
  const w = art[0]!.length
  art.forEach((r, j) => r.forEach((k, i) => {
    const c = keys[k]
    if (c) plot(cv, face > 0 ? x + i : x + w - 1 - i, y + j, ink(c))
  }))
}

/** The dragon, its wings on frame `wing`, its jaws open (the snout dark, a mouth over the jaw) when `open`;
 * `nose` recolours its snout and jaw (a tool's sparks). */
function dragon(cv: Canvas, x: number, y: number, face: 1 | -1, wing: number, ink: Ink, open = false,
  nose?: string): void {
  const art = DRAGON_ART.map(r => [...r])
  if (open) art[2]![10] = 'M'
  const lit = WING_LIT[mod(wing, WING_LIT.length)]!
  const keys: Record<string, string> = { ...DRAGON_INK, ...(nose ? { S: nose, J: nose } : {}) }
  for (const k of 'daL') keys[k] = lit.includes(k) ? GOLD : WING_DIM[k]!
  sprite(cv, x, y, face, art, keys, ink)
  // The lit wing's first and last columns pale at the top and the bottom of the beat.
  const edge = mod(wing, 6) === 0 ? [0, 4, 6] : mod(wing, 6) === 4 ? [3, 3, 7] : undefined
  for (const c of edge?.slice(1) ?? []) plot(cv, face > 0 ? x + c : x + DRAGON_W - 1 - c, y + edge![0]!, ink(PALE))
}

/** A wyvern in its hue (lighter wings and fork, a darker jaw), white while it greets. */
function wyvern(cv: Canvas, f: Fly, up: boolean, hue: string, flash: boolean): void {
  const art = WYVERN.map(r => [...r])
  ;[art[up ? 0 : 2]![2], art[up ? 0 : 2]![3]] = ['W', 'W']
  const keys = { F: mix(hue, WHITE, 0.4), T: hue, B: hue, N: hue, H: hue, S: mix(hue, WHITE, 0.3),
    J: mix(hue, '#000000', 0.25), W: mix(hue, WHITE, 0.6), d: mix(hue, '#000000', 0.3) }
  sprite(cv, f.x + WYVERN_DX, f.y + 1, f.face, art, keys, c => (flash ? WHITE : c))
}

/** The fire cone ahead of the jaws, `len` columns: a core along the snout's row, edges over the head's and the
 * jaw's rows (fire under the snout joins it to the jaw, so it stays one shape with the head in every cell row);
 * core, edges and tip trade colours every frame; the lower edge grows in a column behind the rest. */
function cone(cv: Canvas, f: Fly, y: number, len: number, t: number): void {
  const odd = mod(t, 2) === 1
  if (len > 0) plot(cv, f.face > 0 ? f.x + DRAGON_W - 1 : f.x, y + 3, FLAME)
  for (let i = 0; i < len; i++) {
    const x = f.face > 0 ? f.x + DRAGON_W + i : f.x - 1 - i
    plot(cv, x, y + 2, i === 3 ? (odd ? EMBER : FLAME) : (i === 0) === odd ? FLAME : PALE)
    plot(cv, x, y + 1, i === 0 ? FLAME : odd ? EMBER : DEEP_EMBER)
    if (i < Math.min(3, len - 1)) plot(cv, x, y + 3, i === 0 ? FLAME : odd ? EMBER : DEEP_EMBER)
  }
}

/** The wall along the bottom: merlons on even columns over a coursed base, both cell row 3; moonlight glints
 * along the merlons, a merlon every two frames. */
function wall(cv: Canvas, t: number): void {
  const glint = mod(t >> 1, cv.w + 12) - 6
  for (let x = 0; x < cv.w; x++) {
    if (mod(x, 2) === 0) plot(cv, x, 6, Math.abs(x - glint) <= 1 ? CRATER : STONE_TOP)
    plot(cv, x, 7, mod(x, 4) === 3 ? STONE_DARK : STONE)
  }
}

/** The keep: merlons, two lamplit windows (flickering on fourteen frames), a gate, a brazier in its middle crenel
 * whose flame flickers (flaring a pixel higher, gold and white, `flare` frames into an ask). */
function keep(cv: Canvas, t: number, flare: number): void {
  for (let i = 0; i < KEEP_W; i++) {
    if (mod(i, 2) === 0) plot(cv, KEEP_X + i, 4, KEEP_TOP)
    for (let y = 5; y < 8; y++) plot(cv, KEEP_X + i, y, i >= 2 && i <= 4 && y >= 6 ? GATE : KEEP)
  }
  for (const dx of [1, 5]) plot(cv, KEEP_X + dx, 5, mod(t + 5 * dx, 14) < 2 ? '#f4a261' : LAMP)
  const mid = KEEP_X + 3
  plot(cv, mid, 4, BOWL)
  plot(cv, mid, 3, frame([GOLD, EMBER, FLAME, EMBER], t >> 1))
  if (flare >= 1) plot(cv, mid, 2, flare >= 3 && mod(t, 4) < 2 ? WHITE : FLAME)
}

/** Embers off the brazier: two streams, an ember every twelve frames (a few skipped), rising a pixel and drifting
 * right a cell every other frame until they burn out. */
function embers(cv: Canvas, t: number): void {
  for (const off of [0, 6]) {
    const e = mod(t + off, 12)
    if (e >= 7 || noise(Math.floor((t + off) / 12) * 3 + off) < 0.2) continue
    plot(cv, KEEP_X + 3 + (e >> 1), e < 3 ? 2 : e < 5 ? 1 : 0, e < 3 ? FLAME : e < 5 ? EMBER : DEEP_EMBER)
  }
}

/** Clouds drifting left a cell every four frames over the zone, hidden in the flyers' columns (`holes`) and the
 * column right of them: a cloud slides out on a flyer's left touching it, and never touches its right side. */
function clouds(cv: Canvas, t: number, holes: readonly (readonly [number, number])[]): void {
  const span = cv.w - ZONE_X + 8
  const n = Math.max(1, Math.floor(span / 30))
  for (let i = 0; i < n; i++) {
    const at = Math.floor((i * span) / n + noise(i + 11) * Math.max(0, span / n - 14))
    const x0 = ZONE_X - 6 + mod(at - (t >> 2), span)
    ;['.CCCC.', 'CCCCCC'].forEach((row, j) => [...row].forEach((k, c) => {
      const x = x0 + c
      const hid = holes.some(([l, r]) => x >= l && x <= r + 1)
      if (k === 'C' && x >= ZONE_X && !hid) plot(cv, x, j, j ? CLOUD : CLOUD_TOP)
    }))
  }
}

/** A tower per task along the wall (floor-scaled, spread evenly): merlons, a window lit when done, the newest
 * brightening through white to gold; a lit one flickers on twelve frames, and twinkles on a passed test. */
function towers(cv: Canvas, s: Signals, t: number, pass: boolean): void {
  const span = cv.w - 3 - ZONE_X
  const count = Math.min(s.total, MAX_TOWERS, Math.max(0, Math.floor(span / 4)))
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  for (let k = 0; k < count; k++) {
    const x = ZONE_X + Math.floor(((k + 0.5) * span) / count) - 1
    for (let c = 0; c < 3; c++) {
      if (c !== 1) plot(cv, x + c, 4, STONE_TOP)
      for (let y = 5; y < 8; y++) plot(cv, x + c, y, TOWER)
    }
    let win = k < lit ? (mod(t + 5 * k, 12) < 2 ? EMBER : GOLD) : WINDOW_OFF
    if (k === lit - 1 && s.doneAge < BRIGHT && lit > litOf(s.done - 1)) {
      win = s.doneAge < 4 ? mix(WINDOW_OFF, WHITE, (s.doneAge + 1) / 4) : mix(WHITE, GOLD, (s.doneAge - 3) / 5)
    } else if (k < lit && pass) win = mod(t + k, 2) === 0 ? WHITE : GOLD
    plot(cv, x + 1, 5, win)
  }
}

/** The sign: the news first, else the act, a dot while the act changes (its tail dot blinks every frame). */
function sign(s: Signals, t: number, news: 'fail' | 'pass' | 'commit' | undefined): [string, string] {
  if (news) return news === 'fail' ? ['×', '#ff6b6b'] : [news === 'pass' ? frame(['★', '☆'], t >> 1) : '✓', FLAME]
  if (Math.min(s.actAge, s.toolAge) < CHANGE) return ['·', PALE]
  if (s.act === 'tool') return [TOOL_SIGN[s.tool ?? 'other'], TOOL_INK[s.tool ?? 'other']]
  if (s.act === 'ask') return ['?', LAMP]
  if (s.act === 'say') return [frame(['♪', '♫'], t >> 2), '#ff758f']
  return s.act === 'think' ? ['◌', PALE] : [frame(['z', 'Z'], t >> 2), '#8d99ae']
}

export function dragonScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const g = geoOf(w)
  const fail = s.news === 'testFail' && s.newsAge < HIT + DIP.length ? s.newsAge : -1
  const pass = s.news === 'testPass' && s.newsAge < PASS
  const ca = s.news === 'commit' && s.newsAge < BACK ? s.newsAge : -1
  // On a commit it fades off its path, onto the keep, roars, and back the same way.
  const onKeep = ca >= OFF && ca < LEAVE
  const roaring = ca >= ON && ca < ROAR
  const blast = roaring ? Math.min(ca - ON + 1, ROAR - ca, ROAR_LEN) : 0
  // How much of it shows: fading out and in over four frames at each move (k: 0.2 to 0.8), else whole.
  const k = ca < 0 || (ca >= ON && ca < ROAR) ? 1 : ca < OFF ? (OFF - ca) / 5 : ca < ON ? (ca - OFF + 1) / 5
    : ca < LEAVE ? (LEAVE - ca) / 5 : (ca - LEAVE + 1) / 5
  // Fading off its path it holds the pose it had as the commit began (`t - newsAge`); back on it, the live one.
  const f = fly(ca >= 0 && ca < OFF ? t - ca : t, g)
  // Dipping, it keeps the height it was hit at (its path's own drop held off), so it moves a cell a frame at most.
  const dipping = fail >= HIT && fail < HIT + DIP.length
  const top = dipping ? fly(t - fail + HIT, g).y + DIP[fail - HIT]! : f.y
  // Its props belong to the act, held off through a reaction and around each turn (so none swaps sides).
  const free = ca < 0 && fail < 0
  const bash = free && s.act === 'tool' && s.tool === 'bash'
  // The cone stops short of the keep and the moon (its tip held there as the dragon nears them).
  const room = f.face > 0 ? w - 8 - (f.x + DRAGON_W - 1) : f.x - (KEEP_X + KEEP_W + 2)
  const len = bash ? Math.max(0, Math.min(grown(t, g, Math.min(s.actAge + 1, f.since - 1)), f.until - 2, room)) : 0
  const spark = free && s.act === 'tool' && s.tool !== 'bash' && s.actAge >= 2
  // The wyverns a fifth of a loop apart behind it; the columns clouds hide in (the dragon's with its cone, each
  // wyvern's, the roar's).
  const holes: [number, number][] = []
  const n = Math.min(s.agents, MAX_WYVERNS)
  const flock = Array.from({ length: n }, (_, i) => fly(t - Math.round(((i + 1) * g.p) / 5), g))
  for (const v of flock) holes.push([v.x + WYVERN_DX, v.x + WYVERN_DX + WYVERN_W - 1])
  if (onKeep) holes.push([KEEP_X - 1, KEEP_X + DRAGON_W - 2 + blast])
  else holes.push([f.x - (f.face < 0 ? len : 0), f.x + DRAGON_W - 1 + (f.face > 0 ? len : 0)])

  // Layer 1: the moon and the clouds; layer 2: the castle and the brazier's embers.
  draw(cv, w - 5, 0, ['.MM.', mod(t, 16) < 8 ? 'MCMM' : 'MMCM', '.MM.'], { M: MOON, C: CRATER })   // a shadow drifting
  clouds(cv, t, holes)
  wall(cv, t)
  towers(cv, s, t, pass)
  keep(cv, t, s.act === 'ask' ? s.actAge : 0)
  embers(cv, t)
  // Layer 3: the wyverns trailing it, the newest greeting as it joins.
  flock.forEach((v, i) => {
    const greet = i === n - 1 && s.agentsAge < GREET && mod(s.agentsAge, 2) === 0
    wyvern(cv, v, mod(t + i, 4) < 2, HUES[i]!, greet)
  })
  // Layer 4: the dragon, white as the arrow strikes, its wings flashing on a passed test, faded on a commit.
  const struck = fail >= HIT && fail < HIT + 2
  const ink: Ink = c => {
    const lit = struck ? WHITE : pass && c === GOLD && mod(t, 2) === 0 ? WHITE : c
    return k >= 1 ? lit : mix(FADE_TO, lit, k)
  }
  if (onKeep) {
    dragon(cv, KEEP_X - 1, 0, 1, roaring && mod(t, 4) >= 2 ? 1 : 0, ink, roaring)
    // The roar: a blast out of its jaws a column a frame, rings running out along it, drawn back at the end.
    for (let r = 0; r < blast; r++) {
      const ring = RING_INK[mod(r - (ca - ON), RING_INK.length)]!
      for (const y of [1, 2]) plot(cv, KEEP_X - 1 + DRAGON_W + r, y, ring)
    }
  } else {
    const open = free && s.act === 'say' && s.actAge >= 2 && mod(t, 6) < 3
    const nose = spark ? (mod(t, 4) < 2 ? TOOL_INK[s.tool ?? 'other'] : WHITE) : undefined
    dragon(cv, f.x, top, f.face, ca >= 0 && ca < OFF ? t - ca : t, ink, open, nose)
    if (len > 0) cone(cv, f, f.y, len, t)
  }

  // testFail: an arrow up from the wall to where it will be at HIT, then a puff there (anchored at the
  // reaction's start), rising and spreading, over the dragon.
  if (fail >= 0) {
    const at = fly(t - fail + HIT, g)
    const [hx, hy] = [at.x + 5, at.y + 3]
    if (fail < HIT) {
      plot(cv, hx - (HIT - fail), hy + HIT - fail, STEEL)
      plot(cv, hx - (HIT - fail) - 1, hy + HIT - fail + 1, SHAFT)
    } else if (fail < HIT + PUFF) {
      const [q, smoke] = [fail - HIT, PUFF_INK[Math.min(2, (fail - HIT) >> 2)]!]
      const blob = q < 2 ? [[0, 0], [0, -1]] : q < 8 ? [[-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]]
        : [[-1, 0], [1, 0], [0, -1]]
      for (const [px, py] of blob) plot(cv, hx + px!, Math.max(0, hy - (q >> 2) + py!), smoke)
    }
  }

  const grid = cells(cv)
  const news = fail >= 0 ? 'fail' : pass ? 'pass' : ca >= 0 ? 'commit' : undefined
  const [text, c] = sign(s, t, news)
  put(grid, SIGN_X, 0, text + (mod(t, 2) === 0 ? '·' : ''), { c, b: true })
  return grid
}

/** A hatchling: a big round head (two gold horn nubs, pale eyes, a pink snout, a jaw that works as it talks) on a
 * small body with a gold belly, a gold wing nub on its back, stubby feet and a tail flicking up behind. */
export const PET: PetArt = {
  body: ['......K...K.', '..N...HHHHH.', '.NNBBHHHHHHS', 'T.BGGBHHHHHS', '.TBB.BB.....'],
  step: ['......K...K.', '..N...HHHHH.', '.NNBBHHHHHHS', 'T.BGGBHHHHHS', '.T.BB..BB...'],
  colors: { K: LAMP, N: GOLD, B: RED, H: RED, G: GOLD, S: '#ff758f', T: '#c1121f' },
  eyes: [7, 9], eyeRow: 1, eye: PALE, lid: RED,
  mouth: [9, 3], blush: '#ff758f', spark: EMBER,
}

export const DRAGON: Theme = {
  name: 'dragon',
  rows: SCENE_ROWS,
  color: RED,
  accent: GOLD,
  sprite: {
    think: ['⋗·  ', '⋗ · ', '⋗  ·', '⋗ · '], tool: ['⋗≋  ', '⋗ ≋ ', '⋗  ≋', '⋗ ≋ '],
    say: ['⋗ ♪', '⋗ ♫'], wait: ['⋗ .', '⋗ ..', '⋗ ...'],
  },
  happy: '⋗ ✦', sad: '⋗ …', dead: '✗', sleep: '⋗ zZ',
  confetti: ['✦', '*', '·', '˚'],
  palette: [RED, GOLD, EMBER, LAMP],
  scene: dragonScene,
  pet: PET,
}
