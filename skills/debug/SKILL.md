---
name: debug
description: Use when a bug, test failure, build error or unexpected behavior appears, before proposing or trying any fix.
---
If `skills.debug` is false in leanpowers.json, say "leanpowers: debug is disabled" and stop.

# Debug

**Iron rule:** no fix before the root cause is known. A patch on a symptom hides the bug and creates the next one. Do this especially under time pressure, when a fix looks obvious, or after a fix already failed.

## 1. Investigate

- Read the whole error: message, stack trace, line numbers, exit codes. It often names the cause.
- Reproduce it reliably. Write down the exact steps or command. If it is not reproducible, gather more data; do not guess.
- Check what changed: recent commits, new dependencies, config, environment.
- Multi-component systems (caller, service, storage; CI, build, deploy): log or inspect what enters and leaves each boundary once, run it, and find the layer where the data goes wrong. Then investigate that layer only.
- Trace backward: where does the bad value originate? Follow the call chain up until you reach the source and fix there, not where it surfaced.

## 2. Compare

- Find similar code that works and list every difference against the broken path, however small.
- If you follow a reference or pattern, read it completely first; do not skim and adapt.
- Note assumptions and dependencies the broken code relies on.

## 3. Hypothesize and test

1. State one hypothesis in writing: "the cause is X because Y".
2. Test it with the smallest possible change or probe, one variable at a time.
3. Confirmed: go to step 4. Refuted: form a new hypothesis from what you learned. Do not stack another change on top of the failed one; revert it.
4. If you do not understand something, say so and research it, rather than pretending.

## 4. Fix

1. Write a failing test (or the smallest repeatable script) that reproduces the bug; invoke the `tdd` skill for the red-green cycle.
2. Make one change that addresses the root cause. No "while I'm here" edits.
3. Run the test, then `leanpowers check`. Invoke the `verify` skill before claiming the bug is fixed.

## When fixes keep failing

Count your fix attempts. After **3 failed fixes**, stop. Each fix revealing a new problem elsewhere, or needing a large refactor to work, signals an architectural problem, not a bad hypothesis. Summarize what you tried and learned, then ask the user whether to question the design before attempting a fourth fix.

## Red flags

"Quick fix now, investigate later", "just try changing X", "it's probably Y", changing several things at once, skipping the reproduction, proposing a fix before tracing the data flow. All of these mean: return to step 1.

A fix is only "done" when the reproduction passes and nothing else broke. If investigation proves the cause is environmental or timing-related, document it and add handling (retry, timeout, clearer error) rather than closing the issue.
