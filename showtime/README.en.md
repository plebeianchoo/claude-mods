# showtime: animations and a companion pet for Claude Code

[简体中文](README.md) · **English**

While Claude works, a little show plays above the prompt: a pixel-art shoot-em-up, Claude's mascot Clawd, a dot-eater, a rainbow cat and more, with a pet that changes pose as Claude thinks, runs tools and replies. When the turn ends, a burst of confetti with the time it took. Thirty-eight themes, switched any time.

![showtime: Clawd through a turn, the companion's bubble and the finale](assets/clawd.gif)

- **Stage**: an animated scene in the band above the prompt while a turn runs. Other mods' bands (hud, ts-band, hitokoto) stay beneath it.
- **Companion**: a pet in a row under the stage, in the spirit of Codex's pets, with poses for thinking, using tools, responding and waiting. Its bubble says only what Claude Code's own spinner line doesn't: the tool running (`Bash: npm test`, `Edit: themes.ts`) or a permission prompt waiting on you; while the model thinks it just looks busy. Parallel subagents are counted (`Agent ×3`), a single one shows its task. When Claude runs tests or commits, it says so for a few seconds (tests passed, tests failed, committed). It stays between turns (done, interrupted, failed; dozing after five quiet minutes), gains a level as turns finish and as tests pass and commits land (`Lv.4`), and a click on the band or `/showtime pet` pats it (`♥12`, hearts float up). Its level and affection are kept across sessions, and sessions running side by side all raise the one pet.
- **Feed**: beside the pet, what the turn is working through, at no cost in tokens: it reads the task tools' results (TaskCreate, TaskUpdate, TaskList, TodoWrite) and the engine's own events. The plan's progress sits on the stats row (`Lv.3 ♥12 · 1/4 ▮▮▯▯▯▯▯ 2m 14s`: done over total, a bar, how long the current task has run) and the current task under it (`▸ Write the feed`, or `▹` the next pending one); a row under the band names each subagent running and the tool it is on (`⤷ reviewer · review the diff (Grep)  │  checker · run the tests`), those past what fits counted (`+2 more`). The one-row pet keeps `1/4` after its level. Everything clears when the turn ends. `/showtime feed off` / `on` or the `feed` option turns it off and on; the pet stays either way.
- **Mascot on the spinner line**: with the companion turned off, the mascot moves in front of Claude Code's own spinner line instead (`[◉_◉]⊃━━ ✢ Choreographing… (4s · ↓ 14 tokens)`), whose word, elapsed time and tokens stay as they are. One mascot shows at a time.
- **Finale**: for three seconds after a turn ends, confetti bursts around the mascot with the time the turn took (`(=^▽^=)ﾉ  Done · 12s`); an interrupted turn gets a sad face, a failed one a glitch.

## Themes

Pixel-art scenes, four rows of half-block pixels (`dragon` has six):

- `clawd`: Claude Code's own mascot strolls by, stops to work with the Claude spark spinning beside him, types on a laptop while a tool runs and raises a `?` when you're asked.
- `thunder`: a side-scrolling shoot-em-up: a fighter auto-aims and fires at waves of invaders, explosions and a running score; the waves come faster while tools run.
- `chomp`: a dot-eating hero chased by four ghosts until it swallows the power pellet.
- `sparky`: an electric mouse dashing through, cheeks crackling and thunderbolts striking while tools run.
- `bluecat`: a blue robot cat on a bamboo-copter, gadgets tumbling out of its pocket while tools run.
- `nyan`: a pop-tart cat on a rainbow trail across the stars.
- `stack`: a falling-block well: pieces hover over it and drop in while tools run, done tasks settle as rows, a failed test topples the stack.
- `plumber`: a platformer runner bouncing in place while hills, bricks and pipes scroll by, running and jumping the pipes while tools run; done tasks turn ? blocks into spinning coins, all done slides in the flagpole.
- `snake`: a grid snake winding a figure-eight over a dotted field, growing a cell per done task; while tools run an apple appears ahead and it runs it down, a failed test makes it bite its tail, a passed test is a golden apple.
- `launch`: a rocket on a pad by the sea under a countdown, climbing as tasks get done while its gantry lights them; while tools run the engines light in the tool's colour (bash a full burn with smoke), subagents are boosters, a failed test splashes it down into the water, a commit puts a satellite in orbit round the hull.
- `frogger`: a frog crossing a lane per task from a grass bank, trucks, cars and logs drifting by; it hops in place while tools run, a failed test squashes it flat, a commit brings a lily pad and a fly for its tongue.
- `kitchen`: a chef at a stove under a tiled wall, steam rising from the pot; done tasks are served plates along the counter, the pot boils in the tool's colour while tools run (flames on bash), a sous-chef chops per subagent, a failed test sets the stove on fire, a commit rings the bell and sends a plate out.
- `railway`: a steam train puffing in place while hills and the bridge scroll past, its wheels turning and smoke in the tool's colour while tools run; a carriage per task loads as it lands, a signal arm drops while a permission waits, a failed test screeches the brakes, a commit sends it through a tunnel.
- `garden`: flower beds along a picket fence under drifting clouds, a butterfly fluttering by the big flower; a seed per task sprouts into a flower as it lands, it rains in the tool's colour while tools run, a bee buzzes per subagent, a failed test wilts the flowers, a commit bursts the big one into petals.
- `racetrack`: an oval under waving flags and a cheering crowd, the lead car holding the inside line while the kerb and stands stream past; its wheels turn faster while tools run (skid dust and exhaust in the tool's colour, flames on bash), a car per subagent follows it, a lap board counts the tasks, it pits under a roof while a permission waits, a failed test spins it out in smoke, the chequered flag waves at 100%, a commit rains confetti.
- `aquarium`: a tank with kelp swaying behind, a clownfish crossing and a bubbling airstone; a pearl per task glints in the sand and the treasure chest opens and spills coins as one lands, a curtain of bubbles rises in the tool's colour while tools run, a fish swims per subagent, a snail crawls by while it thinks, a failed test clouds the water and the fish dart, a commit lowers a diver with a torch.
- `submarine`: a yellow submarine cruising the deep under drifting light rays, fish and weeds passing over the seabed; it pings sonar while thinking, raises its periscope while a permission waits, fires a torpedo per done task and spins its propeller in the tool's colour (diving deeper on bash), an escort sub per subagent; a failed test springs a leak, a commit surfaces it with a flag.
- `orchestra`: a stage under a swaying purple curtain, a conductor beating time on his podium beside a ticking metronome; a music stand per task lights as it lands and lifts a note, a musician per subagent takes a seat with an instrument, the lights take the tool's colour, a failed test drops the cymbal and scatters the notes, a commit brings applause.
- `roomba`: a robot vacuum cleaning a rug among furniture legs, bumping the wall and turning at each end, dust motes drifting above; a crumb per task is gone as it lands, a suction trail in the tool's colour while tools run, a mini roomba per subagent at its dock, a failed test wedges it under the sofa, a commit gives a cat a ride.
- `coffee`: a barista behind a wooden counter beside a red espresso machine, jars on the shelf behind; he wipes the counter thinking, works the machine in a tool (it steams on bash, drips on edit), a glass mug per task fills as it lands, a barista per subagent, a failed test tips a cup into a spreading puddle, a commit lifts a latte-art heart.
- `penguins`: penguins huddled on an ice floe under a shimmering aurora, waves rolling past; they waddle while thinking, look up when a permission waits and fish through holes in the ice while tools run, a fish leaping in the tool's colour; a penguin per subagent, one belly-slides for each finished task, a failed test cracks the floe in two, a commit is a fish tossed and gulped.
- `ufo`: a flying saucer hovering over a farm at night, its rim lights chasing, a barn and a fence under twinkling stars; a cow per task is beamed up as it lands, a beam sweeps the field in the tool's colour while tools run (wide on bash), a small saucer per subagent, a failed test crash-lands it in smoke, a commit zips it off and back.
- `dragon`: a sunny 16-bit castle scene with a red-roofed tower where the princess looks out, archers on the walls, a knight on the grass and a red dragon patrolling the sky; set pieces rotate (a strafe, the knight's charge, a tower swoop, the catapult, a landing roar, a sheep raid) with rare surprises (the princess with a frying pan, a Clawd cameo on horseback, a hatchling); it breathes fire on bash while the knight raises his shield (sparks in the tool's colour otherwise), the princess waves on ask, jaws and sound rings on say, a banner per task that unfurls gold when done, a wyvern per subagent trailing it; a passed test fires fireworks from the castle, a failed one knocks the knight down seeing stars, a commit is a royal roar with the tower's banner unfurled and confetti.
- `samurai`: a duel on a wooden bridge under a red moon, blossom dropping petals onto the deck, hero and rival breathing in their stances; each tool call is a slash in the tool's colour (bash cuts twice), a lantern per task is lit along the bridge, a rival per subagent (three at most), a failed test staggers the hero back in a burst of petals, a commit sees him sheathe his blade and bow.
- `warp`: a starship's bridge looking out of its viewport, distant stars twinkling and near stars streaming past (dots while it thinks, lines on a tool, long warp lines on bash, in the tool's colour); a console light per task is lit and a planet slides past as one lands, an escort ship per subagent flies in formation, a scan line sweeps the view while it thinks, the shields go up while a permission waits, a failed test flares them red and jolts the bridge, a passed test glows them green, a commit sees a space station grow in the middle.
- `volcano`: an island volcano smoking over a scrolling sea, a lava glow shimmering on its cone; each tool sends lava down the slope pulsing in the tool's colour (bash faster and brighter, throwing sparks), a hut per task on the shore gets its roof when done, a rowing boat per subagent, a failed test erupts rocks under a reddening sky, a commit hangs a rainbow over the island.
- `dungeon`: a party of three walking a torchlit corridor, bricks and torches sliding past; a door per task opens and lights up as it lands, a monster per subagent bobs in its slot ahead (four at most), the mage casts a spell in the tool's colour while tools run, a failed test springs a spike trap that makes the party hop back, a finished list opens a chest, a commit rolls a d20.
- `mage`: a wizard at a spell circle under the stars, its runes orbiting the floor and his hat swaying; each tool call shoots a bolt from his staff in the tool's colour (bash fires three), a scroll per task burns away as it is done, a familiar per subagent hovers at his side, a failed test fizzles his spell and scorches his hat, a commit summons a dragon's silhouette out of the circle.
- `tavern`: an adventurers' tavern, a fire crackling in the hearth, a bard who plays while Claude thinks and a barkeep behind his counter; he polishes a mug while tools run (pouring from the tap on bash) as the pints fill in the tool's colour, a scroll per task on the quest board is torn off as it is done, a patron per subagent drinks at a table (four at most), a failed test starts a brawl with chairs flying, a commit raises every mug in a toast.
- `necromancer`: a graveyard at night, bats crossing the moon and fog drifting over the graves, a hooded necromancer whose staff pulses; a headstone per task lights its soul flame as it lands, a skeleton per subagent rises from its grave and digs, a tool raises the staff and streams the fog in its colour (lightning strikes the cross on bash), a failed test drops the skeletons into bone piles, a commit crowns him a lich as the fog glows.

Character scenes, two rows: `cat`, `bunny`, `sakura`, `mecha`, `neon`, `dino`, `ocean`, `matrix`. Or `random` for a new one each session.

| | |
| --- | --- |
| `clawd`<br>![clawd](assets/clawd.gif) | `thunder`<br>![thunder](assets/thunder.gif) |
| `chomp`<br>![chomp](assets/chomp.gif) | `sparky`<br>![sparky](assets/sparky.gif) |
| `bluecat`<br>![bluecat](assets/bluecat.gif) | `nyan`<br>![nyan](assets/nyan.gif) |
| `cat`<br>![cat](assets/cat.gif) | `bunny`<br>![bunny](assets/bunny.gif) |
| `sakura`<br>![sakura](assets/sakura.gif) | `mecha`<br>![mecha](assets/mecha.gif) |
| `neon`<br>![neon](assets/neon.gif) | `dino`<br>![dino](assets/dino.gif) |
| `ocean`<br>![ocean](assets/ocean.gif) | `matrix`<br>![matrix](assets/matrix.gif) |

One labelled scene row per theme (the tool/bash frame at 80 cells) in one image: [assets/gallery.png](assets/gallery.png); every theme's still: `assets/<theme>.png`; review sheets: `assets/review/`. `bun scripts/shots.ts --gallery` (from the mod folder) renders them again from `hooks/themes.ts`; `bun scripts/shots.ts --theme <name>` writes the still and a labelled review sheet under `assets/review/`.

`chomp`, `sparky`, `bluecat` and `nyan` are fan-made homages drawn from scratch, under names of their own; `clawd` is drawn as Claude Code draws him on its welcome screen.

## Install

```sh
claude plugin marketplace add <path-to>/claude-mods
claude plugin install showtime@claudebro-mods
```

The pixel scenes want a terminal with true color (Ghostty, iTerm2, WezTerm, kitty).

## Commands

`/showtime` shows the theme, the companion's level and affection and the theme list; `/showtime <theme>` or `/showtime random` switches live, `/showtime theme` asks which in a dialog (random and three themes offered, any other typed under Other), `/showtime preview [theme]` plays a scene above the prompt for eight seconds, `/showtime pet` pats the companion, `/showtime off` / `on` turns everything off and on, `/showtime stage off` / `on` the scene alone, `/showtime companion off` / `on` the companion alone, `/showtime feed off` / `on` the feed (tasks and agents) alone. What `/showtime` sets it writes to the options below (`theme`, `visible`, `stage`, `companion`, `feed`), so `/config` shows it and it is kept across sessions; the change applies at once, and the mod reloads with it. A `random` theme keeps the one it drew for the session through those reloads.

## Options

- `visible`: the animations at all (default on; `/showtime off` / `on`, or the **Showtime** button in the prompt footer).
- `footerButton`: that button in the prompt footer (default on).
- `theme`: the theme (default `random`; `/showtime <theme>` sets it).
- `stage`: the animated scene above the prompt (default on).
- `celebrate`: the finale when a turn ends (default on).
- `companion`: the companion's row (default on).
- `feed`: the plan's progress and current task beside the pet, and the subagents' row under the band (default on).
- `reducedMotion`: the mascot, the scene and the companion drawn as still pictures that change with what the model does, without moving (default off).
- `language`: the language of `/showtime`'s replies, the companion's bubbles and the finale's label (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale, then English.

The band takes the theme's rows plus one for the companion while a turn runs, and one row between turns; when the band has less room, the scene steps aside and the companion stays; under three rows or 60 columns the companion takes one row: the mascot, its bubble and its level. The mascot, the stage and the companion draw on the terminal and the desktop app (the surfaces that run a `Client`); elsewhere Claude Code's own spinner shows unchanged. The pixel scenes want a terminal with true color (Ghostty, iTerm2, WezTerm, kitty).

## More mods

[hoobnn-agent-mods](../../README.en.md) also has a statusline HUD (`hud`), a task progress bar (`todo-bar`), a turn receipt (`receipt`), a Tailscale node band (`ts-band`) and a Hitokoto quote band (`hitokoto`).

## Development

- `hooks/register.tsx`: the hooks: the session's start, the turn's events (activity, finale, pet), `/showtime`, the mascot on the spinner line and the band.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/command.ts`: `/showtime`'s arguments to what they ask for.
- `hooks/pet.ts`: the companion's level and bubble, tool labels, durations.
- `hooks/feed.ts`: the feed model: tasks and subagents read from the task tools' results and the engine's events, the progress, task and agent rows.
- `hooks/reactions.ts`: the reactions every theme shares (tool kind, test failed or passed, commit, permission waiting).
- `hooks/themes.ts`: the theme type and the registry; `hooks/themes/<name>.ts`: one theme each (scene, words, pet); `hooks/draw.ts`: the shared scene layers; `hooks/pets.ts`: the pet's drawing; `hooks/cells.ts`: the cell grid they draw on; `hooks/stage.tsx`, `hooks/sprite.tsx`: the `Client` modules that animate them.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit`; edit the source and run `scripts/sync-kit.sh`.
- `scripts/engine-types.sh`: lays the engine's types beside the mod (gitignored) so `pnpm exec tsc -p showtime` runs.
- `bun scripts/shots.ts --theme <name>` (from the mod folder) renders a theme's still `assets/<name>.png` and its review sheet `assets/review/<name>.png`; `bun scripts/shots.ts --gallery` renders `assets/gallery.png`.
