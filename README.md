# leanpowers

A lean workflow plugin for AI coding assistants: design, plan, subagent execution and
deterministic checks, with as little always-loaded text as possible. It is built for Claude Code,
Codex and Gemini CLI (status: see the [platform table](docs/README.md#platform-status)), has zero
dependencies and needs Node.js 20 or newer. Current version: 0.1.7.

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

Claude Code (marketplace install confirmed on macOS):

```
claude plugin marketplace add Amangaron/leanpowers
claude plugin install leanpowers@leanpowers-marketplace
```

Codex (marketplace install confirmed on macOS; use in a session unverified):

```
codex plugin marketplace add Amangaron/leanpowers
codex plugin add leanpowers@leanpowers-marketplace
```

Gemini CLI (install confirmed on macOS; use in a session unverified):

```
gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension
```

During the install Gemini asks three questions; answer yes to each:

- whether to trust the current folder (any folder, including your home folder; yes adds it to
  Gemini's trusted folders);
- after a 404 for a GitHub release named `gemini-extension` (it is a branch, not a release),
  whether to install via `git clone` instead; this is the intended path;
- after a third-party-extension warning that lists the skills, whether to continue.

The `gemini-extension` branch holds only the built extension and is regenerated per release with
`node scripts/gemini-branch.mjs`. Or clone the repository and run
`gemini extensions link <clone>/dist/gemini-extension`.

After a plugin update, start a new session: running sessions keep the old skills and CLI path.

## Status / Verify it yourself

Version 0.1.7. The authors made no paid test runs (a deliberate decision, see the design spec,
section 16); this is what is and is not confirmed.

Confirmed:

- The deterministic tests pass in CI on macOS, Windows and Linux with Node 20 and 22.
- The Claude Code package loads (inferred from the init event).
- Installing via the marketplace works on macOS for Claude Code (0.1.0, then updated to 0.1.1; in a
  session the skills and commands were listed and the SessionStart hook added its start text) and
  for Codex (the installed files match `dist/codex-plugin`).
- Installing the Gemini CLI extension works on macOS (`gemini extensions list` shows leanpowers
  0.1.3 with 12 skills).

Not confirmed:

- How models behave with the skills.
- The token saving in practice. About 50 % less always-loaded text is calculated, not measured.
- Whether Codex and Gemini CLI load and use the skills in a session.
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
