---
name: run
description: Use when an approved, staffed plan is to be executed task by task, or the user runs the run command - dispatches implementers and reviewers, gates every task and keeps the ledger.
---
If `skills.run` is false in leanpowers.json, say "leanpowers: run is disabled" and stop.

# Run

Decide, dispatch, gate, log. Write no production code, fix nothing, narrate one line per step at most, never ask whether to continue.

## Setup

1. Run folder `<paths.runs>/<plan-basename>/`, ledger `progress.md`; names, formats, resume rules: [details/ledger.md](details/ledger.md).
2. Ledger exists → resume from it and the git log, not memory; never redo completed tasks. Otherwise create it: first line names the plan, then the run base commit.
3. Read the plan once and the tiers in `besetzung.md` (missing → medium). Track tasks.

## Per task

1. **Brief:** run `leanpowers brief --plan <plan> --task <n>`; it prints the brief path, recording the base commit.
2. **Implement:** dispatch a subagent at the task's implementer tier with template `agents/implementer.md`, filling `{{brief}}` and `{{report}}`. Add only earlier interfaces, rulings and deferred minors touching its files. Keep its identity.
3. **Status:** DONE → gate; DONE_WITH_CONCERNS → settle correctness or scope concerns first; NEEDS_CONTEXT → answer, resume; BLOCKED → change context, tier, split or plan (ruling), never retry unchanged.
4. **Gate:** run `leanpowers check --plan <plan> --task <n>` yourself. Red → resume the same implementer with the output; still red after `review.maxFixRounds` resumes → rule.
5. **Review:** risk `high` → now; risk `low` → batched, reviewed once `review.batch` are gated, before the next high task, and at the end. Write the diff from the first base commit to HEAD; dispatch a subagent at the reviewer tier with template `agents/reviewer.md`: `{{brief}}`, `{{report}}` (lists for a batch), `{{diff}}`, `{{constraints}}` = Global Constraints verbatim, `{{review}}`. Never tell a reviewer what not to flag.
6. **Fixes:** Minor → ledger only; a finding against the plan text → ruling first. Critical or Important, round r: note HEAD, resume the owning implementer with the review path (or a fresh one: brief, report, findings). Once green, write the diff from the noted commit to HEAD and dispatch a subagent at tier small with template `agents/re-reviewer.md`: `{{findings}}` = previous review, `{{diff}}`, `{{report}}`, `{{review}}`. New Critical or Important problems join the open list. Log the round. After `review.maxFixRounds` rounds, rule on each open finding: park it, or order the smallest change dependent tasks need.
7. **Complete:** log and mark it done. Start nothing new while a reviewed Critical or Important finding is unfixed and unruled.

## Parallel

Tasks marked parallel run together only with disjoint allowed files; otherwise one implementer at a time. Tell each its siblings' files are off limits and scope findings on them expected; gate the group when all return, ignoring only those findings.

## Rulings, not stalls

Decide conflicts, ambiguities, plan defects and caps yourself (spec outranks plan). Log `Ruling: <what> — <why> — <cost if wrong>`. Stop and ask the user only for: irreversible or destructive actions, security-sensitive actions, side effects outside the repo (push, publish, merge), or a plan so broken every path is a guess. An orchestrator subagent returns `NEEDS_USER` instead.

Dispatches carry file paths, never pasted history, diffs or reports.

**Without subagents:** same loop in this session, playing each role from its template with only its inputs; same briefs, gates, ledger.

## End

1. **Final review:** diff from the run base to HEAD; reviewer at tier large with all briefs, reports and the ledger path for triaging deferred minors.
2. **One fix wave:** write `task-final-brief.md`; one implementer at tier medium; one re-review; rule on what remains.
3. Run `leanpowers check --all` (must print the ok line), then `leanpowers metrics --plan <plan>`.
4. Show the user every `Ruling:` line in order with its cost if wrong, and the open minors. Invoke the `finish` skill.
