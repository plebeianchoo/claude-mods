# Spinner mods: the engine API

How the spinner mods (cat-spinner, clawd-spinner, our cat-clawd-duo and spinner) use
Claude Code's plugin engine, written down so a new spinner can be made from
scratch. Taken from the two upstream sources and this build's type file,
Claude Code **2.1.301** (2026-10-17). The API is still moving between builds:
when something here disagrees with the types, the types win (see
[Where the truth lives](#where-the-truth-lives)).

A tested starting point is in [`templates/blink-spinner/`](../templates/blink-spinner/):
a block that bounces above the spinner line. It passes `claude plugin
validate`, `claude plugin test` and `tsc` on 2.1.301. It has not been watched
running in a live session yet.

## The shape of a spinner mod

```
my-spinner/
  .claude-plugin/plugin.json   { "name", "version", "description", optional "userConfig" }
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           export const register: Register = (on, options) => { ... }
  hooks/frame.ts               pure drawing code: (time, width) -> cells. Keep it free of `$`.
  tests/*.test.ts              import { expect, test } from 'claude-code/testing'
```

`register` gets `on` and the user's `options` (from `userConfig`). Every
hook is `on(event, matcher?, async ($, e, next) => ...)`:

- `$` is the engine. Everything outside the module goes through it (there is
  no DOM and no Node).
- `e` is the event input, frozen.
- `next(e)` runs the plugins below this one, then the engine's own behaviour.
  Return its result to pass the event through. Return something else to answer
  in its place.

JSX compiles against a global `h`. Element constructors come from the
surface: `const { Box, Text, Raster } = $.ui.resolve(e)`. Types are imported
from `'claude-code'`, which is empty at run time.

## The five hooks every spinner has

Both upstream spinners follow this sequence. The template does too.

| Hook | What a spinner does there |
|---|---|
| `session.start` | Interactive sessions only (`e.isInteractive`): start the frame timer, `$.clock.every(ms, fn)`. Register slash commands. Read saved prefs from `$.store`. |
| `turn.start` (or `prompt.submit`) | Mark the turn as working and record its start time, `await $.clock.now()`. A subagent's `turn.start` also fires mid-turn, so set this only if not already working. |
| `turn.complete` | `await next(e)`, then mark idle and forget the mount. **Only when `!e.agentId`**: a subagent's turn ending is not the main turn ending. |
| `ui.render` `{ component: 'Spinner' }` | Draw the first frame as a tree, and save `e.requestId` + width so the timer can repaint it. |
| the timer callback | Build the next frame and `$.ui.blit` it into the mounted Raster. |

## Drawing: the `Spinner` render

```tsx
on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)   // Raster is terminal-only
  const columns = (e.viewport?.columns ?? 80) - 4
  const { Box, Raster } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Raster key="act" columns={columns} rows={2} cells={firstFrame} />
      {await next(e)}                             // keep the engine's own "✻ Sautéing… (3s)" line
    </Box>
  )
})
```

What `e` carries:

- `e.props.word`: this turn's spinner word (`Sautéing`). clawd-spinner keys a
  scene off it. Normalise it first (lower-case, strip accents and the trailing
  `…`), because the word list changes between builds.
- `e.props.message`: text shown in place of the word while a state overrides
  it, else `null`.
- `e.props.suffix`: the ellipsis drawn after the word. Rewrite it with
  `next({ ...e, props: { ...e.props, suffix: ' ~' } })`.
- `e.props.mode`: `'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'`.
  cat-spinner sits the cat down while `mode === 'thinking'`.
- `e.viewport.columns` / `.rows`: the terminal size. A width change re-runs
  the render. A height change alone does not.
- `e.surface`: `terminal`, `desktop`, `vscode` or `mobile`. Spinner renders
  only on the first three, and `Raster` exists only on `terminal`.

Three ways to answer:

1. A tree in place of the whole row. clawd-spinner draws its own line in
   Claude orange, plus the elapsed time it keeps itself.
2. A tree that embeds `await next(e)`. cat-spinner and the template do this,
   so the engine still draws the word, time and tokens.
3. `next({ ...e, props })` to change only the word, message or suffix, with no
   art at all.

A tree that doesn't validate is not drawn. The engine draws its own and logs
`ui.render (Spinner): a hook returned a tree that does not validate` with the
reason, shown in the transcript while hot-reloading and in `claude --debug`
otherwise.

## Raster cells, the pixel format

`Raster` is one fixed grid of cells, `columns` 1–512 by `rows` 1–256, given as
`cells`: **standard padded base64 of `columns * rows` little-endian u32
triplets `[codePoint, foreground, background]`**, row-major.

- **codePoint**: one printable, width-1 BMP character. Anything wider or
  unprintable makes the engine refuse the tree, naming the cell index. No emoji.
- **colour**: `0x00RRGGBB`, or `0x01000000` (bit 24 alone) for the terminal's
  default colour. Use the default for a transparent background.
- The palette paints 1024 distinct fg/bg pairs at once and maps the rest to
  the nearest.

**Half-block trick (both spinners use it):** draw on a pixel canvas twice as
tall as the rows, then pack each pair of vertical pixels into one cell:

| top px | bottom px | cell |
|---|---|---|
| empty | empty | `' '` (0x20), default, default |
| A | A | `█` (0x2588), fg A |
| empty | B | `▄` (0x2584), fg B |
| A | B | `▀` (0x2580), fg A, bg B |

That gives square-ish pixels, 2 per cell vertically. Text (speech bubbles,
`zzz`, `?`) is written straight into cells over the top, after packing. Box
drawing characters such as `╭─╮` are fine.

Encoding: build a `Uint32Array(columns * rows * 3)`, then base64 its bytes.
`Uint8Array.prototype.toBase64()` works at run time (clawd-spinner uses it) but
is missing from the `es2023` lib, so under `tsc` it is a type error. The
`btoa` loop in the template type-checks:

```ts
let binary = ''
for (const byte of new Uint8Array(cells.buffer)) binary += String.fromCharCode(byte)
return btoa(binary)
```

## Animating: `$.clock` and `$.ui.blit`

Don't re-render each frame. Draw once in `ui.render`, then repaint the
mounted Raster in place:

```ts
const r = await $.ui.blit({ requestId, key: 'act', cells })   // requestId from the Spinner render's e.requestId
if (r.deny) $.ui.invalidate('ui.render')                       // fall back to a full redraw
```

- Blits are taken up to 120/s and shown at about 60/s. Blits between frames
  fold into one. The spinners run at 83–90 ms (11–12 fps). A nap animation
  needs only 250 ms.
- `columns` / `rows` on a blit, if given, **must match the mounted size**. A
  resize is a redraw (`$.ui.invalidate('ui.render')`), never a blit.
- `{ deny }` when: nothing of this plugin's is mounted under that
  requestId+key (the spinner row went away between turns), a size mismatch,
  or cells that don't decode. clawd-spinner sets a flag on the first deny and
  falls back to `invalidate` until the next mount.
- Skip identical frames: keep the last `cells` string and return early when it
  hasn't changed.
- `$.clock.every(ms, fn)` and `$.clock.after(ms, fn)` return a `Timer` with
  `.cancel()`. `$.clock.now()` is async (`await` it). Base all motion on
  `now - turnAt`, not on a frame counter, so dropped ticks don't slow the
  animation. Pass that time into a pure `frame()` function so tests can call it.
- Two timer styles both work: one timer per session that does nothing while
  idle (clawd, the template), or start on `prompt.submit` and `.cancel()` on
  `turn.complete` (cat).

## Reacting to what Claude is doing

- **Mode**: read `e.props.mode` in the Spinner render (thinking vs tool-use vs
  responding).
- **Which tool**: `on('tool.call', async ($, e, next) => { ... })`. Check
  `e.tool` (`'Bash'`, `'Read'`...) before, `await next(e)`, and look at the
  result after. cat-spinner maps tools to activities (dig, laptop, magnifier)
  and startles the cat when `ran.deny !== undefined || ran.isError === true`.
  **Always return `next(e)`'s result unchanged.** This hook is a gate: if it
  throws or returns something else, it can block tool calls.
- **The word**: `e.props.word`. clawd-spinner has a scene for each of the 189
  current words plus a fallback act for words a later build adds.

## Between turns: the `AbovePrompt` band

cat-spinner's nap draws above the prompt while idle:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.isWorking || e.props.hasSurvey || e.surface !== 'terminal' || e.props.maxRows < ROWS) return next(e)
  const { Raster } = $.ui.resolve(e)
  return <Raster key="nap" columns={e.props.bodyColumns} rows={ROWS} cells={...} />
})
```

Size it to `e.props.bodyColumns` (not `viewport.columns`): it excludes the
engine's marks and shrinks when a pane is docked. Give way to a survey
(`hasSurvey`). Call `$.ui.invalidate('ui.render')` on `prompt.submit` and
`turn.complete` so the band appears and clears.

## Settings and commands

- **Settings panel**: declare `userConfig` in `plugin.json` (type, title,
  description, default, options). Values arrive as `register`'s `options`.
  Change them with `await $.config.set({ key: '<plugin>.<option>', value })`,
  which returns `{ deny }` on refusal. See cat-spinner's `plugin.json` for six
  examples.
- **Slash command**: `await $.command.register({ name, description })` in
  `session.start`, answered by
  `on('command.run', { command: name }, async ($, e) => ({ text }))`.
  Arguments are in `e.args`.
- **Persisted toggles**: `await $.store.get(key)` / `$.store.set(key, value)`
  survive across sessions. Wrap them in try/catch (clawd-spinner's
  `/clawd-talk`).
- **State**: module variables reset on every hot reload. That is fine for an
  animation. Anything a drawing must re-read after a reload goes in `$.state`
  with a `types/index.d.ts` contract (see the plugin-authoring skill).

## Gotchas collected from both spinners

- Check `e.surface === 'terminal'` before using `Raster`, and `return next(e)`
  everywhere else.
- Leave a margin: clawd keeps 4 columns clear at the right edge, cat 2. Full
  width wraps.
- Below a minimum width (clawd: 50 columns), skip the art and `return next(e)`.
- A reload mid-turn: `ui.render` may run with `working` still false. Set it
  there as well (both spinners do).
- Two spinner plugins installed at once both hook `Spinner`. Going by how
  `next` chains (not tested), whichever runs first replaces the other's
  drawing unless it embeds `next(e)`. Merging both into one plugin, as the duo
  does, avoids that.
- Tests that touch date-dependent visuals (cat's Halloween season) must pin
  the option, or they pass one month and fail the next.
- cat-spinner fingerprints every frame of scripted scenes against
  `tests/golden.ts`. Copy that pattern for any tuned animation.

## Developing one

1. Ask Claude to load the **plugin-authoring** skill, then point it at this
   file and the template. The skill sets up hot reloading: mods written under
   `~/.claude/dev-mods/<session>/` reload when each turn ends, after you answer
   "Enable hot reloading for this session?" once.
2. Or run it standalone: `claude --plugin-dir ~/path/to/my-spinner`.
3. Check it:
   ```sh
   claude plugin validate my-spinner   # what it hooks and calls, and what the engine would refuse
   claude plugin test my-spinner       # runs tests/*.test.ts
   tsc -p my-spinner                   # once the engine has laid .claude-plugin/types/
   ```
4. To keep it, move it into `claude-mods/` as its own mod and add it to the
   marketplace (see `README.md`). Then commit here and bump the master repo.

## Where the truth lives

- **Types for this build**: the plugin-authoring skill writes them as it loads
  (`.../plugin-authoring/types/claude-code.d.ts`, about 22k lines). The engine
  also lays them into `<mod>/.claude-plugin/types/claude-code/index.d.ts` once
  a mod loads. Search them by name: `Spinner: {`, `export type RasterProps`,
  `blit:`, `export type RenderViewport`, `'turn.complete'`.
- **Long-form guide**: `reference.md` beside the skill.
- **Working examples** (vendored here): `cat-clawd-duo/hooks/cat.tsx`
  (settings pane with live preview, tool reactions, nap band),
  `cat-clawd-duo/hooks/clawd/clawd.tsx` (the smallest complete spinner, from
  clawd-spinner's register.tsx) and `showtime/hooks/register.tsx` (themes,
  stage band, companion pet, a `/showtime` command).
