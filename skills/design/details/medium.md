# Medium brief

Write `<paths.runs>/YYYY-MM-DD-<topic>/task-1-brief.md` (a new folder gets a `.gitignore` containing `*`):

- `## Allowed files`: one `- <path>` line per file, tests included. `leanpowers.json` is the user's
  configuration: list it only when the user asked for that change.
- `## Global constraints`: the user's project rules.
- `## Structure rules`: the `structure.rules` that match the allowed files, then `New folders: <structure.newFolders>`.
  With `ask`, a folder that does not exist yet needs the user's yes in the approved design; list those folders
  as `Approved new folders: <folders>`.
- `## Task`: the approved design.
- `## When done`: run the `check` command as the `CLI:` line names it, with absolute paths (none →
  `leanpowers check`), in the form `<cli> check --brief <brief path>`; write it out in every call, never store
  it in a shell variable. Commit with `<type>: <topic>`, one commit. Write the report to `task-1-report.md` in
  the same folder.

Then run `leanpowers brief --file <brief path>`: it records the base commit the check compares against.
