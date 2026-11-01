# Claude Code platform map

Translates leanpowers' neutral actions into Claude Code tools.

## Actions

| Action | Claude Code mechanism |
| --- | --- |
| Dispatch a subagent at a tier with a template | Start a subagent with an explicit `model` alias (`haiku`, `sonnet`, `opus`) on every call; the template text is the prompt. The call's model overrides any agent frontmatter. |
| Resume a subagent with a message | Send a message to the existing agent by its name or id. |
| Wait for a subagent | Dispatch in the foreground: never set `run_in_background`. A resumed agent's result arrives as a task notification: wait for it; never poll or end the turn before it arrives. |
| Ask the user | Ask in chat, or use the question tool if available. |
| Track tasks | Use the built-in task list tool. |
| Invoke a skill | Use the skill mechanism with the skill name. |
| Read a file only when needed | Read the linked details file at the moment it is needed, not earlier. |

## Model tiers

| Tier | Alias |
| --- | --- |
| small | `haiku` |
| medium | `sonnet` |
| large | `opus` |

A `models.*` entry in `leanpowers.json` overrides the alias; `auto` means this table. Only the user can switch the main thread model (`/model`, `--model`).

## Orchestration

`auto` is supported. Subagents may start subagents (default depth 3, limit via `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), so an orchestrator subagent can dispatch implementers and reviewers. Use depth orchestrator, then worker. A plugin `settings.json` with `"agent": "<plugin-agent>"` can run an agent as main thread with its own model.

## CLI

Run checks with `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" <args>` (unverified).

Disabling a skill: plugin skills have no per-skill switch (`skillOverrides` does not apply). Options:
- `permissions.deny: ["Skill(<name>)"]` blocks invocation; whether it also removes the description from context is (unverified).
- `disable-model-invocation: true` in the frontmatter removes it from the list, but only via a rebuild.
- Fallback: the `skills.<name>` switch line in the skill itself.
