# upstream/

The original mods mine were forked from, kept here to read and to port fixes from.
Each `upstream/<name>/` is a plain clone of the original repo on its latest commit;
git ignores them, and `check.sh` re-clones any that are missing.

| Source | Forked into | Repo |
| --- | --- | --- |
| `cat-spinner` | `cat-clawd-duo` (hooks/, cat.tsx) | https://github.com/swicken/cat-spinner |
| `clawd-spinner` | `cat-clawd-duo` (hooks/clawd/) | https://github.com/saiharsha03/clawd-spinner |
| `hoobnn-spinner` | `spinner` | https://github.com/hoobnn/hoobnn-agent-mods (`claude-code/spinner`, `claude-code/kit`) |

`sources.tsv` records, per source, the last upstream commit I reviewed (the baseline).

```bash
upstream/check.sh                    # update the clones, list commits since each baseline
upstream/check.sh hoobnn-spinner     # the full diff since the baseline
upstream/check.sh --mark hoobnn-spinner          # after porting (or skipping): reviewed
upstream/check.sh --add <name> <url> <mod> [paths...]   # track a new source
```

A monthly timer (`claude-mods-upstream.timer` in `~/dotfiles`, the 1st at 10:00) runs
`check.sh --notify`, which messages Telegram only when something is new or a fetch fails.
Porting is always by hand: edit the mod, validate and test it, commit, `--mark`.
