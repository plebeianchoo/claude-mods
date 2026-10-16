# claude-mods

A local Claude Code plugin marketplace (`claudebro-mods`) for my own mods.

| Mod | What it is |
| --- | --- |
| `cat-clawd-duo` | [cat-spinner](https://github.com/swicken/cat-spinner) and [clawd-spinner](https://github.com/saiharsha03/clawd-spinner) merged, so the pixel cat and Clawd share one row above the spinner (stacked below 102 columns). Both MIT; their licenses ship in the mod. |

## Keeping cat-clawd-duo current

`cat-clawd-duo/` is built, not hand-edited: `build/cat-clawd-duo.sh` copies both upstream
plugins from Claude Code's marketplace clones, applies the mechanical renames, then
`build/cat-clawd-duo.patch` (the side-by-side layout and its tests), and validates and
tests the result.

The weekly `claude-autoupdate` job refreshes the upstream clones and runs the build. It
never installs on its own; its log says one of:

- `duo up to date` — nothing to do.
- `DUO UPDATE READY` — upstream changed, the patch applied and the tests pass. Review the
  diff it prints, then run `build/cat-clawd-duo.sh --install`.
- `DUO NEEDS MANUAL MERGE` — upstream changed code the patch touches. Ask Claude to
  re-apply the change on the new upstream and regenerate the patch.
- `DUO BUILD FAILS` — the build's validate/test logs are in `.staged/`.

## Changing the duo

Edit a built copy, then regenerate the patch against pristine upstream:

```bash
build/cat-clawd-duo.sh --pristine /tmp/pristine
mkdir /tmp/cur && cp -r cat-clawd-duo/hooks cat-clawd-duo/tests cat-clawd-duo/LICENSE-* /tmp/cur/
(cd /tmp && diff -ruN pristine cur) > build/cat-clawd-duo.patch
```

## Making a new spinner

[`docs/spinner-engine-api.md`](docs/spinner-engine-api.md) writes up the engine
API the spinners use (Spinner render, Raster cells, `$.ui.blit`, timers, the
AbovePrompt band, settings). [`templates/blink-spinner/`](templates/blink-spinner/)
is a minimal spinner that validates, tests and type-checks: copy it and start
from there.
