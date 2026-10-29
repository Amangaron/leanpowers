---
name: write-skill
description: Use when creating a new skill, editing an existing one, or checking that a skill works before relying on it.
---
If `skills.write-skill` is false in leanpowers.json, say "leanpowers: write-skill is disabled" and stop.

# Write a skill

A skill is a short, reusable instruction for a technique or discipline that agents do not follow reliably on their own. If it only records a one-off fix or a rule a linter can enforce, do not write a skill.

## Format

- Location: `skills/<name>/SKILL.md`. For project-specific skills, use a folder listed in `extraSkillDirs` in leanpowers.json (add the folder there first); the folder holds `<name>/SKILL.md`.
- Name: lowercase letters, digits and hyphens; verb-first or noun-led and short. Frontmatter `name` equals the folder name.
- `description`: starts with `Use when`, at most 60 words, describes only the triggering situation. Never summarize the workflow there; agents then follow the summary instead of reading the skill.
- First body line, exactly: `If \`skills.<name>\` is false in leanpowers.json, say "leanpowers: <name> is disabled" and stop.` Skills that should be off by default are switched through this line and the config default.
- Body at most 600 words. Move heavy reference, long templates and rare branches to `details/<topic>.md` and link them with the condition for reading them; details load only when needed.
- Write in English; user-facing answers stay in the user's language.

## Content rules

- Use actions, not tools: "dispatch a subagent at tier small|medium|large with template `agents/<name>.md`", "ask the user", "track tasks", "run `leanpowers check …`", "invoke the `<name>` skill". Never name a platform tool.
- No hard-coded locations. Refer to `paths.specs`, `paths.plans`, `paths.reports`, `paths.runs` and the run folder `<paths.runs>/<plan-basename>/`.
- Imperative, concrete, no filler. One good example beats three. State the iron rule once, then the steps, then the red flags.
- Discipline skills (rules agents are tempted to skip) need a short list of rationalizations and what to do instead. Technique skills need steps and a worked example.
- Prefer a deterministic check over a prose reminder: if `leanpowers check` can enforce it, point to the check.

## Validate

1. Run `leanpowers check --all`; fix every skill-lint finding (frontmatter, word limits, forbidden names and paths).
2. Test behavior: give a subagent a realistic pressure scenario once without the skill and once with it, and compare. Method and scenario design: [details/testing-skills.md](details/testing-skills.md).
3. Do not commit before both pass.

## Do not

- Ship an untested skill.
- Copy long passages from other skills or documentation; condense in your own words.
- Duplicate what a platform map or another skill already says; link to it by invoking that skill.
