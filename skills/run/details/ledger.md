# Ledger format

`<run folder>/progress.md` is the run's memory. It survives a lost context; your recollection does not. Append one line per event, in the order events happen; never rewrite earlier lines.

## Header

```markdown
# leanpowers ledger — plan: <plan path>

Run base: <sha7> · Branch: <branch>

## Tasks
```

The first line names the plan. Every later line goes under `## Tasks`.

## Run folder files

`<id>` is the task `<n>`, a batch `<a>-<b>` (first and last task) or `final`.

| File | Content |
|---|---|
| `besetzung.md` | tiers from the staffer |
| `task-<n>-brief.md`, `task-<n>-base.txt` | written by `leanpowers brief`; the base commit is recorded on the first call only |
| `task-<n>-report.md` | implementer report (`{{report}}`) |
| `review-<id>.diff`, `review-<id>.md` | diff and review |
| `review-<id>-r<r>.diff`, `review-<id>-r<r>.md` | fix round r: fix diff and re-review |
| `task-final-brief.md` | final fix wave, in the shape of a task brief: the open Critical and Important findings as the task, the files they name under `## Allowed files`, the Global Constraints verbatim, `leanpowers check --all` under `## When done`, commit message `fix: final review findings` |
| `task-final-report.md` | report of the final fix wave |

## Lines

| Event | Line |
|---|---|
| Low-risk task gated green, waiting for its batch review | `Task <n>: gated (commits <base7>..<head7>)` |
| Fix round finished (gate or review) | `Task <n>: fix round <r>/<max> (<x> addressed, <y> open — <one-liners>; commits <a7>..<b7>)` |
| Minor finding deferred | `Task <n>: minor (deferred): <one-liner>` |
| Open finding parked at the cap | `Task <n>: parked — <finding> — Ruling: <why the code stands> — <cost if wrong>` |
| Ruling | `Ruling: <what> — <why> — <cost if wrong>`, prefixed with `Task <n>: ` when it belongs to one task |
| User answer to a stop question | `Ruling: <answer> — user decided — <cost if wrong>` |
| Task complete | `Task <n>: complete (commits <base7>..<head7>, review clean)` or `…, <k> parked)` |
| Final review and fix wave | `Final: review <APPROVED or CHANGES REQUESTED>, fix wave <a7>..<b7>, <k> parked` |
| Final check | `Final: <exact output line of leanpowers check --all>` |

For a batch, write one `complete` line per task once the batch review is clean or ruled. Every line holding `Ruling:` is reported to the user at the end.

## Resume

- `complete` → done; never dispatch it again.
- `gated` as last line → implemented and gated; it waits for its batch review.
- `fix round <r>/<max>` as last line → continue with round r+1, or rule if r equals max.
- `task-<n>-base.txt` exists but no line → the task started: look for its commits since that base and for its report file. Work present → gate it; otherwise resume or re-dispatch the implementer.
- No line and no base file → not started.

## Metrics

`leanpowers metrics --plan <plan>` writes the `## Metrics` section itself (briefs, reports and reviews with word counts) and replaces it when run again. Never write it by hand. It replaces everything from its heading to the next `## ` heading, so run it only at the end and append nothing below it.
