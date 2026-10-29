# Verifikation der Pakete (Plan 3, Task 8)

Datum: 2026-10-29. Claude Code 2.1.289. Skript: `scripts/verify-claude.mjs` (headless, nur
`--plugin-dir dist/claude-plugin`, `--model haiku`, `--max-budget-usd 0.25`, temporäres Git-Repo,
nichts wird in die Konfiguration des Nutzers installiert).

## Ergebnis Claude Code

Es gab zwei Durchläufe des Skripts. Beide endeten gleich: Die Modelläufe schlugen mit
`Failed to authenticate: OAuth session expired and could not be refreshed` fehl
(`claude auth status`: `loggedIn: false`). Das liegt an der Umgebung, in der der Agent lief, nicht
am Paket. Es wurden keine Token verbraucht; gemessene Kosten insgesamt: 0,00 USD.

| Prüfung | Ergebnis | Detail |
| --- | --- | --- |
| `session-start` (Start-Text enthält `Commands: design, plan`) | UNCLEAR | Kein Modelllauf möglich (nicht angemeldet). |
| `check-command` (`/leanpowers:check` liefert `leanpowers check:`) | UNCLEAR | Kein Modelllauf möglich (nicht angemeldet). |
| `plugin-root-var` (`${CLAUDE_PLUGIN_ROOT}` in `commands/*.md` ersetzt) | UNCLEAR | Hängt am Lauf von `check-command`. |
| `coexist` (Command und gleichnamige Skills nebeneinander) | PASS | Das `system/init`-Event (ohne Modellaufruf) zeigt Plugin `leanpowers` geladen, `plugin_errors` leer, `leanpowers:check` und `leanpowers:plan` vorhanden; `design`, `plan`, `staff`, `run`, `debug`, `finish` existieren sowohl als Command als auch als Skill. Ob der Aufruf `/leanpowers:plan` im Modelllauf den richtigen Eintrag lädt, ist damit nicht gezeigt. |

## Was offen bleibt

- Claude Code: `session-start`, `check-command` und `plugin-root-var` müssen mit angemeldetem
  `claude` (`/login`) laufen: `node scripts/verify-claude.mjs` (erwartete Kosten unter 0,10 USD).
  Bis dahin bleiben die `(unverified)`-Markierungen in `platforms/claude.md` bestehen.
- Codex: ungeprüft, bis der Nutzer `bash scripts/verify-codex.sh` selbst ausführt (das Skript
  ändert die Codex-Konfiguration und wird nie von einem Agenten gestartet).
- Gemini CLI: vollständig ungeprüft.
