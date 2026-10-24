// Theme: mage. Its scene, its words and its pet.
//
// The scene: a wizard (#9d4edd) under the stars at a spell circle, its runes a dotted ring orbiting the floor a
// step a frame in every act, his hat's tip swaying on 16 frames. A sign over his staff reads the act; the runes
// take its colour over four frames (gold on ask, mint on say, grey on wait); a tool charges his orb and the runes
// in its colour, each rune trailing a spark (grown on actAge), and each call shoots a bolt right from the orb a
// cell a frame, fading at the circle's end (bash: three). A scroll per task hangs at the right (floor-scaled),
// `done` of them burnt to the rod, the newest burning through four stages; a familiar per agent bobs on six
// frames in its slot, flashing as it comes. testFail: sparks drip down the staff and his hat scorches, easing
// back by 28; testPass: the runes flash; commit: a dragon's silhouette rises out of the circle, hovers, sinks.
// Motion rules: a bolt's wake stays joined to the orb and the sparks to the staff, so neither parts from them.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Canvas, Grid } from '../cells'
import { SCENE_ROWS } from '../draw'
import type { PetArt } from '../pets'
import type { Act, Signals, Theme, ToolKind } from '../themes'

/** The mage facing right, 10×8: his hat (tip, star, brim), face, beard, robe; the staff (S) in his hand, the orb
 * on it (O, core C). The hat's tip is drawn apart, as it sways. */
const MAGE_ART = ['..........', '..hhh.....', '.hhshh..O.', 'bbbbbb.OCO', '..FFE..HS.', '.RWWWRR.S.', '.RRWRRR.S.',
  'RRRRRRR.S.']
/** The hat tip's lean by `t` over 16 frames. */
const SWAY = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, 0]
/** A familiar, 4×3: an owl (eyes E) or a wisp (core E), by slot. */
const FAMILIAR = [['bbbb', 'bEEb', '.bb.'], ['.bb.', 'bEEb', '.b..']]
const FAMILIAR_INK = [['#a47148', '#ffd60a'], ['#80ffdb', '#ffffff'], ['#ced4da', '#ffb703'], ['#ff8fab', '#fff3b0']]
/** The summoned dragon's silhouette, 9×6, front on: wing tips and a horn, its head between them, eyes (G). */
const DRAGON = ['D...D...D', 'DD.DDD.DD', 'DDDGDGDDD', '.DDDDDDD.', '..DDDDD..', '.DD...DD.']
/** A scroll, 2×3, by burn stage: whole, flame at its foot, flame higher, an ember under the rod, the rod. */
const SCROLL = [['oo', 'pr', 'pp'], ['oo', 'pp', 'fy'], ['oo', 'yf', '..'], ['oo', 'e.', '..'], ['cc', '..', '..']]

/** Layout: the mage's box, the gap to the circle, scroll pitch, scrolls and familiars at most. */
const [MAGE_W, CIRCLE_GAP, PITCH, MAX_SCROLLS, MAX_FAMILIARS] = [10, 11, 3, 12, 4]
const RADII = [10, 7, 4]
/** Pixel rows: the bolt's lane, the orbit's back arc (its front three lower), familiars' top, the dragon's top. */
const [LANE_Y, BACK_Y, FAMILIAR_Y, DRAGON_TOP] = [3, 4, 4, 2]
/** Frames: an act's change; a burn; a greeting; between bash's bolts; a bolt's fade at the lane's end. */
const [CHANGE, BURN, GREET, BOLT_GAP, BOLT_FADE] = [4, 8, 8, 4, 3]
/** testFail: sparks leave the orb every other frame until SPARKS; the hat's scorch eases in, holds, eases out. */
const [SPARKS, SCORCH_IN, SCORCH_HOLD, SCORCH_END] = [14, 4, 20, 28]
/** testPass's flash; commit: the dragon rises a pixel a frame to DRAGON_TOP, hovers, sinks from SINK, gone. */
const [PASS, SINK, SUMMON_END] = [12, 21, 28]

const [HAT, BRIM, STAR, SKIN, EYE, BEARD, ROBE, STAFF] =
  ['#9d4edd', '#c77dff', '#ffd60a', '#ffddd2', '#3d405b', '#e9ecef', '#7b2cbf', '#9c6644']
const [ORB, CORE, WHITE, DIM, SCORCH, SMOKE] = ['#c77dff', '#f3e8ff', '#ffffff', '#1a1a1e', '#403d39', '#6c757d']
const [SHADE, DRAGON_EYE, ROD, PAPER, RUNE_MARK, FLAME, FLAME_TIP, EMBER, CHAR] =
  ['#6a4c93', '#ff5d8f', '#b08968', '#f1e3c8', '#9d4edd', '#fb8500', '#ffd60a', '#e85d04', '#7f6a5d']
const STAR_INK = ['#e0aaff', '#fff3b0', '#caf0f8']
const SPARK_INK = ['#ffd60a', '#fb8500', '#e85d04', '#9a8c98']
const RUNE_INK: Record<Exclude<Act, 'tool'>, string> = { think: '#c77dff', ask: '#ffd166', say: '#80ffdb',
  wait: '#8d99ae' }
const TOOL_INK: Record<ToolKind, string> = { bash: '#ffd60a', edit: '#ff9e64', read: '#e0af68', search: '#7dcfff',
  agent: '#bb9af7', web: '#7aa2f7', other: '#ff5d8f' }
const TOOL_SIGN: Record<ToolKind, string> = { bash: '$', edit: '✎', read: '¶', search: '⌕', agent: 'ᗣ', web: '◎',
  other: '✦' }

/** `a` blended toward `b` by `k` (0..1). */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

/** Where everything stands at width `w`: the mage's left column, the circle (centre and radius, one of RADII, so
 * the orbit's points divide by six; 0 when none fits), the end of the bolt's lane, the scrolls and familiar slots. */
function layout(w: number) {
  const x0 = 1 + Math.max(0, Math.floor((w - 48) / 8))
  const cl = x0 + CIRCLE_GAP
  const rx = RADII.find(r => cl + 2 * r <= w - 22) ?? 0
  const end = rx > 0 ? cl + 2 * rx : x0 + MAGE_W - 1
  const scrollX = end + 3
  const scrolls = Math.max(0, Math.min(MAX_SCROLLS, Math.floor((w - scrollX) / PITCH)))
  const slots = [0, 1, 2, 3].map(i => w - 5 - 5 * i).filter(x => x >= (rx > 0 ? end + 2 : x0 + MAGE_W + 1))
  return { x0, cx: cl + rx, rx, end, scrollX, scrolls, slots }
}

/** The orbit round the circle: its back arc leftward, the left end down two rows, the front arc rightward, the
 * right end up two rows; 4·rx + 2 points a step apart. */
function orbit(cx: number, rx: number): (readonly [number, number])[] {
  const path: (readonly [number, number])[] = []
  for (let x = cx + rx - 1; x > cx - rx; x--) path.push([x, BACK_Y])
  path.push([cx - rx, BACK_Y + 1], [cx - rx, BACK_Y + 2])
  for (let x = cx - rx + 1; x < cx + rx; x++) path.push([x, BACK_Y + 3])
  path.push([cx + rx, BACK_Y + 2], [cx + rx, BACK_Y + 1])
  return path
}

/** The circle: a dot on every other point and a rune on every sixth, all a step a frame; the back half dimmer,
 * each rune glinting every fourth frame; a tool's spark filling the gap behind each rune. `front` draws the front
 * half (the dragon rises between the two). */
function circle(cv: Canvas, t: number, cx: number, rx: number, ink: string, trail: string | null, front: boolean) {
  const path = orbit(cx, rx)
  for (let i = 0; i < path.length / 2; i++) {
    const p = 2 * i + t
    const [x, y] = path[mod(p, path.length)]!
    if (y > BACK_Y + 1 !== front) continue
    const back = y > BACK_Y + 1 ? 0 : 0.3
    if (i % 3) {
      plot(cv, x, y, mix(ink, DIM, 0.6 + back / 2))
      continue
    }
    if (trail) plot(cv, ...path[mod(p - 1, path.length)]!, trail)
    plot(cv, x, y, mix(mod(t + i, 4) === 0 ? mix(ink, WHITE, 0.5) : ink, DIM, back))
  }
}

/** The mage at `x`: the hat's tip leaning `lean`, the hat scorched by `scorch` (0..1), the orb and its core in
 * the colours given, his eye shut while he waits, his mouth working while he talks. */
function mage(cv: Canvas, x: number, lean: number, scorch: number, orb: string, core: string, s: Signals, t: number) {
  const burnt = (c: string) => mix(c, SCORCH, scorch)
  const ink: Record<string, string> = { h: burnt(HAT), b: burnt(BRIM), s: burnt(STAR), F: SKIN, H: SKIN, W: BEARD,
    R: ROBE, S: STAFF, O: orb, C: core, E: s.act === 'wait' ? SKIN : EYE }
  draw(cv, x, 0, MAGE_ART, ink)
  plot(cv, x + 3 + lean, 0, ink.h!)
  if (s.act === 'say' && mod(t, 4) < 2) plot(cv, x + 4, 5, '#e5383b')
}

/** The bolts of one call `a` frames old (bash: three, BOLT_GAP apart), along the lane from `from` to `to`: a white
 * head and a coloured one behind it, a wake back to the orb dimming with distance, fading at the lane's end. */
function bolts(cv: Canvas, from: number, to: number, a: number, n: number, ink: string): void {
  const reach = to - from + 1
  const heads: [number, number][] = []
  for (let j = 0; j < n; j++) {
    const b = a - j * BOLT_GAP
    if (b >= 0 && b < reach + BOLT_FADE) heads.push([from + Math.min(b, reach - 1), Math.max(0, b - reach + 1)])
  }
  if (heads.length === 0) return
  const far = Math.max(...heads.map(([x]) => x))
  for (let x = from; x <= far; x++) {
    const d = Math.min(...heads.map(([h]) => (x <= h ? h - x : 99)))
    const fade = Math.min(...heads.filter(([h]) => x <= h).map(([, f]) => f)) / BOLT_FADE
    const c = d === 0 ? WHITE : d === 1 ? ink : mix(ink, '#4a4e69', Math.min(1, (d - 1) / 5))
    plot(cv, x, LANE_Y, mix(c, '#4a4e69', fade))
  }
}

/** testFail's sparks: two from the orb every other frame, falling a cell a frame down the column beside the
 * staff (joined to it, so none parts from it), dimming as they fall. */
function fizzle(cv: Canvas, staff: number, age: number): void {
  for (let b = 0; b <= age && b < SPARKS; b += 2) {
    const k = age - b
    if (k > 2) continue
    plot(cv, staff + 1, LANE_Y + 2 * k, SPARK_INK[k]!)
    if (k > 0) plot(cv, staff + 1, LANE_Y + 2 * k - 1, SPARK_INK[k + 1]!)
  }
}

/** A scroll per task from `x` at a fixed pitch (floor-scaled), `done` of them burnt to the rod, the newest
 * burning through its stages over BURN frames; a violet rune glints across the whole ones on 16 frames. */
function scrolls(cv: Canvas, t: number, x: number, fit: number, s: Signals): void {
  const count = Math.min(s.total, fit)
  const litOf = (d: number) => (s.total > count ? Math.floor((d * count) / s.total) : Math.min(d, count))
  const lit = litOf(s.done)
  const burning = s.doneAge < BURN && lit > litOf(s.done - 1)
  const flick = mod(t, 2) === 0
  for (let k = 0; k < count; k++) {
    const stage = k >= lit ? 0 : k === lit - 1 && burning ? 1 + (s.doneAge >> 1) : 4
    const glint = stage === 0 && mod(t, 16) === mod(k * 5, 16)
    draw(cv, x + PITCH * k, 0, SCROLL[stage]!, { o: ROD, p: PAPER, r: glint ? WHITE : RUNE_MARK, c: CHAR,
      f: flick ? FLAME : FLAME_TIP, y: flick ? FLAME_TIP : FLAME, e: EMBER })
  }
}

/** The sign over the orb: the news first, else the act, a dot while the act changes. */
function sign(s: Signals, t: number, age: number, news: { fail: boolean; pass: boolean; commit: boolean }) {
  if (news.fail) return { text: '×', c: '#e5383b' }
  if (news.pass) return { text: frame(['★', '☆'], t >> 1), c: STAR }
  if (news.commit) return { text: '✓', c: STAR }
  if (age < CHANGE) return { text: '·', c: BRIM }
  if (s.act === 'tool') return { text: TOOL_SIGN[s.tool ?? 'other'], c: TOOL_INK[s.tool ?? 'other'] }
  if (s.act === 'ask') return { text: '?', c: RUNE_INK.ask }
  if (s.act === 'say') return { text: frame(['♪', '♫'], t >> 2), c: RUNE_INK.say }
  if (s.act === 'think') return { text: frame(['·', '∘'], t >> 3), c: BRIM }
  return { text: frame(['z', 'Z'], t >> 2), c: RUNE_INK.wait }
}

export function mageScene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const { x0, cx, rx, end, scrollX, scrolls: fit, slots } = layout(w)
  const staff = x0 + 8
  const fail = s.news === 'testFail' && s.newsAge < SCORCH_END
  const pass = s.news === 'testPass' && s.newsAge < PASS
  const commit = s.news === 'commit' && s.newsAge < SUMMON_END && rx > 0
  // The act's colour, blended in over CHANGE frames; a tool's grows its runes' sparks and charges the orb.
  const isTool = s.act === 'tool'
  const kind = s.tool ?? 'other'
  const blend = Math.min(1, (s.actAge + 1) / CHANGE)
  let ink = mix(RUNE_INK.think, isTool ? TOOL_INK[kind] : RUNE_INK[s.act as Exclude<Act, 'tool'>], blend)
  if (pass) ink = mod(s.newsAge, 4) < 2 ? WHITE : STAR
  const trail = isTool && s.actAge >= 2 ? mix(TOOL_INK[kind], DIM, 0.45) : null

  // Layer 1: the scrolls; the circle's back runes, the dragon rising between them and the front ones.
  scrolls(cv, t, scrollX, fit, s)
  if (rx > 0) circle(cv, t, cx, rx, ink, trail, false)
  if (commit) {
    const a = s.newsAge
    const top = a < SINK ? Math.max(DRAGON_TOP, 8 - a) : DRAGON_TOP + a - SINK
    const body = mix(a >= SINK ? mix(SHADE, DIM, 0.3) : SHADE, '#8e6cb8', a >= 8 && a < SINK && mod(a, 4) < 2 ? 1 : 0)
    draw(cv, cx - 4, top, DRAGON, { D: body, G: DRAGON_EYE })
  }
  if (rx > 0) circle(cv, t, cx, rx, ink, trail, true)

  // Layer 2: the mage, his hat swaying; the orb charged by a tool (or the act's colour), dark as a spell fizzles.
  const a = s.newsAge
  const scorch = !fail ? 0 : a < SCORCH_IN ? (a + 1) / SCORCH_IN : a < SCORCH_HOLD ? 1
    : (SCORCH_END - a) / (SCORCH_END - SCORCH_HOLD)
  // The fizzle smokes the orb for ten frames over whatever charge it holds, so a tool's tint stays on it.
  const smoke = fail && a < 10 ? 0.6 : 0
  const orb = mix(isTool ? mix(ORB, TOOL_INK[kind], blend) : ink, SMOKE, smoke)
  const core = mix(isTool && mod(t, 4) < 2 ? WHITE : CORE, SMOKE, smoke)
  mage(cv, x0, SWAY[mod(t, 16)]!, scorch, orb, core, s, t)
  if (fail) fizzle(cv, staff, a)
  // A bolt per call, keyed on the call (min'd with actAge, so the first call fires even with the kind unchanged).
  const call = isTool ? Math.min(s.actAge, s.toolAge) : 999
  if (rx > 0) bolts(cv, staff + 2, end, call, kind === 'bash' ? 3 : 1, TOOL_INK[kind])

  // Layer 3: the familiars in their slots from the right, bobbing; the newest flashes as it comes.
  const count = Math.min(s.agents, MAX_FAMILIARS, slots.length)
  for (let i = 0; i < count; i++) {
    const [body, eye] = FAMILIAR_INK[i]!
    const flash = i === count - 1 && s.agentsAge < GREET && mod(s.agentsAge, 2) === 0
    const y = FAMILIAR_Y + (mod(t + 2 * i, 6) < 3 ? 0 : 1)
    draw(cv, slots[i]!, y, FAMILIAR[i % 2]!, { b: flash ? WHITE : body!, E: flash ? STAR : eye! })
  }

  // Glyphs: the stars where nothing moves near them, twinkling; the sign over the orb.
  const g = cells(cv)
  const busy = (x: number, r: number) => (x >= x0 - 1 && x <= x0 + MAGE_W) || (r === 1 && x <= end + 1) ||
    (fit > 0 && x >= scrollX - 1 && x <= scrollX + PITCH * Math.min(fit, MAX_SCROLLS)) || g[r]![x]!.ch !== ' '
  for (let x = 0; x < w; x++) {
    if (noise(x * 3.1 + 7) > 0.2) continue
    const r = noise(x + 11) < 0.6 ? 0 : 1
    if (busy(x, r)) continue
    const tw = mod(t + Math.floor(noise(x + 5) * 16), 16)
    put(g, x, r, tw < 2 ? '✦' : tw < 4 ? '⋆' : '·', { c: STAR_INK[x % 3], d: tw >= 4 })
  }
  const { text, c } = sign(s, t, Math.min(s.actAge, s.toolAge), { fail, pass, commit })
  put(g, x0 + 7, 0, text, { c, b: true })
  return g
}

/** A familiar cat: pointed ears, glowing eyes, a star at its collar, its tail curled up behind. */
export const PET: PetArt = {
  body: ['A...A.......', 'AAAAA....TT.', 'AAAAA...T..T', 'AAYAAAAAAT..', '.A.A..A.A...'],
  step: ['A...A.......', 'AAAAA....TT.', 'AAAAA...T..T', 'AAYAAAAAAT..', 'A.A..A.A....'],
  colors: { A: HAT, T: HAT, Y: STAR },
  eyes: [1, 3],
  eyeRow: 1,
  eye: '#80ffdb',
  lid: HAT,
  blush: '#ff8fab',
  spark: BRIM,
}

export const MAGE: Theme = {
  name: 'mage',
  rows: SCENE_ROWS,
  color: HAT,
  accent: STAR,
  sprite: {
    think: ['^·  ', '^ · ', '^  ·', '^ · '],
    tool: ['^*  ', '^-* ', '^ -*', '^  *'],
    say: ['^ ♪', '^ ♫'],
    wait: ['^ .', '^ ..', '^ ...'],
  },
  happy: '^ ✦',
  sad: '^ …',
  dead: '✕',
  sleep: '^ zZ',
  confetti: ['✦', '✧', '⋆', '·'],
  palette: [HAT, STAR, BRIM, RUNE_INK.say],
  scene: mageScene,
  pet: PET,
}
