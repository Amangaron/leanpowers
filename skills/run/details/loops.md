# Gate and fix loops

Both loops are capped at `review.maxFixRounds` and counted separately: gate retries and review rounds each have their own ledger line (see [ledger.md](ledger.md)).

## Dispatches and the CLI

- With a worktree, every dispatch names its root as working directory, and every `leanpowers` call runs there.
- The plugin's CLI may not be on PATH: inside an orchestrator, run `leanpowers brief`, `check` and `metrics` as `{{cli}}`; in the session, as the `CLI:` line names it. Briefs and dispatch texts you write by hand (final fix wave, substitute gate) name the command the same way, with absolute paths. Briefs from `leanpowers brief` already do.

## Gate

- **Normal gate:** `leanpowers check --plan <plan> --task <n>`.
- **Substitute gate:** when later tasks are already committed after task n (a review fix for any task of a batch but the newest), the task check compares everything since n's base against n's allowed files and can never pass. Instead run `leanpowers check` (test gates only) and confirm from the git range that every file changed since the noted commit is one of n's allowed files.
- **Red:** resume the same implementer with the check output; log `gate retry <r>/<max>`.
- **Red after the cap:** escalate once — dispatch a fresh implementer one tier up with the brief, the report and the check output ("a prior implementer tried r times; read the report first"), or split the task by ruling. Log `gate escalated`.
- **Still red:** stop. An orchestrator subagent writes the `Stop:` line and returns `NEEDS_USER`; in the session, ask the user. A red deterministic gate is never ruled green, skipped or parked.

## Review fix rounds

1. Note HEAD. Resume the implementer that owns the files with the review file path; if it cannot be resumed, dispatch a fresh one with brief, report and the review path.
2. When the substitute gate applies, the dispatch says so explicitly: "Later tasks are committed, so your brief's When-done check cannot pass. Change only your allowed files; run `leanpowers check` instead and commit when it is green."
3. Run the gate (normal or substitute) yourself; red → gate rules above.
4. Write the diff from the noted commit to HEAD into `review-<id>-r<r>.diff`. Dispatch a subagent at tier small with template `agents/re-reviewer.md`: `{{findings}}` = the previous review file, `{{diff}}`, `{{report}}`, `{{review}}` = `review-<id>-r<r>.md`.
5. New Critical or Important problems in the fix diff join the open list. Log `review round <r>/<max>`.
6. After the cap, rule on each open finding: park it, or order the smallest change that dependent tasks need and carry it into their dispatch.

## Parallel tasks

Each parallel implementer's dispatch adds: "Tasks <list> run at the same time on files <list>; never touch them. Stage only your allowed files, by path; never stage everything. Scope findings on those files, and test failures caused by their unfinished work, are expected in your own check; the group gate decides."

When all have returned, run each task's normal gate. Ignore only scope findings on a sibling's allowed files; the test gates must be green.

## Final fix wave

Only when the final review leaves Critical or Important findings; deferred minors it marked `fix now` join the wave but never start one. Write `task-final-brief.md` (shape in [ledger.md](ledger.md)), dispatch one implementer at tier medium with report `task-final-report.md`, gate with `leanpowers check --all`, then one re-review into `review-final-r1.md`. Rule on what remains; there is no second wave.

`leanpowers check --all` red, here or at the end → the gate rules above apply (retry, escalate, stop). Never invoke `finish` while it is red; report the red check and the ledger path to the user instead.
