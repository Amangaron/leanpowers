# Codex platform map

Translates leanpowers' neutral actions into OpenAI Codex tools.

## Actions

| Action | Codex mechanism |
| --- | --- |
| Dispatch a subagent at a tier with a template | `spawn_agent` with `task_name`, `message` (the template text), `model`, `reasoning_effort` and `fork_turns: "none"`. |
| Resume a subagent with a message | `send_message` or `followup_task` to the existing agent. |
| Ask the user | Ask in chat. |
| Track tasks | Use the built-in plan tool. |
| Invoke a skill | `$leanpowers-<name>`; plugins have no real slash commands. |
| Read a file only when needed | Read the linked details file at the moment it is needed, not earlier. |

## Model tiers

| Tier | Setting |
| --- | --- |
| small | `models.small` if set, else default subagent model with `reasoning_effort` `low` |
| medium | `models.medium` if set, else default subagent model with `reasoning_effort` `medium` |
| large | `models.large` if set, else default subagent model with `reasoning_effort` `high` |

`auto` means this table. The model is chosen per call; only the user can switch the main model (`/model`).

## Orchestration

`auto` is supported. Nesting is allowed, so an orchestrator subagent can dispatch implementers and reviewers. Plugins cannot ship agent definitions, so templates are passed as the `message`.

## CLI

Run checks with `node "$PLUGIN_ROOT/bin/leanpowers.mjs" <args>` (unverified for skills; fallback: use the path of the installed plugin).

Disabling a skill: add `[[skills.config]]` with `path=...` and `enabled=false` to `config.toml`. leanpowers can set this from `leanpowers.json`.

Start context: SessionStart hooks need user confirmation (`/hooks`) and exclude a plugin from the public directory, so rely on the skill descriptions instead of a hook.
