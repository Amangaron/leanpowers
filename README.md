# leanpowers

A lean workflow plugin for AI coding assistants: design, plan, subagent execution and
deterministic checks, with as little always-loaded text as possible. It runs on Claude Code,
Codex and Gemini CLI, has zero dependencies and needs Node.js 20 or newer.

## Why lean

Everything a session loads up front (the start text plus all skill descriptions) costs tokens
on every request. Measured with the same method:

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

Gemini CLI (built from docs, unverified): clone the repository, then
`gemini extensions link <clone>/dist/gemini-extension`.

## More

- [Install guide, commands and configuration (English)](docs/README.md)
- [Installation, Befehle und Konfiguration (Deutsch)](docs/README.de.md)

## Credit

leanpowers builds on the ideas and adapts parts of [Superpowers](https://github.com/obra/superpowers)
by Jesse Vincent (MIT). See [NOTICE](NOTICE). leanpowers itself is MIT licensed, see [LICENSE](LICENSE).
