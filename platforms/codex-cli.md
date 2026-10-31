# Codex platform map

Translates leanpowers' neutral actions into OpenAI Codex tools.

## Actions

| Action | Codex mechanism |
| --- | --- |
| Dispatch a subagent at a tier with a template | `spawn_agent` with `task_name`, `message` (the template text), `model`, `reasoning_effort` and `fork_turns: "none"` (unverified value). |
| Resume a subagent with a message | `send_message` or `followup_task` (unverified) to the existing agent. |
| Wait for a subagent | Wait for the agent's result before continuing; how a resumed agent reports back is (unverified). Never poll or end the turn while it works. |
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

Run checks with `node "<this plugin>/bin/leanpowers.mjs" <args>`; the plugin folder is two levels above any leanpowers SKILL.md (each skill that uses the CLI carries this line). `$PLUGIN_ROOT` is not relied on (unverified).

Disabling a skill: add `[[skills.config]]` with `path=...` and `enabled=false` to `config.toml`. `leanpowers skills --native codex` prints these blocks; leanpowers never edits Codex's configuration itself.

Verification: run `scripts/verify-codex.sh` yourself (it changes your Codex configuration; agents never run it).

Start context: SessionStart hooks need user confirmation (`/hooks`) and exclude a plugin from the public directory, so rely on the skill descriptions instead of a hook.
