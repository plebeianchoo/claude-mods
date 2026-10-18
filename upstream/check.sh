#!/usr/bin/env bash
# The original mods the ones here were forked from, kept as reference clones in
# upstream/<name>/ (on their latest commit), and what changed in them since each
# fork's baseline, sorted by whether it would apply to the mod here.
#
#   check.sh                       update the clones; triage each commit past its baseline
#   check.sh --notify              the same, and message Telegram if any commit is worth
#                                  a look or a fetch fails (the monthly timer runs this)
#   check.sh <name>                the full upstream diff since the baseline
#   check.sh --patch <name> <commit>
#                                  one commit, mapped onto the mod's paths (to review)
#   check.sh --port <name> <commit>...
#                                  apply those commits to the mod (no commit); a conflict
#                                  leaves the mapped patch in upstream/.port/ to merge by hand
#   check.sh --ported <name> <commit>...
#                                  record commits as ported (after a hand merge)
#   check.sh --mark <name>         record that upstream's current head as reviewed
#   check.sh --add <name> <url> <mod> [paths...]
#                                  start tracking a new upstream, baseline = its head
#
# Sources and baselines live in upstream/sources.tsv (paths space-separated, "."
# for the whole repo); upstream/maps/<name>.sed maps a source's paths and renames
# onto its mod; upstream/ported.tsv lists the commits already ported.
#
# Triage labels: docs (no code), release (version bumps only), ported, unused
# (touches nothing the mod has), clean (applies as is), conflict (merge by hand).
# Commits are tried in order on a copy of the mod, each on top of the clean ones
# before it; a commit that needs a conflicting one shows as a conflict too.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$HERE")"
TSV="$HERE/sources.tsv"
PORTED="$HERE/ported.tsv"
# Not code: what a commit touching only these is labelled docs for.
NOT_CODE=(':(exclude,glob)**/*.md' ':(exclude,glob)**/assets/**' ':(exclude,glob)**/*.png'
  ':(exclude,glob)**/*.gif' ':(exclude,glob)**/LICENSE*' ':(exclude,glob)**/.markdownlint*'
  ':(exclude,glob)**/scripts/**')

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

# One upstream commit's code, as a patch onto the mod's paths.
mapped() {
  local map="$HERE/maps/$name.sed"
  # shellcheck disable=SC2086
  git -C "$HERE/$name" show --format= --binary "$1" -- $paths "${NOT_CODE[@]}" \
    | if [ -f "$map" ]; then sed -f "$map"; else cat; fi
}

applies() { git -C "$REPO" apply --include="$mod/*" "$@"; }

# Triage tries commits in order on a scratch copy of the mod ($WORK, in /tmp),
# applying each clean one, so a commit is judged on top of the clean ones before it.
WORK="/tmp/claude-mods-triage.$$"
trial() { GIT_CEILING_DIRECTORIES="$WORK" git -C "$WORK" apply --include="$mod/*" "$@"; }

# The triage label for one commit (see the header).
label() {
  local c="$1" code patch
  # shellcheck disable=SC2086
  code=$(git -C "$HERE/$name" show --format= "$c" -- $paths "${NOT_CODE[@]}")
  [ -z "$code" ] && { echo docs; return; }
  if ! grep -E '^[+-]' <<< "$code" | grep -vE '^(\+\+\+|---) ' | grep -qvE '^[+-]\s*"version":'; then
    echo release; return
  fi
  local full
  full=$(git -C "$HERE/$name" rev-parse "$c")
  if [ -f "$PORTED" ] && awk -F'\t' -v n="$name" -v c="$full" '$1 == n && $2 == c { f = 1 } END { exit !f }' "$PORTED"; then
    echo ported; return
  fi
  patch=$(mktemp)
  mapped "$c" > "$patch"
  if [ -z "$(trial --numstat "$patch" 2>/dev/null)" ]; then
    echo unused
  elif trial -R --check "$patch" 2>/dev/null; then
    echo ported
  elif trial "$patch" 2>/dev/null; then
    echo clean
  else
    echo "conflict $(trial --check "$patch" 2>&1 | sed -n 's/^error: \([^:]*\): patch does not apply/\1/p' | sort -u | paste -sd' ')"
  fi
  rm -f "$patch"
}

triage() {
  local out="" failed="" c l n
  ACTIONABLE=0
  while IFS=$'\t' read -r name url base paths mod; do
    [[ "$name" = \#* || -z "$name" ]] && continue
    if ! update "$name" "$url" 2>/dev/null; then
      failed+="$name "
      out+="$name ($mod): FETCH FAILED"$'\n'
      continue
    fi
    # shellcheck disable=SC2086
    mapfile -t commits < <(git -C "$HERE/$name" log --reverse --format=%h "$base..HEAD" -- $paths)
    if [ "${#commits[@]}" = 0 ]; then
      out+="$name ($mod): nothing new since ${base:0:7}"$'\n'
      continue
    fi
    out+="$name ($mod): ${#commits[@]} new commit(s) since ${base:0:7}"$'\n'
    mkdir -p "$WORK"
    cp -r "$REPO/$mod" "$WORK/"
    n=0
    for c in "${commits[@]}"; do
      l=$(label "$c")
      case "$l" in clean|conflict*) n=$((n + 1)) ;; esac
      out+="  $c  $(printf '%-9s' "${l%% *}") $(git -C "$HERE/$name" log -1 --format="%<(70,trunc)%s" "$c" | sed "s/ *$//")"
      [[ "$l" = conflict\ * ]] && out+=$'\n'"               conflicts in: ${l#conflict }"
      out+=$'\n'
    done
    rm -rf "/tmp/claude-mods-triage.$$"
    if [ "$n" = 0 ]; then
      out+="  nothing to port: $0 --mark $name"$'\n'
    else
      ACTIONABLE=$((ACTIONABLE + n))
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
    echo "if its paths or names differ from $mod's, write $HERE/maps/$name.sed (see the others)"
    ;;
  --patch)
    need_row "${2:?--patch needs <name> <commit>}"
    mapped "${3:?--patch needs a commit}"
    ;;
  --port)
    need_row "${2:?--port needs <name> <commit>...}"
    shift 2
    [ $# -gt 0 ] || { echo "--port needs a commit" >&2; exit 1; }
    for c in "$@"; do
      full=$(git -C "$HERE/$name" rev-parse --verify -q "$c^{commit}") || { echo "$c: no such commit in $name" >&2; exit 1; }
      patch=$(mktemp)
      mapped "$c" > "$patch"
      if applies "$patch" 2>/dev/null; then
        printf '%s\t%s\t%s\n' "$name" "$full" "$(date +%F)" >> "$PORTED"
        echo "$c applied to $mod/"
        rm -f "$patch"
      else
        mkdir -p "$HERE/.port"
        mv "$patch" "$HERE/.port/$name-${full:0:7}.patch"
        echo "$c does not apply: merge $HERE/.port/$name-${full:0:7}.patch by hand, then $0 --ported $name $c" >&2
        exit 3
      fi
    done
    ;;
  --ported)
    need_row "${2:?--ported needs <name> <commit>...}"
    shift 2
    for c in "$@"; do
      full=$(git -C "$HERE/$name" rev-parse --verify -q "$c^{commit}") || { echo "$c: no such commit in $name" >&2; exit 1; }
      printf '%s\t%s\t%s\n' "$name" "$full" "$(date +%F)" >> "$PORTED"
      echo "$c recorded as ported"
    done
    ;;
  ""|--notify)
    triage
    if [ "${1:-}" = "--notify" ] && { [ "$ACTIONABLE" -gt 0 ] || [ -n "$FAILED" ]; }; then
      printf '[claude-mods] %s upstream change(s) worth a look:\n%s\nIn Claude: "port upstream <name> <commit>".' \
        "$ACTIONABLE" "$REPORT" | tg-notify
    fi
    [ -z "$FAILED" ]
    ;;
  -*)
    sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
  *)
    need_row "$1"
    update "$name" "$url" || exit 1
    # shellcheck disable=SC2086
    git -C "$HERE/$name" diff --stat -p "$base" HEAD -- $paths
    ;;
esac
