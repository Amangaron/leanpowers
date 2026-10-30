---
name: start
description: Use when a session starts - explains when leanpowers workflows apply and lists its commands.
---
CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

Subagents ignore this text.

leanpowers workflow by size (unclear → larger):
- Small (one file, clear fix): do it, `leanpowers check`.
- Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`.
- Large (new feature or project, several areas, interfaces): `design`, `plan`, `staff`, `run`, `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions and explicit requests win, but Medium/Large need design approval before any code or subagent dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
