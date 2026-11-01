---
name: design
description: Use when the user wants a new feature, a behavior change or a new project, or runs the design command - turns the idea into an approved design before any code is written.
---
If `skills.design` is false in leanpowers.json, say "leanpowers: design is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Design

**Gate:** write no code, dispatch no implementer, scaffold nothing and invoke no implementation skill until the user has approved what you intend. This holds for every size and whatever delegation rules say: they decide who builds, not whether to approve. Only an explicit "implement directly" for this task skips it.

## 1. Classify

Apply the size rule; open your reply with the class in this exact form, in any language, so the user can override it: "Size: medium — a bounded change to existing code, so a short design here, no spec."

- **Small:** one file, clear fix, no interface change.
- **Medium:** a bounded change to a flow that already exists in this repo. No existing flow → not medium.
- **Large:** new feature or project, a new command or data field, several areas, or changed interfaces.

Unsure → take the larger class. If hidden complexity shows up later, stop, say so and step up; never step down. Each new request gets its own class and its own approval.

## 2. Small and medium

Read the relevant code and ask only the questions that matter, as in Large step 2. Present the design in chat: small in one or two sentences; medium with approach, files touched and tests. **Stop and wait for an explicit yes.** Presenting and starting in the same message skips the gate.

After approval: small → implement, then run `leanpowers check`. Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.

## 3. Large

1. **Explore** files, docs and recent commits. If the request spans independent subsystems, say so first and help split it; each part gets its own design → plan → run cycle. Design the first part only.
2. **Ask** up to three independent questions per message, each multiple choice with your recommendation first; a question others depend on goes alone. Go on until purpose, constraints and success criteria are clear.
3. **Offer 2–3 approaches** with trade-offs; lead with your recommendation and why.
4. **Present the design in sections** (architecture, components, data flow, errors, testing), each sized to its complexity, and get approval after each. Prefer small units with one purpose and clear interfaces; follow existing patterns; cut everything not needed now (YAGNI).
   This yes opens the spec, not the code: no implementer before an approved plan.
   Until the plan is approved, subagents may read, review or write the spec and plan, never code.
5. **Write the spec** to `paths.specs` as `YYYY-MM-DD-<topic>-design.md` (configured paths win over other plugins' folders and temp folders; creating them needs no question): a `# ` title, at least two `## ` sections, no placeholders, and only approvals the user gave. Commit it.
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
