# claude-mods

A local Claude Code plugin marketplace (`claudebro-mods`) for my own mods.

| Mod | What it is |
| --- | --- |
| `cat-clawd-duo` | [cat-spinner](https://github.com/swicken/cat-spinner) and [clawd-spinner](https://github.com/saiharsha03/clawd-spinner) merged, so a pixel left half and Clawd share one row above the spinner (stacked below 102 columns). The left half shows rotating scenes (sky, city, ocean, space; the next one each turn) by default, or the cat with `/cat-spinner cat`. Both MIT; their licenses ship in the mod. |
| `spinner` | A fork of [hoobnn's spinner](https://github.com/hoobnn/hoobnn-agent-mods) 0.6.1, plus a `rotate` theme choice (the next theme each turn): fifteen themes, a stage band above the prompt, a finale and a companion pet. MIT; the license ships in the mod. |
| `peek` | Images inline in the terminal through Claude Code's own `Image` element: a `show_image` tool for Claude and `/img <path>`. Converts with Pillow and sends PNG bytes, so it works over ssh and inside tmux (`allow-passthrough on`). Inside tmux it draws only when the attached terminal is Ghostty, kitty or WezTerm; others get the caption (see [`peek/README.md`](peek/README.md)). No network, no updater, nothing added to the prompt. Written from scratch after reviewing [show-your-work](https://github.com/iamumeransari/claude-show-your-work). |

All of them are mine: the files in this repo are the source of truth. Edit them in place,
run `claude plugin validate <mod>/.claude-plugin/plugin.json`, `claude plugin test <mod>` and `pnpm typecheck` (after `pnpm install`; it type-checks `peek` only: `spinner`'s `tsconfig.json` does not compile yet, and `cat-clawd-duo` has none),
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
is a minimal spinner that validates and tests (no tsconfig, so it is not type-checked): copy it and start
from there.
