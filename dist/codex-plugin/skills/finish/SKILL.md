---
name: finish
description: Use when implementation is complete and the branch needs to be merged, pushed as a pull request, kept or discarded.
---
If `skills.finish` is false in leanpowers.json, say "leanpowers: finish is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Finish

Verify first, then let the user choose. Never push, merge or discard on your own.

## 1. Verify

Run `leanpowers check --all`. If it is not green, show the user the findings. Merge and pull request stay blocked until it is green (fix first; invoke the `debug` skill for failures you do not understand). The user may still explicitly choose to keep the branch or to discard it.

## 2. Establish the base

Find the branch this work merges into. For a plan run, read it from the ledger's `Base branch:` line (not a commit); otherwise take the nearest of `main` or `master`. If unsure, ask the user.

## 3. Offer exactly four options

Present these four, nothing more (while the check is red, mark options 1 and 2 as blocked), and wait for the choice:

1. **Merge locally** into the base branch.
2. **Push and open a pull request.**
3. **Keep the branch** as it is; the user handles it later.
4. **Discard** the work.

## 4. Execute the choice

**Merge locally:** from the main checkout (not inside the worktree), check out the base, update it if a remote exists, merge the feature branch, run `leanpowers check --all` again on the merged result. Red: report, delete and remove nothing. Green: clean up (step 5), which ends with the safe branch delete (`git branch -d`).

**Push and PR:** push the branch with upstream tracking, then open a pull request whose body has a short summary and a test plan taken from the plan and the check output. Show the user the PR link. Keep the worktree: review may need changes.

**Keep:** report the branch name and worktree location. Clean up nothing.

**Discard:** list what would be lost (branch, commits, worktree path) and ask the user to type the word `discard`. Anything else cancels. Only after that exact confirmation clean up (step 5), ending with a force delete (`git branch -D`).

## 5. Clean up

After a merge or confirmed discard only:

- If the work lives in a git worktree, remove it first: run `git worktree remove <path>` from the main checkout. Git refuses to delete a branch that is still checked out in a worktree.
- Then delete the feature branch: `git branch -d` after a merge, `git branch -D` only after the typed `discard`.
- Remove the plan's run folder `<paths.runs>/<plan-basename>/` once the user has seen the final ruling lines and open minors (the `run` skill shows them before invoking this skill). Skip this when there is no run folder.

## Never

- Merge or open a pull request with a red `leanpowers check --all`.
- Push, merge, force-push or delete a branch without the user's explicit choice.
- Discard without the typed confirmation.
- Remove a worktree or run folder after "keep" or "push and PR".
