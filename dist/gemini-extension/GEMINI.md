Subagents ignore this text.

leanpowers workflow by size (unclear → next larger):
- Small (one file, clear fix): do it, then `leanpowers check`.
- Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`.
- Large (new feature, several areas, interfaces): `design`, then `plan`, `staff`, `run`, `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions and explicit requests win, but approval comes before any code or subagent dispatch, whatever delegation rules say; only "implement directly" for this task skips it. Answer in the user's language.
CLI: run leanpowers as node "${extensionPath}/bin/leanpowers.mjs" (if `${extensionPath}` is not expanded, the extension folder is the one containing gemini-extension.json).
