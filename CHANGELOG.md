# Changelog

All notable changes to leanpowers are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Docs: the maintainer confirmed by hand on macOS (2026-10-31) that installing the Gemini CLI
  extension works (`gemini extensions list` shows leanpowers 0.1.3 with 12 skills); use in a
  session remains unverified. The Gemini install instructions now describe the three prompts
  (trust the folder, `git clone` after a 404 for a release, third-party warning). Details in
  `docs/research/2026-10-29-verifikation.md`.

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
