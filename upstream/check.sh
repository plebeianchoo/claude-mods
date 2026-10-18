#!/usr/bin/env bash
# The original mods the ones here were forked from, kept as reference clones in
# upstream/<name>/ (on their latest commit), and what changed in them since each
# fork's baseline. Read-only for the mods: changes are ported by hand.
#
#   check.sh                       update the clones, list commits past each baseline
#   check.sh --notify              the same, and message Telegram if anything is new
#                                  or a fetch fails (the monthly timer runs this)
#   check.sh <name>                the full diff for one upstream since its baseline
#   check.sh --mark <name>         record that upstream's current head as reviewed
#   check.sh --add <name> <url> <mod> [paths...]
#                                  start tracking a new upstream, baseline = its head
#
# Sources and baselines live in upstream/sources.tsv (paths are space-separated,
# "." for the whole repo).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TSV="$HERE/sources.tsv"

update() {
  local name="$1" url="$2" d="$HERE/$1"
  if [ -d "$d/.git" ]; then
    git -C "$d" pull -q --ff-only
  else
    git clone -q "$url" "$d"
  fi
}

head_of() { git -C "$HERE/$1" rev-parse HEAD; }

row() { awk -F'\t' -v n="$1" '!/^#/ && $1 == n' "$TSV"; }

need_row() {
  r=$(row "$1")
  [ -n "$r" ] || { echo "no upstream named $1 in $TSV" >&2; exit 1; }
  IFS=$'\t' read -r name url base paths mod <<< "$r"
}

report() {
  local out="" failed="" log
  while IFS=$'\t' read -r name url base paths mod; do
    [[ "$name" = \#* || -z "$name" ]] && continue
    if ! update "$name" "$url" 2>/dev/null; then
      failed+="$name "
      out+="$name ($mod): FETCH FAILED"$'\n'
      continue
    fi
    # shellcheck disable=SC2086
    log=$(git -C "$HERE/$name" log --oneline "$base..HEAD" -- $paths)
    if [ -z "$log" ]; then
      out+="$name ($mod): nothing new since ${base:0:7}"$'\n'
    else
      out+="$name ($mod): $(wc -l <<< "$log") new commit(s) since ${base:0:7}"$'\n'
      out+="$(sed 's/^/  /' <<< "$log")"$'\n'
      NEW=1
    fi
  done < "$TSV"
  printf '%s' "$out"
  REPORT="$out"
  FAILED="$failed"
}

case "${1:-}" in
  --mark)
    need_row "${2:?--mark needs a name}"
    update "$name" "$url" || exit 1
    new=$(head_of "$name")
    awk -F'\t' -v OFS='\t' -v n="$name" -v h="$new" '!/^#/ && $1 == n { $3 = h } 1' "$TSV" > "$TSV.tmp"
    mv "$TSV.tmp" "$TSV"
    echo "$name baseline: ${base:0:7} -> ${new:0:7}"
    ;;
  --add)
    name="${2:?--add needs <name> <url> <mod> [paths...]}" url="${3:?url}" mod="${4:?mod}"
    shift 4
    [ -z "$(row "$name")" ] || { echo "$name is already tracked" >&2; exit 1; }
    update "$name" "$url" || exit 1
    paths="${*:-.}"
    printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$url" "$(head_of "$name")" "$paths" "$mod" >> "$TSV"
    echo "tracking $name at $(head_of "$name" | cut -c1-7): $HERE/$name"
    ;;
  ""|--notify)
    NEW=0
    report
    if [ "${1:-}" = "--notify" ] && { [ "$NEW" = 1 ] || [ -n "$FAILED" ]; }; then
      printf '[claude-mods] upstream spinner mods changed:\n%s\nReview: %s <name>, port by hand, then --mark <name>.' \
        "$REPORT" "$0" | tg-notify
    fi
    [ -z "$FAILED" ]
    ;;
  -*)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
  *)
    need_row "$1"
    update "$name" "$url" || exit 1
    # shellcheck disable=SC2086
    git -C "$HERE/$name" diff --stat -p "$base" HEAD -- $paths
    ;;
esac
