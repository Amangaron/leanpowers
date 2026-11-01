# Ledger format

`<run folder>/progress.md` is the run's memory. It survives a lost context; your recollection does not. Append one line per event, in the order events happen; never rewrite earlier lines.

## Branch guard and worktree

Before creating the ledger:

1. If `git worktree list` already shows a worktree on this plan's branch, continue there and resume from the ledger in its run folder.
2. If HEAD is on the repository's default branch (the remote's HEAD branch, else `main` or `master`): when `skills.worktrees` is true, invoke the `worktrees` skill; otherwise create and switch to `feat/<plan-topic>`. Log it as a ruling. User instructions that name a branch or allow work on the default branch win; a branch named in the plan's Global Constraints, the default branch included, counts like a user instruction.
3. With a worktree, the run folder is the one inside the worktree root: copy `besetzung.md` there before writing the ledger. From then on every dispatch (implementers, reviewers, re-reviewers, the final fix wave) names the worktree root as the working directory, and every `leanpowers` call runs there.

## Header

```markdown
# leanpowers ledger — plan: <plan path>

Run base: <sha7> · Base branch: <name> · Branch: <branch> · Worktree: <path or none>

## Tasks
```

The first line names the plan. `Base branch` is the branch you started from: the one the guard switched away from, or, when no switch was needed, the default branch unless user instructions name another. `finish` merges into it. Extra sections such as `## Notes` go between the header line and `## Tasks`; every later line goes under `## Tasks`, and the metrics section stays last.

## Run folder files

`<id>` is the task `<n>`, a batch `<a>-<b>` (first and last task) or `final`.

| File | Content |
|---|---|
| `besetzung.md` | tiers from the staffer |
| `task-<n>-brief.md`, `task-<n>-base.txt` | written by `leanpowers brief`; the base commit is recorded on the first call only; `--reset-base` rewrites it with the current HEAD |
| `task-<n>-report.md` | implementer report (`{{report}}`) |
| `review-<id>.diff`, `review-<id>.md` | diff and review |
| `review-<id>-r<r>.diff`, `review-<id>-r<r>.md` | review round r: fix diff and re-review |
| `task-final-brief.md` | final fix wave, in the shape of a task brief: the open Critical and Important findings (plus minors marked `fix now`) as the task, the files they name under `## Allowed files`, the Global Constraints verbatim, `leanpowers check --all` under `## When done`, commit message `fix: final review findings` |
| `task-final-report.md` | report of the final fix wave |

## Lines

`<n>` in a review line may be a batch `<a>-<b>`.

| Event | Line |
|---|---|
| Task base reset | `Task <n>: base reset (<sha7>) — <why>` |
| Implementer dispatched, written before each implementer dispatch | `Task <n>: implementer dispatched (<name>)`, with the name the dispatch gives the agent where the platform takes one, else `-` |
| Implementer id, written as soon as the dispatch returns the agent's id | `Task <n>: implementer id <id>` |
| Task gated green (any risk) | `Task <n>: gated (commits <base7>..<head7>)` |
| Red gate sent back | `Task <n>: gate retry <r>/<max> (<one-liner>)` |
| Gate escalated after the cap | `Task <n>: gate escalated (<fresh implementer at tier X, or split>)` |
| Review fix round finished | `Task <n>: review round <r>/<max> (<x> addressed, <y> open — <one-liners>; commits <a7>..<b7>)` |
| Minor finding deferred | `Task <n>: minor (deferred): <one-liner>` |
| Open finding parked at the cap | `Task <n>: parked — <finding> — Ruling: <why the code stands> — <cost if wrong>` |
| Ruling | `Ruling: <what> — <why> — <cost if wrong>`, prefixed with `Task <n>: ` when it belongs to one task |
| Stop for the user, written before asking or returning `NEEDS_USER` | `Stop: <the question>` |
| User answer to a stop question | `Ruling: <answer> — user decided — <cost if wrong>` |
| Task complete | `Task <n>: complete (commits <base7>..<head7>, review clean)` or `…, <k> parked)` |
| Final review | `Final: review APPROVED, no fix wave` or `Final: review CHANGES REQUESTED, fix wave <a7>..<b7>, <k> parked` |
| Final minor deferred | `Final: minor (deferred): <one-liner>` |
| Final ruling | `Final: Ruling: <what> — <why> — <cost if wrong>` |
| Final check | `Final: <exact output line of leanpowers check --all>` |

For a batch, write one `complete` line per task once the batch review is clean or ruled. Every line holding `Ruling:` is reported to the user at the end.

## Resume

Read each task's last line, not the file's last line.

- `complete` → done; never dispatch it again.
- `gated` → implemented and gated. If its review file exists, act on that review (fix loop or complete); never re-review from scratch. Otherwise high risk → review now; low risk → it waits for its batch.
- `gate retry <r>/<max>` → gate again; red → retry r+1, or escalate if r equals max.
- `gate escalated` → gate the escalated work; still red → stop.
- `review round <r>/<max>` → continue with round r+1, or rule if r equals max.
- `implementer dispatched`, or `task-<n>-base.txt` exists but no line → the task started: look for its commits since that base and for its report file. Work present → gate it; otherwise resume the implementer named by its `implementer id` line, else by its dispatched line; re-dispatch only when it cannot be resumed.
- No line and no base file → not started.
- Reset a base (`leanpowers brief --reset-base`) only after a plan correction and before the task has commits; log `base reset` together with a `Ruling:` line.
- `Stop: <question>` with no user-answer ruling after it → if the answer came with your dispatch or resume, log it as a ruling and continue; otherwise ask the same question again (an orchestrator subagent returns `NEEDS_USER`).

## Report

`leanpowers report --plan <plan>` copies the header line, every `Ruling:`, `minor (deferred)`, `parked`, `Stop:` and `Final:` line and the `## Metrics` section into `<paths.reports>/<plan-basename>.md`. Run it after `metrics` and commit the file; `finish` removes the run folder only when it exists.

## Metrics

`leanpowers metrics --plan <plan>` writes the `## Metrics` section itself (briefs, reports and reviews with word counts) and replaces it when run again. Never write it by hand. It replaces everything from its heading to the next `## ` heading, so append the `Final:` lines first, run it only at the end and append nothing below it.
