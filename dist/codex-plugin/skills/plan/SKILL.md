---
name: plan
description: Use when an approved spec or clear multi-step requirements need an implementation plan before code is touched, or the user runs the plan command.
---
If `skills.plan` is false in leanpowers.json, say "leanpowers: plan is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Plan

Turn the approved spec into a plan that subagents execute task by task. An implementer sees only its own task and the Global Constraints (cut out by `leanpowers brief`), never the spec or other tasks — so every task must stand on its own.

## Steps

1. **Scope.** One plan per independent subsystem; each plan yields working, tested software on its own. If the spec covers several, propose separate plans.
2. **Map files first.** List every file to create or modify with its one responsibility. Files that change together live together; follow existing patterns and `structure.rules` in leanpowers.json.
3. **Right-size tasks.** A task is the smallest unit with its own test cycle that a reviewer could reject while approving its neighbor. Fold setup, config and docs into the task that needs them.
4. **Mark every task.**
   - `**Risk:** high` for a shared contract, security, possible data loss or cross-module change; otherwise `low`. High-risk tasks are reviewed one by one, low-risk ones in batches.
   - `**Parallel:** true` only when the task's files are disjoint from those of every other parallel task.
   - List all files, tests included: changes outside the list fail the scope check.
5. **Write the content (token rule).** Tests in full code. Implementation as exact interfaces — names, signatures, types — plus the rules it must follow, not full code, unless it is trivial or the exact text is the point. An `**Interfaces:**` block names what the task consumes from earlier tasks and produces for later ones. Steps: write the failing test, run it (expected failure), implement, run it (expected pass), commit — each with its exact command. A test against a stored expected file gets an extra step to generate and review that file, see [Golden files](details/plan-format.md#golden-files).
6. **No placeholders.** No `TBD` or `TODO`, no "add error handling", no "similar to Task N", no name that no task defines.
7. **Save** to `paths.plans` as `YYYY-MM-DD-<topic>.md`; read [details/plan-format.md](details/plan-format.md) before writing the plan and follow it exactly. Copy the spec's project-wide rules verbatim into `## Global Constraints`. Without a spec file, write the requirements into Goal and Global Constraints and set `**Spec:**` to a one-line summary, e.g. `**Spec:** user request YYYY-MM-DD: <summary>`. Commit it.
8. **Check:** run `leanpowers check --all` and fix every doc-lint finding.
9. **Self-review:** point each spec requirement to a task and add tasks for gaps; make sure names, signatures and paths match across tasks.
10. **Ask the user to approve the plan.** Apply changes and repeat steps 8–9 until they do.
11. **Invoke the `staff` skill.**
