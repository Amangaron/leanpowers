---
name: run
description: Use when an approved, staffed plan is to be executed task by task, or the user runs the run command.
---
If `skills.run` is false in leanpowers.json, say "leanpowers: run is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Run

Decide, dispatch, gate, log. Write no production code, fix nothing, narrate one line per step at most, never ask whether to continue.

## Setup

1. Run folder `<paths.runs>/<plan-basename>/`, ledger `progress.md`. Read [details/ledger.md](details/ledger.md) and [details/loops.md](details/loops.md) now.
2. Ledger exists → resume from it and the git log, not memory; never redo completed tasks. Otherwise apply the branch guard (ledger.md), then create the ledger.
3. Read the plan once and the tiers in `besetzung.md` (missing → medium). A task without `**Risk:**` counts as high. Track tasks.

## Per task

1. **Brief:** run `leanpowers brief --plan <plan> --task <n>`; it prints the brief path and records its base.
2. **Implement:** dispatch a subagent at the task's implementer tier with template `<plugin>/prompts/implementer.md`, filling `{{brief}}` and `{{report}}`. Add only earlier interfaces, rulings and deferred minors touching its files. Keep its identity. How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.
3. **Status:** DONE → gate; DONE_WITH_CONCERNS → settle correctness/scope concerns first; NEEDS_CONTEXT → answer, resume; BLOCKED → change context, tier, split or plan (ruling), never retry unchanged.
4. **Gate:** run `leanpowers check --plan <plan> --task <n>` yourself. Red → resume the same implementer with the output; cap, escalation and stop per loops.md. Never rule a red gate green.
5. **Review:** risk `high` → now; risk `low` → batched, reviewed once `review.batch` are gated, before the next high task, at the end. Write the diff from the first base commit to HEAD; dispatch a subagent at the reviewer tier (batch: highest among its tasks) with template `<plugin>/prompts/reviewer.md`: `{{brief}}`, `{{report}}` (lists for a batch), `{{diff}}`, `{{constraints}}` = the run folder's `constraints.md` path, `{{spec}}` = the plan's spec path, `{{sources}}` = the plan's sources or `none`, `{{review}}`. Never tell a reviewer what not to flag.
6. **Fixes:** Minor → ledger only; a finding against the plan text → ruling first. Critical or Important → review fix rounds per loops.md, then rule on each open finding.
7. **Complete:** log and mark it done. Start nothing new while a reviewed Critical or Important finding is open and unruled.

## Parallel

Parallel tasks run together only with disjoint allowed files, otherwise one at a time. Dispatch text and group gate: loops.md.

## Rulings, not stalls

Decide conflicts, ambiguities, plan defects and review caps yourself (spec outranks plan). Log `Ruling: <what> — <why> — <cost if wrong>`. Stop and ask the user only for: irreversible, destructive or security-sensitive actions, side effects outside the repo (push, publish, merge), a plan so broken every path is a guess, or a gate still red after escalation. Log `Stop: <question>` first; an orchestrator subagent then returns `NEEDS_USER`.

Dispatch subagents in the foreground and wait for each result, resumed ones too; never poll, never end the turn while one works. Dispatches carry file paths, never pasted history, diffs or reports; worktree and CLI rules: loops.md.

**Without subagents:** same loop in this session, playing each role from its template with only its inputs; same briefs, gates, ledger.

## End

1. **Final review:** diff from the run base to HEAD; reviewer at tier large with all briefs, reports and `{{ledger}}` = the ledger path.
2. **Fix wave** only if Critical or Important findings remain: one, per loops.md.
3. Run `leanpowers check --all`; red → gate rules, never `finish`.
4. Append the `Final:` lines (`Final: minor (deferred)`, `Final: Ruling:`; ledger.md), then run `leanpowers metrics --plan <plan>`.
5. Show the user every `Ruling:` line in order with its cost if wrong, plus open minors. Invoke the `finish` skill.
