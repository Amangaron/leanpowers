---
name: review
description: Use when a high-risk task, a batch of low-risk tasks or a whole branch is ready for independent review before moving on or merging, or when review findings arrive and must be handled.
---
If `skills.review` is false in leanpowers.json, say "leanpowers: review is disabled" and stop.

# Review

Review is done by a fresh subagent that sees the diff, never the author's reasoning. Deterministic gates (`leanpowers check`) run first; a reviewer judges what a script cannot.

Inside a run, `run`'s loop governs; this skill covers reviews outside a run and the rules for receiving feedback.

## Requesting

**When:** after each high-risk task; after a batch of low-risk tasks; once before merge, over the whole branch. Never review a task that fails its check.

**How:**
1. Write the diff to a file in the run folder (`<paths.runs>/<plan-basename>/`) with `git diff <base>..HEAD`. The task's base commit is recorded there; for a final review it is the base branch (use `git merge-base <base branch> HEAD`).
2. Dispatch a subagent at tier medium with template `agents/reviewer.md`. Use tier large for the final whole-branch review. Fill `{{brief}}`, `{{report}}`, `{{diff}}`, `{{constraints}}` (the Global Constraints copied verbatim, not summarized) and `{{review}}`.
3. Reviewers write to `<run folder>/review-<task or a-b>.md` (re-review round n: `review-<task or a-b>-r<n>.md`), so metrics can count them. For batch and final reviews `{{brief}}` is the list of the batch's brief paths and `{{report}}` the list of their report paths.
4. Fix Critical and Important findings before the next task. Resume the original implementer with the findings; do not fix them in the controller.
5. After the fix, dispatch a subagent at tier small with template `agents/re-reviewer.md`: `{{findings}}` the raised findings, `{{diff}}` only the fix range, `{{report}}` the report path. Do not repeat the full review.

## Receiving

Treat findings as claims to test, not orders.

1. Read all findings first, then verify each one against the actual code before acting.
2. Wrong or based on missing context → push back with evidence: file, line, test output or the constraint. Short and factual.
3. Right → fix it. Say what changed, not that the reviewer is right. No performative agreement, no thanks, no "great catch".
4. Unclear finding → ask for clarification before touching anything; never fix half of an unclear list.
5. Suggestions outside the task's scope (extra features, "while you are there") are declined unless the user asks.
6. Minor findings never block. Inside a run, append them to the ledger as deferred minors.
7. Fix one finding at a time and re-run the covering tests after each.

A review the user or a human reviewer wrote is handled the same way; the user's instructions win when they conflict with a finding.
