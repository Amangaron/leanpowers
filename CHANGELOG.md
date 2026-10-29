# Changelog

All notable changes to leanpowers are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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
- CI on macOS, Windows and Linux with Node 20 and 22.

### Notes

- The saving of about 50 % less always-loaded text than Superpowers 6.3.0 is calculated with one
  counting method, not measured in real sessions.
- The Codex and Gemini CLI packages are built but unverified; the Claude Code package loads
  (inferred from the init event), but no model run has confirmed skill behaviour.
- The authors made no paid test runs.
- leanpowers builds on ideas and adapts parts of [Superpowers](https://github.com/obra/superpowers)
  by Jesse Vincent (MIT).
