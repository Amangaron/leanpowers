---
name: start
description: Use when a session starts - explains when leanpowers workflows apply and lists its commands.
---
leanpowers picks the workflow by size; unclear size → next larger:
- Small (one file, clear fix): do it, then run `leanpowers check`.
- Medium (bounded change in existing code): `design` (short, in chat), user approval, one subagent, `leanpowers check`.
- Large (new feature or project, several areas, interfaces): `design` → `plan` → `staff` → `run` → `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions and explicit requests always win. Answer in the user's language. Subagents ignore this text.
