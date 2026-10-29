---
name: tdd
description: Use when implementing any feature, bugfix or behavior change, before writing production code.
---
If `skills.tdd` is false in leanpowers.json, say "leanpowers: tdd is disabled" and stop.

# Test-driven development

**Iron rule:** no production code without a failing test first. A test written after the code proves nothing, because it never had a chance to fail.

## Cycle

1. **Red.** Write one small test for one behavior, with a name that states the behavior. Prefer real code over mocks.
2. **Verify red.** Run it. It must fail, and for the right reason: the behavior is missing, not a typo, an import error or a broken setup. A test that passes at once tests existing behavior; fix the test.
3. **Green.** Write the simplest code that makes the test pass. Nothing the test does not demand: no options, no generality, no extras.
4. **Verify green.** Run the test and the rest of the suite. All pass, output clean. A failure means fix the code, not the test.
5. **Refactor.** Only when green: remove duplication, improve names. Do not add behavior. Run the tests again.
6. Repeat for the next behavior.

## Code written before its test

Delete it. Do not keep it as a reference, do not adapt it while writing the test, do not "test it afterwards". Start from the test and write the code again; it is quick, and the rewrite is shaped by the test.

## Bugs

Reproduce the bug in a failing test first, then fix it. The test stays as the regression guard.

## Evidence

Keep the RED and GREEN commands with the relevant output lines for the report.

## Excuses that mean stop

"Too simple to test", "I'll add tests after", "I tested it by hand", "deleting would be a waste", "this is different". All of them mean the same: delete the code and start with the test.

## Exceptions

Throwaway prototypes, generated code and pure configuration. Only with the user's consent; ask the user and say which exception you want. Without consent the rule holds.

## Before you finish

- Every new function or behavior has a test that was seen failing first.
- Tests cover edge cases and error paths, not only the happy path.
- Output is pristine: no warnings or stray logs.
- Then run the `verify` skill.
