# showtime dragon pilot (2.0 look) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the showtime `dragon` theme in the 2.0 look Jeremy chose (6-row band, detailed 16-bit pixel art, bright sunny sky, bustling, rotating set pieces with rare easter eggs) as a pilot that the other 29 kept themes will copy once he approves it live.

**Architecture:** Three small shared modules land first so every later theme can reuse them: `hooks/pixel.ts` (colour ramps, mirrored keyed sprites, sky gradients, speed-limited paths), `hooks/events.ts` (a `t`-only scheduler of set pieces and easter eggs), and test support for *opaque* scenes (scenes that paint every cell, so motion is judged by colour, not ink). Then `hooks/themes/dragon.ts` is rewritten on top of them in three passes (world, events, reactions). The other 37 themes are untouched.

**Tech Stack:** TypeScript plugin for Claude Code (`claude plugin test` runner, `claude-code/testing` `test`/`expect`), Bun for `scripts/shots.ts`, `pnpm exec tsc` for types.

**Spec:** Jeremy's review notes, `docs/superpowers/notes/showtime-preview-review.md` (git-ignored; the parts this plan uses are quoted below so the plan stands alone). Prior art and conventions: `docs/superpowers/plans/2026-10-24-showtime-overhaul.md` ("Theme recipe" R1–R8).

### What Jeremy asked for (quoted from the notes)

- dragon: "ew the background very ugly. make it nicer and the castle nicer. make the sky bright and sunny. add a knight attacking the dragon make the dragon breath fire. add more aniumations make it more alive. add a princess too. add more stuff"
- Global brief: "make the animations better and more defined and more alive and nice to look at with more animations and movement. try to add more items and objects and people and animals if possible and suitable. but dont make it too crowded. try to add effects too like a music note coming out of an instruments and make it more lively and fun to look at."
- Preferences (2026-10-26): no ASCII/glyph/kaomoji art, truecolor half-block pixel art; detailed 16-bit (SNES-like shading); bustling but not cluttered; per-theme colour mood (dragon: bright and sunny); band 6 rows (12 px); rotating events + rare easter eggs; camera per theme (dragon is a *place*: fixed stage, life moves inside it); darker tone allowed where it suits, never gore; 100 ms frames, smoother motion through more in-between poses, not a higher frame rate.

## Global Constraints

- Work one task at a time, never two subagents at once (linglong has 4 cores). Tests, `tsc` and renders run one after another.
- `STAGE_MS` stays 100 ms. Smoothness comes from in-between poses and ≤ 1 px/frame motion, never a faster clock.
- Only `dragon` changes how it looks. The other 37 themes render exactly as before: after every task, `git status --short showtime/assets` lists only `dragon.png`, `review/dragon.png` and (Task 7) `gallery.png`.
- `DRAGON.rows` is 6 (`DRAGON_ROWS = 6`, 12 px). `SCENE_ROWS` in `hooks/draw.ts` stays 4 for everyone else.
- The dragon scene is opaque: every cell has a foreground or background colour (no bare terminal background showing through), including the sign glyph cell.
- Motion: nothing moves more than one pixel a frame; set pieces start and end with every actor at its home pose (so slot boundaries never jump).
- Reactions (`testPass`, `testFail`, `commit`) finish within 30 frames of `newsAge`; at `newsAge >= 30` the scene is identical to the no-news scene (the stage clears news at ~40, which must not snap).
- The pet (`PET`, the hatchling) is not part of the notes: leave it as it is.
- No new strings shown to the person. If one becomes necessary it goes through `m('<key>')` in `hooks/i18n.ts` in all eleven languages.
- Never delete: files leaving the tree go to `~/_attic/YYYY-MM-DD/` (`git rm` is fine for tracked files).
- Commits in `claude-mods` are on `main` (check `git branch --show-current`; `git submodule update` leaves a detached HEAD). Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit after each green task. **No push, no master bump, no `claude plugin update` before Task 8's approval.**
- Verification before every commit, from `~/code/claudebro/claude-mods`: `claude plugin validate showtime/.claude-plugin/plugin.json && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK` → validate OK, `0 fail`, `TSC-OK`. The test run takes ~40 s here. If `tsc` complains about missing engine types, recreate `showtime/.claude-plugin/types/` with `showtime/scripts/engine-types.sh` (it needs the plugin-authoring skill loaded first).
- Address panes by id from `$TMUX_PANE` (memory: find-own-tmux-pane). `tmux display -p` without `-t` once pointed at another Claude's window.

**User decisions (already made):**
- Pilot one theme first, and it is dragon (2026-10-26).
- Truecolor half-block pixel art for every kept theme, no glyph/kaomoji art (2026-10-26).
- Detailed 16-bit style; bustling but not cluttered; per-theme colour mood (2026-10-26).
- Band height 6 rows / 12 px (chosen over 4 and 8) (2026-10-26).
- Rotating set pieces plus rare easter eggs in every theme (2026-10-26).
- Camera per theme: places are fixed stages (dragon's castle is a place) (2026-10-26).
- Darker tone allowed where it suits, no gore (2026-10-26).
- Keep 100 ms frames; smoother through in-betweens (memory: showtime-themes-one-at-a-time).
- Plan only for now; execution later (2026-10-27).

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `showtime/hooks/pixel.ts` | new | 16-bit kit: `mix`, `paint` (a 4-tone material as sprite keys), `sprite` (keyed art, mirrored), `sky` (vertical gradient fill), `ease`, `along` (waypoint paths at ≤ 1 px/frame) |
| `showtime/hooks/events.ts` | new | `slotAt` (which set piece or egg plays at `t`), `firstSlot`, `eggSlot` |
| `showtime/hooks/themes.ts` | modify | `Theme` gains optional `opaque` and `showcase` |
| `showtime/tests/motion.ts` | new | shared test helpers: `sigs`, `edgesOf`, `changed`, `assertSmooth` |
| `showtime/tests/scenes.test.ts` | modify | motion rules read colours for opaque scenes; opaque scenes paint every cell |
| `showtime/tests/pixel.test.ts` | new | kit unit tests |
| `showtime/tests/events.test.ts` | new | scheduler unit tests |
| `showtime/tests/dragon.test.ts` | new | dragon: rows, events home at the ends, smooth across whole slots, reactions visible and settled |
| `showtime/scripts/shots.ts` | modify | sheet gets one strip per `showcase` moment (6 frames, 4 apart, 80 cells wide) |
| `showtime/hooks/themes/dragon.ts` | rewrite | the theme |
| `showtime/README.md`, `showtime/README.en.md` | modify | dragon's line |
| `showtime/assets/dragon.png`, `assets/review/dragon.png`, `assets/gallery.png` | regenerate | sheets |

---

### Task 1: The 16-bit pixel kit (`hooks/pixel.ts`)

**Goal:** A small shared module for shaded, mirrored sprites, sky gradients and speed-limited paths, with unit tests.

**Files:**
- Create: `showtime/hooks/pixel.ts`
- Test: `showtime/tests/pixel.test.ts`

**Acceptance Criteria:**
- [ ] `mix`, `paint`, `sprite`, `sky`, `ease`, `along` exported with the signatures below
- [ ] `along` never moves more than 1 px between consecutive ages when every leg's duration is at least its longest axis distance
- [ ] `claude plugin test showtime` reports `0 fail` with the new file counted; `tsc` clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK` → `0 fail`, `across 4 files`, `TSC-OK`

**Steps:**

- [ ] **Step 1: Write the failing tests** in `showtime/tests/pixel.test.ts`:

```ts
import { expect, test } from 'claude-code/testing'

import { canvas } from '../hooks/cells'
import { along, ease, mix, paint, sky, sprite } from '../hooks/pixel'

test('mix blends two colours and clamps k', () => {
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  expect(mix('#102030', '#ffffff', 0)).toBe('#102030')
  expect(mix('#102030', '#ffffff', 2)).toBe('#ffffff')
})

test('paint keys a material as highlight, base, shadow, outline', () => {
  const k = paint('HBSO', '#e63946')
  expect(k.B).toBe('#e63946')
  expect(Object.keys(k)).toEqual(['H', 'B', 'S', 'O'])
  expect(k.H).not.toBe(k.B)
  expect(k.O).not.toBe(k.S)
})

test('sprite draws keyed art and mirrors it facing left', () => {
  const cv = canvas(4, 1)
  sprite(cv, 0, 0, ['AB'], { A: '#111111', B: '#222222' }, 1)
  expect(cv.px.slice(0, 2)).toEqual(['#111111', '#222222'])
  const cv2 = canvas(4, 1)
  sprite(cv2, 0, 0, ['AB'], { A: '#111111', B: '#222222' }, -1)
  expect(cv2.px.slice(0, 2)).toEqual(['#222222', '#111111'])
})

test('sky paints every pixel of its rows, top colour first', () => {
  const cv = canvas(3, 2)
  sky(cv, '#000000', '#ffffff', 0, 3)
  for (let i = 0; i < 12; i++) expect(cv.px[i]).toBeDefined()
  expect(cv.px[0]).toBe('#000000')
  expect(cv.px[3 * 3]).toBe('#ffffff')
  expect(cv.px[0]).toBe(cv.px[2])
})

test('ease runs 0 to 1, flat at the ends', () => {
  expect(ease(-1)).toBe(0)
  expect(ease(0)).toBe(0)
  expect(ease(0.5)).toBe(0.5)
  expect(ease(1)).toBe(1)
  expect(ease(3)).toBe(1)
})

test('along walks waypoints at most one pixel a frame and holds the ends', () => {
  const pts = [{ x: 0, y: 0, at: 0 }, { x: 10, y: 4, at: 12 }, { x: 10, y: 4, at: 20 }, { x: -5, y: 0, at: 40 }]
  let last = along(pts, -3)
  expect(last).toEqual({ x: 0, y: 0 })
  for (let a = -2; a <= 45; a++) {
    const p = along(pts, a)
    expect(Math.abs(p.x - last.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(p.y - last.y)).toBeLessThanOrEqual(1)
    last = p
  }
  expect(along(pts, 40)).toEqual({ x: -5, y: 0 })
  expect(along(pts, 99)).toEqual({ x: -5, y: 0 })
})
```

- [ ] **Step 2: Run to see it fail.** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -5` → fails: cannot resolve `../hooks/pixel`.

- [ ] **Step 3: Write `showtime/hooks/pixel.ts`:**

```ts
// The 16-bit kit the 2.0 themes share: materials shaded in four tones, keyed sprites that face either way, a sky
// gradient, and paths that move at most a pixel a frame.
import { plot } from './cells'
import type { Canvas } from './cells'

/** `a` blended toward `b` by `k` (clamped to 0..1), both `#rrggbb`. */
export function mix(a: string, b: string, k: number): string {
  const q = Math.max(0, Math.min(1, k))
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * q).toString(16).padStart(2, '0')
  return '#' + at(0) + at(1) + at(2)
}

const COOL = '#1b1f3b'
const WARM = '#fff6d5'

/** A material in four tones keyed by the four characters of `keys`: highlight, base, shadow, outline. Shadows lean
 * cool and highlights warm, the way 16-bit palettes shade. */
export function paint(keys: string, base: string): Record<string, string> {
  const [h, b, s, o] = [...keys] as [string, string, string, string]
  return { [h]: mix(base, WARM, 0.45), [b]: base, [s]: mix(base, COOL, 0.35), [o]: mix(base, COOL, 0.65) }
}

/** Draws `art` (rows of keys, `.` or an unknown key clear) with its left edge at `x`, mirrored when `face` is -1;
 * each colour passes through `ink` (for fades and flashes). */
export function sprite(cv: Canvas, x: number, y: number, art: readonly string[], keys: Record<string, string>,
  face: 1 | -1 = 1, ink: (c: string) => string = c => c): void {
  const w = Math.max(...art.map(r => r.length))
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = keys[row[i]!]
      if (c) plot(cv, face > 0 ? x + i : x + w - 1 - i, y + j, ink(c))
    }
  })
}

/** Fills pixel rows `from`..`to` (inclusive, clipped to the canvas) with a vertical gradient, `top` to `bottom`. */
export function sky(cv: Canvas, top: string, bottom: string, from: number, to: number): void {
  const [a, b] = [Math.max(0, from), Math.min(cv.h - 1, to)]
  for (let y = a; y <= b; y++) {
    const c = mix(top, bottom, b === a ? 0 : (y - a) / (b - a))
    for (let x = 0; x < cv.w; x++) plot(cv, x, y, c)
  }
}

/** Smoothstep: 0 below 0, 1 above 1, easing in and out between. */
export function ease(u: number): number {
  return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u)
}

export type Waypoint = { x: number; y: number; at: number }

/** Where a path is at `age`: straight legs between waypoints (sorted by `at`), holding the first before it and the
 * last after it. A leg moves at most a pixel a frame when its duration is at least its longest axis distance. */
export function along(points: readonly Waypoint[], age: number): { x: number; y: number } {
  const first = points[0]!
  if (age <= first.at) return { x: first.x, y: first.y }
  for (let i = 1; i < points.length; i++) {
    const [p, q] = [points[i - 1]!, points[i]!]
    if (age <= q.at) {
      const u = q.at === p.at ? 1 : (age - p.at) / (q.at - p.at)
      return { x: Math.round(p.x + (q.x - p.x) * u), y: Math.round(p.y + (q.y - p.y) * u) }
    }
  }
  const last = points[points.length - 1]!
  return { x: last.x, y: last.y }
}
```

- [ ] **Step 4: Run to see it pass.** Same command as Verify → `0 fail`, `TSC-OK`.

- [ ] **Step 5: Commit.**

```bash
cd ~/code/claudebro/claude-mods && git branch --show-current   # main
git add showtime/hooks/pixel.ts showtime/tests/pixel.test.ts
git commit -m "showtime: a 16-bit pixel kit for the 2.0 themes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/pixel.ts", "showtime/tests/pixel.test.ts"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK", "acceptanceCriteria": ["mix, paint, sprite, sky, ease, along exported with the plan's signatures", "along moves at most 1 px per age step on legs whose duration >= distance", "plugin test 0 fail, tsc clean"], "modelTier": "mechanical"}
```

---

### Task 2: The set-piece scheduler (`hooks/events.ts`)

**Goal:** A pure function of `t` that says which set piece (or, rarely, which easter egg) plays now, with every set piece once per round in a fresh order and never the same twice in a row.

**Files:**
- Create: `showtime/hooks/events.ts`
- Test: `showtime/tests/events.test.ts`

**Acceptance Criteria:**
- [ ] `slotAt(t, len, kinds, seed, eggs?, eggChance?)` returns `{ index, age, len, kind, egg }`, `0 <= age < len`, for negative `t` too
- [ ] With `kinds >= 3` each round of `kinds` slots is a permutation; across 2000 slots no two neighbours share a kind (kinds 2..9)
- [ ] Eggs: rate within [1/70, 1/25] over 20 000 slots at `eggChance` 1/40; never two eggs in neighbouring slots; `egg` is -1 when none
- [ ] `firstSlot` and `eggSlot` return a slot start `t` where that kind / egg plays
- [ ] plugin test `0 fail`, `tsc` clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK` → `0 fail`, `TSC-OK`

**Steps:**

- [ ] **Step 1: Write the failing tests** in `showtime/tests/events.test.ts`:

```ts
import { expect, test } from 'claude-code/testing'

import { eggSlot, firstSlot, slotAt } from '../hooks/events'

test('a slot knows its index and age, for negative t too', () => {
  for (let t = -500; t < 2000; t += 7) {
    const s = slotAt(t, 160, 6, 3)
    expect(s.age).toBeGreaterThanOrEqual(0)
    expect(s.age).toBeLessThan(160)
    expect(s.index * 160 + s.age).toBe(t)
    expect(s.len).toBe(160)
  }
})

test('every round plays each kind once, and no kind plays twice in a row', () => {
  for (let kinds = 2; kinds <= 9; kinds++) {
    let prev = -1
    for (let i = 0; i < 2000; i++) {
      const k = slotAt(i * 10, 10, kinds, 5).kind
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(kinds)
      expect(k).not.toBe(prev)
      prev = k
    }
    if (kinds >= 3) {
      for (let r = 0; r < 50; r++) {
        const round = Array.from({ length: kinds }, (_, j) => slotAt((r * kinds + j) * 10, 10, kinds, 5).kind)
        expect([...round].sort((a, b) => a - b)).toEqual(Array.from({ length: kinds }, (_, j) => j))
      }
    }
  }
})

test('eggs are rare, never back to back, and -1 when there are none', () => {
  let n = 0
  let prev = -1
  for (let i = 0; i < 20000; i++) {
    const e = slotAt(i * 10, 10, 6, 9, 3, 1 / 40).egg
    expect(e).toBeLessThan(3)
    if (e >= 0) {
      n++
      expect(prev).toBe(-1)
    }
    prev = e
  }
  expect(n / 20000).toBeGreaterThanOrEqual(1 / 70)
  expect(n / 20000).toBeLessThanOrEqual(1 / 25)
  expect(slotAt(123, 10, 6, 9).egg).toBe(-1)
})

test('the same t always gives the same slot', () => {
  expect(slotAt(4321, 160, 6, 2, 3, 1 / 40)).toEqual(slotAt(4321, 160, 6, 2, 3, 1 / 40))
})

test('firstSlot and eggSlot find a slot start where that kind or egg plays', () => {
  for (let k = 0; k < 6; k++) {
    const t = firstSlot(k, 160, 6, 2, 3, 1 / 40)
    const s = slotAt(t, 160, 6, 2, 3, 1 / 40)
    expect(s.age).toBe(0)
    expect(s.kind).toBe(k)
    expect(s.egg).toBe(-1)
  }
  for (let e = 0; e < 3; e++) {
    const t = eggSlot(e, 160, 6, 2, 3, 1 / 40)
    const s = slotAt(t, 160, 6, 2, 3, 1 / 40)
    expect(s.age).toBe(0)
    expect(s.egg).toBe(e)
  }
})
```

- [ ] **Step 2: Run to see it fail** (cannot resolve `../hooks/events`).

- [ ] **Step 3: Write `showtime/hooks/events.ts`:**

```ts
// Set pieces by `t` alone. Time is cut into slots of `len` frames; each plays one of `kinds` set pieces, every one
// once per round of `kinds` slots in a fresh order, never the same twice in a row. Now and then (`eggChance`) a slot
// plays one of `eggs` easter eggs instead, never two slots running.
import { mod, noise } from './cells'

export type Slot = { index: number; age: number; len: number; kind: number; egg: number }

/** Round `round`'s order: a shuffle seeded by the round. */
function shuffled(round: number, kinds: number, seed: number): number[] {
  const a = Array.from({ length: kinds }, (_, i) => i)
  for (let i = kinds - 1; i > 0; i--) {
    const j = Math.floor(noise(seed * 977 + round * 131 + i * 17) * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** The kind in slot `index`. Rounds of three or more swap their first two when the first would repeat the last
 * round's last (the last never moves, so the check never chains); two kinds simply alternate. */
function kindAt(index: number, kinds: number, seed: number): number {
  if (kinds <= 1) return 0
  if (kinds === 2) return mod(index + seed, 2)
  const round = Math.floor(index / kinds)
  const a = shuffled(round, kinds, seed)
  if (a[0] === shuffled(round - 1, kinds, seed)[kinds - 1]) [a[0], a[1]] = [a[1]!, a[0]!]
  return a[index - round * kinds]!
}

/** Whether slot `index` rolls an egg (before the no-two-running rule). */
const rolls = (index: number, seed: number, chance: number) => noise(seed * 31 + index * 7.31 + 0.5) < chance

export function slotAt(t: number, len: number, kinds: number, seed: number, eggs = 0, eggChance = 0): Slot {
  const index = Math.floor(t / len)
  const age = t - index * len
  const isEgg = eggs > 0 && rolls(index, seed, eggChance) && !rolls(index - 1, seed, eggChance)
  const egg = isEgg ? Math.floor(noise(seed * 17 + index * 3.17 + 0.25) * eggs) : -1
  return { index, age, len, kind: kindAt(index, kinds, seed), egg }
}

/** The start of the first slot from `t = 0` playing set piece `kind` (no egg), for sheets and tests. */
export function firstSlot(kind: number, len: number, kinds: number, seed: number, eggs = 0, eggChance = 0): number {
  for (let i = 0; i < 1000; i++) {
    const s = slotAt(i * len, len, kinds, seed, eggs, eggChance)
    if (s.kind === kind && s.egg < 0) return i * len
  }
  throw new Error(`no slot plays kind ${kind}`)
}

/** The start of the first slot from `t = 0` playing easter egg `egg`. */
export function eggSlot(egg: number, len: number, kinds: number, seed: number, eggs: number, eggChance: number): number {
  for (let i = 0; i < 200000; i++) if (slotAt(i * len, len, kinds, seed, eggs, eggChance).egg === egg) return i * len
  throw new Error(`no slot plays egg ${egg}`)
}
```

- [ ] **Step 4: Run to see it pass** (Verify command). If the egg-rate test misses its band, change the noise multiplier in `rolls` (e.g. `7.31` → `5.77`) rather than widening the band.

- [ ] **Step 5: Commit.**

```bash
cd ~/code/claudebro/claude-mods && git add showtime/hooks/events.ts showtime/tests/events.test.ts
git commit -m "showtime: a t-only scheduler for set pieces and easter eggs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/events.ts", "showtime/tests/events.test.ts"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK", "acceptanceCriteria": ["slotAt returns index/age/len/kind/egg with 0<=age<len for negative t too", "rounds of >=3 kinds are permutations; no neighbouring repeats for kinds 2..9 over 2000 slots", "egg rate in [1/70,1/25] at chance 1/40 over 20000 slots, never back to back, -1 when none", "firstSlot/eggSlot return a slot start playing that kind/egg", "plugin test 0 fail, tsc clean"], "modelTier": "mechanical"}
```

---

### Task 3: Opaque scenes and showcase strips (types, tests, sheet)

**Goal:** Themes can declare `opaque` (they paint every cell) and `showcase` (moments the review sheet must show); the motion tests judge opaque scenes by colour, a new test makes opaque scenes paint every cell, and `shots.ts` renders showcase strips. Nothing changes for the 38 current themes.

**Files:**
- Modify: `showtime/hooks/themes.ts` (the `Theme` type, after `scene`)
- Create: `showtime/tests/motion.ts`
- Modify: `showtime/tests/scenes.test.ts` (the `ink`/`edges` helpers and the polished-motion test; one new test)
- Modify: `showtime/scripts/shots.ts` (`strips`, `sheet`)

**Acceptance Criteria:**
- [ ] `Theme` has `opaque?: boolean` and `showcase?: (w: number) => Showcase[]` with `Showcase = { name: string; t: number; s?: Partial<Signals> }`
- [ ] For non-opaque themes the motion test behaves exactly as before (same `ink`/`edges` logic, moved into `tests/motion.ts`)
- [ ] New test "opaque scenes paint every cell" passes vacuously today (no opaque theme yet)
- [ ] `bun scripts/shots.ts --theme clawd` output is byte-identical to before (`git status --short showtime/assets` clean)
- [ ] plugin test `0 fail`, `tsc` clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme clawd) && git status --short showtime/assets` → `0 fail`, `TSC-OK`, no asset changes

**Steps:**

- [ ] **Step 1: Extend the `Theme` type** in `showtime/hooks/themes.ts`, right after the `scene` field:

```ts
  /** The scene paints every cell (a sky, a wall): tests judge its motion by colour, not by ink. */
  opaque?: boolean
  /** Moments the review sheet shows besides the standard strips (set pieces, easter eggs), for width `w`. */
  showcase?: (w: number) => Showcase[]
```

and above the `Theme` type:

```ts
/** A moment for the review sheet: a label, a frame and the signals then. */
export type Showcase = { name: string; t: number; s?: Partial<Signals> }
```

- [ ] **Step 2: Create `showtime/tests/motion.ts`** (shared helpers; not a test file itself):

```ts
// Helpers the scene tests share: how a frame's cells compare, where its shapes' edges are, how much changed.
import type { Grid } from '../hooks/cells'

/** Each cell as a signature: over the terminal's background only ink counts (a space or not); an opaque scene
 * paints every cell, so there the glyph and both colours count. */
export function sigs(g: Grid, opaque = false): string[][] {
  return g.map(row => row.map(c => (opaque ? `${c.ch}${c.c ?? ''}/${c.bg ?? ''}` : c.ch === ' ' ? ' ' : 'x')))
}

/** Where shapes start in a row: for ink, the first column of each run of ink; for an opaque row, every column
 * whose cell differs from the one on its left. */
export function edgesOf(line: string[], opaque = false): number[] {
  const out: number[] = []
  for (let x = 0; x < line.length; x++) {
    if (opaque ? x > 0 && line[x] !== line[x - 1] : line[x] === 'x' && (x === 0 || line[x - 1] !== 'x')) out.push(x)
  }
  return out
}

/** How many cells differ between two frames of the same size (glyph or either colour). */
export function changed(a: Grid, b: Grid): number {
  let n = 0
  a.forEach((row, r) => row.forEach((c, x) => {
    const d = b[r]![x]!
    if (c.ch !== d.ch || c.c !== d.c || c.bg !== d.bg) n++
  }))
  return n
}

/** The first jump between two frames, or null: an edge in `now` with no edge of `last` within a cell, in its row
 * or the rows above and below (shapes entering at the outer two columns count as arriving). */
export function jump(last: string[][], now: string[][], opaque: boolean): { row: number; x: number } | null {
  const w = now[0]?.length ?? 0
  for (let r = 0; r < now.length; r++) {
    const a = [last[r - 1], last[r], last[r + 1]].flatMap(line => (line ? edgesOf(line, opaque) : []))
    for (const x of edgesOf(now[r]!, opaque)) {
      if (!(a.some(y => Math.abs(y - x) <= 1) || x <= 1 || x >= w - 2)) return { row: r, x }
    }
  }
  return null
}
```

- [ ] **Step 3: Use it in `showtime/tests/scenes.test.ts`.** Delete the local `ink` and `edges` functions and replace the body of `'polished scenes never hold a frame and never jump a shape more than a cell'` with:

```ts
  for (const name of THEME_NAMES) {
    if (!POLISHED.has(name)) continue
    const theme = THEMES[name]
    const opaque = theme.opaque === true
    for (const act of ACTS) {
      let last = sigs(theme.scene(0, W, sig({ act, actAge: 30 })), opaque)
      for (let t = 1; t < 60; t++) {
        const now = sigs(theme.scene(t, W, sig({ act, actAge: 30 + t })), opaque)
        expect(now.map(r => r.join('')).join('\n')).not.toBe(last.map(r => r.join('')).join('\n'))
        const j = jump(last, now, opaque)
        expect(j, `${name} ${act} t=${t} row ${j?.row} edge at ${j?.x} jumped`).toBeNull()
        last = now
      }
    }
  }
```

Add `import { jump, sigs } from './motion'` at the top. Then add a new test after it:

```ts
test('opaque scenes paint every cell', { timeoutMs: SWEEP_MS }, () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    if (!theme.opaque) continue
    for (const w of [16, 40, 80, 160]) {
      for (const s of [sig({}), sig({ act: 'ask', actAge: 5 }), sig({ act: 'tool', tool: 'bash', actAge: 9 }), sig({ news: 'testPass', newsAge: 8 })]) {
        for (const t of [0, 77, 1234]) {
          theme.scene(t, w, s).forEach((row, r) => row.forEach((c, x) => {
            expect(c.c !== undefined || c.bg !== undefined, `${name} w=${w} t=${t} cell ${x},${r} is bare`).toBe(true)
          }))
        }
      }
    }
  }
})
```

(The old `edges` behaviour is preserved exactly for non-opaque themes: same run-start rule, same ±1 cell and ±1 row tolerance, same edge-of-screen allowance.)

- [ ] **Step 4: Showcase strips in `showtime/scripts/shots.ts`.** Add constants under `FRAMES`:

```ts
/** Showcase strips: frames per strip, frames between them, and their width in cells. */
const SHOW_FRAMES = 6
const SHOW_STEP = 4
const SHOW_W = 80
```

Change `strips` to return each strip's width and append the showcase ones at the end (before `return out`):

```ts
function strips(theme: Theme): { name: string; frames: Grid[]; w: number }[] {
  const acts: Act[] = ['think', 'tool', 'ask', 'say']
  const twelve = (f: (i: number) => Signals, t0 = 40) => Array.from({ length: FRAMES }, (_, i) => theme.scene(t0 + i, W, f(i)))
  const out = acts.map(act => ({ name: act, frames: twelve(i => sig({ act, actAge: 30 + i })), w: W }))
  out.push({ name: 'think t0', frames: twelve(i => sig({ act: 'think', actAge: i }), 0), w: W })
  out.push({ name: 'agents 2', frames: twelve(i => sig({ agents: 2, agentsAge: i })), w: W })
  out.push({ name: 'done 3/7', frames: twelve(i => sig({ done: 3, total: 7, doneAge: i })), w: W })
  out.push({ name: 'done 7/7', frames: twelve(i => sig({ done: 7, total: 7, doneAge: i })), w: W })
  for (const news of ['testFail', 'testPass', 'commit'] as const) for (const age of [0, 8, 20]) out.push({ name: `${news} ${age}`, frames: twelve(i => sig({ news, newsAge: age + i })), w: W })
  out.push({ name: 'tool bash', frames: twelve(i => sig({ act: 'tool', tool: 'bash', actAge: 30 + i, toolAge: 30 + i })), w: W })
  for (const m of theme.showcase?.(SHOW_W) ?? []) {
    const frames = Array.from({ length: SHOW_FRAMES }, (_, i) => theme.scene(m.t + i * SHOW_STEP, SHOW_W, sig({ ...m.s })))
    out.push({ name: m.name, frames, w: SHOW_W })
  }
  return out
}
```

In `sheet`, size the image for the wider of the two strip kinds and place frames by each strip's width:

```ts
  const width = Math.max(FRAMES * (W * SCALE + GAP), SHOW_FRAMES * (SHOW_W * SCALE + GAP)) + GAP
  const img = image(width, rows.length * stripH + 4 * petStripH + GAP)
  rows.forEach((strip, r) => {
    const y = r * stripH
    label(img, `${theme.name} ${strip.name}`, GAP, y + 2)
    strip.frames.forEach((g, i) => blit(img, g, GAP + i * (strip.w * SCALE + GAP), y + LABEL_H))
  })
```

For themes without `showcase`, `Math.max(...)` is `FRAMES * (W * SCALE + GAP)` (2376 ≥ 1956), so the sheet is unchanged.

- [ ] **Step 5: Verify** (command above). Expected: `0 fail`, `TSC-OK`, and `git status --short showtime/assets` prints nothing after re-rendering clawd.

- [ ] **Step 6: Commit.**

```bash
cd ~/code/claudebro/claude-mods && git add showtime/hooks/themes.ts showtime/tests/motion.ts showtime/tests/scenes.test.ts showtime/scripts/shots.ts
git commit -m "showtime: opaque scenes and showcase strips for the 2.0 themes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/themes.ts", "showtime/tests/motion.ts", "showtime/tests/scenes.test.ts", "showtime/scripts/shots.ts"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme clawd) && git status --short showtime/assets", "acceptanceCriteria": ["Theme has opaque?: boolean and showcase?: (w) => Showcase[]", "non-opaque motion test logic unchanged, helpers moved to tests/motion.ts", "new 'opaque scenes paint every cell' test passes", "clawd sheet byte-identical (no asset changes)", "plugin test 0 fail, tsc clean"], "modelTier": "standard"}
```

---

## Dragon design (Tasks 4–6 build this)

Coordinates are pixels: `x` 0..w-1, `y` 0..11 (cell row = `y >> 1`). Full layout at `w >= 44`; the narrow fallbacks are at the end.

**Palette (bright and sunny):** sky `#2f80ed` (y 0) → `#9fd8ff` (y 8); sun `#ffe066`, core `#fff3b0`, rays `#ffd166`; clouds `#ffffff` with shade `#d6e6f5`; far hills `#6fbf73` / shade `#4f9a5a`; grass `#5cbf3a` / `#47a02c`; flowers `#ff6b6b` `#ffd166` `#ffffff` `#c77dff`; stone `paint('ABCD', '#a9a9bc')`; roof `paint('EFGH', '#d62839')`; banner gold `#ffb703`; dragon scales `paint('RrqQ', '#e63946')`, belly `#ffd6a5`, wing membrane `paint('WwvV', '#ffb703')`, horns `#fff3b0`, eye `#fffbe6` with pupil `#1b1f3b`; knight steel `paint('KkjJ', '#c0c8d8')`, tabard `#3a86ff`, plume `#ff595e`, shield `#3a86ff` with a gold `#ffd166` cross; princess dress `#ff8fab` / `#ff5d8f`, hair `#ffd166`, skin `#f6c9a8`, crown `#ffd60a`.

**Layers, back to front (fixed stage, nothing scrolls by itself):**

| Layer | Where | Motion (all ≤ 1 px/frame) |
|---|---|---|
| Sky gradient | y 0–9, every column | static |
| Sun | 5×5 disc at x `w-9`, y 0–4 | rays (8 pixels around it) alternate two patterns every 6 frames; core shimmer every 10 |
| Clouds | 2–4 (by width), 7×2 to 10×3 puffs, y 0–4 | drift left 1 px per 6 frames, wrap |
| Far hills | y 6–9, `sin`-shaped, two tones | static; a flock of 2–3 birds (2 px `v`) crosses every ~90 frames |
| Castle | x 1–22, y 0–11 | stone keep (y 4–11) with merlons, gate (dark wood y 8–11), main tower x 14–19 up to y 2 with a red conical roof (y 0–2), the gold pennant on top waving 4 frames; the **princess window** on the tower at y 4–5 |
| Banners (tasks) | on the keep's merlons, one per task (max 6, 3 px apart) | furled grey 1×2 while open; unfurled 2×3 in banner gold, waving 4 frames, once done; the newest unrolls 1 px/frame over 3 frames |
| Archers | 2 on the keep wall (3×3 px), y 2–4 | bob a pixel on 12 frames, offset |
| Grass | y 10–11 | tufts sway (shade swap per tuft every 8 frames, offset); flowers fixed |
| Knight | home x `26`, feet on y 10 (sprite 7×8, y 3–10) | idle: breathes (plume bobs 1 px on 16 frames), shifts weight on 24 |
| Dragon | patrol over x `30`..`w-14`, y 0–6 | figure-eight by `t` (pixel `y` via `sin`, period long enough for ≤ 1 px/frame), wings on an 8-frame cycle of 4 shapes (up, mid, down, mid) |
| Wyverns (agents) | trail the dragon on its path, a fifth of a loop apart, max 4 | own 4-frame wings; the newest flashes white on even frames for 8 frames after `agentsAge` 0 |
| Effects | over everything | fire, sparks, smoke, arrows, rings (below) |
| Sign glyph | cell (0, 0) | the act's glyph as today, drawn with `bg` set to the sky colour under it |

**Sprites (16-bit: outline, shadow, base, highlight on every material).** The dragon is 16×7 px facing right (tail left, head right), with horns, an eye with a pupil, a belly band, two legs with claws, and a membrane wing whose four poses keep the body still. The knight is 7×8 px (plumed helm, visor slit, tabard over mail, shield on the far arm, sword). The princess shows 3×2 px in the window (crown, hair, face) and 3×6 px full figure for the egg. These sizes are the budget; draw them in `dragon.ts` as keyed string art with `paint(...)` materials, then refine them on the review sheet (Task 7). Starting knight (`J` outline, `K` highlight, `k` steel, `j` steel shadow, `P` plume, `F` visor, `T` tabard, `S` shield, `C` shield cross, `B` blade, `G` hilt, `M` boots):

```
..PP...
.JKkJ..
.JkFJ.B
SSJTTJB
SCSTTGG
SSJTTJ.
..k.k..
.MM.MM.
```

**What the turn shows (signals):**

| Signal | Dragon scene |
|---|---|
| think / wait | patrol; the princess shows in her window on 3 frames out of 60 (a glance out) |
| tool `bash` | fire breath: a cone of particles from the jaws along the facing, down-forward, growing 1 px/frame to 10 px, three tones (`#fff3b0`, `#ffd60a`, `#fb8500`) flickering per frame, smoke pixels (`#e9ecef`, `#adb5bd`) peeling off the tip; if the cone's tip is over the knight, he raises his shield (pose change) and sparks bounce off it |
| tool other | sparks from the nose in the tool's colour (`TOOL_INK` as today) and the wing tinted toward it over 4 frames |
| ask | the princess leans out of her window waving (2-frame wave) with a `?` glyph beside the window (sky `bg`) |
| say | jaws open on 3 of every 6 frames, small sound rings (3 px arcs) leave the jaws 1 px/frame |
| `agents` | wyverns as above |
| `done`/`total` | banners as above |

**Set pieces (`slotAt(t, EVENT_LEN = 160, 6, DRAGON_SEED = 7, 3, 1/40)`).** Each runs on the slot's `age`. At `age` 0 and `age` 159 every actor stands at its home pose (the dragon at its patrol pose for that `t`): paths start from and return to those poses with `along(...)`, so slot boundaries never jump. Actors that are not home leave and arrive through the screen edges or walk/fly in place at ≤ 1 px/frame.

| # | Name | Beats (ages) |
|---|---|---|
| 0 | strafe | 20–60 the dragon leaves its patrol and dives to y 3 heading for the knight; 60–95 breathes fire at him; the knight raises his shield; fire splashes off in sparks; 95–150 climbs back to its patrol pose |
| 1 | charge | 15–55 the knight runs right (4-frame run cycle) under the dragon's path; 55–70 leaps 3 px and slashes (a 3-frame white arc); the dragon flinches (white for 2 frames, knocked up 2 px, back over 6); 80–150 the knight walks back to his post |
| 2 | tower | 20–70 the dragon flies to the princess's tower and circles it once; she ducks (gone from the window) at 50–80 and pops back; 60–110 the archers loose three arrows that arc and miss; 110–155 it returns to patrol |
| 3 | catapult | 10–40 a catapult's arm rises over the keep's merlons; 40–90 it flings a boulder (3×3 px, grey ramp) in a parabola at the dragon; the dragon barrel-rolls (wing poses run backwards for 8 frames) and the boulder lands in the grass right of the knight with a dust puff (6 px, fades over 12 frames); 90–130 the arm lowers |
| 4 | landing | 20–60 the dragon descends to the far grass on the right (feet on y 10), folds its wings; 60–90 roars: rings out of its jaws 1 px/frame, grass flattens in a wave away from it, 2 birds burst off the hills; 100–155 takes off back to patrol |
| 5 | sheep | 0–30 three sheep (4×3 px, white with grey shade, legs stepping) walk in from the right edge and graze; 40–80 the dragon swoops at them, they scatter (two run off right, one bolts left behind the knight); 80–100 it snaps at a hay bale instead, which bursts into straw pixels that fall 1 px/frame; 100–159 the sheep are gone off the edges, the dragon is back on patrol |

**Easter eggs (rare; same home rule):**

| # | Name | Beats |
|---|---|---|
| 0 | frying pan | the princess slides down a rope from her window (1 px/frame), bonks the dragon with a frying pan when it passes low (white flash, 3 stars circling its head for 30 frames), climbs back |
| 1 | Clawd cameo | Clawd (the crab-ish orange mascot, shape from `CLAWD_SHAPE` in `hooks/pets.ts`, scaled to ~6×4 px) rides across the grass left to right on a small horse with a lance, tipping it at the dragon as he passes |
| 2 | hatchling | the pet's hatchling (small version, 6×4 px) flies up from behind the hills, follows the dragon for a loop, both do a barrel roll together, it flies off right |

**Reactions (on top of whatever plays; all over by `newsAge` 30, nothing left at 30+):**

| News | Look | Min. changed cells vs. no news, `newsAge` 4–20, w 80 |
|---|---|---|
| testPass | 3 fireworks rise from the castle (ages 0–6, 1 px/frame), burst at 6–24 into 8-ray stars in gold, green `#80ed99` and pink `#ff8fab` that fade by 28; the knight raises his sword overhead (2 poses, 4–24); the banners flash gold on even frames | ≥ 40 |
| testFail | a fire blast catches the knight: he is knocked back 3 px (1 px/frame), sits down with 3 stars circling his helm (6–24), smoke puff, gets up by 28 | ≥ 15 |
| commit | the dragon stops where it is and roars (jaws open), rings run out along its facing 1 px/frame (ring ink `#fff3b0`→`#bc6c25`), the tower's royal banner unfurls gold (3×4 px) and confetti (6 px) falls from the battlements | ≥ 25 |

**Narrow widths:** `w < 44`: no far hills, no knight, no archers, castle reduced to the tower (x 0–5); set pieces 1, 3 and 5 and eggs 0 and 1 fall back to piece 2's dragon path without the extra actors; testFail becomes an arrow hitting the dragon (white flash, a puff). `w < 24`: sky, sun, one cloud and the dragon only. Every width still paints every cell and passes the generic tests.

**Code layout of `dragon.ts`:** constants and palette; sprite art; small drawers (`skyAndSun`, `clouds`, `hills`, `castle`, `banners`, `archers`, `grass`, `knight`, `princess`, `dragon`, `wyvern`, `fire`, `sparks`, `rings`, `fireworks`, …); `patrol(t, w)`; one function per set piece and egg returning actor poses for an `age` (`strafe(age, home)`, …); `dragonScene(t, w, s, opts?)`; `PET` unchanged; `DRAGON` with `rows: DRAGON_ROWS`, `opaque: true`, `showcase`. `dragonScene`'s optional fourth argument `{ slot?: Slot | null }` forces a slot (or none) for tests; the theme's `scene` is `(t, w, s) => dragonScene(t, w, s)`.

---

### Task 4: Dragon world at 6 rows (stage, actors, signals)

**Goal:** `dragon.ts` rewritten with the layers, sprites and signal mapping from "Dragon design", no set pieces yet (`slot` always none), 6 rows, opaque, passing every generic test.

**Files:**
- Modify (rewrite): `showtime/hooks/themes/dragon.ts`
- Create: `showtime/tests/dragon.test.ts`
- Regenerate: `showtime/assets/dragon.png`, `showtime/assets/review/dragon.png`

**Acceptance Criteria:**
- [ ] `DRAGON.rows === 6`, `DRAGON.opaque === true`; other themes untouched (`git status --short showtime/assets` lists only dragon files)
- [ ] Every layer in the design table is drawn at w 80; the review sheet shows sky, sun, clouds, hills, castle with princess tower, banners, archers, grass, knight and the dragon
- [ ] The signal table works: bash fire cone (knight shields when in reach), other tools' sparks, ask princess wave with `?`, say jaws and sound rings, wyverns per agent, banners per task
- [ ] All generic tests pass (fills rows and width, never holds or jumps under opaque rules, paints every cell)
- [ ] Sheet self-review verdict written in the commit message (R6 of the 2026-10-24 plan, plus: "reads as 16-bit: every material has at least three tones")

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon) && git status --short showtime/assets` → `0 fail`, `TSC-OK`, only dragon assets changed

**Steps:**

- [ ] **Step 1: Write `showtime/tests/dragon.test.ts`** (the first two tests; Tasks 5–6 add more):

```ts
import { expect, test } from 'claude-code/testing'

import { IDLE_SIGNALS, THEMES } from '../hooks/themes'
import type { Signals } from '../hooks/themes'
import { dragonScene } from '../hooks/themes/dragon'
import { changed } from './motion'

const sig = (over: Partial<Signals>): Signals => ({ ...IDLE_SIGNALS, ...over })

test('dragon is a 6-row opaque scene', () => {
  expect(THEMES.dragon.rows).toBe(6)
  expect(THEMES.dragon.opaque).toBe(true)
  expect(dragonScene(40, 80, sig({}), { slot: null })).toHaveLength(6)
})

test('dragon reacts to every signal it promises', () => {
  const base = (s: Partial<Signals>) => dragonScene(200, 80, sig(s), { slot: null })
  const idle = base({ act: 'think', actAge: 30 })
  expect(changed(base({ act: 'tool', tool: 'bash', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ act: 'tool', tool: 'search', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'ask', actAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'say', actAge: 31 }), idle)).toBeGreaterThanOrEqual(2)
  expect(changed(base({ agents: 2, agentsAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ done: 3, total: 5, doneAge: 30 }), base({ done: 0, total: 5, doneAge: 30 }))).toBeGreaterThanOrEqual(3)
})
```

- [ ] **Step 2: Run to see it fail** (`dragonScene` has no fourth parameter / rows is 4).

- [ ] **Step 3: Rewrite `showtime/hooks/themes/dragon.ts`** per "Dragon design": rows and opacity, palette, every layer in the table, the sprites (16-bit materials via `paint`), `patrol`, the signal table, narrow fallbacks, `PET` unchanged, `DRAGON` with `rows: DRAGON_ROWS` (6), `opaque: true`, `scene: (t, w, s) => dragonScene(t, w, s)`. Keep from the current file what still fits: `geoOf`/`fly`'s figure-eight idea (now with pixel `y`), `grown` (the cone grows only on frames the head holds still), `TOOL_INK`/`TOOL_SIGN`/`sign`, the wyvern trailing. Start the header comment in the style of the current one (what the scene is, then what each signal does).

- [ ] **Step 4: Run the Verify command.** Fix until `0 fail`. The opaque motion test is strict: if it reports a jump, find the layer (step `t` near the report and diff the rows) and slow it or give it in-between poses; don't loosen the test.

- [ ] **Step 5: Review the sheet** (R6): Read `showtime/assets/review/dragon.png` and `showtime/assets/dragon.png` and judge: (1) subject reads at a glance at 80 and at 48; (2) every layer moves across the strips; (3) no jumps; (4) every signal strip differs visibly from think; (5) every material shows 3–4 tones; (6) not cluttered: the dragon and the knight stand out from the background (contrast, outlines). Fix and repeat up to three rounds.

- [ ] **Step 6: Commit.**

```bash
cd ~/code/claudebro/claude-mods && git add showtime/hooks/themes/dragon.ts showtime/tests/dragon.test.ts showtime/assets/dragon.png showtime/assets/review/dragon.png
git commit -m "showtime: dragon pilot — sunny 6-row castle, knight, princess, 16-bit dragon

verdict: <one line>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/themes/dragon.ts", "showtime/tests/dragon.test.ts", "showtime/assets/dragon.png", "showtime/assets/review/dragon.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon) && git status --short showtime/assets", "acceptanceCriteria": ["DRAGON.rows === 6 and opaque === true; only dragon assets change", "every layer of the design table drawn at w 80 and visible on the sheet", "signal table works: bash fire + shield, tool sparks, ask princess + ?, say jaws + rings, wyverns, banners", "generic tests pass incl. opaque motion and paint-every-cell", "sheet verdict in the commit message"], "modelTier": "frontier"}
```

---

### Task 5: Dragon set pieces and easter eggs

**Goal:** The six set pieces and three easter eggs from "Dragon design" play on `slotAt(t, 160, 6, 7, 3, 1/40)`, every actor home at both ends of a slot, smooth across whole slots, and shown on the sheet.

**Files:**
- Modify: `showtime/hooks/themes/dragon.ts`
- Modify: `showtime/tests/dragon.test.ts`
- Regenerate: `showtime/assets/dragon.png`, `showtime/assets/review/dragon.png`

**Acceptance Criteria:**
- [ ] Each set piece and egg changes ≥ 20 cells vs. no slot at its middle (w 80)
- [ ] At `age` 0 and `age` 159 of every set piece and egg the frame equals the no-slot frame (0 changed cells), at w 44, 80, 160
- [ ] Walking every frame of every set piece and egg (w 80, think) never jumps under the opaque rule
- [ ] `DRAGON.showcase(80)` lists the six set pieces and three eggs at a busy moment; the sheet shows them
- [ ] plugin test `0 fail`, `tsc` clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon)` → `0 fail`, `TSC-OK`

**Steps:**

- [ ] **Step 1: Add the failing tests** to `showtime/tests/dragon.test.ts` (the three imports join the others at the top of the file; the rest goes at the end):

```ts
import { jump, sigs } from './motion'
import { EVENT_LEN, EVENT_KINDS, EGG_KINDS } from '../hooks/themes/dragon'
import type { Slot } from '../hooks/events'

/** Slot `index` forced to set piece `kind` (or egg `egg`) at `age`. */
const forced = (kind: number, egg: number, age: number, index = 3): Slot => ({ index, age, len: EVENT_LEN, kind, egg })
const pieces = [
  ...Array.from({ length: EVENT_KINDS }, (_, k) => ({ kind: k, egg: -1, name: `piece ${k}` })),
  ...Array.from({ length: EGG_KINDS }, (_, e) => ({ kind: 0, egg: e, name: `egg ${e}` })),
]

test('every set piece and egg shows', () => {
  for (const p of pieces) {
    const t = 3 * EVENT_LEN + EVENT_LEN / 2
    const on = dragonScene(t, 80, sig({}), { slot: forced(p.kind, p.egg, EVENT_LEN / 2) })
    const off = dragonScene(t, 80, sig({}), { slot: null })
    expect(changed(on, off), p.name).toBeGreaterThanOrEqual(20)
  }
})

test('every set piece starts and ends with everyone home', () => {
  for (const w of [44, 80, 160]) {
    for (const p of pieces) {
      for (const age of [0, EVENT_LEN - 1]) {
        const t = 3 * EVENT_LEN + age
        const on = dragonScene(t, w, sig({}), { slot: forced(p.kind, p.egg, age) })
        const off = dragonScene(t, w, sig({}), { slot: null })
        expect(changed(on, off), `${p.name} w=${w} age=${age}`).toBe(0)
      }
    }
  }
})

test('set pieces never jump, frame by frame', { timeoutMs: 60_000 }, () => {
  for (const p of pieces) {
    const at = (age: number) => sigs(dragonScene(3 * EVENT_LEN + age, 80, sig({}), { slot: forced(p.kind, p.egg, age) }), true)
    let last = at(0)
    for (let age = 1; age < EVENT_LEN; age++) {
      const now = at(age)
      const j = jump(last, now, true)
      expect(j, `${p.name} age=${age} row ${j?.row} edge ${j?.x}`).toBeNull()
      last = now
    }
  }
})

test('the sheet showcases every set piece and egg', () => {
  const show = THEMES.dragon.showcase?.(80) ?? []
  expect(show).toHaveLength(EVENT_KINDS + EGG_KINDS)
})
```

- [ ] **Step 2: Run to see them fail** (exports missing).

- [ ] **Step 3: Implement** in `dragon.ts`: export `EVENT_LEN = 160`, `EVENT_KINDS = 6`, `EGG_KINDS = 3`, `DRAGON_SEED = 7`, `EGG_CHANCE = 1 / 40`; in `dragonScene` pick `opts.slot` when given (including `null`), else `slotAt(t, EVENT_LEN, EVENT_KINDS, DRAGON_SEED, EGG_KINDS, EGG_CHANCE)`; one function per set piece/egg from the design tables returning actor poses for an `age` given the home poses (paths with `along`, starting and ending at home); draw the extra actors (catapult, boulder, sheep, hay bale, birds, rope, frying pan, Clawd on horseback, hatchling). Add `showcase: w => [...]` returning, for each piece, `{ name: 'piece <name>', t: firstSlot(k, …) + <its busiest age> - 12 }` and, for each egg, `{ name: 'egg <name>', t: eggSlot(e, …) + <busiest age> - 12 }` (`firstSlot`/`eggSlot` from `hooks/events.ts`).

- [ ] **Step 4: Verify** and review the sheet's showcase strips (R6, plus: each set piece reads as what the table says; the scene stays uncluttered while it plays). Up to three rounds.

- [ ] **Step 5: Commit** (`git add` the same four files) with message `showtime: dragon pilot — six set pieces and three easter eggs` + verdict line + co-author line.

```json:metadata
{"files": ["showtime/hooks/themes/dragon.ts", "showtime/tests/dragon.test.ts", "showtime/assets/dragon.png", "showtime/assets/review/dragon.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon)", "acceptanceCriteria": ["each set piece and egg changes >= 20 cells vs no slot at mid-slot (w 80)", "age 0 and age 159 frames equal the no-slot frame at w 44/80/160", "every frame of every piece/egg passes the opaque jump rule", "showcase lists 6 pieces + 3 eggs and the sheet shows them", "plugin test 0 fail, tsc clean"], "modelTier": "frontier"}
```

---

### Task 6: Dragon reactions (testPass, testFail, commit)

**Goal:** The three reactions from "Dragon design" are clearly visible, finish by `newsAge` 30 and leave nothing behind.

**Files:**
- Modify: `showtime/hooks/themes/dragon.ts`
- Modify: `showtime/tests/dragon.test.ts`
- Regenerate: `showtime/assets/dragon.png`, `showtime/assets/review/dragon.png`

**Acceptance Criteria:**
- [ ] At `newsAge` 4, 8, 12, 16, 20 and `t` 40, 200, 777 (w 80): testPass changes ≥ 40 cells vs. no news, testFail ≥ 15, commit ≥ 25
- [ ] At `newsAge` 30, 35, 39 the frame equals the no-news frame (0 changed cells) for all three
- [ ] Narrow (`w` 40) testFail is the arrow on the dragon and still changes ≥ 6 cells
- [ ] plugin test `0 fail`, `tsc` clean; sheet reviewed

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon)` → `0 fail`, `TSC-OK`

**Steps:**

- [ ] **Step 1: Add the failing tests** to `showtime/tests/dragon.test.ts`:

```ts
const MIN = { testPass: 40, testFail: 15, commit: 25 } as const

test('reactions are clearly visible', () => {
  for (const news of ['testPass', 'testFail', 'commit'] as const) {
    for (const t of [40, 200, 777]) {
      for (const newsAge of [4, 8, 12, 16, 20]) {
        const on = THEMES.dragon.scene(t, 80, sig({ news, newsAge }))
        const off = THEMES.dragon.scene(t, 80, sig({}))
        expect(changed(on, off), `${news} t=${t} age=${newsAge}`).toBeGreaterThanOrEqual(MIN[news])
      }
    }
  }
  const on = THEMES.dragon.scene(200, 40, sig({ news: 'testFail', newsAge: 8 }))
  expect(changed(on, THEMES.dragon.scene(200, 40, sig({})))).toBeGreaterThanOrEqual(6)
})

test('reactions are over by newsAge 30, so clearing the news never snaps', () => {
  for (const news of ['testPass', 'testFail', 'commit'] as const) {
    for (const t of [40, 200, 777]) {
      for (const newsAge of [30, 35, 39]) {
        const on = THEMES.dragon.scene(t, 80, sig({ news, newsAge }))
        expect(changed(on, THEMES.dragon.scene(t, 80, sig({}))), `${news} t=${t} age=${newsAge}`).toBe(0)
      }
    }
  }
})
```

- [ ] **Step 2: Run to see them fail** (Task 4's placeholder reactions won't meet the thresholds; if some pass already, keep them as they are).

- [ ] **Step 3: Implement** the reactions table in `dragon.ts` (fireworks, sword salute, banner flash; knight knocked back with stars and smoke, arrow fallback when narrow; roar rings, royal banner, confetti). Reactions draw over set pieces; while the knight is away in a set piece (charge), testFail catches him where he is.

- [ ] **Step 4: Verify** and review the sheet's testFail/testPass/commit strips at ages 0/8/20: each must read at a glance and differ from think. Up to three rounds.

- [ ] **Step 5: Commit** (same four files) with message `showtime: dragon pilot — fireworks, a knocked-down knight and a royal roar` + verdict + co-author.

```json:metadata
{"files": ["showtime/hooks/themes/dragon.ts", "showtime/tests/dragon.test.ts", "showtime/assets/dragon.png", "showtime/assets/review/dragon.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK && (cd showtime && bun scripts/shots.ts --theme dragon)", "acceptanceCriteria": ["testPass >= 40, testFail >= 15, commit >= 25 changed cells at newsAge 4-20, t 40/200/777, w 80", "0 changed cells at newsAge 30/35/39", "narrow w 40 testFail >= 6 changed cells", "plugin test 0 fail, tsc clean, sheet reviewed"], "modelTier": "frontier"}
```

---

### Task 7: Docs and gallery

**Goal:** The READMEs describe the new dragon and the gallery shows it; no other asset changes.

**Files:**
- Modify: `showtime/README.en.md:41` (the `dragon` line), `showtime/README.md:45` (same, in Chinese)
- Regenerate: `showtime/assets/gallery.png`

**Acceptance Criteria:**
- [ ] Both README lines describe: sunny 6-row castle scene, knight, princess, fire-breathing 16-bit dragon, set pieces and rare surprises, what each signal does (banners per task, wyverns per subagent, fireworks on a passed test, the knight knocked down on a failed one, a royal roar on a commit)
- [ ] `bun scripts/shots.ts --gallery` regenerates; `git status --short showtime/assets` lists only `gallery.png` (dragon assets already committed)
- [ ] plugin test `0 fail`, `tsc` clean

**Verify:** `cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --gallery && git status --short assets && cd .. && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK`

**Steps:**

- [ ] **Step 1:** Replace the `dragon` bullet in `showtime/README.en.md` with one sentence in the existing style (one line, semicolons between signals). Write the Chinese line in `README.md` to match, in the style of its neighbours.
- [ ] **Step 2:** `cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --gallery`, then Read `assets/gallery.png` to check dragon's taller strip sits cleanly among the 4-row ones.
- [ ] **Step 3:** Verify, then commit `showtime/README.md showtime/README.en.md showtime/assets/gallery.png` with message `showtime: dragon pilot — docs and gallery` + co-author.

```json:metadata
{"files": ["showtime/README.md", "showtime/README.en.md", "showtime/assets/gallery.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --gallery && git status --short assets && cd .. && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK", "acceptanceCriteria": ["both README dragon lines describe the new scene and its signals", "gallery regenerated; only gallery.png changes", "plugin test 0 fail, tsc clean"], "modelTier": "standard"}
```

---

### Task 8: Jeremy's live review, then release

**Goal:** Jeremy watches the new dragon live and approves it (or gives notes, applied in one pass and re-shown); on approval it ships as showtime 1.1.0 and the lessons are written down for the other 29 themes.

> **USER-ORDERED GATE — NON-SKIPPABLE.** This task was requested by the user in the current conversation. It MUST NOT be closed by walking around it, by declaring it "verified inline", or by substituting a cheaper check. Close only after every item in `acceptanceCriteria` has been re-validated independently, with output captured.

**Files:**
- Append: `docs/superpowers/notes/showtime-preview-review.md` (a `## dragon pilot review` section; git-ignored)
- Modify (on approval): `showtime/.claude-plugin/plugin.json` (version `1.1.0`), `.claude-plugin/marketplace.json` if it pins the version
- Modify (after any notes): `showtime/hooks/themes/dragon.ts`, tests, assets

**Acceptance Criteria:**
- [ ] The preview ran in the bottom pane of Claude's own window (resolved from `$TMUX_PANE`) with the local build, and the 6-row dragon was visible (`tmux capture-pane` shows the new scene)
- [ ] Jeremy's notes are recorded verbatim with a restatement; any changes are applied in one pass, tests green, and re-shown until he says it's approved
- [ ] On approval: version 1.1.0 committed, `git push` in claude-mods, master bumped and pushed, `claude plugin update showtime@claudebro-mods` reports 1.1.0
- [ ] A "Recipe for the other 29" section is added to the notes file: what the pilot settled (sizes, palettes, event length, tests), so the 2.0 plan copies it

**Verify:** `tmux capture-pane -p -t <bottom pane> | grep -c '▀\|▄'` > 0 during the preview; after release `claude plugin list 2>&1 | grep -A1 'showtime@'` → `Version: 1.1.0`

**Steps:**

- [ ] **Step 1: Find the bottom pane.** `tmux list-panes -t "$TMUX_PANE" -F '#{pane_id} #{@role} #{pane_height}'`; the `commands` pane is the target; note its height to restore later.
- [ ] **Step 2: Start the helper with the local build.** Grow it: `tmux resize-pane -t <pane> -y 32`. Clear its input line (`tmux send-keys -t <pane> C-u`), then type literally `cd ~/code/claudebro && claude --plugin-dir ~/code/claudebro/claude-mods/showtime` + Enter. Wait ~8 s, capture the pane and confirm the prompt is up. If the installed 1.0.1 copy wins over the local one (the preview still shows the old 4-row moonlit dragon), `/exit` and instead run `claude plugin disable showtime@claudebro-mods` in a plain shell before starting it with `--plugin-dir`, and `claude plugin enable showtime@claudebro-mods` afterwards.
- [ ] **Step 3: Loop the preview.** A preview lasts 8 s (`PREVIEW_MS`). Run a background loop that re-sends `/showtime preview dragon` + Enter to `<pane>` every 8.5 s while `/tmp/showtime-review-theme` exists. (A preview always shows `think`; to let Jeremy see set pieces, leave it running: slots change every 16 s.)
- [ ] **Step 4: Ask Jeremy for notes** and write them verbatim plus a one-line restatement under `## dragon pilot review` in the notes file. Change no code while he watches.
- [ ] **Step 5: Stop the helper.** `rm /tmp/showtime-review-theme`, wait for the loop to exit, send `/exit` to the pane, restore its height, re-enable the installed plugin if Step 2 disabled it.
- [ ] **Step 6: If there are notes:** apply them all in one pass in `dragon.ts` (tests stay green, sheet re-reviewed), commit, and go back to Step 2. If he approves:
- [ ] **Step 7: Release 1.1.0.**

```bash
cd ~/code/claudebro/claude-mods
# bump "version" to 1.1.0 in showtime/.claude-plugin/plugin.json (and in .claude-plugin/marketplace.json if it lists showtime's version)
claude plugin validate showtime/.claude-plugin/plugin.json && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK
git add showtime/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "showtime 1.1.0: the dragon pilot of the 2.0 look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime 1.1.0 (dragon pilot)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
claude plugin marketplace update claudebro-mods && claude plugin update showtime@claudebro-mods
claude plugin list 2>&1 | grep -A1 'showtime@'   # Version: 1.1.0
```

- [ ] **Step 8: Write the recipe.** Append `## Recipe for the other 29 (from the dragon pilot)` to the notes file: final sprite sizes, palette approach, event length and counts, egg chance, test thresholds that held, what Jeremy changed and why. Update memory `showtime-2-0-brief` with one line pointing at it.

```json:metadata
{"files": ["docs/superpowers/notes/showtime-preview-review.md", "showtime/.claude-plugin/plugin.json", ".claude-plugin/marketplace.json", "showtime/hooks/themes/dragon.ts"], "verifyCommand": "claude plugin list 2>&1 | grep -A1 'showtime@'", "acceptanceCriteria": ["preview ran in Claude's own bottom pane with the local build and showed the 6-row dragon (capture-pane evidence)", "Jeremy's notes recorded verbatim; changes applied in one pass and re-shown until approved", "on approval: 1.1.0 committed, pushed, master bumped and pushed, plugin list shows Version: 1.1.0", "recipe section for the other 29 themes written to the notes file"], "modelTier": "frontier", "userGate": true, "tags": ["user-gate"]}
```

---

## Self-review

- **Spec coverage:** nicer background and castle → Task 4 (layers, castle with conical roof and pennant); bright sunny sky → Task 4 palette; knight attacking → Task 4 (knight) + Task 5 (strafe, charge); fire breath → Task 4 (bash) + Task 5 (strafe); princess → Task 4 (window, ask) + Task 5 (tower, frying pan); more animation/alive/more stuff → layers table, archers, birds, sheep, catapult; effects → fire, sparks, rings, fireworks, confetti, smoke; 16-bit → `paint` ramps + review criterion; bustling-not-cluttered → review criterion (6); 6 rows → Global Constraints + Task 4; events + eggs → Tasks 2 and 5; fixed stage → design ("nothing scrolls by itself"); 100 ms → Global Constraints; testPass visible (the 1.0.2 item, dragon already clear) → Task 6 thresholds; live approval before the other 29 → Task 8.
- **Not in this plan (on purpose):** the other 29 themes, the 8 removals, the testPass fixes in 11 other themes, 2.0.0. They follow the recipe Task 8 writes.
