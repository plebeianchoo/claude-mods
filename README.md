# claude-mods

A local Claude Code plugin marketplace (`claudebro-mods`) for my own mods.

| Mod | What it is |
| --- | --- |
| `cat-clawd-duo` | [cat-spinner](https://github.com/swicken/cat-spinner) and [clawd-spinner](https://github.com/saiharsha03/clawd-spinner) merged, so the pixel cat and Clawd share one row above the spinner (stacked below 102 columns). Both MIT; their licenses ship in the mod. |
| `spinner` | A fork of [hoobnn's spinner](https://github.com/hoobnn/hoobnn-agent-mods) 0.6.0: fifteen themes, a stage band above the prompt, a finale and a companion pet. MIT; the license ships in the mod. |

Both are mine now: the files in this repo are the source of truth. Edit them in place,
run `claude plugin validate <mod>/.claude-plugin/plugin.json` and `claude plugin test <mod>`,
commit, then `claude plugin marketplace update claudebro-mods && claude plugin update <mod>@claudebro-mods`
and `/reload-plugins` in open sessions.

## The originals (`upstream/`)

Nothing pulls upstream in automatically. `upstream/` keeps a reference clone of each
original mod and `upstream/check.sh` lists what their authors changed since my fork,
so a fix worth having can be ported by hand. A monthly timer runs it and messages
Telegram when there is something new. See [`upstream/README.md`](upstream/README.md).

The duo's original build-from-upstream script and patch were retired on 2026-10-18
(git history, and `~/_attic/2026-10-18/claude-mods-build/`).

## Making a new spinner

[`docs/spinner-engine-api.md`](docs/spinner-engine-api.md) writes up the engine
API the spinners use (Spinner render, Raster cells, `$.ui.blit`, timers, the
AbovePrompt band, settings). [`templates/blink-spinner/`](templates/blink-spinner/)
is a minimal spinner that validates, tests and type-checks: copy it and start
from there.
