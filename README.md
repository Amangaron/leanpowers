# leanpowers

A lean workflow plugin for AI coding assistants: design, plan, subagent execution and
deterministic checks, with as little always-loaded text as possible. It is built for Claude Code,
Codex and Gemini CLI (status: see the [platform table](docs/README.md#platform-status)), has zero
dependencies and needs Node.js 20 or newer. Current version: 0.1.0.

## Why lean

Everything a session loads up front (the start text plus all skill descriptions) costs tokens
on every request. Counted with the same method (calculated, not measured in real sessions):

| | Always-loaded tokens |
| --- | --- |
| leanpowers | about 515 |
| Superpowers 6.3.0 | about 1,030 |

That is roughly 50 % less. Detailed steps live in files that are read only when needed, and the
checks (scope, structure, gates, doc and skill lint) are plain scripts, not model calls.

## Install

Claude Code (built, verification in progress):

```
claude plugin marketplace add Amangaron/leanpowers
claude plugin install leanpowers@leanpowers-marketplace
```

Codex (built, unverified):

```
codex plugin marketplace add Amangaron/leanpowers
codex plugin add leanpowers@leanpowers-marketplace
```

Gemini CLI (built from docs, unverified; the install line works after the first push of the
`gemini-extension` branch):

```
gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension
```

The `gemini-extension` branch holds only the built extension and is regenerated per release with
`node scripts/gemini-branch.mjs`. Or clone the repository and run
`gemini extensions link <clone>/dist/gemini-extension`.

## Status / Verify it yourself

Version 0.1.0. The authors made no paid test runs (a deliberate decision, see the design spec,
section 16); this is what is and is not confirmed.

Confirmed:

- The deterministic tests pass locally (macOS).
- The Claude Code package loads (inferred from the init event).

Not confirmed:

- How models behave with the skills.
- The token saving in practice. About 50 % less always-loaded text is calculated, not measured.
- CI on macOS, Windows and Linux with Node 20 and 22: configured, not run yet.
- The Codex and Gemini CLI packages.
- On Windows, the Claude Code SessionStart hook (the tests do not exercise it).

Verify it yourself:

- Claude Code: after `/login`, run `node scripts/verify-claude.mjs`. It makes a few small model
  calls with your own Claude login (so it uses your quota) and creates a temporary git repository.
- Codex: run `bash scripts/verify-codex.sh`. It asks before it changes your Codex
  configuration (adds a local marketplace and the plugin) and prints how to remove it again.

See [CHANGELOG.md](CHANGELOG.md) and [docs/RELEASE.md](docs/RELEASE.md).

## More

- [Install guide, commands and configuration (English)](docs/README.md)
- [Installation, Befehle und Konfiguration (Deutsch)](docs/README.de.md)

## Credit

leanpowers builds on the ideas and adapts parts of [Superpowers](https://github.com/obra/superpowers)
by Jesse Vincent (MIT). See [NOTICE](NOTICE). leanpowers itself is MIT licensed, see [LICENSE](LICENSE).
