---
name: design
description: Use when the user wants a new feature, a behavior change or a new project, or runs the design command - turns the idea into an approved design before any code is written.
---
If `skills.design` is false in leanpowers.json, say "leanpowers: design is disabled" and stop.

# Design

**Gate:** write no code, dispatch no subagent, scaffold nothing and invoke no implementation skill until the user has approved what you intend. This holds for every size and whatever delegation rules say: they decide who builds, not whether to approve. Only an explicit "implement directly" for this task skips it.

## 1. Classify

Apply the size rule; open your reply with the class in this exact form, in any language, so the user can override it: "Size: medium — a bounded change to existing code, so a short design here, no spec."

- **Small:** one file, clear fix, no interface change.
- **Medium:** a bounded change to a flow that already exists in this repo. No existing flow → not medium.
- **Large:** new feature or project, several areas, or changed interfaces.

Unsure → take the larger class. If hidden complexity shows up later, stop, say so and step up; never step down. Each new request gets its own class and its own approval.

## 2. Small and medium

Read the relevant code and ask only the questions that matter, one at a time. Present the design in chat — for small one or two sentences; for medium the approach, files touched and how it is tested. **Stop and wait for an explicit yes.** Presenting and starting in the same message skips the gate.

After approval: small → implement, then run `leanpowers check`. Medium → write the brief as [details/medium.md](details/medium.md) says and run `leanpowers brief --file <brief>` to record its base. Dispatch a subagent at tier medium with template `prompts/implementer.md`, `{{brief}}` that file and `{{report}}` the report path. Handle its status as `run` does (per task, step 3), run `leanpowers check --brief <brief>` yourself, then invoke the `finish` skill. No spec, no plan.

## 3. Large

1. **Explore** files, docs and recent commits. If the request spans independent subsystems, say so first and help split it; each part gets its own design → plan → run cycle. Design the first part only.
2. **Ask** one question per message, multiple choice when possible, until purpose, constraints and success criteria are clear.
3. **Offer 2–3 approaches** with trade-offs; lead with your recommendation and why.
4. **Present the design in sections** (architecture, components, data flow, errors, testing), each sized to its complexity, and get approval after each. Prefer small units with one purpose and clear interfaces; follow existing patterns; cut everything not needed now (YAGNI).
   This yes opens the spec, not the code: no implementer before an approved plan.
5. **Write the spec** to `paths.specs` as `YYYY-MM-DD-<topic>-design.md`: a `# ` title, at least two `## ` sections, no placeholders. Commit it.
6. **Check:** run `leanpowers check --all` and fix every doc-lint finding. Then read the spec once for contradictions and requirements that allow two readings; fix them inline.
7. **Ask the user to review the spec file.** Apply requested changes and repeat step 6 until they approve.
8. **Invoke the `plan` skill** — no other skill.

## Visual mockups

Only when `skills."design.visualCompanion"` is true in leanpowers.json and a question is genuinely visual: read [details/visual-companion.md](details/visual-companion.md) first.

## Red flags

- "Too simple to need a design" → then the design is two sentences; the approval still applies.
- "I'll call it medium to skip the spec" → that doubt means large.
- "I'll start while they read" → the gate is the yes, not the message.
- "Design approved, one implementer will do" → that is medium; large needs spec and plan.
