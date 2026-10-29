# leanpowers: install and use

German version: [README.de.md](README.de.md)

leanpowers is a lean workflow plugin: it turns an idea into a design, a plan and a task-by-task
subagent run, with deterministic checks instead of model calls where possible. Always-loaded text
is about 515 tokens, against about 1,030 for Superpowers 6.3.0 (same measuring method).

## Platform status

| Platform | Package | Status |
| --- | --- | --- |
| Claude Code | `dist/claude-plugin` | built, verification in progress (plan 3, task 8) |
| Codex | `dist/codex-plugin` | built, unverified |
| Gemini CLI | `dist/gemini-extension` | built from docs, unverified |

Nothing is marked verified yet. Statements that still need a real run are tagged `(unverified)`
in `platforms/*.md`.

## Install

The packages in `dist/` are committed, so a marketplace install needs no build step.

**Claude Code**

```
claude plugin marketplace add Amangaron/leanpowers
claude plugin install leanpowers@leanpowers-marketplace
```

A SessionStart hook prints a short start text. Commands: `/leanpowers:design`, `plan`, `staff`,
`run`, `debug`, `finish`, `check`, `skills`, `init`.

**Codex** (unverified)

```
codex plugin marketplace add Amangaron/leanpowers
codex plugin add leanpowers@leanpowers-marketplace
```

Codex plugins have no slash commands and no session hook: skills are invoked as
`$leanpowers-<name>`.

**Gemini CLI** (unverified)

```
git clone https://github.com/Amangaron/leanpowers
gemini extensions link <clone>/dist/gemini-extension
```

Only the local install is documented here. The layout for installing straight from GitHub is
decided in plan 4. Commands live in the `leanpowers` namespace; three generated agents
(`lp-small`, `lp-medium`, `lp-large`) stand for the model tiers.

## Commands

The CLI is `bin/leanpowers.mjs`. Inside a plugin, the commands run it for you; from a clone, run
`node bin/leanpowers.mjs <command>`.

| Command | What it does |
| --- | --- |
| `check [--all]` | Run the deterministic checks (gates, doc lint, skill lint). |
| `check --plan <file> --task <n>` | Also check scope and structure of one plan task. |
| `brief --plan <file> --task <n>` | Write the brief for one plan task and print its path. |
| `metrics --plan <file>` | Count the briefs, reports and reviews of a run. |
| `config` | Print the effective configuration (defaults merged). |
| `start [--format plain\|claude]` | Print the session start text. |
| `skills` | List skills and switch them (see below). |
| `init` | Propose or create project files (see below). |

The workflow commands `design`, `plan`, `staff`, `run`, `debug` and `finish` start the matching
skill; `review`, `tdd`, `verify`, `worktrees` and `write-skill` are used by those skills.

## Switch skills: `leanpowers skills`

- `skills --list` prints every skill with `[x]` (on) or `[ ]` (off).
- `skills --set worktrees=on,debug=off` writes the switches to `leanpowers.json`.
- Without a flag in a terminal, an interactive checklist opens. In the Claude Code and Gemini CLI
  command, arguments are passed straight to the CLI; without arguments it lists the skills, asks
  which to change and applies them with `--set`.
- `skills --native claude|codex|gemini` prints the instruction for switching the skills off in
  the assistant itself. leanpowers never edits an assistant's own configuration.

`worktrees` and `design.visualCompanion` are off by default.

## Set up a project: `leanpowers init`

- `init` prints a proposed `leanpowers.json` from a scan of the project.
- `init --write` creates `leanpowers.json`; it never overwrites an existing file.
- `init --template project-default` creates the default folders and config, skipping files that
  already exist.

## Configuration: `leanpowers.json`

The file sits in the project root. An optional user file at `~/.config/leanpowers/config.json`
is also read; the project file wins. Missing keys use the defaults. An invalid file is reported
with its path and field, and the defaults are used. The schema is `schema/leanpowers.schema.json`.

| Key | Meaning | Default |
| --- | --- | --- |
| `$schema` | Path or URL of the schema, for editor support. | none |
| `skills` | Switches by skill name or `skill.option`, value true or false. | `worktrees` and `design.visualCompanion` off |
| `extraSkillDirs` | Extra folders with your own skills. | `[]` |
| `paths.specs` / `plans` / `reports` / `runs` | Where specs, plans, reports and run folders go. | `docs/specs`, `docs/plans`, `docs/reports`, `.leanpowers/runs` |
| `commands.test` / `typecheck` / `lint` | Shell commands for the gates; empty means skipped. | empty |
| `structure.newFolders` | New folders: `ask`, `allow` or `deny`. | `ask` |
| `structure.rules` | List of `{ "path": glob, "allow": [globs] }` for what files may live where. | `[]` |
| `review.batch` | Low-risk tasks reviewed together. | `3` |
| `review.maxFixRounds` | Fix rounds before a review escalates. | `2` |
| `models.small` / `medium` / `large` | Model per tier; `auto` uses the platform table. | `auto` |
| `summarizer` | Shell command that shortens long failing gate output; `none` turns it off. | `none` |
| `orchestration` | `auto`, `switch` or `recommend`. | `auto` |

## Credit and license

leanpowers adapts ideas and text from [Superpowers](https://github.com/obra/superpowers) by
Jesse Vincent (MIT); see `NOTICE`. leanpowers is MIT licensed.
