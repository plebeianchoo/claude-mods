# upstream/

The original mods mine were forked from, kept here to read and to port fixes from.
Each `upstream/<name>/` is a plain clone of the original repo on its latest commit;
git ignores them, and `check.sh` re-clones any that are missing.

| Source | Forked into | Repo |
| --- | --- | --- |
| `cat-spinner` | `cat-clawd-duo` (hooks/, cat.tsx) | https://github.com/swicken/cat-spinner |
| `clawd-spinner` | `cat-clawd-duo` (hooks/clawd/) | https://github.com/saiharsha03/clawd-spinner |
| `hoobnn-spinner` | `spinner` | https://github.com/hoobnn/hoobnn-agent-mods (`claude-code/spinner`; its `hooks/kit/` is upstream's synced copy of `claude-code/kit`) |

`sources.tsv` records, per source, the last upstream commit I reviewed (the baseline);
`maps/<name>.sed` maps a source's paths and renames onto my mod; `ported.tsv` lists the
upstream commits already brought in.

```bash
upstream/check.sh                        # update the clones, triage each commit since the baseline
upstream/check.sh hoobnn-spinner         # the full upstream diff since the baseline
upstream/check.sh --patch <name> <commit>        # one commit, mapped onto my mod (to review)
upstream/check.sh --port <name> <commit>...      # apply it to the mod (conflict: upstream/.port/)
upstream/check.sh --ported <name> <commit>...    # record a hand merge as ported
upstream/check.sh --mark <name>          # everything up to upstream's head reviewed
upstream/check.sh --add <name> <url> <mod> [paths...]   # track a new source (then write its map)
```

Triage labels each commit: `docs` (no code), `release` (version bumps only), `ported`,
`unused` (touches nothing my mod has), `clean` (applies as is) or `conflict` (merge by hand).
Commits are tried in order on a scratch copy of the mod, each on top of the clean ones
before it.

A monthly timer (`claude-mods-upstream.timer` in `~/dotfiles`, the 1st at 10:00) runs
`check.sh --notify`, which messages Telegram only when a commit is `clean` or `conflict`,
or a fetch fails. To act on it, tell Claude "port upstream" (the `port-upstream` skill:
triage, security-auditor review of the patch, `--port`, validate and test, commit,
install, `--mark`).
