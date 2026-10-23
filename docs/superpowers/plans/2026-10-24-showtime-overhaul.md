# showtime 1.0.0 Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** showtime shows a token-free live feed (tasks, subagents, running tools) beside its pet, its scenes react to those signals, the audio theme goes, and the theme list grows from 14 to 38 through a one-file-per-theme registry, every theme animated to the spec's rules and reviewed from a rendered sheet before commit.

**Architecture:** A `feed` atom in showtime's plugin state is written by hooks on the task tools' results, `agent.spawn`, `tool.call` and `turn.complete`; pure functions in `hooks/feed.ts` derive the rows. The band builds a `Signals` object from the feed and activity atoms and hands it to every scene through the stage Client. Each theme is one file under `hooks/themes/` exporting a `Theme` (art, scene, pet); `hooks/themes.ts` is the index. `scripts/shots.ts` (bun, `node:zlib` only) renders a still and a review sheet per theme.

**Tech Stack:** Claude Code function-hook plugin (TypeScript/TSX against `claude-code` types, JSX factory `h`), `claude plugin validate|test`, `tsc`, `bun` for the render script, git (submodule `claude-mods` inside `~/code/claudebro`).

**Spec:** `docs/superpowers/specs/2026-10-24-showtime-overhaul-design.md` (paths in this plan are relative to `~/code/claudebro/claude-mods` unless they start with `showtime/`, which is the mod folder under it).

## Global Constraints

- Work on one theme at a time, never two subagents at once: the NUC's CPU stays low. Builds, tests and renders run sequentially.
- `STAGE_MS` stays 100 ms; smoothness comes from motion design (one cell per frame, step cycles, easing, idle motion, animated transitions, reaction bursts), never from a higher frame rate.
- The pet draws whenever the companion is on, with or without feed content. Empty feed rows are blank, never collapsed.
- No live reinstall until the release task: `claude plugin update showtime@claudebro-mods` runs only in Task 46.
- No questions to the user during execution. A theme that fails its review after three rounds is committed as is with a note in `showtime/THEMES-BACKLOG.md`; a test that cannot be made green stops the task and is reported.
- Never delete: files leaving the tree go to `~/_attic/YYYY-MM-DD/` (`git rm` is fine for tracked files; untracked leftovers move to the attic).
- Every commit in `claude-mods` is on `main` (check `git branch --show-current`), message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Push and bump after each step boundary (after Tasks 1, 3, 5, 7, 21, 45, 46): `cd ~/code/claudebro/claude-mods && git push`, then `cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: <what>" && git push`.
- Verification per task: `claude plugin validate showtime/.claude-plugin/plugin.json && claude plugin test showtime && pnpm exec tsc -p showtime` from `~/code/claudebro/claude-mods`, all green, before the commit.
- Strings shown to the person go through `m('<key>')` in `hooks/i18n.ts`, in all eleven languages.

**User decisions (already made):** own feed model, not a port of hoobnn's todo-bar; the companion block becomes the feed; tasks and progress clear at turn end; everything in one spec; stage reacts to the feed; audio theme removed; 24 new themes in the order stack, plumber, snake, launch, frogger, kitchen, railway, garden, racetrack, aquarium, submarine, orchestra, roomba, coffee, penguins, ufo, dragon, samurai, warp, volcano, dungeon, mage, tavern, necromancer; existing art kept but animation polished; themes one at a time; Claude reviews each rendered sheet itself; smoother and more animation; push and bump after each step; live install only at the end; no Telegram messages; execute the plan in this session once written.

---

## File structure (end state of `showtime/`)

| File | Responsibility |
|---|---|
| `hooks/register.tsx` | Hooks only: session, turn, tool, agent, command, render. Reads atoms, writes atoms, builds `Signals`, draws the band and the agent row. |
| `hooks/feed.ts` | Pure feed logic: apply* reducers, progress, task line, agent row, tool kind, clip. No engine imports. |
| `hooks/pet.ts` | Pet logic as today (level, labels, news detection, bubble). |
| `hooks/pets.ts` | Pet frame drawing (`petFrame`, `dockPetOf`, `PetArt` type); no per-theme art any more. |
| `hooks/cells.ts` | Cell grid, half-block canvas, numbers (unchanged). |
| `hooks/draw.ts` | Scene drawing helpers moved from `scenes.ts`: `glyphStars`, `ridge`, `ground`, `clouds`, `stroll` (with easing), plus `burst`, `shake` used by reactions. |
| `hooks/reactions.ts` | Shared reactions for two-row scenes: `withReactions(grid, t, s, color)`. |
| `hooks/themes.ts` | Types (`Theme`, `Signals`, `Act`, …), the index of theme files, `THEMES`, `THEME_NAMES`, `pickRandom`, `nextTheme`, `finaleScene`, `petRow`, `themeOf`. Re-exports `cells.ts`. |
| `hooks/themes/<name>.ts` | One theme: colors, sprite poses, faces, confetti, palette, rows, `scene(t, w, s)`, `pet: PetArt`. 38 files. |
| `hooks/stage.tsx` | The band's scene Client: ticks, `newsAge`, draws the grid. |
| `hooks/sprite.tsx` | The spinner-line mascot Client (unchanged). |
| `hooks/kit/pet.tsx`, `kit/pet-player.tsx`, `kit/band.tsx`, `kit/lang.ts`, `kit/options.ts`, `kit/prefs.ts` | Forked kit, edited in place (the "Generated from" header lines are replaced by "Forked from hoobnn's claude-code/kit; edited in place"). |
| `hooks/config.ts`, `hooks/command.ts`, `hooks/i18n.ts` | Options, `/showtime` parsing, messages. |
| `types/index.d.ts` | The state contract: `Feed`, `DockPet` with `task`/`progress`, no `tap`. |
| `scripts/engine-types.sh` | Lays this build's engine types under `.claude-plugin/types/` so `tsc -p showtime` runs. |
| `scripts/shots.ts` | `bun scripts/shots.ts --theme <name>` writes `assets/<name>.png` and `assets/review/<name>.png`; `--gallery` assembles `assets/gallery.png`. |
| `tests/showtime.test.tsx`, `tests/feed.test.ts`, `tests/scenes.test.ts` | Engine-hosted tests; feed unit tests; grid and motion tests over every theme. |
| `THEMES-BACKLOG.md` | Briefs not built, and polish notes. |

---

## Theme recipe (used by Tasks 8–45)

Every theme task follows this loop. The task text gives the theme's brief, its reaction table and its pet; this recipe gives the mechanics. Commands run from `~/code/claudebro/claude-mods`.

**R1. The file.** `showtime/hooks/themes/<name>.ts` exports `const <NAME>: Theme`. Skeleton (a new theme; an existing one keeps its moved art):

```ts
// <name>: <one line of the brief>.
import { canvas, cells, draw, frame, mod, noise, plot, put } from '../cells'
import type { Grid } from '../cells'
import { SCENE_ROWS, clouds, ground, stroll } from '../draw'
import type { PetArt } from '../pets'
import type { Signals, Theme } from '../themes'

const HERO = ['..AA..', '.AAAA.', 'AAAAAA', '.A..A.']        // 6 px wide, 4 px tall: letters keyed in COLORS, `.` clear
const HERO_STEP = ['..AA..', '.AAAA.', 'AAAAAA', 'A....A']
const COLORS = { A: '#ffd60a' }

export const PET: PetArt = {
  body: ['....AAAA....', '...AAAAAA...', '..AAAAAAAA..', '...AAAAAA...', '....A..A....'],
  step: ['....AAAA....', '...AAAAAA...', '..AAAAAAAA..', '...AAAAAA...', '...A....A...'],
  colors: { A: '#ffd60a' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#1d1d1d',
  lid: '#ffd60a',
  mouth: [5, 3],
  blush: '#ffb703',
  spark: '#ffd60a',
}

function scene(t: number, w: number, s: Signals): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // Layer 1: background that always moves (clouds, stars, a ridge), slow.
  clouds(cv, t, Math.max(2, Math.floor(w / 24)), 0.15, '#3a3f58', 2, 11)
  // Layer 2: the ground, scrolling faster while a tool runs.
  ground(cv, t, 7, s.act === 'tool' ? 1 : 0.5, ['#4a4e69', '#5c6180', '#4a4e69', '#6b7094'])
  // Layer 3: the hero, strolling in, stopping to work, strolling out; eased at the edges.
  const { x, isWalking } = stroll(t, w, 6, s.act === 'tool' ? 60 : 40)
  const art = isWalking && mod(t, 4) < 2 ? HERO_STEP : HERO
  draw(cv, x, 3, art, COLORS)
  // Tasks: one marker per task along the bottom, `done` of them lit.
  for (let i = 0; i < Math.min(s.total, Math.floor(w / 4)); i++) plot(cv, 2 + i * 4, 6, i < s.done ? '#9ece6a' : '#3b3f5c')
  // Agents: one small figure per agent at the right edge.
  for (let i = 0; i < Math.min(s.agents, 4); i++) draw(cv, w - 4 - i * 5, 4 + (mod(t + i * 3, 8) < 4 ? 0 : 1), ['AA', 'AA'], COLORS)
  // News: a burst for the first 20 frames after it lands, then nothing.
  if (s.news === 'commit' && s.newsAge < 20) for (let i = 0; i < 6; i++) plot(cv, x + 3 + Math.round(Math.cos(i) * s.newsAge * 0.5), 2 - Math.round(s.newsAge / 6), '#ffd60a')
  if (s.news === 'testFail' && s.newsAge < 12) draw(cv, x, 0, ['.XX.', 'XXXX'], { X: '#6c757d' })
  const g = cells(cv)
  // Glyph layer over the cells: a spark while a tool runs, a `?` while asking, dots while thinking.
  if (s.act === 'ask') put(g, x + 7, 0, mod(t, 8) < 6 ? '?' : ' ', { c: '#ffd166', b: true })
  else if (s.act === 'think') put(g, x + 7, 0, frame(['·', '··', '···', '  '], t >> 2), { c: '#8a8a8a' })
  else if (s.act === 'tool') put(g, x + 7, 0, frame(['✦', '·', '✶', '·'], t), { c: '#ffd60a', b: true })
  return g
}

export const <NAME>: Theme = {
  name: '<name>',
  rows: SCENE_ROWS,
  color: '#ffd60a',
  accent: '#ffb703',
  sprite: {
    think: ['[·  ]', '[ · ]', '[  ·]', '[ · ]'],
    tool: ['[=  ]', '[ = ]', '[  =]', '[ = ]'],
    say: ['[~  ]', '[ ~ ]', '[  ~]'],
    wait: ['[.  ]', '[.. ]', '[...]'],
  },
  happy: '[^^]',
  sad: '[..]',
  dead: '[xx]',
  sleep: '[--] zZ',
  confetti: ['✦', '✧', '·', '+'],
  palette: ['#ffd60a', '#ffb703', '#fb8500', '#8ecae6'],
  scene,
  pet: PET,
}
```

**R2. Register it.** In `showtime/hooks/themes.ts`: `import { <NAME> } from './themes/<name>'`, add `'<name>'` to `THEME_NAMES` at its place in the spec order, add `<name>: <NAME>` to `THEMES`. In `showtime/.claude-plugin/plugin.json` add `"<name>"` to the `theme` option's `options` list in the same order. In `showtime/README.en.md` and `README.md` add the theme's line to the theme list.

**R3. Rules every scene meets** (spec section 5, "Animation"):
- Motion moves at most one half-block cell per frame; walkers have at least four frames per step cycle; crossings ease at the edges (`stroll` does this).
- Each act has an idle motion with a cycle of at least twelve frames; at least three independently moving layers.
- Act transitions (think to tool, tool to ask) animate over four to eight frames: scenes keep a small `since` counter from a change of `s.act` by reading `mod(t, …)` against `s.actAge` (provided in `Signals`, see Task 6).
- Reactions are 8 to 30 frame animations keyed on `s.newsAge`, or on a change of `s.done` / `s.agents` (use `s.doneAge`, `s.agentsAge`), with a resting state after.
- All six slots: agents, tasks (done/total), tool kind, testFail, and testPass or commit (at least one of the two).

**R4. Check.**

```bash
cd ~/code/claudebro/claude-mods
claude plugin validate showtime/.claude-plugin/plugin.json && claude plugin test showtime && pnpm exec tsc -p showtime
```

Expected: validate OK, all tests pass (the grid and motion tests in `tests/scenes.test.ts` cover the new theme automatically through `THEME_NAMES`), tsc silent.

**R5. Render the review sheet.**

```bash
cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --theme <name>
```

Writes `assets/<name>.png` (one still, `think`, t=40, 80 cells) and `assets/review/<name>.png`: labelled strips of twelve consecutive frames for think, tool, ask, say; then agents=2, done 3/7, done 7/7, testFail at ages 0/8/20, commit at ages 0/8/20; then the pet's frames in think, tool, ready, sleep.

**R6. Look and judge.** Read `showtime/assets/review/<name>.png` with the Read tool. Judge against R3 and the brief, in this order: (1) the subject reads at a glance; (2) every layer moves across the twelve frames; (3) no frame jumps (a shape moving more than a cell between neighbours); (4) each reaction strip shows its reaction clearly and differs from the think strip; (5) colors hold on a dark background (nothing darker than `#3a3a3a` as a foreground). Write the verdict in one line, e.g. `verdict: reads well, all strips move, commit burst clear; testFail subtle (acceptable)`.

**R7. Fix and repeat** R4–R6 up to three times. After the third round, what still fails goes under a `## <name>` heading in `showtime/THEMES-BACKLOG.md` as "polish: …".

**R8. Show and commit.** Show the sheet: call the peek tool `mcp__peek__show_image` with the sheet's absolute path. Regenerate the gallery: `bun scripts/shots.ts --gallery`. Commit:

```bash
cd ~/code/claudebro/claude-mods && git add showtime && git commit -m "showtime: <name> theme — <one-line verdict>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: Baseline green and a working typecheck

**Goal:** `claude plugin test showtime` passes 27/27 and `pnpm exec tsc -p showtime` runs against this build's engine types, before anything changes.

**Files:**
- Create: `showtime/scripts/engine-types.sh`
- Modify: `showtime/hooks/register.tsx` (the `tool.call` hook, around the `noteNews` call) or `showtime/tests/showtime.test.tsx` (whichever is wrong), `package.json` (typecheck script), `.gitignore` (already ignores `*/.claude-plugin/types/`)
- Test: `showtime/tests/showtime.test.tsx`

**Acceptance Criteria:**
- [ ] `claude plugin test showtime` reports `27 pass, 0 fail`
- [ ] `pnpm exec tsc -p showtime` exits 0 with no output
- [ ] `showtime/.claude-plugin/types/claude-code/index.d.ts` exists and is untracked (gitignored)

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && echo TSC-OK` → `27 pass` … `0 fail` … `TSC-OK`

**Steps:**

- [ ] **Step 1: Lay the engine types**

Write `showtime/scripts/engine-types.sh`:

```bash
#!/usr/bin/env bash
# Lays this build's engine types beside the mod so `tsc -p showtime` runs. The
# engine writes them itself only when it hot-reloads the mod from its folder,
# which a marketplace install never does; the plugin-authoring skill's bundle
# carries the same file, so this copies the newest one. Gitignored.
set -euo pipefail
mod="$(cd "$(dirname "$0")/.." && pwd)"
src="$(ls -t /tmp/claude-"$(id -u)"/bundled-skills/*/*/plugin-authoring/types/claude-code.d.ts 2>/dev/null | head -1 || true)"
if [ -z "$src" ]; then
  echo "no engine types found: load the plugin-authoring skill once in an interactive Claude session, then run this again" >&2
  exit 1
fi
mkdir -p "$mod/.claude-plugin/types/claude-code"
cp "$src" "$mod/.claude-plugin/types/claude-code/index.d.ts"
cat > "$mod/.claude-plugin/types/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": ["claude-code", "../../hooks", "../../types", "../../tests"]
}
EOF
head -1 "$src"
```

Run: `chmod +x showtime/scripts/engine-types.sh && showtime/scripts/engine-types.sh`
Expected: `// Written by Claude Code 2.1.309.` (or newer), and the two files exist.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc -p showtime`
Expected: errors only in `tests/showtime.test.tsx` at lines 597 and 608 (implicit `any` on `on` and `$`) or none. If those two remain, type the callbacks: `test('…', async ($: EngineInterface, on: On) => {` is wrong for this kit; instead give them the kit's types by importing `import type { On } from 'claude-code'` (already there) and writing `async ($, on) =>` in the same shape as the other tests at lines 317 and 347 (which infer). Look at lines 590–610 and make the two tests match the others' signature.

Add to `package.json` scripts: `"typecheck": "tsc -p peek && tsc -p showtime"`.

- [ ] **Step 3: Diagnose the four failing tests**

Run: `claude plugin test showtime 2>&1 | grep -A8 '^(fail)'`

Observed today: the test "the companion follows tool calls and permission prompts" expects the bubble `Bash: npm test` but receives the testFail bubble `测试没过…一起修吧`, so `noteNews` ran with `isError === true` on a call the host answered with `{ deny: 'test' }`. Find the result shape the hook sees: add temporarily `$.ui.log(JSON.stringify(result))` after `const result = await next(e)` in the `tool.call` hook, run the one test, read the log line in the test output, then remove the log line. Two possible fixes; pick the one the shape shows:
  - the engine now turns a host's `{ deny }` into `{ isError: true, text }` without a `deny` key: change the guard to `if (e.tool === 'Bash' && typeof command === 'string' && result.deny === undefined && result.result !== undefined)`.
  - the mock clock's `settle()` now runs the 1000 ms sleep, so the call has ended before the mount: in the test, mount before `clock.settle()` or replace `await clock.settle()` with `await clock.advance(0)` for that assertion.

The other three failures share the cause (the dialog test sees a stale bubble; the subagent test the same): fix the cause, re-run, and if a test still fails read its received text and fix its expectation only when the behaviour is right by the README's description.

- [ ] **Step 4: Run all tests**

Run: `claude plugin test showtime 2>&1 | tail -3`
Expected: `27 pass`, `0 fail`.

- [ ] **Step 5: Commit, push, bump**

```bash
cd ~/code/claudebro/claude-mods && git add -A showtime package.json && git commit -m "showtime: baseline green again, engine types for tsc

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime baseline" && git push
```

```json:metadata
{"files": ["showtime/scripts/engine-types.sh", "showtime/hooks/register.tsx", "showtime/tests/showtime.test.tsx", "package.json"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime", "acceptanceCriteria": ["27 pass 0 fail", "tsc exits 0"], "modelTier": "standard"}
```

---

### Task 2: Theme registry, one file per theme

**Goal:** Every theme lives in `showtime/hooks/themes/<name>.ts` with its pet art; `themes.ts` is the index; drawing helpers live in `draw.ts`; `scenes.ts` is gone. No visible change.

**Files:**
- Create: `showtime/hooks/draw.ts`, `showtime/hooks/themes/{clawd,thunder,chomp,sparky,bluecat,nyan,cat,bunny,sakura,mecha,neon,dino,ocean,matrix,audio}.ts`
- Modify: `showtime/hooks/themes.ts`, `showtime/hooks/pets.ts`, `showtime/hooks/register.tsx` (imports), `showtime/README.en.md` (Development section)
- Remove: `showtime/hooks/scenes.ts` (`git rm`)
- Test: `showtime/tests/showtime.test.tsx` (existing tests keep passing; one new test)

**Acceptance Criteria:**
- [ ] `ls showtime/hooks/themes | wc -l` is 15 (audio still present until Task 3)
- [ ] `THEMES[name].pet` is defined for every name; `petArtOf` is removed and `register.tsx` reads `THEMES[name].pet`
- [ ] All tests pass; tsc clean; the band draws the same frames (the width test still covers every theme)

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && ls showtime/hooks/themes | wc -l` → `28 pass`, `0 fail`, `15`

**Steps:**

- [ ] **Step 1: Write the failing test**

Append to `showtime/tests/showtime.test.tsx`:

```ts
test('every theme has its own pet with eyes inside its body', () => {
  for (const name of THEME_NAMES) {
    const pet = THEMES[name].pet
    expect(pet.body).toHaveLength(5)
    for (const row of pet.body) expect(row.length).toBeLessThanOrEqual(12)
    for (const x of pet.eyes) expect(pet.body[pet.eyeRow]![x]).not.toBe('.')
  }
})
```

Run: `claude plugin test showtime 2>&1 | grep -A3 'own pet'`
Expected: FAIL, `pet` is undefined on the theme type.

- [ ] **Step 2: Move the drawing helpers**

Create `showtime/hooks/draw.ts` with the exports `SCENE_ROWS`, `glyphStars`, `ridge`, `ground`, `clouds`, `stroll` cut from `showtime/hooks/scenes.ts` lines 1–72 (the "layers" section), each now `export`ed. Change `stroll` to ease at the edges:

```ts
/** Where a hero strolls: in from the left, a stop mid-way to work, then out; eased so it never pops in. */
export function stroll(t: number, w: number, width: number, stop: number): { x: number; isWalking: boolean } {
  const lap = w + width
  const p = mod(t, lap + stop)
  const mid = Math.floor(lap / 2)
  const ease = (u: number) => (u < 8 ? Math.round(u * u / 8) : u)   // the first eight frames accelerate
  if (p < mid) return { x: ease(p) - width, isWalking: true }
  if (p < mid + stop) return { x: mid - width, isWalking: false }
  return { x: p - stop - width, isWalking: true }
}
```

Keep `mod` imported from `./cells`.

- [ ] **Step 3: Extend the Theme type**

In `showtime/hooks/themes.ts`: import `type { PetArt } from './pets'` (pets.ts must not import themes.ts for values; it already imports only types, so no cycle), and add to `Theme`:

```ts
  /** The companion's body and face in this theme. */
  pet: PetArt
```

- [ ] **Step 4: One file per theme**

For each of the six pixel themes, create `showtime/hooks/themes/<name>.ts` holding: the scene function and its constants from `scenes.ts` (e.g. `clawdScene` and `CLAUDE`, `CLAWD`, `CLAWD_COLORS`, `BLOCK_COLORS`, `SPIN` for clawd), the theme object from `themes.ts` (`THEMES.clawd` block), and the pet from `pets.ts` (`CLAWD_PET`, renamed `PET`), as `export const CLAWD: Theme = { …, scene, pet: PET }`. Imports: `from '../cells'`, `from '../draw'`, `type { PetArt } from '../pets'`, `type { Act, Theme } from '../themes'`.

For each of the eight two-row themes, the same with the scene function from `themes.ts` (`catScene` at line 95, and so on) and, since they have no pet of their own, the borrowed Clawd shape as today:

```ts
export const PET: PetArt = { ...CLAWD_SHAPE, colors: { O: COLOR, L: COLOR, D: COLOR }, lid: COLOR }
```

where `CLAWD_SHAPE` is exported from `showtime/hooks/pets.ts` as the body/step/eyes of Clawd without colors (move `CLAWD_PET`'s shape there under that name; `themes/clawd.ts` builds its `PET` from it with Clawd's colors).

For `audio`, the same (it goes in Task 3; keep it compiling now).

Delete `petArtOf` and the per-theme `*_PET` constants from `pets.ts`, keeping `PetArt`, `PROP_W`, `BODY_W`, `PET_W`, `PET_ROWS`, `PET_MS`, `loopOf`, `petFrame`, `noPet`, `dockPetOf`, `CLAWD_SHAPE`.

- [ ] **Step 5: The index**

Rewrite the body of `showtime/hooks/themes.ts` to keep types, constants, `poseOf`, `isThemeName`, `pickRandom`, `nextTheme`, `themeOf`, `finaleScene`, `petRow`, and replace the scene functions and the `THEMES` literal with:

```ts
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
import { AUDIO } from './themes/audio'

export const THEMES: Record<ThemeName, Theme> = {
  clawd: CLAWD, thunder: THUNDER, chomp: CHOMP, sparky: SPARKY, bluecat: BLUECAT, nyan: NYAN,
  cat: CAT, bunny: BUNNY, sakura: SAKURA, mecha: MECHA, neon: NEON, dino: DINO, ocean: OCEAN, matrix: MATRIX,
  audio: AUDIO,
}
```

A theme file imports `type { Theme } from '../themes'` while `themes.ts` imports the value from the theme file: type-only imports make no runtime cycle. `SCENE_ROWS` now comes from `./draw`.

In `register.tsx` replace `petArtOf(name, …)` with `(isThemeName(name) ? THEMES[name] : THEMES.clawd).pet` and drop the `petArtOf` import.

- [ ] **Step 6: Check, commit**

Run the Verify command. Expected: `28 pass`, `0 fail`, `15`. Update the Development list in `showtime/README.en.md` (`hooks/themes/<name>.ts`: one theme each; `hooks/draw.ts`: the layers; `scenes.ts` gone). Commit:

```bash
git add -A showtime && git commit -m "showtime: one file per theme, draw.ts for the layers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/themes.ts", "showtime/hooks/draw.ts", "showtime/hooks/themes/", "showtime/hooks/pets.ts", "showtime/hooks/register.tsx"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && ls showtime/hooks/themes | wc -l", "acceptanceCriteria": ["15 theme files", "every theme has pet", "28 pass"], "modelTier": "standard"}
```

---

### Task 3: Remove the audio theme

**Goal:** No audio theme, tap, Swift source or `ui.message` level feed remains; a stored `theme: audio` loads as `random`.

**Files:**
- Remove (`git rm`): `showtime/hooks/audio.ts`, `showtime/hooks/audio-tap.swift`, `showtime/hooks/themes/audio.ts`, `showtime/assets/audio.gif`, `showtime/assets/audio.png`, `showtime/assets/audio-live.png`
- Modify: `showtime/hooks/themes.ts` (THEME_NAMES, OPT_IN, imports, `Theme.scene` signature loses `audio?`), `showtime/hooks/stage.tsx` (no `audio`/`feed` props), `showtime/hooks/register.tsx` (tap section, `syncTap`, `feedOf`, `stageProps`, `ui.message` audio branch, status lines), `showtime/hooks/config.ts` (CHOICES unchanged, but `oneOf` falls back), `showtime/hooks/i18n.ts` (drop `cmd.audioOn`, `cmd.audioOff` in all languages), `showtime/types/index.d.ts` (drop `tap`), `showtime/.claude-plugin/plugin.json` (theme option description and options), `showtime/README.md`, `showtime/README.en.md`, `.claude-plugin/marketplace.json`
- Test: `showtime/tests/showtime.test.tsx` (remove the four audio tests at lines 113–221; add one)

**Acceptance Criteria:**
- [ ] `grep -rn -i audio showtime/hooks showtime/types showtime/.claude-plugin/plugin.json` prints nothing
- [ ] `THEME_NAMES.length === 14`, `OPT_IN` is gone and `pickRandom` draws from all names
- [ ] A stored `theme: 'audio'` row loads as `random` (test)
- [ ] All tests pass; tsc clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && ! grep -rqi audio showtime/hooks showtime/types showtime/.claude-plugin/plugin.json && echo NO-AUDIO` → `25 pass`, `0 fail`, `NO-AUDIO`

**Steps:**

- [ ] **Step 1: Write the failing test**

Replace the four audio tests with:

```ts
test('a theme row from before 1.0 naming audio loads as random', { options: { theme: 'audio' } }, async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const text = (await $.command.run({ command: 'showtime', args: '', ...RUN })).text
  expect(text).toContain('random')
  expect(text).not.toContain('audio')
})
```

Run: `claude plugin test showtime 2>&1 | grep -A3 'before 1.0'` → FAIL (the status names audio).

- [ ] **Step 2: Remove the code**

`git rm` the files listed. In `themes.ts`: drop `'audio'` from `THEME_NAMES`, delete `OPT_IN` and the filters in `pickRandom`/`nextTheme` (`const pool = THEME_NAMES`), drop the `AudioFeed` import and the `audio?` parameter of `Theme.scene`. In `stage.tsx`: drop `audio`, `feed`, the `surface.post` line and the `AudioView` import; call `theme.scene(t, w, props.act)`. In `register.tsx`: delete the whole "the audio theme's tap" section (`meter`, `tap`, `stageProps`, `buildTap`, `startTap`, `syncTap`, `feedOf`), every `await syncTap($)` call, the `tapState` atom, the `AudioView`/`AudioMeter` imports, the `audioStage` helper and the `live`/`heard` branches in the band hook (the scene is always `<Client key="work" module="./stage.tsx" width={columns} props={props} />`), the `ui.message` hook's audio branch (keep the pat), and the `current === 'audio'` lines in `status`. In `config.ts`, `oneOf(options.theme, CHOICES, 'random')` already maps an unknown row to `random`: nothing to change. In `i18n.ts` remove the two keys from `Key` and every language. In `types/index.d.ts` remove `tap`. In `plugin.json`: remove `"audio"` from the options and the clause "audio (this Mac's sound…never drawn at random), " from the description; set the top description to "Animations and a companion pet while the model works: a mascot beside the spinner, a scene above the prompt (a shoot-em-up, Clawd, pixel homages and more), a finale and a pet that levels up, in fourteen themes". In both READMEs remove the Sound paragraph, the audio rows and the macOS notes; in `.claude-plugin/marketplace.json` drop "(fork of hoobnn spinner 0.6.1)" wording to "(hoobnn spinner fork)" and remove any audio mention.

- [ ] **Step 3: Check, commit, push, bump**

Run the Verify command. Expected: `25 pass`, `0 fail`, `NO-AUDIO`.

```bash
cd ~/code/claudebro/claude-mods && git add -A showtime .claude-plugin && git commit -m "showtime: drop the audio theme and its tap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime registry, no audio" && git push
```

```json:metadata
{"files": ["showtime/hooks/register.tsx", "showtime/hooks/themes.ts", "showtime/hooks/stage.tsx", "showtime/hooks/i18n.ts", "showtime/.claude-plugin/plugin.json"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && ! grep -rqi audio showtime/hooks showtime/types showtime/.claude-plugin/plugin.json", "acceptanceCriteria": ["no audio references", "14 themes", "stored audio loads as random"], "modelTier": "standard"}
```

---

### Task 4: The feed model (`feed.ts`) with unit tests

**Goal:** Pure reducers and derivations for the feed, fully unit-tested, not yet wired to hooks.

**Files:**
- Create: `showtime/hooks/feed.ts`, `showtime/tests/feed.test.ts`
- Modify: `showtime/types/index.d.ts` (export the `Feed` types; add `feed: Feed` to the contract)

**Acceptance Criteria:**
- [ ] Every function below exists with the given signature and the tests in Step 1 pass
- [ ] `feed.ts` imports nothing from `claude-code`
- [ ] tsc clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime` → all pass (25 + 12 new), tsc silent

**Steps:**

- [ ] **Step 1: The types and the failing tests**

Add to `showtime/types/index.d.ts` (top level, before `declare module`):

```ts
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type FeedTask = { id: string; subject: string; status: TaskStatus }
export type FeedAgent = { id: string; description: string; type: string; tool?: string; since: number }
/** The running tools of the main loop, by tool_use_id. */
export type Running = Record<string, { tool: string; label: string }>
/** What the companion block and the scenes read: tasks, subagents, running tools. Plain data. */
export type Feed = {
  tasks: FeedTask[]
  source: 'tasks' | 'todos' | null
  /** When the in-progress task began, else when the turn began; null between turns. */
  startedAt: number | null
  agents: FeedAgent[]
  running: Running
}
```

and `feed: Feed` inside `PluginState.showtime`.

Write `showtime/tests/feed.test.ts`:

```ts
import { expect, test } from 'claude-code/testing'

import {
  EMPTY_FEED, agentRow, applyAgentDone, applyAgentTool, applySpawn, applyTaskResult, clearTurn, clip, progressOf, taskLine, toolKindOf,
} from '../hooks/feed'
import type { Feed } from '../types'

const NOW = 1_000_000

test('TaskCreate adds a pending task; TaskUpdate moves it; in_progress sets startedAt', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TaskCreate', { subject: 'Write feed' }, { task: { id: '1', subject: 'Write feed' } }, NOW)
  expect(f.tasks).toEqual([{ id: '1', subject: 'Write feed', status: 'pending' }])
  expect(f.source).toBe('tasks')
  f = applyTaskResult(f, 'TaskUpdate', { taskId: '1', status: 'in_progress' }, { success: true, taskId: '1', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } }, NOW + 5)
  expect(f.tasks[0]!.status).toBe('in_progress')
  expect(f.startedAt).toBe(NOW + 5)
  f = applyTaskResult(f, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true, taskId: '1', updatedFields: ['status'], statusChange: { from: 'in_progress', to: 'completed' } }, NOW + 9)
  expect(f.tasks[0]!.status).toBe('completed')
})

test('a TaskUpdate for an unseen id names it task <id> until TaskList names it', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TaskUpdate', { taskId: '7', status: 'in_progress' }, { success: true, taskId: '7', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } }, NOW)
  expect(f.tasks).toEqual([{ id: '7', subject: 'task 7', status: 'in_progress' }])
  f = applyTaskResult(f, 'TaskList', {}, { tasks: [{ id: '7', subject: 'Polish nyan', status: 'in_progress', blockedBy: [] }, { id: '8', subject: 'Release', status: 'pending', blockedBy: ['7'] }] }, NOW)
  expect(f.tasks.map(t => t.subject)).toEqual(['Polish nyan', 'Release'])
})

test('TodoWrite fills the list only while native tasks are not in use; an empty list clears', () => {
  let f = applyTaskResult(EMPTY_FEED, 'TodoWrite', {}, { oldTodos: [], newTodos: [{ content: 'a', status: 'in_progress', activeForm: 'Doing a' }, { content: 'b', status: 'pending', activeForm: 'Doing b' }] }, NOW)
  expect(f.source).toBe('todos')
  expect(f.tasks.map(t => t.subject)).toEqual(['a', 'b'])
  f = applyTaskResult(f, 'TaskCreate', { subject: 'n' }, { task: { id: '1', subject: 'n' } }, NOW)
  expect(f.source).toBe('tasks')
  expect(f.tasks.map(t => t.subject)).toEqual(['n'])
  f = applyTaskResult(f, 'TodoWrite', {}, { oldTodos: [], newTodos: [{ content: 'z', status: 'pending', activeForm: 'z' }] }, NOW)
  expect(f.tasks.map(t => t.subject)).toEqual(['n'])
  f = applyTaskResult(f, 'TaskList', {}, { tasks: [] }, NOW)
  expect(f.tasks).toEqual([])
  expect(f.source).toBeNull()
})

test('a denied call or a result without the expected fields leaves the feed unchanged', () => {
  const f = applyTaskResult(EMPTY_FEED, 'TaskCreate', { subject: 'x' }, { task: { id: '1', subject: 'x' } }, NOW)
  expect(applyTaskResult(f, 'TaskCreate', {}, undefined, NOW)).toBe(f)
  expect(applyTaskResult(f, 'TaskUpdate', {}, { success: false, taskId: '1', updatedFields: [] }, NOW)).toBe(f)
  expect(applyTaskResult(f, 'TodoWrite', {}, { nonsense: true }, NOW)).toBe(f)
  expect(applyTaskResult(f, 'Bash', {}, { result: 'out' }, NOW)).toBe(f)
})

test('agents spawn, pick up a tool, and finish', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'review the diff', type: 'reviewer' }, NOW)
  f = applySpawn(f, { id: 'a2', description: 'run the tests', type: 'checker' }, NOW + 1)
  f = applyAgentTool(f, 'a1', 'Grep: TODO')
  f = applyAgentTool(f, 'zz', 'Bash: ls')
  expect(f.agents.map(a => [a.id, a.tool])).toEqual([['a1', 'Grep: TODO'], ['a2', undefined]])
  f = applyAgentDone(f, 'a1')
  expect(f.agents.map(a => a.id)).toEqual(['a2'])
  expect(applyAgentDone(f, 'none')).toBe(f)
})

test('clearTurn drops tasks, startedAt, running and every agent still listed', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'd', type: 'x' }, NOW)
  f = applyTaskResult(f, 'TaskCreate', { subject: 'x' }, { task: { id: '1', subject: 'x' } }, NOW)
  f = { ...f, running: { c1: { tool: 'Bash', label: 'Bash: ls' } }, startedAt: NOW }
  expect(clearTurn(f)).toEqual(EMPTY_FEED)
})

test('progressOf: done/total, a seven-cell bar and the elapsed time; null without tasks', () => {
  expect(progressOf(EMPTY_FEED, NOW)).toBeNull()
  const tasks: Feed['tasks'] = [
    { id: '1', subject: 'a', status: 'completed' },
    { id: '2', subject: 'b', status: 'completed' },
    { id: '3', subject: 'c', status: 'completed' },
    { id: '4', subject: 'd', status: 'in_progress' },
    { id: '5', subject: 'e', status: 'pending' },
    { id: '6', subject: 'f', status: 'pending' },
    { id: '7', subject: 'g', status: 'pending' },
  ]
  const p = progressOf({ ...EMPTY_FEED, tasks, source: 'tasks', startedAt: NOW - 134_000 }, NOW)
  expect(p).toEqual({ done: 3, total: 7, bar: '▮▮▮▯▯▯▯', elapsed: '2m 14s', text: '3/7 ▮▮▮▯▯▯▯ 2m 14s', ratio: '3/7' })
  expect(progressOf({ ...EMPTY_FEED, tasks: tasks.map(t => ({ ...t, status: 'completed' as const })), source: 'tasks', startedAt: null }, NOW)!.text).toBe('7/7 ▮▮▮▮▮▮▮')
})

test('taskLine: the in-progress task, clipped; the first pending when none runs; empty without tasks', () => {
  expect(taskLine(EMPTY_FEED, 40)).toBe('')
  const f: Feed = { ...EMPTY_FEED, source: 'tasks', tasks: [{ id: '1', subject: 'Done thing', status: 'completed' }, { id: '2', subject: 'Implement the feed model for the companion block', status: 'in_progress' }] }
  expect(taskLine(f, 30)).toBe('▸ Implement the feed model f…')
  expect(taskLine({ ...f, tasks: [{ id: '3', subject: 'Next', status: 'pending' }] }, 30)).toBe('▹ Next')
})

test('agentRow: type, description, tool; as many as fit, then +n more', () => {
  let f = applySpawn(EMPTY_FEED, { id: 'a1', description: 'review the diff', type: 'reviewer' }, NOW)
  f = applyAgentTool(f, 'a1', 'Grep: TODO')
  f = applySpawn(f, { id: 'a2', description: 'run the tests', type: 'checker' }, NOW)
  f = applySpawn(f, { id: 'a3', description: 'a very long description that goes on and on and on past thirty cells', type: 'general-purpose' }, NOW)
  expect(agentRow(f, 200)).toBe('⤷ reviewer · review the diff (Grep)  │  checker · run the tests  │  general-purpose · a very long description that …')
  expect(agentRow(f, 60)).toBe('⤷ reviewer · review the diff (Grep)  │  +2 more')
  expect(agentRow(EMPTY_FEED, 60)).toBe('')
})

test('toolKindOf', () => {
  expect(['Bash', 'Edit', 'Read', 'Grep', 'Agent', 'WebSearch', 'mcp__peek__show_image'].map(toolKindOf)).toEqual(['bash', 'edit', 'read', 'search', 'agent', 'web', 'other'])
  expect(['Write', 'NotebookEdit', 'Glob', 'WebFetch', 'Task', 'MultiEdit'].map(toolKindOf)).toEqual(['edit', 'edit', 'search', 'web', 'agent', 'edit'])
})

test('clip keeps CJK widths and strips control characters', () => {
  expect(clip('abc\u0007def', 10)).toBe('abcdef')
  expect(clip('中文字符串测试', 8)).toBe('中文字…')
  expect(clip('short', 5)).toBe('short')
})
```

Run: `claude plugin test showtime 2>&1 | grep -c '^(fail)'` → 11 (the file fails to import).

- [ ] **Step 2: Implement `feed.ts`**

```ts
// The feed: what the companion block and the scenes read about the turn (its
// tasks, its subagents, its running tools), reduced from tool results and
// agent events. Pure: no engine, no clock; `now` comes in.
import { textWidth } from './cells'
import type { Feed, FeedAgent, FeedTask, TaskStatus } from '../types'

export const EMPTY_FEED: Feed = { tasks: [], source: null, startedAt: null, agents: [], running: {} }

export type ToolKind = 'bash' | 'edit' | 'read' | 'search' | 'agent' | 'web' | 'other'

const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed']
const isStatus = (v: unknown): v is TaskStatus => STATUSES.includes(v as TaskStatus)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Control characters out, width-aware clipping with an ellipsis. */
export function clip(text: string, width: number): string {
  const clean = Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ''))
  if (textWidth(clean.join('')) <= width) return clean.join('')
  let out = ''
  for (const ch of clean) {
    if (textWidth(out + ch) > width - 1) break
    out += ch
  }
  return `${out}…`
}

/** What a task tool's result does to the feed; the same feed back for anything it cannot read. */
export function applyTaskResult(feed: Feed, tool: string, input: unknown, result: unknown, now: number): Feed {
  if (!isRecord(result)) return feed
  if (tool === 'TaskCreate') {
    const task = result.task
    if (!isRecord(task) || typeof task.id !== 'string' || typeof task.subject !== 'string') return feed
    const tasks = feed.source === 'tasks' ? feed.tasks.filter(t => t.id !== task.id) : []
    return { ...feed, source: 'tasks', tasks: [...tasks, { id: task.id, subject: task.subject, status: 'pending' }] }
  }
  if (tool === 'TaskUpdate') {
    const change = result.statusChange
    if (result.success !== true || typeof result.taskId !== 'string' || !isRecord(change) || !isStatus(change.to)) return feed
    const id = result.taskId
    const tasks = feed.source === 'tasks' ? [...feed.tasks] : []
    const at = tasks.findIndex(t => t.id === id)
    if (at === -1) tasks.push({ id, subject: `task ${id}`, status: change.to })
    else tasks[at] = { ...tasks[at]!, status: change.to }
    return { ...feed, source: 'tasks', tasks, startedAt: change.to === 'in_progress' ? now : feed.startedAt }
  }
  if (tool === 'TaskList') {
    if (!Array.isArray(result.tasks)) return feed
    const tasks: FeedTask[] = []
    for (const t of result.tasks) {
      if (!isRecord(t) || typeof t.id !== 'string' || typeof t.subject !== 'string' || !isStatus(t.status)) return feed
      tasks.push({ id: t.id, subject: t.subject, status: t.status })
    }
    return tasks.length === 0 ? { ...feed, tasks: [], source: null } : { ...feed, source: 'tasks', tasks }
  }
  if (tool === 'TaskGet') {
    const task = result.task
    if (!isRecord(task) || typeof task.id !== 'string' || typeof task.subject !== 'string' || !isStatus(task.status)) return feed
    const tasks = feed.tasks.map(t => (t.id === task.id ? { ...t, subject: task.subject as string, status: task.status as TaskStatus } : t))
    return { ...feed, tasks }
  }
  if (tool === 'TodoWrite') {
    if (feed.source === 'tasks' || !Array.isArray(result.newTodos)) return feed
    const tasks: FeedTask[] = []
    for (const [i, t] of result.newTodos.entries()) {
      if (!isRecord(t) || typeof t.content !== 'string' || !isStatus(t.status)) return feed
      tasks.push({ id: String(i), subject: t.content, status: t.status })
    }
    if (tasks.length === 0) return { ...feed, tasks: [], source: null }
    const started = tasks.some(t => t.status === 'in_progress') && !feed.tasks.some(t => t.status === 'in_progress')
    return { ...feed, source: 'todos', tasks, startedAt: started ? now : feed.startedAt }
  }
  return feed
}

export function applySpawn(feed: Feed, agent: { id: string; description: string; type: string }, now: number): Feed {
  const kept = feed.agents.filter(a => a.id !== agent.id)
  return { ...feed, agents: [...kept, { ...agent, since: now }] }
}

export function applyAgentTool(feed: Feed, agentId: string, label: string | undefined): Feed {
  if (!feed.agents.some(a => a.id === agentId)) return feed
  return { ...feed, agents: feed.agents.map(a => (a.id === agentId ? { ...a, tool: label } : a)) }
}

export function applyAgentDone(feed: Feed, agentId: string): Feed {
  if (!feed.agents.some(a => a.id === agentId)) return feed
  return { ...feed, agents: feed.agents.filter(a => a.id !== agentId) }
}

/** The main turn ended: tasks, timing, running tools and any agent left go. */
export function clearTurn(feed: Feed): Feed {
  return EMPTY_FEED
}

/** `12s`, `3m 05s`, `1h 02m`. */
function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

export type Progress = { done: number; total: number; bar: string; elapsed: string; text: string; ratio: string }

export function progressOf(feed: Feed, now: number): Progress | null {
  const total = feed.tasks.length
  if (total === 0) return null
  const done = feed.tasks.filter(t => t.status === 'completed').length
  const lit = Math.round((done / total) * 7)
  const bar = '▮'.repeat(lit) + '▯'.repeat(7 - lit)
  const elapsed = feed.startedAt === null || done === total ? '' : duration(now - feed.startedAt)
  const ratio = `${done}/${total}`
  return { done, total, bar, elapsed, ratio, text: [ratio, bar, elapsed].filter(Boolean).join(' ') }
}

export function taskLine(feed: Feed, width: number): string {
  const current = feed.tasks.find(t => t.status === 'in_progress')
  if (current) return clip(`▸ ${current.subject}`, width)
  const next = feed.tasks.find(t => t.status === 'pending')
  return next ? clip(`▹ ${next.subject}`, width) : ''
}

const SEP = '  │  '

/** One line for the agents running: as many as fit in `width`, the rest counted. */
export function agentRow(feed: Feed, width: number): string {
  if (feed.agents.length === 0) return ''
  const parts = feed.agents.map(a => {
    const tool = a.tool ? ` (${a.tool.split(':')[0]})` : ''
    return `${a.type} · ${clip(a.description, 30)}${tool}`
  })
  let line = '⤷ '
  for (let i = 0; i < parts.length; i++) {
    const left = parts.length - i
    const more = left > 1 ? `${SEP}+${left - 1} more` : ''
    const candidate = line + (i > 0 ? SEP : '') + parts[i]
    if (textWidth(candidate + more) > width && i > 0) return `${line}${SEP}+${left} more`
    line = candidate
  }
  return line
}

export function toolKindOf(tool: string): ToolKind {
  if (tool === 'Bash') return 'bash'
  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'Write' || tool === 'NotebookEdit') return 'edit'
  if (tool === 'Read') return 'read'
  if (tool === 'Grep' || tool === 'Glob') return 'search'
  if (tool === 'Agent' || tool === 'Task') return 'agent'
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'web'
  return 'other'
}

export function agentsOf(feed: Feed): FeedAgent[] {
  return feed.agents
}
```

Note: `clearTurn` returns `EMPTY_FEED` by design (the spec clears everything at turn end); the test checks equality.

- [ ] **Step 3: Run, fix, commit**

Run: `claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime` → all pass, tsc silent. Adjust the test's expected clip strings only if `textWidth` counts differ from the literal (`…` is width 1). Commit:

```bash
git add -A showtime && git commit -m "showtime: the feed model, pure and tested

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/feed.ts", "showtime/tests/feed.test.ts", "showtime/types/index.d.ts"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime", "acceptanceCriteria": ["11 feed tests pass", "no engine imports in feed.ts"], "modelTier": "standard"}
```

---

### Task 5: Wire the feed: hooks, the companion block, the agent row, the `feed` option

**Goal:** The feed atom is written by the hooks and drawn: three rows beside the pet, the agent row under the band, the narrow line with done/total, `/showtime feed off|on`, the option in `/config`.

**Files:**
- Modify: `showtime/hooks/register.tsx`, `showtime/hooks/kit/pet.tsx`, `showtime/hooks/config.ts`, `showtime/hooks/command.ts`, `showtime/hooks/i18n.ts`, `showtime/types/index.d.ts` (`DockPet.task`, `DockPet.progress`, `DockPet.ratio`; `isFeedOff`), `showtime/.claude-plugin/plugin.json` (option `feed`), `showtime/README.en.md`, `showtime/README.md`
- Test: `showtime/tests/showtime.test.tsx`

**Acceptance Criteria:**
- [ ] With tasks created through `$.tool.call({ tool: 'TaskCreate', … })` the band shows `1/2`, `▸ <subject>` and the bubble; without tasks only stats and bubble
- [ ] Two spawned agents produce one `⤷` row under the band; eight agents show `+n more`
- [ ] Narrow band (bodyColumns 50) shows `Lv.1 ♥0 1/2` on one line
- [ ] `/showtime feed off` hides task, progress and the agent row and writes the `showtime.feed` row; the pet still draws
- [ ] Companion off hides the feed too
- [ ] All tests pass; tsc clean

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime` → all pass

**Steps:**

- [ ] **Step 1: Failing tests**

Append to `showtime/tests/showtime.test.tsx`. The host's `tool.call` mock must answer the task tools; extend `host()`'s `tool.call` handler at its top:

```ts
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(++taskSeq), subject: (e as { subject: string }).subject } }, text: 'ok' }
    if (e.tool === 'TaskUpdate') {
      const u = e as { taskId: string; status?: 'pending' | 'in_progress' | 'completed' }
      return { result: { success: true, taskId: u.taskId, updatedFields: ['status'], statusChange: { from: 'pending', to: u.status ?? 'pending' } }, text: 'ok' }
    }
```

with `let taskSeq = 0` beside `lastCallId` and `taskSeq = 0` in `host()`. Then the tests:

```ts
test('tasks show beside the pet: progress on the stats row, the task under it; cleared when the turn ends', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write the feed', description: 'd' } as never)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Draw the rows', description: 'd' } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  let text = await said(ui)
  expect(text).toContain('0/2')
  expect(text).toContain('▸ Write the feed')
  await ui.unmount()
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  expect(await said(ui)).toContain('1/2')
  await ui.unmount()
  await $.turn.complete(DONE)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  text = await said(ui)
  expect(text).not.toContain('1/2')
  expect(text).not.toContain('Write the feed')
  expect(text).toContain('Lv.')
  await ui.unmount()
})

test('subagents get a row under the band, counted past what fits, gone when they finish', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 'c1', prompt: 'p', description: 'review the diff', subagentType: 'reviewer', provider: { kind: 'plugin', plugin: 'test' } } as never)
  await $.agent.spawn({ tool_use_id: 'c2', prompt: 'p', description: 'run the tests', subagentType: 'checker', provider: { kind: 'plugin', plugin: 'test' } } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  let text = await said(ui)
  expect(text).toContain('⤷ reviewer · review the diff')
  expect(text).toContain('checker · run the tests')
  await ui.unmount()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 40 } })
  expect(await said(ui)).toContain('+1 more')
  await ui.unmount()
  await $.turn.complete(DONE)
  await clock.settle()
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...IDLE })
  expect(await said(ui)).not.toContain('⤷')
  await ui.unmount()
})

test('a narrow band keeps done/total on its one line; /showtime feed off hides the feed, not the pet', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'One', description: 'd' } as never)
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 50 } })
  expect(await said(ui)).toContain('0/1')
  await ui.unmount()
  expect((await $.command.run({ command: 'showtime', args: 'feed off', ...RUN })).text).toContain('off')
  expect(rows).toContainEqual(['showtime.feed', false])
  ui = await $.ui.mount({ plugin: 'showtime', surface: 'terminal', ...BAND })
  const text = await said(ui)
  expect(text).not.toContain('0/1')
  expect(text).toContain('Lv.')
  expect(await drawn(ui, 'pet')).toContain('▀')
  await ui.unmount()
})
```

Check the exact spawn-event input shape in the engine types (`AgentSpawnInput`, line ~261 of `.claude-plugin/types/claude-code/index.d.ts`): the test passes what it requires, cast `as never`, and `$.agent.spawn` is the engine's own spawn as the test kit exposes it (grep `spawn` under `declare module 'claude-code/testing'`); if the kit has no spawn, raise `agent.spawn` through `$.tool.call({ tool: 'Agent', description, prompt, subagent_type })` with the host answering `{ result: { agentId: 'a1', … } }` and hook `agent.spawn` from that.

Run: `claude plugin test showtime 2>&1 | grep -c '^(fail)'` → 3.

- [ ] **Step 2: The option and the command**

`showtime/.claude-plugin/plugin.json`, after `companion`:

```json
    "feed": {
      "type": "boolean",
      "title": "Feed",
      "description": "Beside the pet: the plan's progress and current task, and a row under the band naming each subagent and what it runs (/showtime feed off|on overrides it). Costs no tokens: it reads the task tools' results and the engine's own events",
      "default": true
    },
```

`config.ts`: `hasFeed: boolean` read as `flag(options.feed, true)`. `command.ts`: `| { kind: 'feed'; isOn: boolean }`, `if (verb === 'feed' && isSwitch) return { kind: 'feed', isOn: arg === 'on' }`, and `USAGE` gains `|feed off`. `i18n.ts`: keys `cmd.feedOff` ("Feed (tasks and agents) hidden"), `cmd.feedOn` ("Feed (tasks and agents) shown"), `feed.more` ("+{n} more"), `feed.task` ("task {id}"); `cmd.usage` gains `· feed off / on`; all eleven languages (zh-Hans: 任务与子代理信息栏已隐藏/已显示, +{n} 个, 任务 {id}; zh-Hant: 任務與子代理資訊列已隱藏/已顯示, +{n} 個, 任務 {id}; ja: タスクとサブエージェントの表示をオフ/オン, 他 {n} 件, タスク {id}; ko: 작업·서브에이전트 표시 끔/켬, +{n}개, 작업 {id}; es: Tareas y agentes ocultos/mostrados, +{n} más, tarea {id}; fr: Tâches et agents masqués/affichés, +{n} de plus, tâche {id}; de: Aufgaben und Agenten ausgeblendet/eingeblendet, +{n} weitere, Aufgabe {id}; pt-BR: Tarefas e agentes ocultos/exibidos, +{n} mais, tarefa {id}; ru: Задачи и агенты скрыты/показаны, ещё {n}, задача {id}). `agentRow` and `applyTaskResult` take the two strings as parameters (`more: (n) => string`, `taskName: (id) => string`) so `feed.ts` stays free of i18n: update their signatures and the Task 4 tests accordingly (`agentRow(f, 60, n => \`+${n} more\`)`, `applyTaskResult(f, …, now, id => \`task ${id}\`)`).

- [ ] **Step 3: The atom and the hooks**

In `register.tsx`:

```ts
import { EMPTY_FEED, agentRow, applyAgentDone, applyAgentTool, applySpawn, applyTaskResult, clearTurn, progressOf, taskLine } from './feed'
const feed = atom({ plugin: 'showtime', key: 'feed' } as const, EMPTY_FEED)
const feedOffSet = atom({ plugin: 'showtime', key: 'isFeedOff' } as const, null as boolean | null)
const isFeedOff = derive([feedOffSet], set => set ?? !(rows?.hasFeed ?? true))
const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite'])
```

Add `isFeedOff: boolean | null` and `feed: Feed` to the contract (`feed` is there from Task 4). `setSwitch` gains the field `'feed'` (mirror `feedOffSet`). The `running` map goes: the feed's `running` record replaces it; `settle($)` reads `Object.values((await read($, feed)).running).map(r => r.label)`.

`tool.call` hook, the subagent branch: before `next`, `await update($, feed, f => applyAgentTool(f, e.agentId!, toolLabel(e as never)))`; after, `applyAgentTool(f, e.agentId!, undefined)`. The main branch: `running` writes become `update($, feed, f => ({ ...f, running: { ...f.running, [e.tool_use_id]: { tool: e.tool, label } } }))` and the matching removal in `finally`. After `const result = await next(e)`, add:

```ts
      if (TASK_TOOLS.has(e.tool)) {
        const now = await $.clock.now()
        await update($, feed, f => applyTaskResult(f, e.tool, e, 'result' in result ? result.result : undefined, now, id => m('feed.task', { id })))
        await publishPet($)
      }
```

New hooks:

```ts
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    const spawned = result as { agentId?: string }
    const parent = (e as { parentAgentId?: string }).parentAgentId
    if (typeof spawned.agentId === 'string' && parent === undefined && !('workflow' in e)) {
      await update($, feed, f => applySpawn(f, { id: spawned.agentId!, description: e.description, type: e.subagentType }, Date.now()))
    }
    return result
  })
```

(Read `AgentSpawnInput`/result in the types to confirm the field names `parentAgentId`, `agentId`; hoobnn's todo-bar at `upstream/hoobnn-spinner/claude-code/todo-bar/hooks/register.tsx:124` does the same and is the reference.) `turn.complete` with `e.agentId`: `await update($, feed, f => applyAgentDone(f, e.agentId!))` before returning. Main `turn.complete`: `await update($, feed, clearTurn)`. `turn.start` main: `await update($, feed, f => ({ ...f, startedAt: Date.now() }))` is not needed (startedAt null means no elapsed until a task is in progress); leave it null. `session.start`: `const listed = await $.agent.list().catch(() => [])` and `applySpawn` each with `parent === undefined` (check `AgentInfo` fields: `id`, `description`, and a type field if present, else `'agent'`).

- [ ] **Step 4: Publish and draw**

`publishPet`: after `stats`, when `!(await read($, isFeedOff))`: `const p = progressOf(f, await $.clock.now())`; `view.progress = p?.text`, `view.ratio = p?.ratio`, `view.task = taskLine(f, 44)`; the `id` stays as it is (frames do not change with the feed), but the equality check that skips the update gains `was.task === next.task && was.progress === next.progress`. Add `task?: string; progress?: string; ratio?: string` to `DockPet`.

`kit/pet.tsx` `drawPet`: the column becomes

```tsx
        <Text color="#6c757d" wrap="truncate-end">{pet.progress ? `${pet.stats} · ${pet.progress}` : pet.stats}</Text>
        {pet.task ? <Text color="#b8b8be" wrap="truncate-end">{pet.task}</Text> : null}
        {pet.bubble ? (…as today…) : null}
```

`drawPetLine`: the stats Text shows `pet.ratio ? \`${pet.stats} ${pet.ratio}\` : pet.stats`. Replace the "Generated from" header line in every `kit/*.ts(x)` with `// Forked from hoobnn's claude-code/kit; edited in place.`

The band hook: `PET_LABEL_W` becomes a function of width: `const labelW = Math.max(24, Math.min(44, e.props.bodyColumns - 2 - PET_W - 1 - 40))` used where `PET_LABEL_W` was. After the band is built, the agent row:

```tsx
    const agentsLine = (await read($, isFeedOff)) ? '' : agentRow(await read($, feed), e.props.bodyColumns - 2, n => m('feed.more', { n }))
    const mine = agentsLine ? (
      <Box flexDirection="column">
        {band}
        <Text color="#6c757d" wrap="truncate-end">{agentsLine}</Text>
      </Box>
    ) : band
    return stackAbove(ui, mine, await next(e))
```

(`Text` from `ui`.) The narrow branch does the same with its line. The `/showtime feed` command case mirrors `companion`'s with `m('cmd.feedOn'|'cmd.feedOff')`. `status()` adds `m('cmd.feedOff')` when off.

- [ ] **Step 5: Run everything; docs; commit; push; bump**

Run the Verify command → all pass, tsc silent. READMEs: a "Feed" bullet under the feature list (the three rows, the agent row, the narrow line, cleared at turn end, no tokens), the `feed` option, `feed off / on` in Commands. Commit, push, bump:

```bash
cd ~/code/claudebro/claude-mods && git add -A showtime && git commit -m "showtime: the feed beside the pet — tasks, progress, subagents

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime feed" && git push
```

```json:metadata
{"files": ["showtime/hooks/register.tsx", "showtime/hooks/kit/pet.tsx", "showtime/hooks/config.ts", "showtime/hooks/command.ts", "showtime/hooks/i18n.ts", "showtime/types/index.d.ts", "showtime/.claude-plugin/plugin.json"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime", "acceptanceCriteria": ["tasks rows render and clear", "agent row with overflow", "narrow line ratio", "feed off keeps pet"], "modelTier": "frontier"}
```

---

### Task 6: `Signals` into every scene, shared reactions, motion tests

**Goal:** Scenes take `(t, w, s: Signals)`; the band builds `Signals` from the atoms; `reactions.ts` gives the two-row scenes agents, shake and burst; `tests/scenes.test.ts` checks grids and motion for every theme.

**Files:**
- Create: `showtime/hooks/reactions.ts`, `showtime/tests/scenes.test.ts`
- Modify: `showtime/hooks/themes.ts` (`Signals`, `IDLE_SIGNALS`, `Theme.scene`), `showtime/hooks/stage.tsx`, `showtime/hooks/register.tsx` (signals in the band hook, news `at`), `showtime/hooks/themes/*.ts` (signature only; two-row scenes wrap with `withReactions`), `showtime/tests/showtime.test.tsx` (the width test passes `IDLE_SIGNALS`)

**Acceptance Criteria:**
- [ ] `Signals` has `act, tool?, agents, done, total, news?, newsAge, actAge, doneAge, agentsAge`
- [ ] Every theme's scene compiles with the new signature; `stage.tsx` computes the ages
- [ ] `tests/scenes.test.ts` runs grid tests for all 14 themes and motion tests; motion tests may fail for existing themes and are marked per theme in the test's `POLISHED` set (empty now; each of Tasks 8–21 adds its theme)
- [ ] tsc clean; all other tests pass

**Verify:** `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime` → all pass

**Steps:**

- [ ] **Step 1: Types**

In `themes.ts`:

```ts
export type ToolKind = 'bash' | 'edit' | 'read' | 'search' | 'agent' | 'web' | 'other'
export type NewsKind = 'testPass' | 'testFail' | 'commit'
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
}
export const IDLE_SIGNALS: Signals = { act: 'think', agents: 0, done: 0, total: 0, newsAge: 999, actAge: 999, doneAge: 999, agentsAge: 999 }
```

`Theme.scene: (t: number, w: number, s: Signals) => Grid`. Each theme file's `scene(t, w, act)` becomes `scene(t, w, s)` with `const act = s.act` on its first line (behaviour unchanged for now). The width test in `showtime.test.tsx` calls `theme.scene(t, w, { ...IDLE_SIGNALS, act: acts[t % 4]! })`.

- [ ] **Step 2: The stage counts ages**

`stage.tsx` props: `signals: Omit<Signals, 'newsAge' | 'actAge' | 'doneAge' | 'agentsAge'> & { newsId?: string }`. Keep per-instance memory as `pet-player.tsx` does:

```ts
const stages = new WeakMap<object, { act: Act; actAt: number; done: number; doneAt: number; agents: number; agentsAt: number; newsId?: string; newsAt: number }>()
```

Each render: `const t = surface.state ?? 0`; get or create the memory; for each of act/done/agents/newsId, if the prop differs from the memory, set it and its `*At = t`; build `s: Signals = { ...props.signals, actAge: t - m.actAt, doneAge: t - m.doneAt, agentsAge: t - m.agentsAt, newsAge: props.signals.news ? t - m.newsAt : 999 }`; call `theme.scene(t, w, s)`.

- [ ] **Step 3: The band builds the signals**

In the band hook, in place of `act: now.act`:

```ts
      const f = await read($, feed)
      const p = progressOf(f, await $.clock.now())
      const said = await read($, news)
      const lastTool = Object.values(f.running).at(-1)?.tool
      const signals = { act: now.act, tool: lastTool ? toolKindOf(lastTool) : undefined, agents: f.agents.length, done: p?.done ?? 0, total: p?.total ?? 0, news: said?.kind, newsId: said?.id }
```

and `props: { theme: name, columns, signals, still: isStill }` (the finale branch passes `signals` too; `StageProps.act` is gone). Import `toolKindOf` from `./feed`.

- [ ] **Step 4: Shared reactions**

`showtime/hooks/reactions.ts`:

```ts
// Reactions any grid can carry, for the two-row scenes: a figure per subagent
// at the right edge, a shake on a failed test, a spark burst on a commit.
import { frame, mod, put } from './cells'
import type { Grid } from './cells'
import type { Signals } from './themes'

const FIGURE = ['ᗣ', 'ᗤ']

export function withReactions(g: Grid, t: number, s: Signals, color: string): Grid {
  const w = g[0]?.length ?? 0
  const rows = g.length
  let out = g
  // Agents: one small figure each, bobbing, at the right edge, at most four.
  for (let i = 0; i < Math.min(s.agents, 4); i++) {
    const x = w - 2 - i * 2
    const row = mod(t + i * 3, 8) < 4 ? rows - 1 : Math.max(0, rows - 2)
    if (x >= 0) put(out, x, row, frame(FIGURE, t >> 2), { c: color, d: true })
  }
  // A failed test: the whole grid shakes a column left and right for eight frames.
  if (s.news === 'testFail' && s.newsAge < 8) {
    const dx = mod(s.newsAge, 2) === 0 ? 1 : -1
    out = out.map(row => (dx > 0 ? [{ ch: ' ' }, ...row.slice(0, w - 1)] : [...row.slice(1), { ch: ' ' }]))
  }
  // A commit: sparks fly out from the middle for sixteen frames and fade.
  if (s.news === 'commit' && s.newsAge < 16) {
    const cx = Math.floor(w / 2)
    for (let i = 0; i < 8; i++) {
      const dir = i % 2 ? 1 : -1
      const x = cx + dir * Math.round(1 + s.newsAge * (0.4 + (i % 4) * 0.3))
      const row = (i >> 1) % rows
      put(out, x, row, frame(['✦', '✧', '·'], i + (s.newsAge >> 2)), { c: color, d: s.newsAge > 10 })
    }
  }
  return out
}
```

Each two-row theme's scene returns `withReactions(g, t, s, COLOR)`.

- [ ] **Step 5: Grid and motion tests**

`showtime/tests/scenes.test.ts`:

```ts
import { expect, test } from 'claude-code/testing'

import { IDLE_SIGNALS, THEMES, THEME_NAMES, segments, textWidth } from '../hooks/themes'
import type { Act, NewsKind, Signals } from '../hooks/themes'

const ACTS: Act[] = ['think', 'tool', 'ask', 'say']
const NEWS: NewsKind[] = ['testPass', 'testFail', 'commit']
/** Themes that meet the motion rules already (each polish task adds its own). */
const POLISHED = new Set<string>([])

function sig(over: Partial<Signals>): Signals {
  return { ...IDLE_SIGNALS, ...over }
}

test('every scene fills its rows and width under every signal, and never throws', () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    const cases: Signals[] = [
      ...ACTS.map(act => sig({ act, actAge: 0 })),
      ...ACTS.map(act => sig({ act, actAge: 30 })),
      sig({ agents: 2, agentsAge: 0 }), sig({ agents: 5, agentsAge: 40 }),
      sig({ done: 0, total: 0 }), sig({ done: 3, total: 7, doneAge: 0 }), sig({ done: 7, total: 7, doneAge: 2 }), sig({ done: 2, total: 40 }),
      ...NEWS.flatMap(news => [0, 8, 20, 60].map(newsAge => sig({ news, newsAge }))),
      sig({ act: 'tool', tool: 'bash' }), sig({ act: 'tool', tool: 'edit' }), sig({ act: 'tool', tool: 'search' }),
    ]
    for (const w of [16, 40, 80, 160]) {
      for (const s of cases) {
        for (const t of [0, 1, 7, 50, 333]) {
          const g = theme.scene(t, w, s)
          expect(g).toHaveLength(theme.rows)
          for (const row of g) expect(textWidth(segments(row).map(x => x.text).join(''))).toBe(w)
        }
      }
    }
  }
})

/** The foreground cells of a row as a string, for comparing frames. */
function ink(g: ReturnType<(typeof THEMES)['clawd']['scene']>): string[] {
  return g.map(row => row.map(c => (c.ch === ' ' ? ' ' : c.ch === '' ? '' : 'x')).join(''))
}

/** The leftmost column of each non-blank 4-cell chunk, to spot a shape jumping. */
function edges(line: string): number[] {
  const out: number[] = []
  for (let x = 0; x < line.length; x++) if (line[x] === 'x' && (x === 0 || line[x - 1] !== 'x')) out.push(x)
  return out
}

test('polished scenes never hold a frame and never jump a shape more than a cell', () => {
  for (const name of THEME_NAMES) {
    if (!POLISHED.has(name)) continue
    const theme = THEMES[name]
    for (const act of ACTS) {
      let last = ink(theme.scene(0, 80, sig({ act, actAge: 30 })))
      for (let t = 1; t < 60; t++) {
        const now = ink(theme.scene(t, 80, sig({ act, actAge: 30 + t })))
        expect(now.join('\n')).not.toBe(last.join('\n'))
        for (let r = 0; r < now.length; r++) {
          const a = edges(last[r]!)
          const b = edges(now[r]!)
          // Each edge in the new frame is within a cell of one in the old (shapes that appear count once, at the edges).
          for (const x of b) {
            const near = a.some(y => Math.abs(y - x) <= 1) || x <= 1 || x >= 78
            expect(near, `${name} ${act} t=${t} row ${r} edge at ${x} jumped`).toBe(true)
          }
        }
        last = now
      }
    }
  }
})
```

Run: `claude plugin test showtime 2>&1 | tail -3` → all pass (POLISHED is empty, so the motion test is a no-op until Task 8).

- [ ] **Step 6: Commit**

```bash
cd ~/code/claudebro/claude-mods && git add -A showtime && git commit -m "showtime: signals into every scene, shared reactions, motion tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["showtime/hooks/themes.ts", "showtime/hooks/stage.tsx", "showtime/hooks/reactions.ts", "showtime/hooks/register.tsx", "showtime/tests/scenes.test.ts"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime", "acceptanceCriteria": ["Signals type with ages", "all scenes compile", "scenes.test.ts runs"], "modelTier": "standard"}
```

---

### Task 7: `scripts/shots.ts`: a still, a review sheet, the gallery

**Goal:** `bun scripts/shots.ts --theme <name>` writes `assets/<name>.png` and `assets/review/<name>.png` with labelled strips; `--gallery` writes `assets/gallery.png`. zlib only.

**Files:**
- Create: `showtime/scripts/shots.ts`, `showtime/assets/review/.gitkeep`
- Modify: `showtime/README.en.md`, `showtime/README.md` (Development: the script's real path and use)

**Acceptance Criteria:**
- [ ] `cd showtime && bun scripts/shots.ts --theme clawd` finishes in under 10 s and writes both PNGs; `file assets/review/clawd.png` says `PNG image data`
- [ ] The sheet, read with the Read tool, shows labelled strips of twelve frames for think, tool, ask, say, agents=2, done 3/7, done 7/7, testFail 0/8/20, commit 0/8/20, and the pet in think, tool, ready, sleep
- [ ] `bun scripts/shots.ts --gallery` writes `assets/gallery.png` from every theme's still

**Verify:** `cd ~/code/claudebro/claude-mods/showtime && time bun scripts/shots.ts --theme clawd && file assets/clawd.png assets/review/clawd.png` → two `PNG image data` lines, real time under 10 s

**Steps:**

- [ ] **Step 1: The script**

```ts
// Renders a theme as PNGs without a terminal, a browser or ffmpeg: each cell of
// the scene becomes SCALE×(2·SCALE) pixels (half blocks are two pixels, a glyph
// a dimmed block of its color), labels in a 3×5 pixel font.
//   bun scripts/shots.ts --theme <name>   → assets/<name>.png, assets/review/<name>.png
//   bun scripts/shots.ts --gallery        → assets/gallery.png (every theme's still)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { IDLE_SIGNALS, THEMES, THEME_NAMES, isThemeName } from '../hooks/themes'
import type { Act, Signals, Theme } from '../hooks/themes'
import { PET_ROWS, PET_W, petFrame } from '../hooks/pets'
import type { Grid } from '../hooks/cells'

const OUT = join(import.meta.dir, '../assets')
const SCALE = 4
const W = 48
const STILL_W = 80
const BACK = [0x1a, 0x1a, 0x1e] as const
const GAP = 6

type Img = { w: number; h: number; px: Uint8Array }
const image = (w: number, h: number): Img => {
  const px = new Uint8Array(w * h * 3)
  for (let i = 0; i < w * h; i++) px.set(BACK, i * 3)
  return { w, h, px }
}
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const dot = (img: Img, x: number, y: number, c: [number, number, number]) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return
  img.px.set(c, (y * img.w + x) * 3)
}
const rect = (img: Img, x: number, y: number, w: number, h: number, c: [number, number, number]) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dot(img, x + i, y + j, c)
}

/** A grid of cells onto the image at (ox, oy): `▀▄█` as pixels, any other glyph as a dimmed block. */
function blit(img: Img, g: Grid, ox: number, oy: number): void {
  g.forEach((row, r) => {
    row.forEach((cell, x) => {
      if (cell.ch === ' ' || cell.ch === '') return
      const fg = cell.c ? hex(cell.c) : ([0xb8, 0xb8, 0xbe] as [number, number, number])
      const bg = cell.bg ? hex(cell.bg) : null
      const X = ox + x * SCALE
      const Y = oy + r * SCALE * 2
      if (cell.ch === '█') rect(img, X, Y, SCALE, SCALE * 2, fg)
      else if (cell.ch === '▀') {
        rect(img, X, Y, SCALE, SCALE, fg)
        if (bg) rect(img, X, Y + SCALE, SCALE, SCALE, bg)
      } else if (cell.ch === '▄') {
        rect(img, X, Y + SCALE, SCALE, SCALE, fg)
        if (bg) rect(img, X, Y, SCALE, SCALE, bg)
      } else {
        const dim = fg.map(v => Math.round(v * (cell.d ? 0.4 : 0.7))) as [number, number, number]
        rect(img, X + 1, Y + 1, SCALE - 2, SCALE * 2 - 2, dim)
      }
    })
  })
}

// A 3×5 font for the labels: a-z, 0-9, space, / and :.
const FONT: Record<string, string[]> = {
  a: ['010', '101', '111', '101', '101'], b: ['110', '101', '110', '101', '110'], c: ['011', '100', '100', '100', '011'], d: ['110', '101', '101', '101', '110'],
  e: ['111', '100', '110', '100', '111'], f: ['111', '100', '110', '100', '100'], g: ['011', '100', '101', '101', '011'], h: ['101', '101', '111', '101', '101'],
  i: ['111', '010', '010', '010', '111'], j: ['001', '001', '001', '101', '010'], k: ['101', '110', '100', '110', '101'], l: ['100', '100', '100', '100', '111'],
  m: ['101', '111', '111', '101', '101'], n: ['110', '101', '101', '101', '101'], o: ['010', '101', '101', '101', '010'], p: ['110', '101', '110', '100', '100'],
  q: ['010', '101', '101', '011', '001'], r: ['110', '101', '110', '101', '101'], s: ['011', '100', '010', '001', '110'], t: ['111', '010', '010', '010', '010'],
  u: ['101', '101', '101', '101', '011'], v: ['101', '101', '101', '010', '010'], w: ['101', '101', '111', '111', '101'], x: ['101', '010', '010', '010', '101'],
  y: ['101', '101', '010', '010', '010'], z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], ' ': ['000', '000', '000', '000', '000'], '/': ['001', '001', '010', '100', '100'],
  ':': ['000', '010', '000', '010', '000'], '=': ['000', '111', '000', '111', '000'], '-': ['000', '000', '111', '000', '000'],
}
function label(img: Img, text: string, x: number, y: number): void {
  let cx = x
  for (const ch of text.toLowerCase()) {
    const rows = FONT[ch] ?? FONT[' ']!
    rows.forEach((bits, j) => [...bits].forEach((b, i) => b === '1' && rect(img, cx + i * 2, y + j * 2, 2, 2, [0xdd, 0xdd, 0xdd])))
    cx += 8
  }
}

// PNG: 8-bit RGB, unfiltered scanlines, one IDAT.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = (b: Uint8Array) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ -1) >>> 0 }
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b }
function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length)
  body.set(new TextEncoder().encode(type)); body.set(data, 4)
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc(body))])
}
function png(img: Img): Uint8Array {
  const stride = img.w * 3 + 1
  const raw = new Uint8Array(img.h * stride)
  for (let y = 0; y < img.h; y++) raw.set(img.px.subarray(y * img.w * 3, (y + 1) * img.w * 3), y * stride + 1)
  const ihdr = new Uint8Array([...u32(img.w), ...u32(img.h), 8, 2, 0, 0, 0])
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(deflateSync(raw))), ...chunk('IEND', new Uint8Array())])
}

const sig = (over: Partial<Signals>): Signals => ({ ...IDLE_SIGNALS, ...over })

/** The review sheet's strips: a label and twelve consecutive frames each. */
function strips(theme: Theme): { name: string; frames: Grid[] }[] {
  const acts: Act[] = ['think', 'tool', 'ask', 'say']
  const twelve = (f: (i: number) => Signals, t0 = 40) => Array.from({ length: 12 }, (_, i) => theme.scene(t0 + i, W, f(i)))
  const out = acts.map(act => ({ name: act, frames: twelve(i => sig({ act, actAge: 30 + i })) }))
  out.push({ name: 'agents 2', frames: twelve(i => sig({ agents: 2, agentsAge: i })) })
  out.push({ name: 'done 3/7', frames: twelve(i => sig({ done: 3, total: 7, doneAge: i })) })
  out.push({ name: 'done 7/7', frames: twelve(i => sig({ done: 7, total: 7, doneAge: i })) })
  for (const news of ['testFail', 'commit'] as const) for (const age of [0, 8, 20]) out.push({ name: `${news} ${age}`, frames: twelve(i => sig({ news, newsAge: age + i })) })
  out.push({ name: 'tool bash', frames: twelve(i => sig({ act: 'tool', tool: 'bash', actAge: 30 + i })) })
  return out
}

function sheet(theme: Theme): Img {
  const rows = strips(theme)
  const cellH = theme.rows * SCALE * 2
  const petH = PET_ROWS * SCALE * 2
  const stripH = 14 + cellH + GAP
  const img = image(12 * (W * SCALE + GAP) + GAP, rows.length * stripH + 14 + petH + GAP * 2)
  rows.forEach((strip, r) => {
    const y = r * stripH
    label(img, `${theme.name} ${strip.name}`, GAP, y + 2)
    strip.frames.forEach((g, i) => blit(img, g, GAP + i * (W * SCALE + GAP), y + 14))
  })
  const y = rows.length * stripH
  label(img, 'pet think tool ready sleep', GAP, y + 2)
  const states = ['think', 'tool', 'ready', 'sleep'] as const
  states.forEach((state, k) => Array.from({ length: 12 }, (_, i) => petFrame(theme.pet, state, i * 2)).forEach((g, i) => blit(img, g, GAP + (k * 12 + i) * (PET_W * SCALE + 2) / 4, y + 14)))
  return img
}

function still(theme: Theme): Img {
  const g = theme.scene(40, STILL_W, sig({ act: 'tool', tool: 'bash', done: 3, total: 7, agents: 1 }))
  const img = image(STILL_W * SCALE, theme.rows * SCALE * 2)
  blit(img, g, 0, 0)
  return img
}

const args = process.argv.slice(2)
mkdirSync(join(OUT, 'review'), { recursive: true })
if (args[0] === '--theme' && isThemeName(args[1])) {
  const theme = THEMES[args[1]]
  writeFileSync(join(OUT, `${theme.name}.png`), png(still(theme)))
  writeFileSync(join(OUT, 'review', `${theme.name}.png`), png(sheet(theme)))
  console.log(`assets/${theme.name}.png assets/review/${theme.name}.png`)
} else if (args[0] === '--gallery') {
  const rowH = 14 + 4 * SCALE * 2 + GAP
  const img = image(STILL_W * SCALE, THEME_NAMES.length * rowH)
  THEME_NAMES.forEach((name, i) => {
    label(img, name, 0, i * rowH + 2)
    blit(img, THEMES[name].scene(40, STILL_W, sig({ act: 'tool', tool: 'bash', done: 3, total: 7, agents: 1 })), 0, i * rowH + 14)
  })
  writeFileSync(join(OUT, 'gallery.png'), png(img))
  console.log('assets/gallery.png')
} else {
  console.error(`usage: bun scripts/shots.ts --theme <${THEME_NAMES.join('|')}> | --gallery`)
  process.exit(2)
}
```

The pet-strip placement arithmetic above packs 48 pet frames; if it overlaps, lay them at `GAP + (k * 12 + i) * (PET_W * SCALE + 2)` and widen the image to fit (`Math.max(sheetW, 48 * (PET_W * SCALE + 2))`). The sheet must be readable, not pretty.

`themes.ts` must stay runnable under bun with no engine: it imports only `./cells`, `./draw`, `./themes/*`, `./pets` and `./reactions`; none imports a value from `claude-code`. Check with `bun -e "import('./hooks/themes.ts').then(m => console.log(m.THEME_NAMES.length))"` from `showtime/`.

- [ ] **Step 2: Run it, look at it**

Run the Verify command. Read `showtime/assets/review/clawd.png` with the Read tool and confirm the strips and labels are there. Commit `scripts/shots.ts`, `assets/review/.gitkeep` and the two PNGs. Push, bump:

```bash
cd ~/code/claudebro/claude-mods && git add -A showtime && git commit -m "showtime: shots.ts renders a still, a review sheet and the gallery with zlib alone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime signals and shots" && git push
```

```json:metadata
{"files": ["showtime/scripts/shots.ts", "showtime/assets/review/"], "verifyCommand": "cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --theme clawd && file assets/clawd.png assets/review/clawd.png", "acceptanceCriteria": ["two PNGs in under 10 s", "sheet shows labelled strips", "gallery renders"], "modelTier": "standard"}
```

---

## Tasks 8–21: the existing themes, one at a time

Each task: the theme's reactions (spec section 4 table), the animation polish (recipe R3), the review loop (R4–R8), and its name added to `POLISHED` in `tests/scenes.test.ts` so the motion test guards it from then on. Files per task: `showtime/hooks/themes/<name>.ts`, `showtime/tests/scenes.test.ts`, `showtime/assets/<name>.png`, `showtime/assets/review/<name>.png`, `showtime/assets/gallery.png`, and `showtime/THEMES-BACKLOG.md` only if a polish note is needed. Verify for every one: `cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme <name>)` → all pass, two PNG paths printed. Acceptance for every one: motion test passes with the theme in `POLISHED`; all six reaction slots implemented and visible on the sheet; verdict line in the commit message; sheet shown with peek.

### Task 8: clawd
**Goal:** Clawd reacts: one small Clawd (6 px) per agent on the bench typing (bob every 4 frames); `total` tiles over the bench, `done` lit green; a laptop (edit), terminal (bash) or magnifier (search) beside him by `s.tool`; commit: tiles flash white for 12 frames; testFail: he drops the laptop (falls 1 px per frame for 4 frames, lies 20); testPass: thumbs up for 16 frames. Polish: act transitions over 6 frames (`s.actAge < 6`: he turns, the sign rises), blink stays, the ground always scrolls, stars twinkle. Steps: R1 (edit the existing file), R3, R4, add `'clawd'` to `POLISHED`, R5–R8.
```json:metadata
{"files": ["showtime/hooks/themes/clawd.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/clawd.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme clawd)", "acceptanceCriteria": ["motion test passes for clawd", "six reaction slots on the sheet", "verdict in commit"], "modelTier": "frontier"}
```

### Task 9: thunder
**Goal:** One invader wave per agent flying in parallel rows (at most four); the score reads `done/total` and a small ship icon per task sits along the bottom edge, `done` of them lit; fire rate by tool kind (bash every 2 frames, edit 4, else 6); testFail: the jet takes a hit (flashes red/transparent for 10 frames, drops 1 px, recovers); commit: a bomb clears every invader in a 12-frame flash. Polish: the jet bobs on a 12-frame sine, exhaust flickers every frame, stars drift at two speeds, explosions have 4 frames. Steps as Task 8 with `'thunder'`.
```json:metadata
{"files": ["showtime/hooks/themes/thunder.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/thunder.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme thunder)", "acceptanceCriteria": ["motion test passes", "six slots", "verdict"], "modelTier": "frontier"}
```

### Task 10: chomp
**Goal:** One ghost per agent (at most four, each its own color) chasing; `total` dots on the track, `done` of them already eaten (gaps); a power pellet pulses while `s.tool === 'bash'` and the ghosts turn blue; testFail: a ghost catches him (he spins 8 frames and shrinks); testPass: fruit appears for 20 frames. Polish: mouth 4-frame cycle, ghosts wave their skirts every 2 frames, dots glimmer. Steps as Task 8 with `'chomp'`.
```json:metadata
{"files": ["showtime/hooks/themes/chomp.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/chomp.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme chomp)", "acceptanceCriteria": ["motion test passes", "six slots", "verdict"], "modelTier": "frontier"}
```

### Task 11: sparky
**Goal:** One extra mouse trailing per agent (smaller, offset 6 px, bobbing out of phase); a thunderbolt strikes per completed task (`doneAge < 10`: a bolt from the top at a column that moves with `done`); cheeks crackle (alternating pixels) while bash runs; testFail: a grey cloud over him for 20 frames raining 2 px drops; commit: a big bolt across the whole band for 8 frames. Polish: tail wags on a 6-frame cycle, ears twitch every 24, grass scrolls. Steps as Task 8 with `'sparky'`.
```json:metadata
{"files": ["showtime/hooks/themes/sparky.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/sparky.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme sparky)", "acceptanceCriteria": ["motion test passes", "six slots", "verdict"], "modelTier": "frontier"}
```

### Task 12: bluecat
**Goal:** One gadget per agent tumbling in the air (bounce 8-frame cycle, max four); the copter climbs with done/total (y = 6 − round(5·done/total)); pocket items by tool kind (a wrench for bash, a pencil for edit, a lamp for search); testFail: the copter stalls (blades stop, he sinks 2 px over 6 frames, recovers over 6); commit: a door pops out beside him for 16 frames with light. Polish: blades spin every frame, bell swings every 3, clouds at two speeds. Steps as Task 8 with `'bluecat'`.
```json:metadata
{"files": ["showtime/hooks/themes/bluecat.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/bluecat.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme bluecat)", "acceptanceCriteria": ["motion test passes", "six slots", "verdict"], "modelTier": "frontier"}
```

### Task 13: nyan
**Goal:** The rainbow trail's length tracks done/total (4 cells at 0, the full width behind at 100%); a star burst per completed task (`doneAge < 12`); speed by tool kind (stars scroll 1 px/frame think, 2 bash); one extra small cat per agent in echelon; testFail: the trail greys for 20 frames; commit: a double rainbow (second band above) for 24 frames. Polish: legs 4-frame cycle, the trail waves, stars at three depths. Steps as Task 8 with `'nyan'`.
```json:metadata
{"files": ["showtime/hooks/themes/nyan.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/nyan.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme nyan)", "acceptanceCriteria": ["motion test passes", "six slots", "verdict"], "modelTier": "frontier"}
```

### Tasks 14–21: cat, bunny, sakura, mecha, neon, dino, ocean, matrix
**Goal (each):** The two-row scene keeps its characters and gains: a second moving layer where it has one (drifting particles or a scrolling ground), a 4-frame step cycle for anything that slides, an idle motion for every act (a blink, a bob, a wave), act transitions over 4 frames, and `withReactions` (already wrapped in Task 6) tuned to its color; plus tasks shown as a dim row of `total` marks with `done` lit at the top row's right. Then `POLISHED` gains the name and the review loop runs. One task per theme, in this order: Task 14 cat, 15 bunny, 16 sakura, 17 mecha, 18 neon, 19 dino, 20 ocean, 21 matrix. After Task 21: push and bump (`Bump claude-mods: showtime existing themes polished`).
```json:metadata
{"files": ["showtime/hooks/themes/<name>.ts", "showtime/tests/scenes.test.ts", "showtime/assets/review/<name>.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme <name>)", "acceptanceCriteria": ["motion test passes", "reactions visible", "verdict"], "modelTier": "frontier"}
```

---

## Tasks 22–45: the new themes, one at a time

Each task creates `showtime/hooks/themes/<name>.ts` from recipe R1 with the brief below, registers it (R2: `themes.ts`, `plugin.json`, both READMEs), adds the name to `POLISHED`, and runs R4–R8. Pixel scenes are `SCENE_ROWS` (4 rows, 8 px) with three or more layers; each has its own `PET` (5 px tall, up to 12 wide). Verify and acceptance as for Tasks 8–21. Group order: A 22–25, B 26–29, C 30–33, D 34–37, E 38–41, F 42–45. Push and bump after Task 45 (`Bump claude-mods: showtime 24 new themes`).

### Task 22: stack
A falling-block puzzle (color `#4cc9f0`). Layers: a dim well of 10 columns at the left third, a stack of settled rows, a falling tetromino, side particles. think: a piece hovers and rotates every 8 frames; tool: a piece drops 1 px/frame and lands (bash: fast drop); each tool call drops a new piece; `done` lines are shown cleared (flash 6 frames at `doneAge < 6`), `total` rows outlined; one extra well column per agent; testFail: the stack topples (rows shift right 1 px for 8 frames, grey); commit: the well flashes and empties over 12 frames. Pet: a tetromino with eyes.

### Task 23: plumber
A platformer runner (`#e63946`). Layers: hills far, bricks mid, pipes and ground near, the runner. think: he idles bouncing on a 12-frame cycle; tool: runs with a 4-frame step and jumps pipes (arc 6 frames); `total` ? blocks along the top, `done` turned to coins spinning (4 frames); flagpole slides in at 100% (`doneAge < 16`); one extra runner per agent trailing; testFail: he bonks a block and sits 12 frames; commit: fireworks over the flag 16 frames. Pet: a mushroom.

### Task 24: snake
A grid snake (`#9ece6a`). Layers: a dotted field, the snake, apples, a scoreboard glyph. think: the snake winds in a figure-eight (one cell per frame); tool: an apple appears near it and it heads there (bash: faster); the snake's length is 3 + `done`, `total` apples shown dim at the right; one more snake per agent, each its own hue; testFail: it bites its tail (flashes 8 frames, shortens 2); testPass: a golden apple 16 frames. Pet: a small coiled snake.

### Task 25: launch
A rocket on a pad (`#f4a261`). Layers: stars, a gantry, the rocket, exhaust and clouds. think: countdown digits over the rocket (12 frames each); tool: engines light (flame 2-frame flicker), bash: full burn with smoke rolling; the rocket's altitude tracks done/total (lifts 1 px per frame up to its mark); stage separation per agent (a booster falls away, max 3); testFail: splashdown (it drops into water at the right, splash 10 frames); commit: orbit reached, a satellite ring 20 frames. Pet: an astronaut.

### Task 26: frogger
A frog crossing lanes (`#80b918`). Layers: water with logs, a road with cars, the frog. Lanes equal `total` (max 4 visible), crossed as done (the frog sits one lane higher per done); logs drift 1 px/frame, faster while tools run; a truck per agent in the nearest lane; think: the frog blinks and breathes; tool: hops (4-frame arc) between logs; testFail: squashed (flattens 8 frames, re-spawns); commit: a lily pad with a fly, tongue out 12 frames. Pet: a frog.

### Task 27: kitchen
A chef at a stove (`#ffb703`). Layers: tiled wall, counter with plates, the chef, steam. A plate per task along the counter, served (a dome lifts) as done; a pot boils (2-frame bubbles) while tools run, bash: flames; a sous-chef per agent at the right chopping (4-frame); think: the chef taps a spoon on a 12-frame cycle; testFail: a fire on the stove 16 frames, then smoke; commit: a bell rings (`!` swings 8 frames) and a plate goes out. Pet: a dumpling.

### Task 28: railway
A steam train (`#6c757d` with `#e5383b` accents). Layers: hills, a bridge, the train, smoke puffs. A carriage per task (max 6), loaded (a block appears) as done; the signal arm drops while a permission waits (`act === 'ask'`), rises over 4 frames; an extra engine per agent at the back; think: the train idles, puffs every 6 frames; tool: wheels turn (4-frame), bash: fast with sparks; testFail: brakes screech, sparks and a jolt 10 frames; commit: a tunnel swallows the train (dark 12 frames) and it comes out the other side. Pet: a signal lamp.

### Task 29: garden
Plots in a row (`#52b788`). Layers: sky with clouds, a fence, plots, a bee. A seed per task, sprouting (4 stages) as done; rain while tools run (drops 1 px/frame); a bee per agent zigzagging (6-frame); think: a butterfly flaps on a 12-frame cycle; testFail: the plants wilt (bend 8 frames, grey) then recover; commit: a bloom bursts open with petals 16 frames. Pet: a sprout.

### Task 30: racetrack
Cars on an oval (`#f72585`). Layers: stands with flags waving, the track, cars, dust. One car per agent plus the lead car; laps read `done/total` as a counter board; a pit stop while a permission waits (car stops under a pit roof, wrench 4-frame); think: the pace lap, slow; tool: full speed with skid dust, bash fastest; testFail: a spin-out (the car rotates 8 frames, smoke); the chequered flag waves at 100% for 24 frames. Pet: a traffic cone.

### Task 31: aquarium
A tank (`#4895ef`). Layers: back plants swaying, bubbles rising, fish, a chest. A fish per agent (max 4, each a shape); bubbles while tools run (1 px/frame); a treasure chest opens per completed task (`doneAge < 16`, coins float); think: a snail crosses the floor one cell per 3 frames; testFail: the water clouds (dim overlay 16 frames) and fish dart; commit: a diver descends 20 frames with a torch. Pet: a seahorse.

### Task 32: submarine
The deep (`#4361ee`). Layers: light rays, the sub, fish, the seabed. think: sonar pings (expanding ring every 12 frames); periscope up while a permission waits; a torpedo per completed task fires (`doneAge < 14`); an escort sub per agent; tool: the propeller spins 2-frame and the sub advances, bash: dive deeper; testFail: a leak (drops inside, the sub tilts 10 frames); commit: surfaces with a flag 16 frames. Pet: a jellyfish.

### Task 33: orchestra
A pixel band (`#c77dff`). Layers: curtain folds swaying, the stage, musicians, notes. A musician per agent (max 4, each an instrument); the conductor waves a baton (6-frame) while thinking, faster while tools run; a note floats up per completed task (`doneAge < 16`); `total` music stands with `done` lit; testFail: a clash (notes scatter, a musician drops a cymbal, 12 frames); commit: applause (hands at the bottom 2-frame, 20 frames). Pet: a metronome.

### Task 34: roomba
A robot vacuum (`#adb5bd`). Layers: a rug pattern, furniture legs, crumbs, the roomba. Crumbs equal `total` (max 12), eaten as done (the roomba drives over them); think: it bumps a wall and turns (4-frame turn); tool: it cleans in a line, bash: with a spinning brush; a second roomba per agent; testFail: stuck under the sofa (wheels spin, 16 frames, then it reverses out); commit: a cat rides it across 24 frames. Pet: a dust bunny.

### Task 35: coffee
A barista (`#8d5524` with cream). Layers: shelf with jars, the counter, the machine, steam. A cup per task on the counter, filled as done (fill 4 stages); the machine steams while bash runs (2-frame), drips while edit; a barista per agent; think: the barista wipes the counter on a 12-frame cycle; testFail: a spill (a cup tips 6 frames, a puddle spreads 10); commit: latte art (a heart appears 16 frames). Pet: a coffee bean.

### Task 36: penguins
An ice floe (`#90e0ef`). Layers: the aurora shimmering, the sea, the floe, penguins. A penguin per agent huddling (max 4, shuffle 8-frame); a slide per completed task (one penguin belly-slides across, 12 frames); all look up while a permission waits; think: they waddle in place; tool: they fish (a fish jumps 6-frame); testFail: the floe cracks (a line runs across 8 frames, halves drift); commit: a fish caught and tossed 16 frames. Pet: a chick.

### Task 37: ufo
A saucer over a farm (`#b5e48c`). Layers: stars, a barn and fence, cows, the saucer with its beam. think: the saucer hovers on a 12-frame sine with lights chasing; a cow beamed up per completed task (`doneAge < 20`, rises 1 px per 2 frames); `total` cows in the field; an extra saucer per agent; tool: the beam sweeps, bash: wide beam; testFail: crash-lands (tumbles 10 frames, smoke); commit: it zips off the right edge 8 frames and returns. Pet: a small alien.

### Task 38: dragon
A dragon over a castle (`#e63946` with `#ffb703`). Layers: moon and clouds, the castle, the dragon, embers. think: it circles (a figure-eight path, wings 6-frame); bash: breathes fire (a cone 2-frame flicker); a tower per task lit (a window glows) as done; a wyvern per agent (smaller, trailing); testFail: an arrow hits it (it dips 6 frames, a puff); commit: it lands on the keep and roars (12 frames). Pet: a hatchling.

### Task 39: samurai
A duel under a red moon (`#e5383b` with `#f8f9fa`). Layers: petals falling, a bridge, the two fighters, lanterns. think: ready stance, breathing on a 16-frame cycle, the rival mirrors; a strike per tool call (slash arc 4 frames, bash: double); a lantern per task lit as done along the bridge; a rival per agent (max 3); testFail: he staggers (2 px back over 6 frames, a petal burst); commit: he sheathes the blade (8 frames) and bows. Pet: a tiny ronin.

### Task 40: warp
A starship bridge view (`#7dcfff`). Layers: distant stars, near stars streaming, a console silhouette, ships. Stars stream by tool kind (1 px think, 2 edit, 4 bash as warp lines); a planet slides past per completed task (`doneAge < 24`); an escort ship per agent in formation; think: the viewport scans (a line sweeps 12 frames); ask: shields up (a dome outline); testFail: shields flare red 10 frames and the view shakes; commit: a station grows from the center 20 frames. Pet: a droid.

### Task 41: volcano
An island volcano (`#ff6d00`). Layers: sea, the island, the cone, smoke and lava. think: smoke puffs rise 1 px/frame; tool: lava flows down the slope (advances a cell per 2 frames), bash: faster with sparks; a hut per task on the shore, safe (a roof) as done; a boat per agent rowing (4-frame); testFail: eruption (rocks arc 12 frames, the sky reddens); commit: a rainbow arcs over 20 frames. Pet: a lava blob.

### Task 42: dungeon
A party crawling a dungeon (`#ffd166` torches on `#343a40`). Layers: wall bricks, torches flickering (2-frame), rooms, the party. A room per task (max 6) lit as cleared; the party (3 figures, 4-frame step) advances a room per done; a monster per agent fought in its room (bob 6-frame, hits flash); think: torches flicker and the mage's staff glows 12-frame; testFail: a trap springs (spikes 8 frames, the party jumps back); a chest at 100% opens 16 frames; commit: a d20 rolls across 12 frames. Pet: a d20.

### Task 43: mage
A wizard at a spell circle (`#9d4edd`). Layers: stars, the circle's runes orbiting (one cell per frame), the mage, familiars. think: runes orbit, the hat sways 16-frame; a bolt per tool call (shoots right 1 cell/frame, bash: three); a familiar per agent hovering (6-frame bob); a scroll per task burning away as done (4 stages); testFail: a fizzle (sparks fall, the hat scorches black 20 frames); commit: a summoned dragon silhouette rises 20 frames. Pet: a familiar cat.

### Task 44: tavern
Adventurers at a tavern (`#c9a227`). Layers: a fire crackling (2-frame), tables, patrons, the quest board. A scroll per task on the board, torn off (falls 6 frames) as done; the bard plays while thinking (notes rise 12-frame); a patron per agent at a table (drinking 8-frame); tool: the barkeep polishes (4-frame), bash: pours; testFail: a brawl (chairs fly 12 frames, dust); commit: a toast (mugs raise 10 frames, foam). Pet: a frothy mug.

### Task 45: necromancer
A graveyard at night (`#80ed99` on `#212529`). Layers: a moon with bats crossing, fog drifting, graves, skeletons. A skeleton per agent rises (6 frames) and digs (4-frame); a soul flame per task over a grave, lit as done (2-frame flicker); lightning while bash runs (a bolt 2 frames, the sky flashes); think: the necromancer's staff pulses 12-frame; testFail: the skeletons collapse (fall 8 frames to bone piles); commit: a lich crown appears and the fog glows 20 frames. Pet: a skull.

```json:metadata
{"files": ["showtime/hooks/themes/<name>.ts", "showtime/hooks/themes.ts", "showtime/.claude-plugin/plugin.json", "showtime/tests/scenes.test.ts", "showtime/assets/review/<name>.png"], "verifyCommand": "cd ~/code/claudebro/claude-mods && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime && (cd showtime && bun scripts/shots.ts --theme <name>)", "acceptanceCriteria": ["theme registered in themes.ts, plugin.json, READMEs", "motion test passes", "six slots on the sheet", "verdict in commit"], "modelTier": "frontier"}
```

---

### Task 46: Release 1.0.0

**Goal:** Version 1.0.0 installed live, docs and backlog written, marketplace and upstream map updated, everything pushed and the master bumped.

**Files:**
- Create: `showtime/THEMES-BACKLOG.md`
- Modify: `showtime/.claude-plugin/plugin.json` (version 1.0.0, description "…in thirty-eight themes"), `showtime/README.md`, `showtime/README.en.md`, `.claude-plugin/marketplace.json`, `upstream/maps/hoobnn-spinner.sed`, `README.md` (claude-mods: the showtime row), `~/code/claudebro/README.md` row if it names the theme count

**Acceptance Criteria:**
- [ ] `THEMES-BACKLOG.md` lists breakout, pinball, skiing, crane, duck, sloth, keycat, laundry with one-line briefs, plus any polish notes the theme tasks added
- [ ] `upstream/check.sh` runs clean (the sed map maps `claude-code/spinner/hooks/scenes.ts` to nothing and `hooks/themes.ts` paths to `showtime/hooks/themes.ts`; moved files mapped)
- [ ] `claude plugin marketplace update claudebro-mods && claude plugin update showtime@claudebro-mods` installs 1.0.0 (`installed_plugins.json` shows `"version": "1.0.0"`)
- [ ] The gallery (`assets/gallery.png`) shows all 38 themes
- [ ] Pushed; master bumped

**Verify:** `cd ~/code/claudebro/claude-mods && upstream/check.sh && claude plugin marketplace update claudebro-mods && claude plugin update showtime@claudebro-mods && grep -A3 '"showtime@claudebro-mods"' ~/.claude/plugins/installed_plugins.json | grep version` → `"version": "1.0.0"`

**Steps:**

- [ ] **Step 1: Backlog, docs, version**

Write `showtime/THEMES-BACKLOG.md` with a `## Not built` list (the eight briefs as the spec words them) and a `## Polish` section holding whatever Tasks 8–45 appended. Set `version` to `1.0.0` and the description's theme count; in the READMEs: the feature list (feed), the theme table rows for 24 new themes (one line each, no GIF), the Options (`feed`), Commands, the Development list (`feed.ts`, `draw.ts`, `reactions.ts`, `themes/`, `scripts/shots.ts`, `scripts/engine-types.sh`), and the sentence "every theme's still: assets/<theme>.png; review sheets: assets/review/". `marketplace.json`: "…a finale and a pet that levels up, and a token-free feed of tasks and subagents, in thirty-eight themes (hoobnn spinner fork)". claude-mods `README.md` row for showtime likewise.

- [ ] **Step 2: Upstream map**

Edit `upstream/maps/hoobnn-spinner.sed`: keep the existing rules, add `s#claude-code/spinner/hooks/scenes\.ts#showtime/hooks/themes.ts#` and `s#claude-code/spinner/hooks/audio\.ts#showtime/hooks/attic/audio.ts#` (a path that does not exist makes the triage report "unused", which is right). Run `upstream/check.sh` → three "nothing new" lines or a triage, no error.

- [ ] **Step 3: Gallery, tests, install**

```bash
cd ~/code/claudebro/claude-mods/showtime && bun scripts/shots.ts --gallery
cd ~/code/claudebro/claude-mods && claude plugin validate showtime/.claude-plugin/plugin.json && claude plugin test showtime 2>&1 | tail -3 && pnpm exec tsc -p showtime
git add -A showtime .claude-plugin README.md upstream/maps && git commit -m "showtime 1.0.0: feed, reacting scenes, 38 themes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
claude plugin marketplace update claudebro-mods && claude plugin update showtime@claudebro-mods
cd ~/code/claudebro && git add claude-mods && git commit -m "Bump claude-mods: showtime 1.0.0" && git push
```

- [ ] **Step 4: Look at it live**

Show `showtime/assets/gallery.png` with peek. Run `/showtime` in the session (through `$.command` is not possible from here; instead note in the final report that `/showtime` and `/showtime preview <theme>` are for Jeremy to try) and capture the band with `tmux capture-pane -p -t "$TMUX_PANE" -S -8` after this turn's tools have run, to confirm the feed rows draw.

```json:metadata
{"files": ["showtime/THEMES-BACKLOG.md", "showtime/.claude-plugin/plugin.json", "showtime/README.en.md", ".claude-plugin/marketplace.json", "upstream/maps/hoobnn-spinner.sed"], "verifyCommand": "cd ~/code/claudebro/claude-mods && upstream/check.sh && claude plugin marketplace update claudebro-mods && claude plugin update showtime@claudebro-mods && grep -A3 '\"showtime@claudebro-mods\"' ~/.claude/plugins/installed_plugins.json | grep version", "acceptanceCriteria": ["backlog written", "check.sh clean", "1.0.0 installed", "pushed and bumped"], "modelTier": "mechanical"}
```
