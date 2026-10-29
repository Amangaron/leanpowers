Subagents ignore this text.

leanpowers picks the workflow by size; unclear size → next larger:
- Small (one file, clear fix): do it, then run `leanpowers check`.
- Medium (bounded change in existing code): `design` (short, in chat), user approval, one subagent, `leanpowers check`.
- Large (new feature or project, several areas, interfaces): `design` → `plan` → `staff` → `run` → `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions and explicit requests always win. Answer in the user's language.
CLI: run leanpowers as node "${extensionPath}/bin/leanpowers.mjs" (if `${extensionPath}` is not expanded, the extension folder is the one containing gemini-extension.json).
