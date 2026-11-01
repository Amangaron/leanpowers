---
name: verify
description: Use when about to say work is done, fixed, passing or ready, before any completion claim, commit, pull request or handoff.
---
If `skills.verify` is false in leanpowers.json, say "leanpowers: verify is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Verify

**Iron rule:** no completion claim without fresh evidence from this turn. Evidence comes from running the check, not from remembering or inferring. Claiming success without it is a false report, not a shortcut.

## Evidence

- Run `leanpowers check`, which runs the configured gates (tests, typecheck, lint); `--all` adds doc-lint and skill-lint. It is the deterministic judge; your own confidence is not.
- Inside a run, use the task form from the brief's "When done": `leanpowers check --plan <plan> --task <n>`. It adds scope and structure checks.
- For a medium task, use `leanpowers check --brief <brief>`.
- Before a branch is finished, run `leanpowers check --all`.
- A task that changes behavior also needs its test run directly, to see the specific RED and GREEN lines.

## Steps

1. Name the claim you are about to make ("tests pass", "bug fixed", "task complete").
2. Run the command that proves exactly that claim, in full, now.
3. Read the whole output and the exit status. Count failures; do not skim.
4. Quote the exact output line in your report, for example `✔ leanpowers check: ok (…)`. If it shows findings or a failure, state the real status and fix them first.
5. Only then make the claim, and make it no wider than the evidence.

## What does not count as evidence

- An earlier run, before later edits.
- A passing run of a different, narrower command.
- A subagent's report that says it passed. Check the diff and the check output yourself.
- A clean linter, which says nothing about tests; passing tests, which say nothing about the requirements.

## Words that mean stop

"Should pass", "probably", "seems to", "looks right", "I'm confident", "just this once". Any of these before a run means run first.

## Specific claims

- **Bug fixed:** the original reproduction passes now, and a regression test that failed before the fix passes.
- **Requirements met:** compare the task text line by line against the diff; a green check does not do this for you.
- **Delegated work done:** inspect the diff and re-run the check; trust the evidence rather than the status message.
