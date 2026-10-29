# superpowers

My fork of [pcvelz/superpowers](https://github.com/pcvelz/superpowers) (itself a Claude Code
fork of [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent), taken at
upstream commit `cb12f4f` (6.5.3-dev) on 2026-10-30. MIT; the original license ships here.
The files in this directory are the source of truth: edit them in place, nothing pulls upstream in.

## What is in it

Skills, invoked as `superpowers:<name>` (the Skill tool) or `/superpowers:<name>`:

| Skill | For |
| --- | --- |
| `using-superpowers` | injected at session start: use the Skill tool before acting |
| `brainstorming` | design before building: one question at a time, 2–3 approaches, a design doc |
| `writing-plans` | a spec into numbered tasks (Claude Code native tasks, `json:metadata`, user-gate tagging) |
| `subagent-driven-development` | run a plan task by task with implementer and reviewer subagents |
| `executing-plans` | run a plan in a separate session, with review checkpoints |
| `requesting-code-review` | the reviewer prompt the other skills dispatch |
| `systematic-debugging` | root cause before fixes (with `find-polluter.sh`, defense-in-depth, condition-based waiting) |
| `test-driven-development` | red, green, refactor; `writing-good-tests.md` |
| `verification-before-completion` | evidence before claiming done |
| `finishing-a-development-branch` | merge, PR, or keep: what to do when the work is done |
| `using-git-worktrees` | an isolated workspace for a plan |
| `writing-skills` | how to write and test a skill |

Hooks (`hooks/hooks.json`):

| Hook | Event | Does |
| --- | --- | --- |
| `session-start` | SessionStart | injects `using-superpowers` and, when `~/.claude/superpowers/model-routing.json` exists (or a project `docs/superpowers/model-routing.json`), the model-routing notice |
| `pre-taskcreate-model-tier` | PreToolUse TaskCreate | plan tasks must carry a valid `modelTier` |
| `pre-agent-model-routing` | PreToolUse Agent | a dispatch's `model` must match the in-progress task's tier |
| `pre-askuser-handoff-guard` | PreToolUse AskUserQuestion | after writing-plans, the handoff question keeps its two-option shape |

All three gates are dormant without the routing file and fail open; kill switch
`SUPERPOWERS_ROUTING_GUARD=0`. They log to `/tmp/claude-hooks/user-gate-trace.log`.
The user-gate hooks (`post-task-complete-revalidate.sh`, `stop-revalidate-user-gates.sh`,
`stop-wait-guard.sh`) are not part of the plugin: `~/dotfiles/claude/settings.json` runs the
copies in `~/dotfiles/claude/hooks/superpowers/`.

`docs/` keeps upstream's two design notes the hooks and `writing-plans` cite.

## What was left out, and why

- The brainstorming **visual companion** (a Node web server plus a browser launcher): linglong is headless.
- `checking-gates`, `specifying-gates`, `/gate-check`, `/specify-gate`, `/onboard`, the onboarding drift hook: never invoked here.
- `dispatching-parallel-agents`, `receiving-code-review`: never invoked, not referenced by the kept skills.
- `pre-taskcreate-commit-strategy` and the `workflow.json` notice: dormant without a `workflow.json`, which does not exist here.
- The Windows polyglot wrapper (`run-hook.cmd`), tests, GitHub templates, contributor docs.

## Working on it

Installed from the local marketplace: `/plugin install superpowers --marketplace plebeianchoo/claude-mods`
(here: `claude plugin install superpowers@claudebro-mods`).

```bash
claude plugin validate superpowers/.claude-plugin/plugin.json
bash superpowers/tests/run.sh                 # hook smoke tests
git commit …
claude plugin marketplace update claudebro-mods && claude plugin update superpowers@claudebro-mods
```
then `/reload-plugins` in open sessions.

Upstream is tracked as `superpowers-extended-cc` in `upstream/` (baseline `cb12f4f`); the monthly
`check.sh` triages what pcvelz changed since, and the `port-upstream` skill brings a fix in.
