---
name: start
description: Use when a session starts - explains when leanpowers workflows apply and lists its commands.
---
CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

Subagents ignore this text.

leanpowers workflow by size (unclear → larger), named first as `Size: small|medium|large`:
- Small (one file, clear fix): do it, `leanpowers check`.
- Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`, `finish`.
- Large (new feature or project, several areas, interfaces): `design` (spec), `plan`, `staff`, `run`, `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions win, but Medium needs design approval and Large plan approval before any code or subagent dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
