# Changelog

All notable changes to leanpowers are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.7] - 2026-11-01

These changes follow from a test run of 0.1.6 in a test project.

### Changed

- The start text invokes `design` before any text or tool; `design` opens with the `Size:` marker only after reading the code and counting its files, and a new red flag says to read the code before calling a request one file.
- The start text says that every size needs the user's yes on its design (large: also on the plan) before code or implementer dispatch, delegation rules included.
- Small means one file plus its test, in the start text and in `design`.

## [0.1.6] - 2026-11-01

These changes follow from a test run of 0.1.5 in a test project.

### Added

- `brief --plan`, `brief --file`, `check --plan … --task …` and `check --brief …` warn when HEAD is on the default branch (a remote's HEAD branch, else `main` or `master`); the warning never changes the result or the exit code.

### Changed

- `plan` runs the first three `staff` steps and asks the user to approve the plan and the staffing in one message; after a plan change the staffer runs again. `staff` invoked on its own shows the staffing and waits for a yes.
- `design` creates `feat/<topic>` before the spec commit, and the medium path before its brief, unless the user named a branch in their own words.
- The ledger's branch guard treats a description of the current state in a dispatch prompt as no user instruction; a ruling that relies on a user instruction quotes it. The orchestrator prompt names no branch.
- `design`, `plan`, `staff` and `run` stop and ask for access when a file they rely on cannot be read, instead of improvising its steps.
- The medium line in `design` names its steps; a new red flag says that a new command is large.

## [0.1.5] - 2026-11-01

These changes follow from a second pilot in a test project.

### Added

- `report --plan <file>` writes the rulings, open minors and final lines of a run from the ledger to `paths.reports`.
- Plan and brief path warnings: a plan or brief outside the configured `paths` folder prints a warning.
- `init` writes `paths` into `leanpowers.json`.

### Changed

- The start text invokes `design` first and shares one large-size rule with it; large allows subagents for reading, reviewing and writing spec and plan before plan approval.
- `design` asks up to three independent questions per message.
- Configured `paths` win over other plugins' folders and count as approved folders.
- The medium path creates a feature branch and always ends in `finish`; `finish` handles work on the base branch and read-only git.
- `staff` always shows the staffing and names its own changes.
- Template paths are written as `<plugin>/prompts/...`.
- The rule against shell variables for commands and paths covers every role.
- Codex tiers are set only via `reasoning_effort`.
- The ledger logs the implementer name before dispatch and its id after.

### Fixed

- `1 file` instead of `1 files` in the check output.
- One shared brief file-name check.

## [0.1.4] - 2026-11-01

### Added

- `brief --file <brief>` records the base commit for a hand-written medium brief; `check --brief <brief>` checks its scope and structure (combines with `--all`).
- `check --all` warns about uncommitted changes outside the run folder.
- `skills/design/details/medium.md`: the medium brief form with commit message and `check --brief`.

### Changed

- Start text and `design`: the reply opens with `Size: small|medium|large`; large needs plan approval before any code or subagent dispatch; medium ends with `finish`.
- Scope names a changed `leanpowers.json` as the user's project configuration.
- The orchestrator template starts with a turn rule; `staff` resumes a stalled orchestrator once before dispatching a fresh one; the ledger logs each implementer dispatch.
- Briefs, the orchestrator and the run loops say to write the CLI command out in every call, never in a shell variable.
- `finish` blocks merge and pull request while uncommitted changes remain.
- The Gemini context file uses a shorter CLI fallback note, so the start text stays within 150 tokens.
- Docs: the maintainer confirmed by hand on macOS (2026-10-31) that installing the Gemini CLI
  extension works (`gemini extensions list` shows leanpowers 0.1.3 with 12 skills); use in a
  session remains unverified. The Gemini install instructions now describe the three prompts
  (trust the folder, `git clone` after a 404 for a release, third-party warning). Details in
  `docs/research/2026-10-29-verifikation.md`.

### Fixed

- `verify` no longer says that plain `leanpowers check` runs doc-lint and skill-lint (only `--all` does).

## [0.1.3] - 2026-10-31

### Fixed

- `init` now also allows the sibling extension of the same language family in each proposed folder rule (`*.ts` with `*.tsx`, `*.js` with `*.jsx`), so a fresh Next.js `app/` can hold `route.ts` and `actions.ts`.

## [0.1.2] - 2026-10-30

### Added

- `brief --reset-base`: re-anchor a task's base commit after plan corrections.
- `init --agents-md`: `init` writes a leanpowers start-text block into `AGENTS.md` for Codex.
- Plan format: golden-file steps.
- Ledger lines for final minors, rulings and `## Notes`.
- `extraSkillDirs` resolve `plugin:<name>` to the skills of other plugins on Claude Code, Codex and Gemini.

### Changed

- Test files now approve new folders, and the brief lists the approved new folders.
- Briefs name the spec and the sources; reviewers get `constraints.md`.
- The orchestrator waits instead of stalling; the plan branch counts as a user instruction; approval comes before delegation.
- After a plugin update, start a new session.
- Docs: the maintainer confirmed by hand on macOS (2026-10-30) that the marketplace install works for
  Claude Code and Codex. In the LIDO Code Studio pilot (2026-10-30) a Codex session loaded and followed
  the leanpowers `start` and `design` skills. The Gemini CLI package remains unverified. Details in
  `docs/research/2026-10-29-verifikation.md`.

### Fixed

- A missing `leanpowers.json` is now named in the error message.

## [0.1.1] - 2026-10-30

### Added

- `docLint.ignore` in `leanpowers.json`: spec and plan files that `doc-lint` skips, as globs relative to the
  project root. Helps projects that adopt leanpowers with documents written before it.

## [0.1.0] - 2026-10-29

### Added

- Deterministic checks as plain Node scripts, not model calls: `check` (gates, scope, structure,
  doc lint, skill lint), `brief`, `metrics` and `config`.
- Workflow skills (`start`, `design`, `plan`, `staff`, `run`, `debug`, `finish`, plus `review`,
  `tdd`, `verify`, `worktrees`, `write-skill`) and the agent prompts (implementer, reviewer,
  re-reviewer, staffer, orchestrator).
- Packages for Claude Code, Codex and Gemini CLI, built from one source into `dist/`, with
  marketplace files for Claude Code and Codex and a `gemini-extension` release branch script.
- CLI commands `start` (session start text), `skills` (list and switch skills) and `init`
  (propose or create project files).
- Verification scripts for users: `scripts/verify-claude.mjs` and `scripts/verify-codex.sh`.
- CI on macOS, Windows and Linux with Node 20 and 22 (all green on the release commit).

### Notes

- The saving of about 50 % less always-loaded text than Superpowers 6.3.0 is calculated with one
  counting method, not measured in real sessions.
- The Codex and Gemini CLI packages are built but unverified; the Claude Code package loads
  (inferred from the init event), but no model run has confirmed skill behaviour.
- The authors made no paid test runs.
- leanpowers builds on ideas and adapts parts of [Superpowers](https://github.com/obra/superpowers)
  by Jesse Vincent (MIT).
