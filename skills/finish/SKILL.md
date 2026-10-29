---
name: finish
description: Use when implementation is complete and the branch needs to be merged, pushed as a pull request, kept or discarded.
---
If `skills.finish` is false in leanpowers.json, say "leanpowers: finish is disabled" and stop.

# Finish

Verify first, then let the user choose. Never push, merge or discard on your own.

## 1. Verify

Run `leanpowers check --all`. If it is not green, stop: show the user the findings and do not offer the options below. Fixing comes first (invoke the `debug` skill for failures you do not understand).

## 2. Establish the base

Find the branch this work started from (for a plan run, the run base recorded in the ledger; otherwise the nearest of `main` or `master`). If unsure, ask the user.

## 3. Offer exactly four options

Present these four, nothing more, and wait for the choice:

1. **Merge locally** into the base branch.
2. **Push and open a pull request.**
3. **Keep the branch** as it is; the user handles it later.
4. **Discard** the work.

## 4. Execute the choice

**Merge locally:** check out the base, update it if a remote exists, merge the feature branch, run `leanpowers check --all` again on the merged result. Green: delete the feature branch. Red: report, do not delete anything. Then clean up (step 5).

**Push and PR:** push the branch with upstream tracking, then open a pull request whose body has a short summary and a test plan taken from the plan and the check output. Show the user the PR link. Keep the worktree: review may need changes.

**Keep:** report the branch name and worktree location. Clean up nothing.

**Discard:** list what would be lost (branch, commits, worktree path) and ask the user to type the word `discard`. Anything else cancels. Only after that exact confirmation delete the branch and clean up.

## 5. Clean up

After a merge or confirmed discard only:

- If the work lives in a git worktree, leave it and run `git worktree remove <path>` from the main checkout.
- Remove the plan's run folder `<paths.runs>/<plan-basename>/` once the user has seen the final ruling lines and open minors (the `run` skill shows them before invoking this skill). Skip this when there is no run folder.

## Never

- Proceed with a red `leanpowers check --all`.
- Push, merge, force-push or delete a branch without the user's explicit choice.
- Discard without the typed confirmation.
- Remove a worktree or run folder after "keep" or "push and PR".
