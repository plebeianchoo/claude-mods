#!/usr/bin/env bash
# Rebuilds the cat-clawd-duo mod from the upstream cat-spinner and clawd-spinner
# plugins plus this repo's patch, so upstream updates reach the duo.
#
#   cat-clawd-duo.sh            build into .staged/, validate and test it, and report
#                               whether it differs from the installed copy
#   cat-clawd-duo.sh --install  the same, then replace cat-clawd-duo/ with the build,
#                               commit it, and update the installed plugin
#   cat-clawd-duo.sh --pristine <dir>
#                               only assemble upstream (renames, no patch) into <dir>;
#                               used to regenerate duo.patch after editing the mod
#
# Upstream is read from the marketplace clones Claude Code keeps (refreshed by
# `claude plugin marketplace update`), so their version is what the weekly job fetched.
# Exit codes: 0 up to date or built, 2 the patch no longer applies (merge by hand),
# 3 the build fails validation or tests.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HERE="$REPO/build"
CAT="$HOME/.claude/plugins/marketplaces/cat-spinner"
CLAWD="$HOME/.claude/plugins/marketplaces/clawd-spinner"
OUT="$REPO/cat-clawd-duo"
STAGE="$REPO/.staged/cat-clawd-duo"
CLAUDE="${CLAUDE:-$HOME/.local/bin/claude}"

# Upstream laid out as the duo expects, with the mechanical renames: the cat's
# hooks at hooks/ (its register.tsx as cat.tsx), Clawd's under hooks/clawd/, both
# test suites, and the cat's userConfig keys and plugin name renamed.
assemble() {
  local d="$1"
  rm -rf "$d"
  mkdir -p "$d/hooks/clawd" "$d/tests"
  cp -r "$CAT/hooks/." "$d/hooks/"
  mv "$d/hooks/register.tsx" "$d/hooks/cat.tsx"
  cp -r "$CAT/tests/." "$d/tests/"
  cp -r "$CLAWD/hooks/." "$d/hooks/clawd/"
  rm "$d/hooks/clawd/hooks.json"
  mv "$d/hooks/clawd/register.tsx" "$d/hooks/clawd/clawd.tsx"
  for t in "$CLAWD"/tests/*.test.ts; do cp "$t" "$d/tests/clawd-$(basename "$t")"; done
  cp "$CAT/LICENSE" "$d/LICENSE-cat-spinner"
  cp "$CLAWD/LICENSE" "$d/LICENSE-clawd-spinner"

  sed -i "s#'\.\./hooks/register'#'../hooks/cat'#" "$d"/tests/*.ts "$d"/tests/*.tsx
  sed -i -E "s#'\.\./hooks/([a-z]+)'#'../hooks/clawd/\1'#" "$d"/tests/clawd-*.test.ts
  sed -i "s/'cat-spinner\./'cat-clawd-duo./g; s/\`cat-spinner\./\`cat-clawd-duo./g" "$d/hooks/cat.tsx"
  sed -i "s/plugin: 'cat-spinner'/plugin: 'cat-clawd-duo'/g; s/'cat-spinner\./'cat-clawd-duo./g; s/\"cat-spinner\./\"cat-clawd-duo./g" "$d/tests/cat.test.tsx"
}

# The manifest: the cat's userConfig, named for the duo, versioned by both upstreams.
manifest() {
  local d="$1" cat_v clawd_v
  cat_v=$(jq -r .version "$CAT/.claude-plugin/plugin.json")
  clawd_v=$(jq -r .version "$CLAWD/.claude-plugin/plugin.json")
  mkdir -p "$d/.claude-plugin"
  jq --arg v "$cat_v-clawd$clawd_v" '
      .name = "cat-clawd-duo" | .version = $v
    | .description = "cat-spinner and clawd-spinner merged: the pixel cat and Clawd share one row above the spinner (stacked when the terminal is too narrow)."
    | .author = { name: "Jeremy (fork of Scott Wicken cat-spinner + Sai Rudra clawd-spinner)" }
    | del(.homepage, .repository)' "$CAT/.claude-plugin/plugin.json" > "$d/.claude-plugin/plugin.json"
}

if [ "${1:-}" = "--pristine" ]; then
  assemble "$2"
  exit 0
fi

assemble "$STAGE"
if ! patch -s -p1 -d "$STAGE" --no-backup-if-mismatch < "$HERE/cat-clawd-duo.patch"; then
  echo "DUO NEEDS MANUAL MERGE: upstream changed code the duo patch touches (cat $(jq -r .version "$CAT/.claude-plugin/plugin.json"), clawd $(jq -r .version "$CLAWD/.claude-plugin/plugin.json"))."
  exit 2
fi
find "$STAGE" -name '*.rej' -delete
manifest "$STAGE"

if ! "$CLAUDE" plugin validate "$STAGE/.claude-plugin/plugin.json" > "$REPO/.staged/validate.log" 2>&1 \
  || ! "$CLAUDE" plugin test "$STAGE" > "$REPO/.staged/test.log" 2>&1; then
  echo "DUO BUILD FAILS: see $REPO/.staged/validate.log and test.log"
  exit 3
fi

if diff -rq -x types "$STAGE" "$OUT" > /dev/null 2>&1; then
  echo "duo up to date ($(jq -r .version "$OUT/.claude-plugin/plugin.json"))"
  exit 0
fi

if [ "${1:-}" != "--install" ]; then
  echo "DUO UPDATE READY: $(jq -r .version "$OUT/.claude-plugin/plugin.json" 2>/dev/null || echo none) -> $(jq -r .version "$STAGE/.claude-plugin/plugin.json"), tests pass."
  echo "  review: diff -ru -x types $OUT $STAGE"
  echo "  install: $0 --install"
  exit 0
fi

rm -rf "$OUT"
cp -r "$STAGE" "$OUT"
git -C "$REPO" add -A cat-clawd-duo
git -C "$REPO" commit -qm "cat-clawd-duo $(jq -r .version "$OUT/.claude-plugin/plugin.json")"
"$CLAUDE" plugin marketplace update claudebro-mods
"$CLAUDE" plugin update cat-clawd-duo@claudebro-mods
echo "duo installed: $(jq -r .version "$OUT/.claude-plugin/plugin.json") (run /reload-plugins in open sessions)"
