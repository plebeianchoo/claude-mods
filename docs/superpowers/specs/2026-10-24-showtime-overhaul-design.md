# showtime overhaul: a live feed, scenes that react, and twenty-four new themes

Date: 2026-10-24. Mod: `showtime/` (fork of hoobnn's spinner 0.6.1, at 0.8.0). Target: 1.0.0.

## Goal

showtime becomes useful as well as decorative. While a turn runs it shows what is
going on (the tool running, each subagent and its task, the plan's progress) without
spending a token, the scenes above the prompt react to those same signals, and the
theme list grows from fourteen to thirty-eight with a registry that makes the next
theme a one-file addition. The pet is the constant: it draws whenever the companion
is on, with or without anything to report.

Out of scope: the audio theme (removed), session health figures (the statusline
script has them), a turn receipt, a pane.

## 1. The feed model

One new atom in showtime's state, `feed`, holds what the companion block and the
scenes read. Plain data, no tokens:

```ts
type Feed = {
  /** Native tasks (TaskCreate/TaskUpdate/TaskList/TaskGet) or TodoWrite's list. */
  tasks: { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed' }[]
  source: 'tasks' | 'todos' | null
  /** When the in-progress task began, else when the turn began; null between turns. */
  startedAt: number | null
  /** Top-level subagents running now. */
  agents: { id: string; description: string; type: string; tool?: string; since: number }[]
  /** The main loop's running tool labels, by tool_use_id (moved here from register.tsx's map). */
  running: Record<string, string>
  /** What a shell command just did, for a few seconds. */
  news: { kind: 'testPass' | 'testFail' | 'commit'; at: number } | null
}
```

Sources, all through hooks that already exist or are added beside them:

- `tool.call` for `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `TodoWrite`:
  `await next(e)`, then apply the result. TaskCreate adds a pending task; TaskUpdate
  applies `statusChange` (a task first seen by id gets the subject `task <id>` until a
  TaskList or TaskGet result names it); TaskList replaces the list; TodoWrite replaces
  it with `newTodos` only while `source` is not `tasks`. Native tasks win once seen.
  An empty list clears `tasks` and `source`. A denied call or a result without the
  expected fields leaves the feed unchanged.
- `tool.call` with `e.agentId`: sets that agent's `tool` to the tool label, if the
  agent is in `agents`; otherwise ignored (workflow and engine forks carry ids no
  list names).
- `tool.call` on the main loop: `running` gains the label before `next`, loses it
  after; `news` is set from the Bash result as today (`newsOf`).
- `agent.spawn` with no `parentAgentId` and no workflow: adds the agent with its
  `description`, `subagentType` and `since: now`.
- `turn.complete` with `e.agentId`: removes that agent. Without one (the main turn):
  clears `tasks`, `source`, `startedAt`, `running` and every agent still listed, so a
  killed subagent cannot leave a stale row.
- `turn.start` (main): `startedAt = now`. A task going `in_progress` resets it to now.
- `session.start`: `agents` seeded from `$.agent.list()` for a resumed session.

Derivations are pure functions in a new `hooks/feed.ts` and test without the
engine: `applyTaskResult`, `applySpawn`, `applyAgentTool`, `applyAgentDone`,
`clearTurn`, `progressOf(feed, now)` (`done`, `total`, a seven-cell bar, elapsed),
`taskLine(feed, width)`, `agentRow(feed, width)` (what fits, the overflow count),
`toolKindOf(tool)`, `clip`. The existing `activity` atom (think, tool, ask, say, wait)
stays the pet's mood source; neither atom writes the other.

## 2. The companion block

The block keeps its shape: pet art at the far right, text rows right-aligned beside
it, three rows. The text area grows from 24 cells to at most 44 when the scene can
spare them (the scene keeps at least 40 cells; below that the text area shrinks back
to 24).

```
                                   Lv.8 ♥2 · 3/7 ▮▮▮▯▯▯▯ 2m14s  [pet]
                                   ▸ Implement the feed model     [pet]
                                   Bash: claude plugin test       [pet]
```

- Row 1: level and hearts as now; with tasks, then `done/total`, the bar and the
  elapsed time of the current task (`formatDuration`). No tasks: stats only.
- Row 2: the in-progress task's subject, clipped; empty without tasks.
- Row 3: the bubble as now (tool label, `❯` permission waiting, done, interrupted,
  failed, the news for a few seconds, the pat hearts).

While `agents` is not empty, one extra row under the band, full width, dim:

```
⤷ reviewer · review the diff (Grep)  │  checker · run the tests (Bash)  │  +1 more
```

Each agent: its type, its description clipped to 30 cells, the tool it runs now in
parentheses. As many as fit, then `+n more`. With one agent, row 3 shows it as
today and the row still appears.

Narrow or short (under 60 columns or under 3 rows): the single pet line as now with
`done/total` after the stats: `(=^･^=) Lv.8 ♥2 3/7 · Bash: npm test`.

The pet draws whenever the companion is on. Empty rows cost nothing: the block
already reserves three rows for the art.

Between turns the tasks are cleared (section 1), so the block shows the pet, its
stats and the finale mood, as 0.8.0 does.

The published `DockPet` (for hud's docking) gains `task?: string` and
`progress?: string` so a docked drawing is not wrong; hud is not installed here and
this is verified only by the contract compiling.

## 3. Options and commands

- New option `feed` (default on): the rows and the agent row. `/showtime feed off|on`
  beside `stage` and `companion`. Companion off hides the feed too.
- `audio` leaves the theme list, `/showtime audio` answers with the theme list as any
  unknown name does, and a stored `theme: audio` falls back to `random` on load.
- Everything else (`/showtime`, `<theme>`, `random`, `rotate`, `theme`, `preview`,
  `pet`, `off`/`on`, `stage`, `companion`) is unchanged.

## 4. Stage reactions

The scene signature changes from `(t, w, act, audio?)` to `(t, w, s)`:

```ts
type Signals = {
  act: Act
  tool?: 'bash' | 'edit' | 'read' | 'search' | 'agent' | 'web' | 'other'
  agents: number
  done: number
  total: number
  news?: 'testPass' | 'testFail' | 'commit'
  /** Frames since the news landed, so a scene plays a burst and settles. */
  newsAge: number
}
```

The band builds `Signals` from the feed and activity atoms when it renders and
passes it in the stage Client's props; the Client already re-renders on a props
change, and the feed atom's writes already redraw the band. `newsAge` is counted by
the Client from the frame the `news` prop changed.

Reactions, the six pixel scenes:

| Scene | agents | tasks | tool kind | news |
|---|---|---|---|---|
| clawd | one small Clawd per agent on the bench, typing | `total` tiles over the bench, `done` lit | laptop (edit), terminal (bash), magnifier (search) | commit: tiles flash; testFail: drops the laptop; testPass: thumbs up |
| thunder | one invader wave per agent, in parallel | score reads `done/total`; a ship per task along the bottom edge, `done` lit | fire rate by kind, bash fastest | testFail: the jet takes a hit and flickers; commit: a bomb clears the screen |
| chomp | one ghost per agent, at most four | `total` dots on the track, `done` eaten | power pellet while bash runs | testFail: a ghost catches him; testPass: fruit |
| sparky | one extra mouse trailing per agent | a bolt per completed task | cheeks crackle while bash runs | testFail: a cloud over him; commit: a big bolt |
| bluecat | one gadget in the air per agent | the copter climbs with done/total | pocket items by kind | testFail: the copter stalls; commit: a door pops out |
| nyan | trail length tracks done/total | a star burst per completed task | speed by kind | testFail: the trail greys; commit: double rainbow |

The eight two-row character scenes (cat, bunny, sakura, mecha, neon, dino, ocean,
matrix) get three shared reactions from a new `hooks/reactions.ts`, drawn into any
grid: a tiny figure per agent at the right edge, a brief shake on testFail, a spark
burst on commit. Finales are unchanged. Reduced motion draws each reaction's resting
state.

## 5. Themes

### Registry

`hooks/themes.ts` becomes an index. Each theme is one file, `hooks/themes/<name>.ts`,
exporting a `Theme` (colors, sprite poses, finale faces, confetti, palette, rows,
scene, and now its pet art, moved out of `pets.ts`). The index imports them and builds
`THEMES` and `THEME_NAMES`; `random` and `rotate` draw from the index. Adding a theme
is adding a file and one import line. The shared drawing helpers (`canvas`, `draw`,
`ground`, `stroll`, `glyphStars`, …) move from `scenes.ts` into `hooks/draw.ts`.

### Existing themes

The six pixel scenes get their section 4 reactions and keep their art. The eight
two-row scenes get the shared reactions and keep their art. `audio` is removed with
`audio.ts`, `audio-tap.swift`, `AUDIO_PET`, the `tap` state, the `ui.message` level
feed and the macOS notes in the READMEs.

### New themes (24)

Pixel scenes of `SCENE_ROWS` rows in the style of the existing six, each with its own pet art
and all six reaction slots (agents, tasks, tool kind, testFail, testPass or commit),
built in the waves below. A theme's description here is its brief; the plan fixes
the sprites.

Wave A: stack, plumber, snake, launch.
- stack: a falling-block puzzle; a piece drops per tool call, lines clear as tasks complete, a column per agent. Pet: a tetromino.
- plumber: a platformer runner over pipes; a ? block per task, a coin as it completes, a flagpole at 100%. Pet: a mushroom.
- snake: grows per completed task, an apple per running tool, one snake per agent. Pet: a small snake.
- launch: a rocket on a pad; countdown while thinking, engines while tools run, lifts off with done/total, stage separation per agent, splashdown on testFail. Pet: an astronaut.

Wave B: frogger, kitchen, railway, garden.
- frogger: a frog across lanes; a lane per task crossed as done, faster logs while tools run, a truck per agent, squashed on testFail. Pet: a frog.
- kitchen: a chef at a stove; a plate per task served as done, a pot boils while tools run, a sous-chef per agent, a fire on testFail, a bell on commit. Pet: a dumpling.
- railway: a steam train; a carriage per task loaded as done, the signal drops while a permission waits, an extra engine per agent, a tunnel on commit. Pet: a signal lamp.
- garden: plots; a seed per task sprouts as done, rain while tools run, a bee per agent, wilt on testFail, bloom on commit. Pet: a sprout.

Wave C: racetrack, aquarium, submarine, orchestra.
- racetrack: cars on an oval, one per agent; laps read done/total, a pit stop while a permission waits, a spin-out on testFail, the chequered flag at 100%. Pet: a traffic cone.
- aquarium: a tank; a fish per agent, bubbles while tools run, a chest opens per completed task, the water clouds on testFail, a diver on commit. Pet: a seahorse.
- submarine: the deep; sonar pings while thinking, periscope up while a permission waits, a torpedo per completed task, an escort per agent, a leak on testFail. Pet: a jellyfish.
- orchestra: a pixel band; a musician per agent, the conductor waves while thinking, a note per completed task, a clash on testFail, applause on commit. Pet: a metronome.

Wave D: roomba, coffee, penguins, ufo.
- roomba: crumbs equal total, eaten as done, bumps walls while thinking, a second roomba per agent, stuck on testFail, a cat rides it on commit. Pet: a dust bunny.
- coffee: a barista; a cup per task filled as done, the machine steams while bash runs, a barista per agent, a spill on testFail, latte art on commit. Pet: a coffee bean.
- penguins: an ice floe; a slide per completed task, a penguin per agent huddling, the floe cracks on testFail, a fish on commit, all look up while a permission waits. Pet: a chick.
- ufo: a saucer over a farm; a cow beamed up per completed task, hovering while thinking, a saucer per agent, a crash on testFail, flies off on commit. Pet: a small alien.

Wave E: dragon, samurai, warp, volcano.
- dragon: circles a castle while thinking, breathes fire while bash runs, a tower per task lit as done, a wyvern per agent, an arrow on testFail, lands on the keep on commit. Pet: a hatchling.
- samurai: a duel under a red moon; ready stance while thinking, a strike per tool call, a lantern per task lit as done, a rival per agent, petals falling; staggers on testFail, sheathes on commit. Pet: a tiny ronin.
- warp: a bridge view; stars stream by tool kind, warp while bash runs, a planet per completed task, an escort per agent, red shields on testFail, a station on commit. Pet: a droid.
- volcano: smoke while thinking, lava while tools run, a hut per task safe as done, a boat per agent, eruption on testFail, a rainbow on commit. Pet: a lava blob.

Wave F: dungeon, mage, tavern, necromancer.
- dungeon: a party; a room per task lit as cleared, torches while thinking, a monster per agent, a trap on testFail, a chest at 100%, a d20 on commit. Pet: a d20.
- mage: a spell circle; runes orbit while thinking, a bolt per tool call, a familiar per agent, a scroll per task burning as done, a fizzle on testFail, a summoned dragon on commit. Pet: a familiar cat.
- tavern: a quest board with a scroll per task torn off as done, the bard plays while thinking, a patron per agent, a brawl on testFail, a toast on commit. Pet: a frothy mug.
- necromancer: a graveyard; a skeleton per agent digging, a soul flame per task lit as done, lightning while bash runs, collapse on testFail, a lich crown on commit. Pet: a skull.

### Backlog

`showtime/THEMES-BACKLOG.md` lists briefs not built in this round, one file each when
wanted: breakout, pinball, skiing, crane, duck, sloth, keycat, laundry, and any
later idea.

### Stills

`showtime/scripts/shots.ts`, adapted from upstream's `spinner-shots.ts` (MIT; the
README's reference to a root `scripts/showtime-shots.ts` is wrong today), renders
`assets/<theme>.png` for every theme and `assets/gallery.png`. GIFs are kept for the
fourteen existing themes and not made for new ones.

## 6. Files

- New: `hooks/feed.ts`, `hooks/reactions.ts`, `hooks/draw.ts`, `hooks/themes/<name>.ts` (38), `scripts/shots.ts`, `THEMES-BACKLOG.md`.
- Changed: `hooks/register.tsx` (feed atom, four hooks, Signals, the agent row, `/showtime feed`; its running-tools map moves into the feed), `hooks/themes.ts` (index + `Signals`), `hooks/scenes.ts` (split into theme files, then removed), `hooks/pets.ts` (shared pet frame logic only), `hooks/stage.tsx` (Signals props, newsAge), `hooks/kit/pet.tsx` (two extra rows, `drawPetLine` progress; the kit's source copy edited alike so the generated header stays true), `hooks/command.ts`, `hooks/config.ts`, `hooks/i18n.ts` (keys `feed.task`, `feed.more`, `opt.feed` in all eleven languages), `types/index.d.ts` (`Feed`, `DockPet` fields), `.claude-plugin/plugin.json` (option `feed`, version 1.0.0, no `audio` option text), `README.md`, `README.en.md`, `../.claude-plugin/marketplace.json` (description), `../upstream/maps/hoobnn-spinner.sed` (paths that moved).
- Removed: `hooks/audio.ts`, `hooks/audio-tap.swift`, `assets/audio*.{gif,png}`.

## 7. Tests and verification

`tests/showtime.test.tsx` grows, and `tests/feed.test.ts` is new:

- feed.ts: each task tool's result; TodoWrite as fallback and native precedence; an
  empty list clearing; agent spawn, tool, done; the main turn's clear pruning a stale
  agent; bad input leaving the feed unchanged; `progressOf`, `taskLine`, `agentRow`
  clipping and overflow; `toolKindOf`.
- Render (`claude plugin test`): the three rows with tasks and without; the agent row
  with two agents and with overflow; the narrow line; feed off; companion off hiding
  the feed; the pet drawn with nothing to report.
- Scenes: every theme's scene returns a grid of its `rows` rows and `w` cells for
  each act, with and without agents, at 0/0, 3/7 and 7/7, and for each news kind at
  age 0 and age 60; no theme throws; every theme has a pet and all sprite poses.
- Registry: `THEME_NAMES` has 38 entries, no `audio`; `random` and `rotate` never
  draw a missing name; a stored `audio` loads as `random`.

Verification per step: `claude plugin validate showtime/.claude-plugin/plugin.json`,
`claude plugin test showtime`, `tsc -p showtime` (the tsconfig extends the
engine-written one, so it type-checks once the mod has loaded), then
`claude plugin marketplace update claudebro-mods && claude plugin update
showtime@claudebro-mods` and a real turn with tasks and a subagent watched in the
bottom pane. Stills are regenerated at the end of each wave.

## 8. Order of work

1. Registry refactor and audio removal (no visible change; every test green).
2. Feed model, companion block, option, docs.
3. Signals plumbing, reactions in the six pixel scenes and the shared reactions.
4. Waves A to F, four themes each, stills after each wave.
5. Version 1.0.0, READMEs, marketplace description, backlog file, upstream map.

Each step is committed on its own in `claude-mods`, then the master repo's pointer.
