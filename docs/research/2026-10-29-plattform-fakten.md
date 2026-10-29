# Plattform-Fakten für Plan 2/3 (Stand 2026-10-29)

Diese Notiz fasst zwei Rechercheberichte zusammen. Quellen:
- Claude Code: code.claude.com/docs
- Codex: learn.chatgpt.com/docs (developers.openai.com leitet dorthin weiter), Release rust-v0.165.0
- Gemini CLI: geminicli.com/docs, Release v0.66.0

„unbestätigt“ heißt: Die Doku lässt den Punkt offen, er muss vor der Umsetzung getestet werden.

## Claude Code

**Skill abschalten**
- Für Plugin-Skills gibt es keinen offiziellen Schalter pro Skill. `skillOverrides` gilt nicht für Plugin-Skills.
- Eine Regel `permissions.deny: ["Skill(<name>)"]` blockiert den Aufruf. Ob sie auch die Beschreibung aus dem Kontext entfernt, ist unbestätigt.
- Aus der Liste entfernt ihn nur `disable-model-invocation: true` im Frontmatter. Das lässt sich nur über den Build beziehungsweise eine Neugenerierung steuern.

**Plugin-Aufbau**
- `.claude-plugin/plugin.json`, Pflichtfeld ist nur `name`.
- Ordner `skills/<n>/SKILL.md`, `commands/*.md` (älteres Format), `agents/*.md` (mit `model:`), `hooks/hooks.json`.

**SessionStart**
- Kontext über `hookSpecificOutput.additionalContext`, höchstens 10.000 Zeichen.
- Matcher: `startup|resume|clear|compact|fork`.
- Ob der Hook auch in Subagenten feuert, ist unbestätigt. `SubagentStart` kann Kontext gezielt an Subagenten geben.

**Subagenten**
- Das Modell ist pro Aufruf wählbar (`sonnet|opus|haiku|fable`). Der Aufruf hat Vorrang vor dem Frontmatter.
- **Subagenten können selbst Subagenten starten**, standardmäßig bis zu 3 Ebenen tief. Das lässt sich mit `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` begrenzen.

**Modellwechsel**
- Nur der Nutzer kann umschalten (`/model`, `--model`).
- Alternative: Eine Plugin-`settings.json` mit `"agent": "<plugin-agent>"` lässt diesen Agenten als Hauptthread laufen, mit seinem eigenen Modell.

**Headless**
- `claude -p … --model X --output-format json --plugin-dir <pfad>`.
- Kosten und Verbrauch über `total_cost_usd` beziehungsweise `modelUsage`, das auch Subagenten einschließt.

**Marketplace**
- `.claude-plugin/marketplace.json` im Repo-Root mit `"source": "./dist/claude-plugin"`.

## OpenAI Codex

**Plugin**
- `.codex-plugin/plugin.json` (`skills`, `hooks`, `interface`). Codex liest auch `.claude-plugin/plugin.json`.
- Installation:
  - `codex plugin marketplace add owner/repo`
  - danach `codex plugin add leanpowers@<marketplace>`
- Benötigt `.agents/plugins/marketplace.json` oder `.claude-plugin/marketplace.json`.

**Befehle**
- Es gibt keine echten `/befehle` für Plugins. Skills werden mit `$skill-name` aufgerufen.
- `commands/*.md` werden automatisch zu Skills migriert: unbestätigt, höchstens 4.000 Byte, `description` ist Pflicht.

**Start-Kontext**
- SessionStart-Hooks gibt es, aber der Nutzer muss sie bestätigen (`/hooks`).
- Plugins mit Hooks können nicht ins öffentliche Verzeichnis.
- Kontext über 2.500 Token wird ausgelagert.
- Superpowers verzichtet auf Codex ganz auf den Start-Hook und verlässt sich auf den Skill-Katalog.

**Subagenten**
- Werkzeug `spawn_agent{task_name, message, model?, reasoning_effort?, fork_turns}`.
- Das Modell ist pro Aufruf wählbar, Verschachtelung ist erlaubt.
- Plugins können keine Agent-Definitionen mitliefern.

**Abschalten**
- Ein einzelner Skill: `[[skills.config]] path=… enabled=false` in `config.toml`.

**Modellwechsel**
- Nur `/model` durch den Nutzer.

**Headless**
- `codex exec --json -m X`, die Token stehen in `turn.completed.usage`.

## Gemini CLI

**Achtung Zielgruppe:** Für kostenlose Nutzer und Google-One-Nutzer wurde Gemini CLI am 2026-06-18 durch die Antigravity CLI ersetzt.

**Extension**
- `gemini-extension.json` mit `contextFileName`.
- Ordner werden automatisch erkannt: `commands/*.toml`, `skills/`, `agents/`, `hooks/`.
- Installation: `gemini extensions install <github-url>`.

**Befehle**
- Echte TOML-Befehle mit `{{args}}`. Unterordner werden zum Namensraum (`/ns:cmd`).
- Einzelne Befehle lassen sich nicht abschalten.

**Start-Kontext**
- Die Datei aus `contextFileName` wird bei **jeder** Anfrage mitgeschickt. Sie muss deshalb sehr kurz bleiben.

**Subagenten**
- Werkzeug `invoke_agent{agent_name, prompt}`, aber **ohne** Modell-Parameter.
- Das Modell ist pro Agent-Datei fest. Nötig ist deshalb eine Datei pro Modellstufe.
- **Subagenten können keine Subagenten starten.**

**Abschalten**
- Skills: `/skills disable <name>` (schreibt `skills.disabled`).
- Agenten: `agents.overrides.<n>.enabled=false`.

**Modellwechsel**
- Durch den Nutzer mit `/model set <name>`.
- Ein `BeforeModel`-Hook kann das Modell pro Anfrage überschreiben.

**Headless**
- `gemini -p … --output-format json -m X`, die Token stehen in `stats.models.*.tokens`.

## Folgen für das Design (in Plan 2/3 entscheiden)

1. **Skills abschalten**
   - Gemini und Codex haben echte Schalter. leanpowers kann sie aus `leanpowers.json` setzen.
   - Für Claude Code bleibt nur die Rückfallebene aus Spec Abschnitt 9: Starttext und Abbruch in der ersten Zeile, eventuell zusätzlich eine `deny`-Regel.
2. **Befehle**
   - Echt auf Claude Code und Gemini.
   - Auf Codex als Skills (`$leanpowers-plan` …).
3. **Starttext**
   - Claude Code: Hook.
   - Gemini: `GEMINI.md`, wird pro Anfrage gesendet, deshalb höchstens 150 Token.
   - Codex: kein Hook, stattdessen die Skill-Beschreibungen.
4. **Modellstufen**
   - Claude Code und Codex: pro Aufruf.
   - Gemini: je eine Agent-Datei pro Stufe (`lp-small`, `lp-medium`, `lp-large`).
5. **Übernahme durch das gewählte Modell**
   - Auf Claude Code und Codex wäre auch eine automatische Übernahme durch einen Orchestrierungs-Subagenten möglich.
   - Gemini kann das nicht, weil dort keine Verschachtelung möglich ist.
   - Mit dem Nutzer klären, bevor Plan 3 geschrieben wird.
6. **Token-Messung:** Ein Normalisierer für drei Formate wird gebraucht (Plan 4).
