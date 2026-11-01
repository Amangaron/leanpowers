---
name: design
description: Use when the user wants a new feature, a behavior change or a new project, or runs the design command - turns the idea into an approved design before any code is written.
---
If `skills.design` is false in leanpowers.json, say "leanpowers: design is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Design

**Gate:** write no code, dispatch no implementer, scaffold nothing and invoke no implementation skill until the user approves what you intend. This holds for every size; delegation rules decide who builds, not whether to approve. Only an explicit "implement directly" for this task skips it.

## 1. Classify

Apply the size rule; open your reply with the class in this exact form, in any language: "Size: medium — a bounded change to an existing flow."

- **Small:** one file, clear fix, no interface change.
- **Medium:** a bounded change to a flow that already exists in this repo. No existing flow → not medium.
- **Large:** new feature or project, a new command or data field, several areas, or changed interfaces.

Unsure → take the larger class. If hidden complexity shows up, stop, say so and step up; never step down. Each new request gets its own class and approval.

## 2. Small and medium

Read the relevant code; ask only questions that matter (Large step 2). Present the design in chat: small in one or two sentences; medium with approach, files touched and tests. **Stop and wait for an explicit yes.**

After approval: small → implement, then run `leanpowers check`. Medium → follow [details/medium.md](details/medium.md) step by step: branch, brief, base, dispatch, check, finish. No spec, no plan.

A linked file you cannot read: name its path, ask the user for access and stop; never improvise its steps.

## 3. Large

1. **Explore** files, docs and recent commits. If the request spans independent subsystems, help split it; each part gets its own design → plan → run cycle; design the first only.
2. **Ask** up to three independent questions per message, each multiple choice with your recommendation first; a question others depend on goes alone. Go on until purpose, constraints and success criteria are clear.
3. **Offer 2–3 approaches** with trade-offs; lead with your recommendation and why.
4. **Present the design in sections** (architecture, components, data flow, errors, testing) and get approval after each. Prefer small single-purpose units with clear interfaces; follow existing patterns; cut everything not needed now (YAGNI).
   This yes opens the spec, not the code: no implementer before an approved plan.
   Until the plan is approved, subagents may read, review or write the spec, plan and staffing, never code.
5. **Write the spec** to `paths.specs` as `YYYY-MM-DD-<topic>-design.md` (configured paths win over other plugins' folders and temp folders; creating them needs no question): a `# ` title, at least two `## ` sections, no placeholders, and only approvals the user gave. On the default branch, create and switch to `feat/<topic>` before committing, unless the user named a branch in their own words (chat, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`): then use it. Commit it.
6. **Check:** run `leanpowers check --all` and fix every doc-lint finding. Then reread the spec and fix contradictions and ambiguities inline.
7. **Ask the user to review the spec file.** Apply changes and repeat step 6 until they approve.
8. **Invoke the `plan` skill** — no other skill.

## Visual mockups

Only when `skills."design.visualCompanion"` is true in leanpowers.json and a question is visual: read [details/visual-companion.md](details/visual-companion.md) first.

## Red flags

- "Too simple to need a design" → then it is two sentences, still approved first.
- "I'll start while they read" → the gate is the yes, not the message.
- "Design approved, one implementer will do" → that is medium; large needs spec and plan.
- "Just one new command in the existing CLI" → a new command is large.
