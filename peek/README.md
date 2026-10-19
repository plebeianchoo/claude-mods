# peek: images inline in the terminal

A `show_image` tool for Claude and `/img <path>` for you. The picture is drawn
through Claude Code's own `Image` element, with its name and pixel size under it.
Nothing goes to the network, nothing is added to the prompt, and there is no updater.

## What it does

- **`show_image`**: Claude calls it when a picture is the answer (a screenshot, a
  chart it made, a design). The result tells Claude it did not see the picture, so it
  reads the file itself if it needs to.
- **`/img <path>`**: shows a file yourself. `~` and paths relative to the working
  folder work.
- **Conversion**: PNG, JPEG, WebP, GIF (first frame), BMP and TIFF are converted by
  Pillow (`python3` with `PIL`) to a PNG with its longest side at most 1600 px and at
  most 2 MiB, EXIF rotation applied. Without Pillow, only a PNG already under 2 MiB can
  be shown. Converted files are cached under `$XDG_RUNTIME_DIR/peek-<uid>/` and reused
  until the source file changes.
- **Inside tmux**: Claude Code's upload is not wrapped for passthrough, so tmux drops
  it and only the placeholder cells arrive. peek reads the image id from those cells
  (`tmux capture-pane`) and re-sends the same PNG wrapped for passthrough to its own
  pane, so the picture appears. tmux 3.3a or later with `allow-passthrough on` is needed.

## The terminal guard

Images go through the kitty graphics protocol in its Unicode-placeholder form, which
only some terminals draw. A terminal without it shows the placeholder cells as coloured
symbols (the colour is the image id) and prints the upload as raw escape bytes.

Inside tmux the real terminal is hidden, so peek asks tmux once per session for the
attached client's `TERM` (`tmux display -p '#{client_termname}'`) and draws only when it
names Ghostty, kitty or WezTerm. Anything else, including `xterm-256color` as a Windows
console reports it, gets a dim line with the file name and size instead, and Claude's
tool result says the picture was not drawn so it can describe it in words.

Limits:

- Only one tmux client is checked. With a capable and an incapable terminal attached
  to the same session, the incapable one still sees symbols.
- WezTerm is matched by its `TERM` of `wezterm`, which it reports only when its terminfo
  is installed; with its default `xterm-256color` it is treated as unable to draw.
- Outside tmux the guard is off and Claude Code's own detection decides.

## Checking a change

```sh
claude plugin validate peek/.claude-plugin/plugin.json && claude plugin test peek && pnpm typecheck
claude plugin marketplace update claudebro-mods && claude plugin update peek@claudebro-mods
```

then `/reload-plugins` in open sessions. If pictures show as symbols, run
`tmux list-clients -F '#{client_termname} #{client_termtype}'` first: the second field is
the terminal's own version reply, empty for terminals that give none.
