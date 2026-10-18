# Duo Scenery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The duo's left half (the cat's track) shows one of four pixel scenes — sky, city, ocean, space — rotating to the next each turn, with the cat kept as a `left = cat` option.

**Architecture:** A new pure module `cat-clawd-duo/hooks/scenery/` draws a scene into an 18 px canvas and packs it into the same base64 Raster cells the cat uses. `hooks/cat.tsx` gets a `left` option; when it is `scenes`, its existing 90 ms timer and its Spinner slot draw `sceneryCells(...)` instead of `sceneCells(cat, ...)`, and `prompt.submit` advances the scene. Clawd's files are not touched.

**Tech Stack:** TypeScript/TSX Claude Code plugin hooks; tests with `claude-code/testing` run by `claude plugin test` (bun underneath); scripts run with `bun`.

**Spec:** `docs/superpowers/specs/2026-10-19-duo-scenery-design.md`

## Global Constraints

- All paths are relative to `~/code/claudebro/claude-mods` (the claude-mods repo, branch `main`). Check `git branch --show-current` prints `main` before each commit.
- The scenery module is pure: no `$`, no clock, no I/O, no network, no `Math.random` inside `hooks/scenery/`. Randomness comes only from `Moment.seed` through `rnd`/`pick`.
- Scene canvas: `PH = 18` px tall = `ROWS = 9` Raster rows (the cat's `H`/`ROWS` from `hooks/rig.ts`). Cells are packed exactly like the cat's `encodeCells`: triplets `[codePoint, fg, bg]`, `0x2580` (▀, top fg, bottom bg), `0x2584` (▄, bottom fg), `0x20` blank, `DEF = 0x01000000` for the terminal's own colour, then base64 of the Uint32Array's bytes.
- Rotation order: `sky → city → ocean → space → sky`. First scene of a session is random.
- `left` option: values `scenes` | `cat`, default `scenes`. Cat-only settings (`coat`, `animation`, `season`, `between`) are hidden in the dialog when `left = scenes`. With `scenes` the band above the prompt is left to `next(e)`.
- Do not edit anything under `cat-clawd-duo/hooks/clawd/`. Importing from `hooks/clawd/acts.ts` is fine.
- The cat's existing golden fingerprints in `tests/golden.ts` must stay byte-identical.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push claude-mods only in Task 10.
- Never delete files (move to `~/_attic/2026-10-19/`); `rm -rf` outside /tmp is blocked by a hook.

**User decisions (already made):**
- Route: new duo characters — the new thing replaces the cat on the left; Clawd stays on the right.
- Content: all four scenes (sky, city, ocean, space), rotating each turn.
- Weather and time of day are random per turn; no clock, no network.
- The cat stays available as an option (`left = cat`).
- Approach A: `hooks/scenery/` module plugged into the cat's timer and Spinner slot.
- Default `left = scenes`.
- Testing: scene unit tests, golden fingerprints, ANSI preview for Jeremy before release.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `cat-clawd-duo/hooks/scenery/pixels.ts` | Canvas, drawing helpers, `State`/`Moment`/`Scene` types, `toCells` packing |
| Create `cat-clawd-duo/hooks/scenery/sky.ts` | Sky scene |
| Create `cat-clawd-duo/hooks/scenery/city.ts` | City scene |
| Create `cat-clawd-duo/hooks/scenery/ocean.ts` | Ocean scene |
| Create `cat-clawd-duo/hooks/scenery/space.ts` | Space scene |
| Create `cat-clawd-duo/hooks/scenery/index.ts` | `SCENES`, `nextScene`, `PACE`, `stateOf`, `sceneryCells` |
| Create `cat-clawd-duo/tests/scenery.test.ts` | Pure tests for all of the above |
| Modify `cat-clawd-duo/hooks/cat.tsx` | `left` option, scene state, timer/Spinner/band/dialog/command switch |
| Modify `cat-clawd-duo/.claude-plugin/plugin.json` | `left` userConfig, description, version |
| Modify `cat-clawd-duo/tests/cat.test.tsx` | Existing cat tests pin `left: 'cat'`; new left-half tests |
| Modify `cat-clawd-duo/tests/scenes.ts`, `tests/golden.ts` | Scenery golden scenes |
| Create `cat-clawd-duo/scripts/fingerprints.ts` | Regenerates `tests/golden.ts` |
| Create `cat-clawd-duo/scripts/preview-scenery.ts` | ANSI preview of the scenes in a terminal |

Test command used throughout (from `~/code/claudebro/claude-mods`):

```bash
claude plugin test cat-clawd-duo 2>&1 | tail -15
```

Baseline before Task 1: `106 pass, 0 fail`.

---

### Task 1: Scenery pixels

**Goal:** `hooks/scenery/pixels.ts` gives scenes an 18 px canvas, drawing helpers and packing to Raster cells identical in format to the cat's.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/pixels.ts`
- Create: `cat-clawd-duo/tests/scenery.test.ts`

**Acceptance Criteria:**
- [ ] `canvas(w).px.length === w * 18`, filled with `DEF`
- [ ] `put` ignores out-of-range coordinates and rounds fractional ones
- [ ] `toCells` decodes to `w * 9 * 3` words; blank → `[0x20, DEF, DEF]`, top only → `[0x2580, top, DEF]`, bottom only → `[0x2584, bottom, DEF]`, both → `[0x2580, top, bottom]`
- [ ] `sceneSuite(name, scene)` helper exists in the test file for later tasks

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `0 fail`, pass count up by 4

**Steps:**

- [ ] **Step 1: Write the failing test** — create `cat-clawd-duo/tests/scenery.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'

import { canvas, DEF, PH, put, ROWS, toCells, type Moment, type Scene, type State } from '../hooks/scenery/pixels'
import { H } from '../hooks/rig'

// A frame's Raster cells, as words: [codePoint, fg, bg] per cell.
const words = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), ch => ch.charCodeAt(0)).buffer)
const draw = (scene: Scene, columns: number, m: Moment) => {
  const c = canvas(columns)
  scene(c, m)
  return toCells(c)
}
const at = (state: State, t = 6000, seed = 7): Moment => ({ t, dist: t * 0.008, state, seed })

// What every scene must do: fill its raster, at any width and seed, the same
// way for the same moment, and look different while a tool runs.
export function sceneSuite(name: string, scene: Scene) {
  describe(`the ${name} scene`, () => {
    test('fills every cell of its raster at any width and seed', () => {
      for (const columns of [44, 60, 90, 200]) {
        for (let seed = 0; seed < 12; seed++) {
          for (const state of ['think', 'tool', 'say'] as const) {
            const w = words(draw(scene, columns, at(state, 6000, seed)))
            expect(w.length).toBe(columns * ROWS * 3)
            for (let i = 0; i < w.length; i += 3) expect(w[i]).not.toBe(0x20)
          }
        }
      }
    })

    test('draws the same moment the same way', () => {
      expect(draw(scene, 60, at('say'))).toBe(draw(scene, 60, at('say')))
    })

    test('moves over time', () => {
      expect(draw(scene, 60, at('think', 2000))).not.toBe(draw(scene, 60, at('think', 9000)))
    })

    test('looks different while a tool runs than while Claude thinks', () => {
      expect(draw(scene, 60, at('tool'))).not.toBe(draw(scene, 60, at('think')))
    })
  })
}

describe('scenery pixels', () => {
  test('is as tall as the cat track, and starts clear', () => {
    expect(PH).toBe(H)
    expect(ROWS).toBe(H / 2)
    const c = canvas(5)
    expect(c.px.length).toBe(5 * PH)
    expect(c.px.every(p => p === DEF)).toBe(true)
  })

  test('puts pixels only inside the canvas, rounding to the nearest', () => {
    const c = canvas(4)
    put(c, -1, 0, 0xff0000)
    put(c, 4, 0, 0xff0000)
    put(c, 0, PH, 0xff0000)
    expect(c.px.every(p => p === DEF)).toBe(true)
    put(c, 1.4, 2.6, 0x00ff00)
    expect(c.px[3 * 4 + 1]).toBe(0x00ff00)
  })

  test('packs two pixels per cell as half blocks', () => {
    const c = canvas(4)
    put(c, 1, 0, 0x111111) // top only
    put(c, 2, 1, 0x222222) // bottom only
    put(c, 3, 0, 0x333333) // both
    put(c, 3, 1, 0x444444)
    const w = words(toCells(c))
    expect(w.length).toBe(4 * ROWS * 3)
    expect([...w.slice(0, 3)]).toEqual([0x20, DEF, DEF])
    expect([...w.slice(3, 6)]).toEqual([0x2580, 0x111111, DEF])
    expect([...w.slice(6, 9)]).toEqual([0x2584, 0x222222, DEF])
    expect([...w.slice(9, 12)]).toEqual([0x2580, 0x333333, 0x444444])
  })

  test('packs a whole row the same when every pixel is set', () => {
    const c = canvas(2)
    c.px.fill(0x123456)
    const w = words(toCells(c))
    for (let i = 0; i < w.length; i += 3) expect([...w.slice(i, i + 3)]).toEqual([0x2580, 0x123456, 0x123456])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery/pixels`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/pixels.ts`:

```ts
// The left half's scenes, as pixels: a canvas as tall as the cat's track
// (PH px, ROWS cells), packed into Raster cells the way the cat's track is:
// two pixels per cell as half blocks, DEF where nothing is drawn.
import { mix, rnd, wave } from '../clawd/acts'
import { H } from '../rig'

export { mix, rnd, wave }

export const PH = H
export const ROWS = H / 2
export const DEF = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

/** What Claude is doing, as a scene shows it. */
export type State = 'think' | 'tool' | 'say'

/**
 * One frame's inputs: ms since the turn began, px the layers have scrolled
 * (cat.tsx advances it at a pace that eases toward the state's), what Claude
 * is doing, and the turn's seed, which picks the scene's variant.
 */
export type Moment = { t: number; dist: number; state: State; seed: number }

export type Canvas = { W: number; px: Uint32Array }
export type Scene = (c: Canvas, m: Moment) => void

export const canvas = (W: number): Canvas => ({ W, px: new Uint32Array(W * PH).fill(DEF) })

export const mod = (n: number, m: number) => ((n % m) + m) % m

/** A variant picked by the seed: 0 to n - 1, the same all turn. */
export const pick = (seed: number, salt: number, n: number) => Math.floor(rnd(seed, salt) * n)

export function put(c: Canvas, x: number, y: number, colour: number) {
  x = Math.round(x)
  y = Math.round(y)
  if (x >= 0 && x < c.W && y >= 0 && y < PH) c.px[y * c.W + x] = colour
}

export function rect(c: Canvas, x: number, y: number, w: number, h: number, colour: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(c, x + i, y + j, colour)
}

/** Rows from `top` down to `bottom`, blended, over rows `from` to `to`. */
export function gradient(c: Canvas, top: number, bottom: number, from = 0, to = PH) {
  for (let y = from; y < to; y++) rect(c, 0, y, c.W, 1, mix(top, bottom, (y - from) / Math.max(1, to - from - 1)))
}

export function disc(c: Canvas, cx: number, cy: number, r: number, colour: number) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) put(c, cx + dx, cy + dy, colour)
}

/** Pixel art: one letter per pixel, keyed in `pal`; `.` is clear. */
export function sprite(c: Canvas, art: readonly string[], pal: Record<string, number>, x: number, y: number) {
  art.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && pal[ch] !== undefined && put(c, x + i, y + j, pal[ch]!)))
}

/** The canvas as Raster cells (base64 of [codePoint, fg, bg] words), ROWS tall. */
export function toCells(c: Canvas): string {
  const words = new Uint32Array(c.W * ROWS * 3)
  for (let row = 0; row < ROWS; row++) {
    for (let x = 0; x < c.W; x++) {
      const top = c.px[2 * row * c.W + x]!
      const bottom = c.px[(2 * row + 1) * c.W + x]!
      const at = (row * c.W + x) * 3
      if (top === DEF && bottom === DEF) words.set([0x20, DEF, DEF], at)
      else if (top === DEF) words.set([LOWER_HALF, bottom, DEF], at)
      else words.set([UPPER_HALF, top, bottom], at)
    }
  }
  const bytes = new Uint8Array(words.buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `110 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/pixels.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: scenery pixels (canvas, helpers, Raster packing)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sky scene

**Goal:** `hooks/scenery/sky.ts` draws a random time of day (day/dusk/night) and weather (clear/cloudy/rain/storm), clouds and hills scrolling with `dist`, rain heavier and lightning while a tool runs, a bird and the sun/moon glow while Claude writes.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/sky.ts`
- Modify: `cat-clawd-duo/tests/scenery.test.ts` (append one line)

**Acceptance Criteria:**
- [ ] `sceneSuite('sky', sky)` passes: fills every cell at widths 44/60/90/200 × 12 seeds × 3 states; pure; moves; tool ≠ think

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `114 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Write the failing test** — append to `cat-clawd-duo/tests/scenery.test.ts`:

```ts
import { sky } from '../hooks/scenery/sky'
sceneSuite('sky', sky)
```

(Move the `import` up with the other imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery/sky`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/sky.ts`:

```ts
// Sky: a random time of day and weather each turn, clouds and hills drifting
// at the turn's pace, rain heavier (and lightning, in a storm) while a tool
// runs, and a bird crossing while Claude writes, the sun or moon aglow.
import { disc, gradient, mix, mod, PH, pick, put, rect, rnd, sprite, wave, type Scene } from './pixels'

const TIMES = [
  { top: 0x3a7bd5, bottom: 0xbfe3ff, light: 0xfff3a0, hill: 0x4c9a4a, far: 0x7fb77e }, // day
  { top: 0x2b1b4f, bottom: 0xf08a4b, light: 0xff9e3d, hill: 0x3d4a3a, far: 0x6a5a6e }, // dusk
  { top: 0x050816, bottom: 0x1b2a4a, light: 0xe8e8f0, hill: 0x16241c, far: 0x24303f }, // night
] as const
const CLEAR = 0
const RAIN = 2
const STORM = 3
const CLOUDS = [2, 5, 7, 8]
const BIRD_UP = ['b.b', '.b.']
const BIRD_DOWN = ['...', 'bbb']

export const sky: Scene = (c, m) => {
  const timeOfDay = pick(m.seed, 1, 3)
  const time = TIMES[timeOfDay]!
  const isNight = timeOfDay === 2
  const weather = pick(m.seed, 2, 4)
  const isWet = weather >= RAIN
  gradient(c, isWet ? mix(time.top, 0x404650, 0.5) : time.top, time.bottom)

  // Stars on a dry night, twinkling.
  if (isNight && !isWet) {
    for (let i = 0; i < c.W / 3; i++) {
      put(c, Math.floor(rnd(m.seed, 100 + i) * c.W), Math.floor(rnd(m.seed, 200 + i) * 9), mix(0x40445a, 0xffffff, wave(m.t + i * 397, 1800)))
    }
  }

  // The sun or moon, glowing while Claude writes; a storm hides it.
  const lx = Math.floor(c.W * (0.6 + rnd(m.seed, 3) * 0.3))
  if (weather !== STORM) {
    if (m.state === 'say') disc(c, lx, 4, 4, mix(time.light, time.bottom, 0.6))
    disc(c, lx, 4, 2, time.light)
  }

  // Far hills, slow.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist * 0.2
    const h = 3 + Math.round(2 * Math.sin(u / 9 + m.seed) + Math.sin(u / 4))
    rect(c, x, PH - 3 - h, 1, h, time.far)
  }

  // Clouds, more of them the worse the weather.
  const grey = isWet ? 0x8a8f99 : isNight ? 0x3a4058 : 0xf4f6fa
  for (let i = 0; i < CLOUDS[weather]!; i++) {
    const w = 6 + pick(m.seed, 300 + i, 8)
    const x = mod(Math.floor(rnd(m.seed, 310 + i) * c.W * 2 - m.dist * (0.6 + rnd(m.seed, 320 + i) * 0.6)), c.W + w * 2) - w
    const y = 1 + pick(m.seed, 330 + i, 5)
    rect(c, x, y + 1, w, 2, grey)
    rect(c, x + 2, y, w - 4, 1, grey)
  }

  // Near hills, at the turn's pace.
  for (let x = 0; x < c.W; x++) {
    const u = x + m.dist
    const h = 2 + Math.round(Math.sin(u / 6 + m.seed * 3) + 0.5 * Math.sin(u / 2.5))
    rect(c, x, PH - h, 1, h, time.hill)
  }

  // Rain, heavier and slanting while a tool runs; lightning in a storm.
  if (isWet) {
    const isBusy = m.state === 'tool'
    const drops = Math.floor(c.W * (isBusy ? 0.8 : 0.35))
    for (let i = 0; i < drops; i++) {
      const fall = m.t * (0.02 + rnd(m.seed, 500 + i) * 0.01)
      const y = mod(Math.floor(rnd(m.seed, 510 + i) * PH + fall), PH)
      const x = mod(Math.floor(rnd(m.seed, 520 + i) * c.W - (isBusy ? fall * 0.5 : 0)), c.W)
      put(c, x, y, 0x9ec9ff)
    }
    if (weather === STORM && isBusy && mod(Math.floor(m.t / 90), 23) === 0) {
      for (let i = 0; i < c.px.length; i++) c.px[i] = mix(c.px[i]!, 0xffffff, 0.6)
    }
  }

  // A bird crosses while Claude writes; a clear day gets a second one.
  if (m.state === 'say') {
    const birds = weather === CLEAR && !isNight ? 2 : 1
    for (let b = 0; b < birds; b++) {
      const x = mod(Math.floor(m.t * 0.02) - b * 9, c.W + 6) - 3
      const y = 6 + b * 2 + Math.round(Math.sin(m.t / 400 + b))
      const isUp = Math.floor(m.t / 200 + b) % 2 === 0
      sprite(c, isUp ? BIRD_UP : BIRD_DOWN, { b: isNight ? 0xcfd3e0 : 0x2a2a35 }, x, y)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `114 pass`, `0 fail`. If "looks different while a tool runs" fails for sky, the chosen seed (7) gave clear/cloudy weather where only the bird differs (and the bird appears only in `say`): change the test helper's default seed so it is not relied on — instead make `sceneSuite`'s tool≠think test loop seeds 0–11 and require at least one to differ:

```ts
    test('looks different while a tool runs than while Claude thinks', () => {
      const differs = Array.from({ length: 12 }, (_, seed) => draw(scene, 60, at('tool', 6000, seed)) !== draw(scene, 60, at('think', 6000, seed)))
      expect(differs.some(Boolean)).toBe(true)
    })
```

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/sky.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: sky scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: City scene

**Goal:** `hooks/scenery/city.ts` draws a random day/night skyline in two depths scrolling with `dist`, windows lighting and flickering faster while a tool runs, cars on the street (more and faster during tools), fireworks while Claude writes.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/city.ts`
- Modify: `cat-clawd-duo/tests/scenery.test.ts` (append one line)

**Acceptance Criteria:**
- [ ] `sceneSuite('city', city)` passes all four tests

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `118 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Write the failing test** — add to `cat-clawd-duo/tests/scenery.test.ts` (import with the others, call at the end):

```ts
import { city } from '../hooks/scenery/city'
sceneSuite('city', city)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery/city`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/city.ts`:

```ts
// City: a skyline in two depths scrolling at the turn's pace, windows lighting
// up (and flickering faster) while tools run, traffic on the street, and
// fireworks over the roofs while Claude writes.
import { gradient, mix, mod, PH, pick, put, rect, rnd, type Scene } from './pixels'

const WINDOWS = [
  [0xffd166, 0xffe9a8],
  [0x8ecae6, 0xd0f4ff],
  [0xff8fab, 0xffc2d1],
] as const
const CARS = [0xe63946, 0xf1faee, 0x457b9d, 0xffb703]
const SPARKS = [0xff4b3e, 0xffd54f, 0x8ecae6, 0xc77dff]
const STREET = 3

export const city: Scene = (c, m) => {
  // Night twice as often as day: the windows are the show.
  const isNight = pick(m.seed, 1, 3) > 0
  const lit = WINDOWS[pick(m.seed, 2, 3)]!
  gradient(c, isNight ? 0x0b1026 : 0x5aa0e0, isNight ? 0x2a2350 : 0xcde8ff, 0, PH - STREET)

  // The far skyline: flat silhouettes, slow.
  const farOff = Math.floor(m.dist * 0.3)
  for (let x = 0; x < c.W; x++) {
    const b = Math.floor((x + farOff) / 5)
    const h = 4 + pick(m.seed, 1000 + b, 6)
    rect(c, x, PH - STREET - h, 1, h, isNight ? 0x1a1d33 : 0x8fa3b8)
  }

  // Near buildings, 7 px wide with a 1 px gap, windows on every other column.
  const off = Math.floor(m.dist)
  const share = m.state === 'tool' ? 0.7 : m.state === 'say' ? 0.45 : 0.2
  const flick = m.state === 'tool' ? 300 : 1500
  for (let x = 0; x < c.W; x++) {
    const u = x + off
    const b = Math.floor(u / 8)
    const col = u - b * 8
    if (col === 7) continue
    const h = 6 + pick(m.seed, 2000 + b, 8)
    const top = PH - STREET - h
    rect(c, x, top, 1, h, isNight ? 0x22263d : 0x5b6b80)
    if (col % 2 === 1) {
      for (let y = top + 1; y < PH - STREET - 1; y += 2) {
        if (rnd(b * 31 + y, col + Math.floor(m.t / flick)) < share) put(c, x, y, rnd(b, y) < 0.5 ? lit[0] : lit[1])
      }
    }
  }

  // The street, its lane marks moving, and the cars.
  rect(c, 0, PH - STREET, c.W, STREET, 0x2b2b2f)
  for (let x = 0; x < c.W; x += 4) put(c, mod(x - Math.floor(m.dist * 2), c.W), PH - 2, 0x6c6c70)
  const isBusy = m.state === 'tool'
  for (let i = 0; i < (isBusy ? 5 : 2); i++) {
    const speed = (isBusy ? 0.04 : 0.015) * (0.7 + rnd(m.seed, 600 + i) * 0.6)
    const x = mod(Math.floor(rnd(m.seed, 610 + i) * c.W + m.t * speed), c.W + 4) - 2
    rect(c, x, PH - 2, 3, 1, CARS[pick(m.seed, 620 + i, CARS.length)]!)
    put(c, x + 3, PH - 2, 0xfff3a0)
  }

  // Fireworks while Claude writes: a burst every 1.2 s, somewhere over the roofs.
  if (m.state === 'say') {
    const n = Math.floor(m.t / 1200)
    const k = (m.t % 1200) / 1200
    const cx = Math.floor(rnd(m.seed, 700 + n) * c.W)
    const cy = 3 + pick(m.seed, 710 + n, 3)
    const colour = mix(SPARKS[pick(m.seed, 720 + n, SPARKS.length)]!, 0x000000, k * 0.7)
    const r = Math.round(k * 4)
    for (let a = 0; a < 8; a++) put(c, cx + Math.cos((a * Math.PI) / 4) * r * 1.6, cy + Math.sin((a * Math.PI) / 4) * r, colour)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `118 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/city.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: city scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ocean scene

**Goal:** `hooks/scenery/ocean.ts` draws a random water tint underwater, light rays, sand and swaying kelp, fish drifting with `dist`, a school darting past and faster bubbles while a tool runs, a whale or jellyfish while Claude writes.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/ocean.ts`
- Modify: `cat-clawd-duo/tests/scenery.test.ts` (append one line)

**Acceptance Criteria:**
- [ ] `sceneSuite('ocean', ocean)` passes all four tests

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `122 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Write the failing test** — add to `cat-clawd-duo/tests/scenery.test.ts`:

```ts
import { ocean } from '../hooks/scenery/ocean'
sceneSuite('ocean', ocean)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery/ocean`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/ocean.ts`:

```ts
// Ocean: underwater, kelp swaying over the sand and fish drifting at the
// turn's pace; a school darts past and the bubbles stream while a tool runs;
// a whale or a jellyfish swims through while Claude writes.
import { gradient, mix, mod, PH, pick, put, rect, rnd, sprite, type Scene } from './pixels'

const WATERS = [
  [0x0a3d62, 0x1e7fb5],
  [0x0b4d4a, 0x2a9d8f],
  [0x1b1f4a, 0x3a5ba0],
] as const
const FISH = ['.ff..', 'fffft', '.ff..']
const FISH_COLOURS = [0xffb703, 0xfb8500, 0xe63946, 0x8ecae6]
const WHALE = [
  '.....wwwwwww...',
  '..wwwwwwwwwwww.',
  '.wewwwwwwwwwwww',
  'wwwwwwwwwwwwwwt',
  '.bbbbbbbbbbb.tt',
]
const JELLY = ['.jjj.', 'jjjjj', 'j.j.j', '.j.j.']

export const ocean: Scene = (c, m) => {
  const [deep, shallow] = WATERS[pick(m.seed, 1, WATERS.length)]!
  gradient(c, shallow, deep)

  // Light rays near the surface, drifting slowly.
  for (let x = 0; x < c.W; x++) if (mod(x + Math.floor(m.dist * 0.2), 11) < 2) rect(c, x, 0, 1, 3, mix(shallow, 0xffffff, 0.15))

  // Sand, and kelp swaying from it.
  rect(c, 0, PH - 2, c.W, 2, 0xc2a36b)
  const kelps = Math.floor(c.W / (6 + pick(m.seed, 2, 6)))
  for (let i = 0; i < kelps; i++) {
    const base = mod(Math.floor(rnd(m.seed, 100 + i) * c.W * 2 - m.dist * 0.6), c.W + 4) - 2
    const h = 5 + pick(m.seed, 110 + i, 8)
    for (let j = 0; j < h; j++) put(c, base + Math.sin(m.t / 700 + j / 2 + i) * (j / h) * 1.5, PH - 2 - j, j % 3 ? 0x2d6a4f : 0x40916c)
  }

  // Fish, drifting left at the turn's pace, bobbing.
  const fishes = 3 + pick(m.seed, 3, 3)
  for (let i = 0; i < fishes; i++) {
    const x = mod(Math.floor(rnd(m.seed, 200 + i) * c.W - m.dist * (0.8 + rnd(m.seed, 210 + i))), c.W + 8) - 4
    const y = 3 + pick(m.seed, 220 + i, PH - 8) + Math.round(Math.sin(m.t / 500 + i))
    sprite(c, FISH, { f: FISH_COLOURS[pick(m.seed, 230 + i, FISH_COLOURS.length)]!, t: 0xffffff }, x, y)
  }

  // A school darts past while a tool runs.
  if (m.state === 'tool') {
    const sx = c.W - mod(Math.floor(m.t * 0.06), c.W + 20)
    for (let i = 0; i < 9; i++) put(c, sx + (i % 3) * 3 + (i > 2 ? 1 : 0), 6 + Math.floor(i / 3) * 2, 0xdfe7ff)
  }

  // Bubbles rising, faster while a tool runs.
  const rise = m.state === 'tool' ? 0.012 : 0.004
  for (let i = 0; i < c.W / 6; i++) {
    const x = Math.floor(rnd(m.seed, 300 + i) * c.W)
    const y = mod(Math.floor(rnd(m.seed, 310 + i) * PH - m.t * rise * (0.6 + rnd(m.seed, 320 + i))), PH)
    put(c, x, y, mix(shallow, 0xffffff, 0.6))
  }

  // A whale or a jellyfish while Claude writes.
  if (m.state === 'say') {
    const x = c.W - mod(Math.floor(m.t * 0.012), c.W + 20)
    if (pick(m.seed, 4, 2) === 0) sprite(c, WHALE, { w: 0x4a6fa5, b: 0xdfe7ff, e: 0x111111, t: 0x4a6fa5 }, x, 4)
    else sprite(c, JELLY, { j: 0xff8fab }, x, 3 + Math.round(Math.sin(m.t / 400) * 2))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `122 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/ocean.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: ocean scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Space scene

**Goal:** `hooks/scenery/space.ts` draws a random nebula tint, stars in three depths scrolling with `dist` (stretching into warp streaks while a tool runs), a bobbing ship with a flickering flame, and a rising planet plus a comet while Claude writes.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/space.ts`
- Modify: `cat-clawd-duo/tests/scenery.test.ts` (append one line)

**Acceptance Criteria:**
- [ ] `sceneSuite('space', space)` passes all four tests

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `126 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Write the failing test** — add to `cat-clawd-duo/tests/scenery.test.ts`:

```ts
import { space } from '../hooks/scenery/space'
sceneSuite('space', space)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery/space`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/space.ts`:

```ts
// Space: stars in three depths drifting at the turn's pace, stretched into
// warp streaks while a tool runs, a ship bobbing among them, and a planet
// rising with a comet overhead while Claude writes.
import { disc, gradient, mix, mod, PH, pick, put, rnd, sprite, type Scene } from './pixels'

const NEBULAE = [0x2a0f3d, 0x0f2a3d, 0x3d1a0f]
const PLANETS = [0xe9c46a, 0x8ecae6, 0xe76f51]
const SHIP = [
  '..aa....',
  '.sssss..',
  'fsswwsss',
  '.sssss..',
  '..aa....',
]

export const space: Scene = (c, m) => {
  const nebula = NEBULAE[pick(m.seed, 1, NEBULAE.length)]!
  gradient(c, 0x02030a, nebula)
  const isWarping = m.state === 'tool'

  // Stars: nearer ones brighter and faster; streaks while warping.
  for (let i = 0; i < c.W * 0.8; i++) {
    const depth = 1 + (i % 3)
    const x = mod(Math.floor(rnd(m.seed, 100 + i) * c.W * 3 - m.dist * depth * 0.5), c.W)
    const y = Math.floor(rnd(m.seed, 110 + i) * PH)
    const colour = mix(0x30344a, 0xffffff, depth / 3)
    const length = isWarping ? depth * 2 : 1
    for (let k = 0; k < length; k++) put(c, x + k, y, mix(colour, nebula, k / length))
  }

  // A planet rising and a comet overhead while Claude writes.
  if (m.state === 'say') {
    const tint = PLANETS[pick(m.seed, 2, PLANETS.length)]!
    const px = Math.floor(c.W * 0.7)
    const py = PH + 2 - Math.min(10, Math.floor(m.t / 250))
    disc(c, px, py, 7, tint)
    disc(c, px - 2, py - 2, 3, mix(tint, 0xffffff, 0.35))
    const cx = mod(Math.floor(m.t * 0.03), c.W + 12) - 6
    for (let k = 0; k < 6; k++) put(c, cx - k, 2 + Math.floor(k / 3), mix(0xffffff, nebula, k / 6))
  }

  // The ship, bobbing, its flame flickering; it surges ahead while warping.
  const sx = Math.floor(c.W * 0.25) + (isWarping ? 4 : 0) + Math.round(Math.sin(m.t / 1500) * 2)
  const sy = 6 + Math.round(Math.sin(m.t / 600))
  sprite(c, SHIP, { s: 0xc0c7d4, w: 0x8ecae6, a: 0xe63946, f: Math.floor(m.t / 120) % 2 ? 0xffb703 : 0xff4b3e }, sx, sy)
  if (isWarping) for (let k = 1; k <= 4; k++) put(c, sx - k, sy + 2, mix(0xffb703, nebula, k / 5))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `126 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/space.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: space scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scenery index (rotation, state, pace)

**Goal:** `hooks/scenery/index.ts` exposes the rotation order, `nextScene`, the per-state scroll `PACE`, `stateOf`, and `sceneryCells(name, columns, moment)`.

**Files:**
- Create: `cat-clawd-duo/hooks/scenery/index.ts`
- Modify: `cat-clawd-duo/tests/scenery.test.ts`

**Acceptance Criteria:**
- [ ] `SCENES` is `['sky', 'city', 'ocean', 'space']`
- [ ] `nextScene('space') === 'sky'`, `nextScene('sky') === 'city'`; `nextScene(undefined, () => 0.6) === 'ocean'`
- [ ] `stateOf(true, true) === 'tool'`, `stateOf(false, true) === 'think'`, `stateOf(false, false) === 'say'`
- [ ] `PACE.think < PACE.say < PACE.tool`
- [ ] `sceneryCells(name, 50, m)` decodes to `50 * 9 * 3` words for every name; `isSceneName` accepts the four and rejects others

**Verify:** `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `131 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Write the failing test** — add to `cat-clawd-duo/tests/scenery.test.ts` (import with the others, describe at the end):

```ts
import { isSceneName, nextScene, PACE, SCENES, sceneryCells, stateOf } from '../hooks/scenery'

describe('the scene rotation', () => {
  test('goes sky, city, ocean, space, and back to sky', () => {
    expect([...SCENES]).toEqual(['sky', 'city', 'ocean', 'space'])
    expect(nextScene('sky')).toBe('city')
    expect(nextScene('city')).toBe('ocean')
    expect(nextScene('ocean')).toBe('space')
    expect(nextScene('space')).toBe('sky')
  })

  test('starts a session on a random scene', () => {
    expect(nextScene(undefined, () => 0)).toBe('sky')
    expect(nextScene(undefined, () => 0.6)).toBe('ocean')
    expect(nextScene(undefined, () => 0.99)).toBe('space')
  })

  test('knows its scene names', () => {
    for (const name of SCENES) expect(isSceneName(name)).toBe(true)
    expect(isSceneName('cat')).toBe(false)
  })

  test('reads what Claude is doing: a running tool first, then thinking, else writing', () => {
    expect(stateOf(true, true)).toBe('tool')
    expect(stateOf(true, false)).toBe('tool')
    expect(stateOf(false, true)).toBe('think')
    expect(stateOf(false, false)).toBe('say')
    expect(PACE.think).toBeLessThan(PACE.say)
    expect(PACE.say).toBeLessThan(PACE.tool)
  })

  test('draws every scene as Raster cells the width asked', () => {
    for (const name of SCENES) expect(words(sceneryCells(name, 50, at('say'))).length).toBe(50 * ROWS * 3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — cannot resolve `../hooks/scenery`.

- [ ] **Step 3: Write the implementation** — create `cat-clawd-duo/hooks/scenery/index.ts`:

```ts
// The scenes the left half can show instead of the cat, in the order they
// take turns, and how fast their layers scroll for what Claude is doing.
import { city } from './city'
import { ocean } from './ocean'
import { canvas, toCells, type Moment, type Scene, type State } from './pixels'
import { sky } from './sky'
import { space } from './space'

export type { Moment, State } from './pixels'

export const SCENES = ['sky', 'city', 'ocean', 'space'] as const
export type SceneName = (typeof SCENES)[number]

const DRAW: Record<SceneName, Scene> = { sky, city, ocean, space }

/** Pixels per ms the layers scroll: slow while Claude thinks, fast while a tool runs. */
export const PACE: Record<State, number> = { think: 0.004, say: 0.008, tool: 0.02 }

export const isSceneName = (name: string): name is SceneName => (SCENES as readonly string[]).includes(name)

/** The scene after `name`; a random one to start a session. */
export const nextScene = (name: SceneName | undefined, rng: () => number = Math.random): SceneName =>
  name ? SCENES[(SCENES.indexOf(name) + 1) % SCENES.length]! : SCENES[Math.floor(rng() * SCENES.length)]!

/** What Claude is doing: a running tool wins, then thinking, else it is writing. */
export const stateOf = (isToolRunning: boolean, isThinking: boolean): State =>
  isToolRunning ? 'tool' : isThinking ? 'think' : 'say'

/** One frame of a scene, `columns` wide, as Raster cells. */
export function sceneryCells(name: SceneName, columns: number, m: Moment): string {
  const c = canvas(columns)
  DRAW[name](c, m)
  return toCells(c)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `131 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/hooks/scenery/index.ts cat-clawd-duo/tests/scenery.test.ts
git commit -m "cat-clawd-duo: scenery rotation, pace and cells

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire scenes into the duo (`left` option)

**Goal:** `cat.tsx` and `plugin.json` gain the `left` option (`scenes` default, `cat`), drawing the turn's scene in the cat's slot, rotating it each `prompt.submit`, skipping the nap with scenes, and exposing it in the dialog and `/cat-spinner`.

**Files:**
- Modify: `cat-clawd-duo/hooks/cat.tsx` (imports at top; exports after `BETWEENS` ~line 38; labels after `SEASON_LABELS` ~line 290; `startPreview` ~line 306; `editing` ~line 326; `is*` guards ~line 340; `register` options ~line 345; `session.start` nap timer ~line 365; dialog ~lines 389–455; command ~lines 463–520; timer state and `prompt.submit` ~lines 527–560; `AbovePrompt` ~line 573; `Spinner` ~lines 590–623)
- Modify: `cat-clawd-duo/.claude-plugin/plugin.json`
- Modify: `cat-clawd-duo/tests/cat.test.tsx`

**Acceptance Criteria:**
- [ ] With default options, the Spinner's `Raster key="cat"` has the same columns as before but none of the Siamese coat colour `0x9c8e82`
- [ ] With `left: 'cat'`, the Raster has `0x9c8e82` (the cat), and every existing cat test passes with `left: 'cat'` added
- [ ] With `between: 'nap'` and default `left`, the band above the prompt has no `Raster key="nap"`
- [ ] The dialog lists `Left: Scenes: …` first, and hides Cat/Animation/Season/Between turns when `left = scenes`
- [ ] `/cat-spinner cat` writes `cat-clawd-duo.left = cat`; `/cat-spinner scenes` with `left = scenes` writes nothing
- [ ] `claude plugin validate cat-clawd-duo/.claude-plugin/plugin.json` passes

**Verify:** `claude plugin validate cat-clawd-duo/.claude-plugin/plugin.json && claude plugin test cat-clawd-duo 2>&1 | tail -5` → validation OK, `136 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Pin the existing cat tests to `left: 'cat'`**

In `cat-clawd-duo/tests/cat.test.tsx`, every test with an options object gets `left: 'cat'`:

```bash
sed -i "s/{ options: { /{ options: { left: 'cat', /" cat-clawd-duo/tests/cat.test.tsx
```

Then add `{ options: { left: 'cat' } },` as the second argument of these six tests, which have no options today (they read the cat's pixels, the cat-only dialog entries, or the nap band):
- `test('draws the cat above the engine spinner line', async ($, on) => {`
- `test('saves an option when picked, and goes back on the current one', async ($, on) => {`
- `test('offers Alignment in the dialog only for a compact track', async $ => {`
- `test('draws the track as wide as the terminal allows when stacked', async ($, on) => {`
- `test('puts the cat and Clawd side by side in one row on a wide terminal', async ($, on) => {`
- `test('stays out of sight between turns by default (Hide)', async ($, on) => {`

e.g. `test('draws the cat above the engine spinner line', { options: { left: 'cat' } }, async ($, on) => {`.

Check: `grep -c "left: 'cat'" cat-clawd-duo/tests/cat.test.tsx` → `19`.

- [ ] **Step 2: Write the failing tests** — append to `cat-clawd-duo/tests/cat.test.tsx`:

```tsx
describe('scenes on the left', () => {
  const RUN = { command: 'cat-spinner', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
  const BAND = {
    plugin: 'cat-clawd-duo',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  } as const
  const DIALOG = {
    plugin: 'cat-clawd-duo',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'cat-spinner-settings',
    props: { title: 'cat-spinner', isFocused: true, bodyColumns: 70, placement: 'inline', scroll: { offset: 0, bodyRows: 14 }, view: {} },
  } as const

  test('draws a scene in the cat\'s place by default, side by side with Clawd', { options: { season: 'plain' } }, async ($, on) => {
    await engineSpinner($, on)
    const split = splitColumns(135)!
    const ui = await $.ui.mount({ ...SPINNER, viewport: { columns: 135, rows: 40 } } as typeof SPINNER)
    const left = await ui.find({ type: 'Raster', key: 'cat' })
    expect(left?.props.columns).toBe(split.cat)
    expect(colorsOf(left?.props.cells).has(0x9c8e82)).toBe(false) // no Siamese
    expect((await ui.find({ type: 'Raster', key: 'act' }))?.props.columns).toBe(split.clawd)
    await ui.unmount()
  })

  test('leaves the band above the prompt alone, even with the nap on', { options: { between: 'nap' } }, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine band</Text>
    })
    const ui = await $.ui.mount(BAND)
    expect(await ui.find({ type: 'Raster', key: 'nap' })).toBeUndefined()
    await ui.unmount()
  })

  test('lists Left first in the dialog, and hides the cat\'s own settings', async $ => {
    const ui = await $.ui.mount(DIALOG)
    expect((await ui.find({ type: 'Button', key: 'edit-left' }))?.text).toContain('Left: Scenes')
    expect(await ui.find({ type: 'Button', key: 'edit-coat' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'edit-between' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'edit-width' })).toBeDefined()
    await ui.unmount()
  })

  test('brings the cat back with /cat-spinner cat', async ($, on) => {
    const writes: unknown[] = []
    on('config.set', (_$, e) => {
      writes.push({ key: e.key, value: e.value })
      return { value: e.value }
    })
    const { text } = await $.command.run({ ...RUN, args: 'cat' })
    expect(writes).toEqual([{ key: 'cat-clawd-duo.left', value: 'cat' }])
    expect(text).toBe('The cat is back on the left.')
  })

  test('says so when the scenes are already on', async ($, on) => {
    const writes: unknown[] = []
    on('config.set', (_$, e) => {
      writes.push(e.key)
      return { value: e.value }
    })
    const { text } = await $.command.run({ ...RUN, args: 'scenes' })
    expect(writes).toEqual([])
    expect(text).toBe('The left half already shows scenes.')
  })
})
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: the 5 new tests FAIL (the cat is drawn; no `edit-left`; no `left` write); the 131 others pass.

- [ ] **Step 4: Implement in `cat-clawd-duo/hooks/cat.tsx`**

4a. Imports — after `import { clawdTurnComplete } from './clawd/clawd'` add:

```ts
import { nextScene, PACE, SCENES as SCENERY, sceneryCells, stateOf, type Moment, type SceneName } from './scenery'
```

4b. After `export type Between = (typeof BETWEENS)[number]` add:

```ts
// What the left half of the row shows: the turn's scene, or the cat.
export const LEFTS = ['scenes', 'cat'] as const
export type Left = (typeof LEFTS)[number]
```

4c. After the `SEASON_LABELS` object add:

```ts
const LEFT_LABELS: Record<Left, string> = {
  scenes: 'Scenes: sky, city, ocean and space, the next one each turn',
  cat: 'Cat: the pixel cat',
}
// The cat's own settings, listed only while the cat is on the left.
const CAT_ONLY: readonly string[] = ['coat', 'animation', 'season', 'between']
```

4d. Replace `startPreview` with (adds `left`, and the scene preview):

```ts
// The dialog's scenes: each in turn for 70 frames, as while Claude writes.
const previewScenery = (frame: number, track: number) =>
  sceneryCells(SCENERY[Math.floor(frame / 70) % SCENERY.length]!, track, { t: frame * FRAME_MS, dist: frame * FRAME_MS * PACE.say, state: 'say', seed: sceneSeed })

function startPreview($: EngineInterface, animation: Animation, playing: Playable, left: Left) {
  if (preview) return
  const state = { cat: { run: 0, think: 0, sit: 0 } as Cat, playing, frame: 0, track: 0 }
  const timer = $.clock.every(FRAME_MS, () => {
    if (!state.track) return
    state.frame += 1
    if (left === 'scenes') {
      void $.ui.blit({ requestId: SETTINGS, key: PREVIEW_KEY, columns: state.track, rows: ROWS, cells: previewScenery(state.frame, state.track) })
      return
    }
    if (animation === 'random' && state.frame % 70 === 0) state.playing = pickAnimation(state.playing)
    state.cat = advance(inAnimation(state.cat, state.playing, state.track), false, state.track)
    void $.ui.blit({ requestId: SETTINGS, key: PREVIEW_KEY, columns: state.track, rows: ROWS, cells: sceneCells(state.cat, state.track, { isHalloween, time: state.frame, seed: sceneSeed }) })
  })
  preview = Object.assign(state, { timer })
}
```

4e. `let editing: 'coat' | 'animation' | 'width' | 'align' | 'season' | 'between' | undefined` → `let editing: 'left' | 'coat' | 'animation' | 'width' | 'align' | 'season' | 'between' | undefined`.

4f. After `const isBetween = ...` add:

```ts
const isLeft = (name: string): name is Left => (LEFTS as readonly string[]).includes(name)
```

4g. In `register`, after `const between: Between = ...` add:

```ts
  const leftOption = String(options.left ?? 'scenes')
  const left: Left = isLeft(leftOption) ? leftOption : 'scenes'
```

4h. Both calls `startPreview($, animation, playing)` → `startPreview($, animation, playing, left)` (in `session.start` and in the command).

4i. `session.start`: `if (between === 'nap') {` → `if (between === 'nap' && left === 'cat') {`.

4j. Dialog: add as the first element of `every`:

```ts
      { key: 'left', label: 'Left', current: left as string, names: LEFTS as readonly string[], labels: LEFT_LABELS as Record<string, string> },
```

and replace the `settings` filter with:

```ts
    // Alignment only matters for a compact track, which is narrower than the
    // terminal; the cat's own settings only while the cat is on the left.
    const settings = every.filter(setting => (setting.key !== 'align' || width === 'compact') && (left === 'cat' || !CAT_ONLY.includes(setting.key)))
```

and the preview Raster's `cells={sceneCells(preview?.cat ?? { run: 0, think: 0, sit: 0 }, track)}` → 

```tsx
cells={left === 'scenes' ? previewScenery(preview?.frame ?? 0, track) : sceneCells(preview?.cat ?? { run: 0, think: 0, sit: 0 }, track)}
```

4k. Command: replace the `usage` line with

```ts
    const usage = `Switch the left half with ${list(LEFTS)}, cats with ${list(COAT_NAMES)}, animations with ${list(ANIMATIONS)}, the width with ${list(WIDTHS)}, a compact track's alignment with ${list(ALIGNS)}, the season with ${list(SEASONS)}, and what it does between turns with ${list(BETWEENS)}.`
    const shows = left === 'scenes' ? 'The left half shows scenes (sky, city, ocean, space, the next each turn). ' : ''
```

prefix both status texts in the `if (!choice)` block with `${shows}` (i.e. `` `${shows}Your cat is the ${coat}, …` ``), and add before `if (isCoat(choice)) {`:

```ts
    if (isLeft(choice)) {
      if (choice === left) return { text: `The left half already shows ${choice === 'cat' ? 'the cat' : 'scenes'}.` }
      const { deny } = await $.config.set({ key: 'cat-clawd-duo.left', value: choice })
      if (deny) return { text: `Couldn't switch the left half: ${deny}` }
      return { text: choice === 'cat' ? 'The cat is back on the left.' : 'The left half shows scenes now: sky, city, ocean and space, the next one each turn.' }
    }
```

4l. Scene state — after `let napFrame = 0` and `const decor = …` add:

```ts
  // With scenes on the left: this turn's scene, and how far it has run.
  let scene: SceneName | undefined
  let view = { t: 0, dist: 0, pace: PACE.think, seed: 0 }
  const moment = (): Moment => ({ t: view.t, dist: view.dist, state: stateOf(doing !== undefined, isThinking), seed: view.seed })
  // The left half's cells: the turn's scene, or the cat.
  const leftCells = (columns: number) =>
    left === 'scenes' ? sceneryCells((scene ??= nextScene(undefined)), columns, moment()) : sceneCells(cat, columns, decor())
```

4m. `prompt.submit`: after `if (animation === 'random') playing = pickAnimation(playing)` add:

```ts
    // Scenes take turns: the next one, from its start, with a new variant.
    if (left === 'scenes') {
      scene = nextScene(scene)
      view = { t: 0, dist: 0, pace: PACE.think, seed: Math.floor(Math.random() * 2 ** 31) }
    }
```

and replace the timer body with:

```ts
    timer ??= $.clock.every(FRAME_MS, () => {
      if (!requestId || !track) return
      if (left === 'scenes') {
        // The pace eases toward what Claude is doing, over about half a second.
        view.pace += (PACE[moment().state] - view.pace) * 0.2
        view.t += FRAME_MS
        view.dist += view.pace * FRAME_MS
      } else {
        cat = advance(inAnimation(cat, playing, track), isThinking, track, Math.random, { doing, isStartled })
      }
      isStartled = false
      frame += 1
      void $.ui.blit({ requestId, key: KEY, columns: track, rows: ROWS, cells: leftCells(track) })
    })
```

4n. `AbovePrompt`: `if (between !== 'nap' || !isIdle || …` → `if (left === 'scenes' || between !== 'nap' || !isIdle || …` and update the comment above it to: `// The band is the cat's only between turns, when there's room, and it yields to a survey; scenes leave it alone.`

4o. `Spinner`: both `cells={sceneCells(cat, track, decor())}` → `cells={leftCells(track)}`.

- [ ] **Step 5: `plugin.json`** — in `cat-clawd-duo/.claude-plugin/plugin.json` set `"description"` to `"cat-spinner and clawd-spinner merged: rotating pixel scenes (sky, city, ocean, space) or the pixel cat, and Clawd, share one row above the spinner (stacked when the terminal is too narrow)."` and add as the first `userConfig` entry:

```json
    "left": {
      "type": "string",
      "title": "Left",
      "description": "What the left half shows: scenes (sky, city, ocean, space, the next one each turn) or the cat",
      "default": "scenes",
      "options": [
        "scenes",
        "cat"
      ]
    },
```

- [ ] **Step 6: Validate and run tests**

Run: `claude plugin validate cat-clawd-duo/.claude-plugin/plugin.json && claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: validation passes; `136 pass`, `0 fail`. The golden scenes still pass unchanged (`git diff --stat cat-clawd-duo/tests/golden.ts` prints nothing).

- [ ] **Step 7: Commit**

```bash
git add cat-clawd-duo/hooks/cat.tsx cat-clawd-duo/.claude-plugin/plugin.json cat-clawd-duo/tests/cat.test.tsx
git commit -m "cat-clawd-duo: left option, scenes in the cat's place by default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Golden scenery fingerprints

**Goal:** Each scene in each state gets a golden fingerprint, and `scripts/fingerprints.ts` regenerates `tests/golden.ts` without changing the cat's entries.

**Files:**
- Create: `cat-clawd-duo/scripts/fingerprints.ts`, `cat-clawd-duo/scripts/stub/react/{package.json,jsx-dev-runtime.js}`
- Modify: `cat-clawd-duo/tests/scenes.ts`
- Modify: `cat-clawd-duo/tests/golden.ts` (regenerated)

**Acceptance Criteria:**
- [ ] `tests/scenes.ts` has 12 new entries named `scenery: <scene>, <state>`
- [ ] `git diff cat-clawd-duo/tests/golden.ts` shows only `+` lines (the 17 cat entries unchanged)
- [ ] The golden test "covers every scene it has a fingerprint for" passes

**Verify:** `git diff cat-clawd-duo/tests/golden.ts | grep -c '^-  '` → `0`; `claude plugin test cat-clawd-duo 2>&1 | tail -5` → `148 pass`, `0 fail`

**Steps:**

- [ ] **Step 1: Add the scenes** — in `cat-clawd-duo/tests/scenes.ts`, add to the imports:

```ts
import { PACE, SCENES as SCENERY, sceneryCells, type State } from '../hooks/scenery'
```

add before `export const SCENES`:

```ts
// Each scene for 40 frames of one state, from the turn's start, seed 7.
const scenery = (name: (typeof SCENERY)[number], state: State) =>
  Array.from({ length: 40 }, (_, i) => sceneryCells(name, 70, { t: i * 90, dist: i * 90 * PACE[state], state, seed: 7 }))
```

and add inside the `SCENES` object, after `'wake-up stretch': …,`:

```ts
  ...Object.fromEntries(
    SCENERY.flatMap(name => (['think', 'tool', 'say'] as const).map(state => [`scenery: ${name}, ${state}`, () => scenery(name, state)])),
  ),
```

- [ ] **Step 2: Run tests to verify the golden coverage test fails**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -15`
Expected: FAIL — 12 `draws "scenery: …" exactly as before` and `covers every scene it has a fingerprint for`.

- [ ] **Step 3: Create the generator** — `cat-clawd-duo/scripts/fingerprints.ts` (from upstream cat-spinner, run with bun).

`tests/scenes.ts` imports `hooks/cat.tsx`, and bun compiles its JSX to an import of `react/jsx-dev-runtime`, which this repo doesn't have (the plugin engine supplies JSX at runtime). Nothing renders while fingerprinting, so a stub runtime is enough; it was checked to reproduce the existing `'yarn': 'e8d15ae3'` exactly. Create `cat-clawd-duo/scripts/stub/react/package.json`:

```json
{ "name": "react", "type": "module" }
```

and `cat-clawd-duo/scripts/stub/react/jsx-dev-runtime.js`:

```js
// Only for scripts/: hooks/cat.tsx's JSX compiles to this import under bun, and
// nothing renders while fingerprinting, so it never runs.
export const jsxDEV = () => null
export const Fragment = null
```

Then the generator:

```ts
// Prints tests/golden.ts: the fingerprint of every golden scene as drawn now.
//   NODE_PATH=scripts/stub bun scripts/fingerprints.ts > tests/golden.ts
import { fingerprint, SCENES } from '../tests/scenes.ts'

const lines = Object.entries(SCENES).map(([name, scene]) => `  '${name}': '${fingerprint(scene())}',`)
console.log(`// Generated by scripts/fingerprints.ts from tests/scenes.ts. Regenerate it only
// for an intended visual change, and say which scenes changed and why.
export const GOLDEN: Record<string, string> = {
${lines.join('\n')}
}`)
```

Regenerate into a temp file first, then move it in:

```bash
cd cat-clawd-duo && NODE_PATH=scripts/stub bun scripts/fingerprints.ts > /tmp/golden.ts && mv /tmp/golden.ts tests/golden.ts && cd ..
git diff cat-clawd-duo/tests/golden.ts | grep -c '^-  '
```

Expected: `0` (no cat fingerprint changed). If it is not 0, stop: Task 7 changed the cat's drawing — fix that, do not commit new cat fingerprints.

If bun reports another missing module, stop and report it rather than working around it.

- [ ] **Step 4: Run tests**

Run: `claude plugin test cat-clawd-duo 2>&1 | tail -5`
Expected: `148 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/scripts/fingerprints.ts cat-clawd-duo/scripts/stub cat-clawd-duo/tests/scenes.ts cat-clawd-duo/tests/golden.ts
git commit -m "cat-clawd-duo: golden fingerprints for the scenes (cat's unchanged)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: ANSI preview for Jeremy

**Goal:** `scripts/preview-scenery.ts` animates any scene in a truecolor terminal, cycling think → tool → say, and Jeremy looks at all four in the bottom tmux pane before release; requested tweaks are made and goldens regenerated.

**Files:**
- Create: `cat-clawd-duo/scripts/preview-scenery.ts`
- Modify (only if Jeremy asks for tweaks): `cat-clawd-duo/hooks/scenery/*.ts`, `cat-clawd-duo/tests/golden.ts`

**Acceptance Criteria:**
- [ ] `bun scripts/preview-scenery.ts sky 3` exits 0 after ~3 s, having drawn 9 rows per frame
- [ ] Jeremy has seen all four scenes and said they're fine, or each tweak he asked for is made, tests pass, goldens regenerated with only scenery lines changed

**Verify:** `cd cat-clawd-duo && timeout 10 bun scripts/preview-scenery.ts space 2 > /dev/null; echo $?` → `0`

**Steps:**

- [ ] **Step 1: Create the preview** — `cat-clawd-duo/scripts/preview-scenery.ts`:

```ts
// Animates a scene in this terminal (truecolor), as the duo's left half draws
// it, cycling what Claude is doing: think, tool, say, a few seconds each.
//   bun scripts/preview-scenery.ts [sky|city|ocean|space] [seconds] [columns]
import { isSceneName, PACE, SCENES, sceneryCells, type State } from '../hooks/scenery'
import { ROWS } from '../hooks/scenery/pixels'

const DEF = 0x01000000
const FRAME_MS = 90
const STATES: State[] = ['think', 'tool', 'say']

const arg = process.argv[2] ?? 'sky'
const name = isSceneName(arg) ? arg : SCENES[0]
const seconds = Number(process.argv[3] ?? 12)
const columns = Number(process.argv[4] ?? 70)
const seed = Math.floor(Math.random() * 2 ** 31)

const fg = (c: number) => (c === DEF ? '\x1b[39m' : `\x1b[38;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}m`)
const bg = (c: number) => (c === DEF ? '\x1b[49m' : `\x1b[48;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}m`)

const render = (cells: string) => {
  const w = new Uint32Array(Uint8Array.from(atob(cells), ch => ch.charCodeAt(0)).buffer)
  const lines: string[] = []
  for (let row = 0; row < ROWS; row++) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const i = (row * columns + x) * 3
      line += fg(w[i + 1]!) + bg(w[i + 2]!) + String.fromCodePoint(w[i]!)
    }
    lines.push(line + '\x1b[0m')
  }
  return lines.join('\n')
}

let t = 0
let dist = 0
let pace = PACE.think
const frames = Math.floor((seconds * 1000) / FRAME_MS)
process.stdout.write('\x1b[?25l')
for (let f = 0; f < frames; f++) {
  const state = STATES[Math.floor((f / frames) * STATES.length)]!
  pace += (PACE[state] - pace) * 0.2
  t += FRAME_MS
  dist += pace * FRAME_MS
  if (f > 0) process.stdout.write(`\x1b[${ROWS + 1}A`)
  process.stdout.write(`${render(sceneryCells(name, columns, { t, dist, state, seed }))}\n\x1b[2K${name}  ${state}  seed ${seed}\n`)
  await Bun.sleep(FRAME_MS)
}
process.stdout.write('\x1b[?25h')
```

- [ ] **Step 2: Smoke-run it**

Run: `cd cat-clawd-duo && timeout 10 bun scripts/preview-scenery.ts space 2 > /dev/null; echo $?`
Expected: `0`.

- [ ] **Step 3: Show Jeremy** — find the bottom pane (`tmux list-panes -a -F '#{pane_id} #{@role} #{pane_current_command}'`, the one whose `@role` is the shell) and send:

```bash
tmux send-keys -t <pane-id> 'cd ~/code/claudebro/claude-mods/cat-clawd-duo && for s in sky city ocean space; do bun scripts/preview-scenery.ts $s 12; done' Enter
```

Tell Jeremy what plays (each scene 12 s, 4 s each of think/tool/say, a random variant each run; re-run to see other variants) and ask, with the question tool, which scenes he wants changed — options: "All good (Suggested)", "Tweak some (say which)", "Swap a scene for another idea".

- [ ] **Step 4: Apply tweaks, if any** — edit only `hooks/scenery/*.ts`, re-run the preview for Jeremy, then:

```bash
claude plugin test cat-clawd-duo 2>&1 | tail -5
cd cat-clawd-duo && NODE_PATH=scripts/stub bun scripts/fingerprints.ts > /tmp/golden.ts && mv /tmp/golden.ts tests/golden.ts && cd ..
git diff cat-clawd-duo/tests/golden.ts | grep '^-  ' | grep -vc "scenery:"
```

Expected: tests `0 fail` after regenerating; last command prints `0` (only scenery fingerprints changed).

- [ ] **Step 5: Commit**

```bash
git add cat-clawd-duo/scripts/preview-scenery.ts cat-clawd-duo/hooks/scenery cat-clawd-duo/tests/golden.ts
git commit -m "cat-clawd-duo: scenery preview script (+ tweaks from the preview)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Release

**Goal:** cat-clawd-duo `1.11.0-clawd0.5.0` is installed, pushed, pinned in the master repo and in dotfiles, and documented.

**Files:**
- Modify: `cat-clawd-duo/.claude-plugin/plugin.json` (version)
- Modify: `README.md` (claude-mods, the duo's line)
- Modify: `~/code/claudebro/CLAUDE.md` table row (master repo) — only the `claude-mods/` Contents cell
- Modify: `~/dotfiles/tools/claude-plugins.tsv` (the cat-clawd-duo sha)

**Acceptance Criteria:**
- [ ] `jq -r .version cat-clawd-duo/.claude-plugin/plugin.json` → `1.11.0-clawd0.5.0`
- [ ] `claude plugin validate` passes and `claude plugin test cat-clawd-duo` → `0 fail`
- [ ] `git status -sb` in claude-mods shows `main...origin/main` with nothing ahead
- [ ] `installed_plugins.json`'s cat-clawd-duo `version` is `1.11.0-clawd0.5.0`, and `tools/claude-plugins.tsv` has its `gitCommitSha`
- [ ] Master repo commit "Bump claude-mods (cat-clawd-duo 1.11.0)" pushed; dotfiles commit pushed

**Verify:** `jq -r '.plugins["cat-clawd-duo@claudebro-mods"][0].version' ~/.claude/plugins/installed_plugins.json` → `1.11.0-clawd0.5.0`

**Steps:**

- [ ] **Step 1: Version, docs, validate, test**

```bash
jq '.version = "1.11.0-clawd0.5.0"' cat-clawd-duo/.claude-plugin/plugin.json > /tmp/p.json && mv /tmp/p.json cat-clawd-duo/.claude-plugin/plugin.json
grep -n "cat-clawd-duo" README.md
```

Edit the duo's line(s) in `README.md` to say the left half shows rotating scenes (sky, city, ocean, space) by default, or the cat with `/cat-spinner cat`. Then:

```bash
claude plugin validate cat-clawd-duo/.claude-plugin/plugin.json && claude plugin test cat-clawd-duo 2>&1 | tail -5
```

Expected: valid; `0 fail`.

- [ ] **Step 2: Commit, push, install**

```bash
git add cat-clawd-duo/.claude-plugin/plugin.json README.md
git commit -m "cat-clawd-duo 1.11.0: rotating scenes on the left (sky, city, ocean, space)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
claude plugin marketplace update claudebro-mods && claude plugin update cat-clawd-duo@claudebro-mods
jq -r '.plugins["cat-clawd-duo@claudebro-mods"][0] | .version, .gitCommitSha' ~/.claude/plugins/installed_plugins.json
```

Expected: `1.11.0-clawd0.5.0` and a sha.

- [ ] **Step 3: Master repo** — in `~/code/claudebro/CLAUDE.md` the `claude-mods/` row's Contents stays accurate (`cat-clawd-duo` and `spinner`); no edit unless it now misdescribes the duo. Then:

```bash
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods (cat-clawd-duo 1.11.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
```

- [ ] **Step 4: Dotfiles pin** — set the cat-clawd-duo row's commit in `~/dotfiles/tools/claude-plugins.tsv` to the sha from Step 2, then:

```bash
cd ~/dotfiles && git add tools/claude-plugins.tsv && git commit -m "claude-plugins: pin cat-clawd-duo 1.11.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
```

- [ ] **Step 5: Hand over** — tell Jeremy to run `/reload-plugins`, that `/cat-spinner cat` brings the cat back, and that cat-spinner upstream commits touching `cat.tsx` may now triage as `conflict` near the `left` switch.
