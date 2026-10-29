---
name: worktrees
description: Use when starting feature work that should be isolated from the current workspace, or before executing a plan on a separate branch.
---
If `skills.worktrees` is false in leanpowers.json, say "leanpowers: worktrees is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Worktrees

A git worktree gives the work its own directory and branch while sharing the repository. This skill is off by default; it runs only when `skills.worktrees` is true.

## 1. Choose the location

1. If the user's instructions (CLAUDE.md, AGENTS.md, GEMINI.md, a direct request) name a location, use it.
2. Else if `.worktrees/` or `worktrees/` already exists in the project root, use it (`.worktrees/` wins if both exist).
3. Otherwise create `.worktrees/`.

## 2. Make sure it is ignored

Run `git check-ignore -q <folder>`. If it is not ignored, add the folder to `.gitignore` and, if the user's instructions allow commits, commit that change before creating the worktree; otherwise tell the user the ignore entry is uncommitted. A worktree folder that git would track pollutes every later commit.

## 3. Create it

- Branch name from the work: `feat/<topic>`, `fix/<topic>`.
- `git worktree add <folder>/<branch-name> -b <branch-name>`, then work inside it.
- If the project is already inside a worktree for this branch, or the user is already on a feature branch they want to keep using, do not create another.

## 4. Prepare

1. Install dependencies with the project's own tool (look for a lock file or the setup notes: npm, pnpm, yarn, pip, cargo, go, and so on).
2. Run `leanpowers check` as a baseline before any change.
3. Green: report the location and branch, then start. Red: show the failures to the user and ask whether to proceed or investigate first. A red baseline means later failures cannot be attributed.

## Cleanup

Removal belongs to the `finish` skill: after a merge or a confirmed discard it runs `git worktree remove <path>`. Do not remove a worktree with uncommitted work without asking.

## Mistakes to avoid

- Creating a worktree inside a tracked folder.
- Skipping the baseline check.
- Hard-coding setup commands instead of detecting the project's tooling.
- Leaving the branch checked out in two places at once; git forbids it, so use a new branch name.
