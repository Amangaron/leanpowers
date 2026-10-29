---
name: staff
description: Use when an approved plan is about to be executed, or the user runs the staff command.
---
If `skills.staff` is false in leanpowers.json, say "leanpowers: staff is disabled" and stop.

# Staff

Decide who runs the plan: which tier orchestrates, and which tier implements and reviews each task. The cheapest tier that gets a task right in one attempt wins. How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.

## Steps

1. **Run folder:** `<paths.runs>/<plan-basename>/`. Create it if missing, with a `.gitignore` containing `*`. If it already holds `besetzung.md` and the plan has not changed since, reuse it and go to step 4.
2. **Recommend:** dispatch a subagent at tier small with template `prompts/staffer.md`, `{{plan}}` the plan path and `{{besetzung}}` `<run folder>/besetzung.md`.
3. **Show** the recommendation to the user in three lines:
   - orchestrator tier and its reason;
   - task tiers in short, e.g. "implementers: 3 small, 2 medium; reviewers: medium, Task 4 large";
   - what happens next under the configured `orchestration` mode.
   If the user changes a tier, write the change into `besetzung.md`.
4. **Start** by the `orchestration` value in leanpowers.json:
   - **`auto`, where the platform supports nested subagents:** dispatch a subagent at the orchestrator tier with template `prompts/orchestrator.md`, `{{plan}}` the plan path, `{{run}}` the run folder and `{{cli}}` the command from the `CLI:` line of the session or this skill, with absolute paths (none → `leanpowers`). When `git worktree list` shows a worktree on the plan's branch, name its root as the working directory and pass the run folder inside it. Do not read the plan or code yourself while it works. When it returns `NEEDS_USER`, ask the user its question faithfully in the user's language, then resume the orchestrator with the answer. When it returns `DONE`, report its summary to the user and invoke the `finish` skill, working in the worktree root if there is one. If it ends with neither, dispatch a fresh one with the same inputs once; the ledger lets it resume. If that one also ends with neither, tell the user, give the ledger path and offer to continue with the `run` skill in this session.
   - **`switch`, or `auto` on a platform without nested subagents:** ask the user to switch this session to the model for the orchestrator tier, then invoke the `run` skill. If switching is impossible or the user declines, invoke `run` on the current model.
   - **`recommend`:** invoke the `run` skill on the current model.
5. In every mode the per-task tiers in `besetzung.md` apply: implementers and reviewers are dispatched at exactly those tiers. With a worktree, every dispatch names its root as the working directory and every `leanpowers` call runs there.
