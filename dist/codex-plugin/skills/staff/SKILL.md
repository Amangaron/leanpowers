---
name: staff
description: Use when an approved plan is about to be executed, or the user runs the staff command.
---
If `skills.staff` is false in leanpowers.json, say "leanpowers: staff is disabled" and stop.

CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.

# Staff

Decide who runs the plan: which tier orchestrates, and which tier implements and reviews each task. The cheapest tier that gets a task right in one attempt wins. How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder. `platform.md` or a template unreadable: name its path, ask the user for access and stop; never improvise its steps.

## Steps

1. **Run folder:** `<paths.runs>/<plan-basename>/`, never a temp folder or another plugin's folder; creating it needs no question. Create it if missing, with a `.gitignore` containing `*`. If it already holds `besetzung.md` and the plan has not changed since, reuse it; go to step 4 only if the user approved plan and staffing together, else to step 3.
2. **Recommend:** dispatch a subagent at tier small with template `<plugin>/prompts/staffer.md`, `{{plan}}` the plan path and `{{besetzung}}` `<run folder>/besetzung.md`.
3. **Show**, in every mode and before step 4, the recommendation to the user in three lines, in the plan approval message:
   - orchestrator tier and its reason;
   - task tiers in short, e.g. "implementers: 3 small, 2 medium; reviewers: medium, Task 4 large";
   - what happens next under the configured `orchestration` mode.
   If you change a tier the staffer recommended, name each change and its reason in these lines. Write every change, yours or the user's, into `besetzung.md`. Invoked directly, without that message: show the lines and wait for the user's yes before step 4.
4. **Start** by the `orchestration` value in leanpowers.json:
   - **`auto`, where the platform supports nested subagents:** dispatch a subagent at the orchestrator tier with template `<plugin>/prompts/orchestrator.md`, `{{plan}}` the plan path, `{{run}}` the run folder and `{{cli}}` the command from the `CLI:` line of the session or this skill, with absolute paths (none → `leanpowers`). Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim. Its prompt names no branch; the branch guard in `run` decides. When `git worktree list` shows a worktree on the plan's branch, name its root as the working directory and pass the run folder inside it. Do not read the plan or code yourself while it works. When it returns `NEEDS_USER`, ask the user its question faithfully in the user's language, then resume the orchestrator with the answer. When it returns `DONE`, report its summary to the user and invoke the `finish` skill, working in the worktree root if there is one. If it ends with neither, resume the same orchestrator once: "Your turn ended without a status line. Wait for your running subagents, then continue; the turn rule applies." Its subagents may still be working and report to it. Only if it cannot be resumed or ends with neither again, dispatch a fresh one with the same inputs, its prompt naming the ledger's last line; the ledger lets it resume. If that one also ends with neither, tell the user, give the ledger path and offer to continue with the `run` skill in this session.
   - **`switch`, or `auto` on a platform without nested subagents:** ask the user to switch this session to the model for the orchestrator tier, then invoke the `run` skill. If switching is impossible or the user declines, invoke `run` on the current model.
   - **`recommend`:** invoke the `run` skill on the current model.
5. In every mode the per-task tiers in `besetzung.md` apply: implementers and reviewers are dispatched at exactly those tiers. With a worktree, every dispatch names its root as the working directory and every `leanpowers` call runs there.
