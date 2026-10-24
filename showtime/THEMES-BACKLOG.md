# Themes backlog

Briefs for themes not built in the 1.0.0 round, and polish deferred from it. Each brief is
the sort of line the plan's theme groups use: what the scene shows, how it reacts to the
shared signals (agents, tasks done/total, tool kind, testFail, testPass, commit, a
permission waiting), and the pet. Build one when wanted, as a file under `hooks/themes/`
and a row in the registry, with the review loop and a still.

## Not built

The design spec names these eight (`docs/superpowers/specs/2026-10-24-showtime-overhaul-design.md`,
"Backlog") without wording them; the briefs below are drafted here in the plan's style.

- breakout: a brick wall, a paddle and a bouncing ball; a brick per task cleared as it is done, a ball per agent, the ball speeds up while tools run, a lost ball on testFail, the wall explodes at 100%. Pet: a ball.
- pinball: a table seen from above; the ball bounces off bumpers while tools run, a flipper per agent, a lit lane per task as it is done, tilt on testFail, a jackpot on commit. Pet: a steel ball.
- skiing: a skier down a slope between pines; a gate per task passed as done, snow flying while tools run, a skier per agent, a crash into a tree on testFail, the finish line at 100%. Pet: a snowflake.
- crane: a construction crane over a site; a block per task lifted into the tower as done, the hook swings while tools run, a crane per agent, the load drops on testFail, a flag on the roof on commit. Pet: a hard hat.
- duck: a pond; a duckling per task joins the line as done, ripples while tools run, a duck per agent, a splash and a fright on testFail, a bread crust on commit. Pet: a rubber duck.
- sloth: a sloth on a branch; it creeps a leaf at a time, a leaf per task eaten as done, a sloth per agent, it sleeps while a permission waits, a fall on testFail, a hug on commit. Pet: a leaf.
- keycat: a cat walking over a keyboard; a key per task lit as done, keys pressed by paw while tools run, a cat per agent, a spilled glass on testFail, a purr on commit. Pet: a keycap.
- laundry: a laundromat; a machine per agent spins, a sock per task paired as done, bubbles while tools run, a flood on testFail, a folded stack on commit. Pet: a sock.

## Polish

Deferred from the 1.0.0 round (task reviews and the final review), one line each.

### Open questions for Jeremy

- testPass is the weakest reaction in about ten themes: a cross-theme pass to strengthen it?
- The say and wait acts never reach the band: keep their scene cues, or drop them?
- Tasks clear at turn end while native tasks persist across turns: keep the feed per turn, or carry it over?

### Shared (tests, sheet, engine glue)

- Promote the scratch checks into `tests/scenes.test.ts`: reaction at rest by newsAge 30, act-change continuity, an agent drop leaves figures in place, stage age counting.
- The glyph themes (cat, bunny, sakura, mecha, neon, dino, ocean, matrix) render as dim specks in the gallery PNG (renderer limit): add a README note.
- The sheet's testFail/commit strips have total=0, so reactions on task marks (stack's topple) never show there.
- The sheet strips start at t=40 and hold toolAge at 30+, so per-call effects (slashes, bolts) show only in dumps.
- `scripts/` is not covered by tsc.
- The progress row's elapsed time refreshes only when the pet is published, not each second.
- An empty row is drawn when the pet is off and agents run (untested); the overflow test uses 2 agents, not 8.
- A remounted stage replays a still-live news burst from age 0.
- TaskGet's branch is untested; `agentsOf` is an unused export; a test title still says "drawable themes".
- `stash@{0}` from Task 1 (an abandoned guard attempt) is still in the repo: Jeremy to drop or keep.
- Code tidying: Theme.pet's doc comment displaces scene's, theme imports sit mid-file in themes.ts, the 999 sentinel is unnamed in several themes.

### clawd

- Restore the walking bob now that the motion test allows one-cell vertical hops (Task 9 ruling).
- clawdScene is ~110 lines; the stroll ease has hard-coded phases; the mini is 5 px, not 6.
- A dropped prop keys on s.tool without act === 'tool'; the lying laptop lost a top-right pixel.

### thunder

- BOOM's first frame starts 2–3 columns off (the run-start probe flags explosions in every act).
- Explosions can overdraw the jet below w=30.
- Leaving ask re-syncs the wave: spared invaders vanish and the shots the jet held reappear in flight (no act history).
- The tool act's cue is ~11–12 cells at w=48 (shot and star tints), below the 15 aimed for.

### chomp

- The cherry shows under 20 frames at narrow widths; done/total gaps are not width-capped.

### sparky

- The done bolt may strike an off-screen cloud; the agents reaction is invisible at w=16.
- Marks can overwrite the ears at w≤40 with many tasks.

### bluecat

- A hop at full altitude clips the blades; a full sink at the lowest altitude clips the collar.
- CAT_COLORS.b unused; MAX_AGENTS should derive from GADGET_COLORS.length.

### nyan

- The fourth pip at w=16 collides with the glyph cell; an agent beyond `fits` shows as a pip with no entry.
- A bash dash can merge with a neighbouring near star and part when bash ends.

### cat

- Capped task hearts all show lit when total > count; the pass shower hides under the hearts.

### bunny

- The transition has 2 states over 4 frames; capped marks all lit when done > count; ᗣ ⌕ are font-dependent.

### sakura

- Scaled marks can round up to all-lit before done.

### mecha

- Marks collide with the sign at w=16 with 4 agents.

### neon

- `lit` should be min(done, count); the greeting spark may overwrite a bar cell for a frame.

### dino

- The fourth agent figure covers the sign column at w=16 (shared withReactions); the tool act has no idle sign.

### ocean

- think's fourth transition state repeats the first glyph; the small fish vanishes without an eaten frame.

### matrix

- Rain anchors leave a visible regularity (judge in a real terminal); metronome columns unguarded below w=20.

### stack

- The topple never shows on the sheet; a spurious done flash when floor-scaling leaves lit unchanged.
- A one-frame shape pop at tool↔idle; the for(;;) cycle walk is unbounded for very long tool runs.

### plumber

- The task HUD vanishes and the pole overlaps the sign at w=16; no test covers the arc/bounce.

### snake

- The snake is small against a 42-cell loop; bash only subtly faster; testFail 20 is the regrowth frame.

### launch

- A total change moves the rocket up to 2 px in one frame; done 3/7 vs 7/7 differ by 1 px.
- The countdown sits over the shoulder, not the nose; tool→think drops the 1-px lift at once.

### frogger

- Lane kinds change with total (a plan write repaints the frog's lane); the frog sits still on the river.
- Trucks overlap a cell at w=16 with 4 agents; a done jump >1 teleports the lanes between.

### kitchen

- The going-out plate pops away at newsAge 30 mid-counter on w≥48 (fade it instead).
- The plate row refits at once when the agent count changes; only the newest dome animates on a done jump >1.

### railway

- The act sign is hidden whenever total > 0 (collides with the readout): decide.
- The smoke trail merges with the tunnel's stone column at w=32 during a commit; w=48 fits one agent.

### garden

- Bees absent below w=20; rain ends in one frame at tool exit; the sprout's eyes read as leaf shading.

### racetrack

- Agent cars: none below w=24; flags pop in and out whole.

### aquarium

- The seahorse has no separate eye; tool→anything drops ~78 curtain cells in a frame (no act history).
- Agent fish sit in front of the chest below ~w=50; the greeting flash fires on a decrease.

### submarine

- The sign falls off at w=16; escorts: 2 at w=48, none at w=16; the torpedo leaves 1–3 px off the bow.
- Fish small (6×2); the surfacing flag is 2–3 px; leak drops respawn 2 px.

### orchestra

- The pool core changes colour in one frame at tool→think; applause hands pop in whole; testPass only gold lights.

### roomba

- The sofa pops in whole at testFail 0; ~10% of testFail starts hold it against a wall.
- The cat can ride backwards after a mid-ride turn; agents absent below w≈36.

### coffee

- The glint is weak on the two light-grey lids; the front cup recolours at heart start/end; no shelf jars below w≈42.

### penguins

- Only two penguins fit at w=48 since the 7-wide redraw (four from w≈51).
- The slider can cover the host's feet for a few frames when done and commit coincide.
- A bash leap vanishes mid-arc on a tool change (no history).

### ufo

- A done jump >1 pops extra cows; the beam drops whole at tool end (no act history).

### dragon

- The commit fade-to-path jumps up to 17 cells at newsAge 24 (accepted fade); wyverns hide behind the dragon at turns.
- ask/say cues are ~2 cells.

### samurai

- Slash arcs show only in dumps; the rival is clipped at w=16; news replacing a commit mid-reaction jumps the blade.

### warp

- Streak length and colour step at a tool-kind change; escorts drop out below w≈20.
- The testFail shake moves the bridge only; the droid's eye reads as a notch.

### volcano

- The glow's footprint pops at newsAge 0 and 29; the cooled rock is low-contrast at ages 10–11; boats tiny; no testPass.

### dungeon

- The ask `?` shares the torch colour and merges with a passing torch; the wait `z` reads as an I-beam.

### mage

- A bolt cut by a new call or act end drops ≤5 px; no circle, bolts or commit below w≈42.

### tavern

- The toast froth is a no-op; brawl chairs overdraw seated patrons; ask/say only 7–9 cells.

### necromancer

- The skull hovers 1–2 px over the body at collapse frames 3–4; say is the weakest cue (~11–13 cells).
- Four agents at w=48 leave no grave slots.
