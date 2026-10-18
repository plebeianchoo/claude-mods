#!/usr/bin/env bash
# Shows what changed upstream since the mods here were forked, so a change worth
# having can be ported by hand. Read-only: it never touches the mods.
#
#   upstream-diff.sh               fetch each upstream, list commits past its baseline
#   upstream-diff.sh <name>        the full diff for one upstream since its baseline
#   upstream-diff.sh --mark <name> record that upstream's current head as reviewed
#
# Upstreams and baselines live in build/upstream.tsv. Clones are kept in
# ~/.cache/claude-mods-upstream, apart from Claude Code's plugin marketplaces.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TSV="$HERE/upstream.tsv"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/claude-mods-upstream"

fetch() {
  local name="$1" url="$2" d="$CACHE/$1"
  if [ -d "$d" ]; then
    git -C "$d" fetch -q origin
  else
    mkdir -p "$CACHE"
    git clone -q --bare "$url" "$d"
  fi
}

head_of() { git -C "$CACHE/$1" rev-parse 'HEAD^{commit}'; }

row() { awk -F'\t' -v n="$1" '!/^#/ && $1 == n' "$TSV"; }

case "${1:-}" in
  --mark)
    r=$(row "${2:?--mark needs a name}")
    [ -n "$r" ] || { echo "no upstream named $2 in $TSV" >&2; exit 1; }
    IFS=$'\t' read -r name url base paths mod <<< "$r"
    fetch "$name" "$url"
    new=$(head_of "$name")
    awk -F'\t' -v OFS='\t' -v n="$name" -v h="$new" '!/^#/ && $1 == n { $3 = h } 1' "$TSV" > "$TSV.tmp"
    mv "$TSV.tmp" "$TSV"
    echo "$name baseline: ${base:0:7} -> ${new:0:7}"
    ;;
  "")
    while IFS=$'\t' read -r name url base paths mod; do
      [[ "$name" = \#* || -z "$name" ]] && continue
      fetch "$name" "$url"
      # shellcheck disable=SC2086
      log=$(git -C "$CACHE/$name" log --oneline "$base..$(head_of "$name")" -- $paths)
      if [ -z "$log" ]; then
        echo "$name ($mod): nothing new since ${base:0:7}"
      else
        echo "$name ($mod): $(wc -l <<< "$log") new commit(s) since ${base:0:7}"
        sed 's/^/  /' <<< "$log"
        echo "  see: $0 $name"
      fi
    done < "$TSV"
    ;;
  *)
    r=$(row "$1")
    [ -n "$r" ] || { echo "no upstream named $1 in $TSV" >&2; exit 1; }
    IFS=$'\t' read -r name url base paths mod <<< "$r"
    fetch "$name" "$url"
    # shellcheck disable=SC2086
    git -C "$CACHE/$name" diff --stat -p "$base" "$(head_of "$name")" -- $paths
    ;;
esac
