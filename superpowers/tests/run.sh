#!/usr/bin/env bash
# Smoke tests for the superpowers hooks: synthetic inputs, no LLM, no writes outside /tmp.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK=$(mktemp -d /tmp/superpowers-test.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
export SUPERPOWERS_USERGATE_TRACE_LOG="$WORK/trace.log"
HOME_ROUTED="$WORK/home-routed"; mkdir -p "$HOME_ROUTED/.claude/superpowers"
echo '{"mechanical":"haiku","standard":"sonnet","frontier":"inherit"}' > "$HOME_ROUTED/.claude/superpowers/model-routing.json"
HOME_BARE="$WORK/home-bare"; mkdir -p "$HOME_BARE"
fail=0
check() { local label="$1" want="$2" got="$3"; if [ "$want" = "$got" ]; then echo "  PASS $label"; else echo "  FAIL $label: want $want, got $got"; fail=$((fail+1)); fi; }

echo "session-start"
out=$(cd "$WORK" && CLAUDE_PLUGIN_ROOT="$ROOT" HOME="$HOME_ROUTED" bash "$ROOT/hooks/session-start")
check "valid JSON" 0 "$(printf '%s' "$out" | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1; echo $?)"
ctx=$(printf '%s' "$out" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])')
check "carries using-superpowers" 0 "$(printf '%s' "$ctx" | grep -q 'name: using-superpowers'; echo $?)"
check "carries routing notice when routing file exists" 0 "$(printf '%s' "$ctx" | grep -q '<model-routing-active>'; echo $?)"
check "names the superpowers: prefix, not the old one" 0 "$(printf '%s' "$ctx" | grep -q "superpowers:using-superpowers" && ! printf '%s' "$ctx" | grep -q 'extended-cc'; echo $?)"
out=$(cd "$WORK" && CLAUDE_PLUGIN_ROOT="$ROOT" HOME="$HOME_BARE" bash "$ROOT/hooks/session-start")
check "no routing notice without the file" 1 "$(printf '%s' "$out" | grep -q '<model-routing-active>'; echo $?)"

run() { # hook, HOME, json  -> exit code
  cd "$WORK" && HOME="$2" bash "$ROOT/hooks/$1" >"$WORK/out" 2>"$WORK/err" <<< "$3"; echo $?
}
plan_task() { python3 -c '
import json,sys
fence = sys.argv[1]
print(json.dumps({"tool_name":"TaskCreate","cwd":sys.argv[2],"tool_input":{"subject":"Task 1: add thing","description":"**Goal:** x\n\n```json:metadata\n"+fence+"\n```\n"}}))' "$1" "$WORK"; }

echo "pre-taskcreate-model-tier"
check "other tool passes" 0 "$(run pre-taskcreate-model-tier "$HOME_ROUTED" '{"tool_name":"Bash","cwd":"'"$WORK"'","tool_input":{"command":"ls"}}')"
check "plan task with tier passes" 0 "$(run pre-taskcreate-model-tier "$HOME_ROUTED" "$(plan_task '{"modelTier":"mechanical"}')")"
check "plan task without tier blocks" 2 "$(run pre-taskcreate-model-tier "$HOME_ROUTED" "$(plan_task '{"files":["a"]}')")"
check "dormant without routing file" 0 "$(run pre-taskcreate-model-tier "$HOME_BARE" "$(plan_task '{"files":["a"]}')")"
check "kill switch" 0 "$(cd "$WORK" && SUPERPOWERS_ROUTING_GUARD=0 HOME="$HOME_ROUTED" bash "$ROOT/hooks/pre-taskcreate-model-tier" >/dev/null 2>&1 <<< "$(plan_task '{"files":["a"]}')"; echo $?)"

echo "pre-agent-model-routing"
check "other tool passes" 0 "$(run pre-agent-model-routing "$HOME_ROUTED" '{"tool_name":"Bash","cwd":"'"$WORK"'","tool_input":{}}')"
check "Agent with no in-progress task passes" 0 "$(run pre-agent-model-routing "$HOME_ROUTED" '{"tool_name":"Agent","cwd":"'"$WORK"'","transcript_path":"/nonexistent","tool_input":{"prompt":"x","description":"x"}}')"

echo "pre-askuser-handoff-guard"
check "not armed passes" 0 "$(run pre-askuser-handoff-guard "$HOME_ROUTED" '{"tool_name":"AskUserQuestion","cwd":"'"$WORK"'","transcript_path":"/nonexistent","tool_input":{"questions":[{"question":"a?","options":[{"label":"x"}]}]}}')"

echo "skills"
for s in "$ROOT"/skills/*/SKILL.md; do
  n=$(basename "$(dirname "$s")"); [ "$n" = shared ] && continue
  check "$n frontmatter name" 0 "$(sed -n 2p "$s" | grep -q "^name: $n$"; echo $?)"
done
check "no reference to the old prefix" 1 "$(grep -rq 'superpowers-extended-cc' "$ROOT/skills" "$ROOT/hooks"; echo $?)"
check "no reference to dropped files" 1 "$(grep -rqE 'visual-companion|checking-gates|specifying-gates|dispatching-parallel-agents|receiving-code-review' "$ROOT/skills" "$ROOT/hooks"; echo $?)"

echo; [ "$fail" -eq 0 ] && echo "all passed" || { echo "$fail failed"; exit 1; }
