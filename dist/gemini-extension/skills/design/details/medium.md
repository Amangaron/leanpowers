# Medium path

After the user approved the design, in this order:

1. **Branch:** if HEAD is on the repository's default branch (the remote's HEAD branch, else `main` or `master`),
   create and switch to `feat/<topic>`. A branch the user named wins.
2. **Brief:** write `<paths.runs>/YYYY-MM-DD-<topic>/task-1-brief.md`. Configured paths win over other plugins'
   folders and temp folders; creating them needs no question. A new run folder gets a `.gitignore` containing `*`.
   - `## Allowed files`: one `- <path>` line per file, tests included. `leanpowers.json` is the user's
     configuration: list it only when the user asked for that change.
   - `## Global constraints`: the user's project rules.
   - `## Structure rules`: the `structure.rules` that match the allowed files, then
     `New folders: <structure.newFolders>`. With `ask`, a folder that does not exist yet needs the user's yes in the
     approved design; list those folders as `Approved new folders: <folders>`.
   - `## Task`: the approved design.
   - `## When done`: run the `check` command as the `CLI:` line names it, with absolute paths (none →
     `leanpowers check`), in the form `<cli> check --brief <brief path>`. Write every shell command and path out in
     full; never store a command or path in a shell variable. Commit with `<type>: <topic>`, one commit. Write the
     report to `task-1-report.md` in the same folder.
3. **Base:** run `leanpowers brief --file <brief path>`; it records the base commit the check compares against.
4. **Dispatch** a subagent at tier medium with template `<plugin>/prompts/implementer.md`, `{{brief}}` the brief path and
   `{{report}}` the report path. Handle its status as `run` does (per task, step 3).
5. **Check:** run `leanpowers check --brief <brief path>` yourself. Red → resume the same implementer with the output.
6. **Finish:** invoke the `finish` skill, also when a commit failed (for example because git is read-only).
