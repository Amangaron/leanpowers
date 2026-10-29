# Gemini CLI platform map

Translates leanpowers' neutral actions into Gemini CLI tools.

## Actions

| Action | Gemini CLI mechanism |
| --- | --- |
| Dispatch a subagent at a tier with a template | `invoke_agent` with `agent_name` `lp-small`, `lp-medium` or `lp-large` and the template text as `prompt`. There is no model parameter, so one agent file exists per tier. The build writes `lp-small`, `lp-medium` and `lp-large` with `model: inherit`; `models.*` from `leanpowers.json` is not yet written into them. |
| Resume a subagent with a message | leanpowers does not resume on Gemini; re-dispatch with the report file path. |
| Ask the user | Ask in chat. |
| Track tasks | Use the built-in todo tool. |
| Invoke a skill | Activate the skill by name via the skill mechanism. |
| Read a file only when needed | Read the linked details file at the moment it is needed, not earlier. |

## Model tiers

| Tier | Source |
| --- | --- |
| small | `model` field of the `lp-small` agent file |
| medium | `model` field of the `lp-medium` agent file |
| large | `model` field of the `lp-large` agent file |

Today every agent file has `model: inherit`. Intended: a `models.*` entry in `leanpowers.json` is written into the matching agent file by the build (not implemented yet); `auto` means this table. A `BeforeModel` hook could override the model per request.

## Orchestration

Subagents cannot start subagents, so there is no nesting. `auto` behaves as `switch`: the user changes the main model with `/model set <name>`.

## CLI

Run checks with `node "${extensionPath}/bin/leanpowers.mjs" <args>` (unverified).

Disabling: skills with `/skills disable <name>` (writes `skills.disabled`); agents with `agents.overrides.<n>.enabled=false`. Individual commands cannot be disabled.

The context file named by `contextFileName` is sent with every request, so keep it very short.
