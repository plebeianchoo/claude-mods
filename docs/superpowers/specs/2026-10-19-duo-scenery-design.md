# cat-clawd-duo: rotating scenes on the left

**Status:** approved design, 2026-10-19. Next: implementation plan.

## Goal

The duo's left half (the cat's track) can show one of four pixel scenes instead of the
cat: **sky**, **city**, **ocean**, **space**. The scene changes to the next one every turn.
Clawd on the right is unchanged. The cat stays available as an option.

## Settings

- New option `left`: `scenes` (default) | `cat`. In `plugin.json` userConfig and the
  `/cat-spinner` settings dialog ("Left").
- `coat`, `animation`, `season`, `between` stay; they only matter when `left = cat`.
  `width` and `align` apply to both.
- The first scene of a session is random; each `prompt.submit` moves to the next in the
  order sky → city → ocean → space → sky.
- Between turns: with `scenes`, the band above the prompt is left alone (`next(e)`);
  with `cat`, the nap works as today.

## Structure

New module `hooks/scenery/`, pure (no state, no I/O, no network):

| File | What it does |
|---|---|
| `pixels.ts` | A canvas 18 px (9 rows) tall, `put`/`rect`/`sprite` on it, and packing to Raster cells the same way the cat packs (half blocks ▀ ▄ █, `DEF` = transparent). Reuses `rnd`, `mix`, `wave` from `clawd/acts.ts` by import; Clawd's files are not edited. |
| `sky.ts` `city.ts` `ocean.ts` `space.ts` | One scene each: `(c: Canvas, t: number, state: State, seed: number) => void`. |
| `index.ts` | `SCENES` (rotation order), `nextScene(name)`, `sceneryCells(name, t, columns, state, seed): Uint32Array`. |

`State` = `think` | `tool` | `say`, derived in `cat.tsx`: `tool` while a `tool.call` is
running (`doing` is set), else `think` when the Spinner's `mode` is `thinking`, else `say`.

### `cat.tsx` changes (the only edits to existing code)

- Read `left` with the other options.
- Keep `scene` (current name), `seed` (random per turn) and `t0` (turn start).
- `prompt.submit`: when `left = scenes`, `scene = nextScene(scene)` (random on the
  first turn), new `seed`, `t0 = now`.
- The 90 ms timer and the Spinner render draw `sceneryCells(...)` instead of
  `sceneCells(cat, ...)` when `left = scenes`. Same raster key, columns and rows
  (`ROWS` = 9), same side-by-side and stacked layouts.
- `AbovePrompt`: skip the nap when `left = scenes`.
- Settings dialog: a "Left" entry; its preview draws the scene when `scenes`.

## The scenes

Each has three scrolling layers (far, middle, near) plus a moving feature. A seed per
turn picks the variant. Speeds and densities blend toward the new state over ~500 ms
(computed from `t`, no stored state).

| Scene | Seed picks | think | tool | say |
|---|---|---|---|---|
| sky | day / dusk / night; clear / cloudy / rain / storm | clouds drift slowly; stars twinkle at night | wind up, heavier rain, lightning in a storm | a bird or balloon crosses; sun or moon glows |
| city | skyline, window palette, day / night | few lit windows, slow traffic | windows flicker on, traffic speeds up, cranes swing | fireworks or a billboard sweep |
| ocean | water tint, fish mix, kelp density | fish idle, slow bubbles | a school darts past, bubble stream | a whale or jellyfish surfaces |
| space | starfield, planet colours, nebula tint | ship drifts, stars crawl | warp streaks, stars stretch into lines | a planet rises, a comet passes |

No text in the scenes and no finale animation.

## Testing

`tests/scenery.test.ts`:
- Every scene × state × widths 44, 60, 90, 200 returns `columns * 9 * 3` values and doesn't throw.
- Rotation order and wrap-around.
- Same inputs give identical cells (purity).

Golden: add scene cases to `tests/scenes.ts`, regenerate `tests/golden.ts`. The cat's
existing fingerprints must not change. `scripts/fingerprints.ts`, which the golden header
mentions but the repo doesn't have, is recreated.

Before committing: render a few frames of each scene as ANSI to the bottom tmux pane for
Jeremy to look at.

## Rollout

Version `1.11.0-clawd0.5.0`; `claude plugin validate` + `claude plugin test`; commit and push
claude-mods; `marketplace update` + `plugin update cat-clawd-duo@claudebro-mods`; bump the
master repo; update the pinned sha in `~/dotfiles/tools/claude-plugins.tsv`, commit, push;
Jeremy runs `/reload-plugins`.

Upstream: cat-spinner commits touching `cat.tsx` near the switch may triage as `conflict`
and are merged by hand (port-upstream skill).

## Out of scope

Real weather or clock time; scenes between turns; a finale; scenes for Clawd's half.
