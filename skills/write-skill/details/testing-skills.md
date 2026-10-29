# Testing a skill

A skill is code for agents; test it the way you test code: watch it fail first.

## RED: baseline without the skill

1. Write 2-3 realistic scenarios in which an agent is tempted to break the rule. Add pressure: a deadline, sunk cost, an authority saying "just do it", exhaustion, a tempting shortcut. Combine at least three pressures in the hardest scenario.
2. Make the scenario concrete: a real file, a real choice, a forced answer ("choose A, B or C and act") rather than "what should you do?".
3. Dispatch a fresh subagent at tier small or medium with the scenario and without the skill.
4. Record verbatim what it did and the exact rationalizations it used ("too small to test", "I already checked manually"). These are your target; if the baseline already behaves correctly, you do not need the skill.

## GREEN: write the skill against the failures

1. Write the minimal skill that addresses the recorded failures. Do not add rules for failures you have not seen.
2. Re-run the same scenarios in a fresh subagent that is given the skill text.
3. It must now comply. If it does not, the skill is unclear or too long; fix the wording, not the scenario.

## REFACTOR: close the loopholes

1. Look at new rationalizations in the re-runs. Add each one to the skill with its counter: an explicit rule, a line in the rationalization list, a red-flag entry.
2. Re-run until a subagent under maximum pressure complies and, asked afterwards, can cite the skill's rule it followed.
3. Stop when two consecutive runs find nothing new.

## Checks per skill type

- **Discipline skills:** pressure scenarios as above. The test is whether the rule survives temptation.
- **Technique skills:** an application scenario (can it follow the steps on a new case?) plus an edge case with missing information.
- **Reference skills:** a retrieval scenario (does it find and apply the right section?) and a gap check.

## Practical notes

- Keep scenario files outside the skill folder; only the skill and its details ship.
- Compare token cost: the skill's addition to the agent's context must be worth the failures it prevents. Trim anything that did not change a result.
- Finish with `leanpowers check --all` before committing.
