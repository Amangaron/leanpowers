# leanpowers: Installation und Nutzung

Englische Version: [README.md](README.md)

leanpowers ist ein schlankes Workflow-Plugin: Es führt von der Idee über Entwurf und Plan zu einem
Lauf, der Aufgabe für Aufgabe von Subagenten ausgeführt wird. Wo möglich, prüfen Skripte statt
Modellaufrufen. Der immer geladene Text umfasst etwa 515 Token, bei Superpowers 6.3.0 sind es
etwa 1.030 Token (gleiche Messmethode).

## Stand der Plattformen

| Plattform | Paket | Stand |
| --- | --- | --- |
| Claude Code | `dist/claude-plugin` | gebaut, Verifikation läuft (lädt fehlerfrei; Modelläufe stehen aus, siehe `docs/research/2026-10-29-verifikation.md`) |
| Codex | `dist/codex-plugin` | gebaut, ungeprüft |
| Gemini CLI | `dist/gemini-extension` | aus der Dokumentation gebaut, ungeprüft |

Bisher ist nichts als geprüft markiert. Angaben, die noch einen echten Lauf brauchen, stehen in
`platforms/*.md` mit dem Zusatz `(unverified)`.

## Installation

Die Pakete in `dist/` sind eingecheckt, eine Installation über den Marktplatz braucht keinen
Build-Schritt.

**Claude Code**

```
claude plugin marketplace add Amangaron/leanpowers
claude plugin install leanpowers@leanpowers-marketplace
```

Ein SessionStart-Hook gibt einen kurzen Starttext aus. Befehle: `/leanpowers:design`, `plan`,
`staff`, `run`, `debug`, `finish`, `check`, `skills`, `init` (die Verdrahtung der Befehle ist
`(unverified)`: das Plugin lädt fehlerfrei mit Befehlen und gleichnamigen Skills nebeneinander,
aber noch kein Modelllauf hat einen Befehl bestätigt).

**Codex** (ungeprüft)

```
codex plugin marketplace add Amangaron/leanpowers
codex plugin add leanpowers@leanpowers-marketplace
```

Codex hat für Plugins keine Slash-Befehle und keinen Session-Hook: Skills rufen Sie mit
`$leanpowers-<name>` auf, die Kommandozeile über ihren Pfad, `node <Plugin-Pfad>/bin/leanpowers.mjs <Befehl>`.
Zum Prüfen des Pakets starten Sie selbst `bash scripts/verify-codex.sh`.

**Gemini CLI** (ungeprüft)

```
git clone https://github.com/Amangaron/leanpowers
gemini extensions link <clone>/dist/gemini-extension
```

Hier ist nur die lokale Installation beschrieben. Der Aufbau für die Installation direkt von
GitHub wird in Plan 4 festgelegt. Die Befehle liegen im Namensraum `leanpowers`; drei erzeugte
Agenten (`lp-small`, `lp-medium`, `lp-large`) stehen für die Modellstufen.

## Befehle

Die Kommandozeile ist `bin/leanpowers.mjs`. Im Plugin rufen die Befehle sie für Sie auf; aus einem
Klon starten Sie `node bin/leanpowers.mjs <Befehl>`.

| Befehl | Wirkung |
| --- | --- |
| `check [--all]` | Führt die Gates aus (Test-, Typecheck- und Lint-Befehle); `--all` ergänzt Doc-Lint und Skill-Lint. |
| `check --plan <Datei> --task <n>` | Prüft zusätzlich Scope und Struktur einer Plan-Aufgabe. |
| `brief --plan <Datei> --task <n>` | Schreibt den Brief für eine Plan-Aufgabe und gibt den Pfad aus. |
| `metrics --plan <Datei>` | Zählt Briefs, Berichte und Reviews eines Laufs. |
| `config` | Gibt die wirksame Konfiguration aus (mit Standardwerten ergänzt). |
| `start [--format plain\|claude]` | Gibt den Starttext der Sitzung aus. |
| `skills` | Listet Skills und schaltet sie um (siehe unten). |
| `init` | Schlägt Projektdateien vor oder legt sie an (siehe unten). |

Die Workflow-Befehle `design`, `plan`, `staff`, `run`, `debug` und `finish` starten den
passenden Skill; `review`, `tdd`, `verify`, `worktrees` und `write-skill` werden von diesen
Skills benutzt.

## Skills umschalten: `leanpowers skills`

- `skills --list` zeigt jeden Skill mit `[x]` (an) oder `[ ]` (aus).
- `skills --set worktrees=on,debug=off` schreibt die Schalter in `leanpowers.json`.
- Ohne Option öffnet sich in einem Terminal eine interaktive Ankreuzliste. Im Befehl für
  Claude Code und Gemini CLI werden Argumente direkt an die Kommandozeile weitergegeben; ohne
  Argumente listet er die Skills, fragt, welche geändert werden sollen, und wendet sie mit
  `--set` an.
- `skills --native claude|codex|gemini` gibt die Anweisung aus, mit der Sie die Skills in der
  Plattform selbst abschalten. leanpowers ändert nie die eigene Konfiguration eines Assistenten.

`worktrees` und `design.visualCompanion` sind standardmäßig aus.

## Projekt einrichten: `leanpowers init`

- `init` gibt den Vorschlag für eine `leanpowers.json` aus, abgeleitet aus einer Projektanalyse.
- `init --write` legt `leanpowers.json` an; eine vorhandene Datei wird nie überschrieben.
- `init --template project-default` legt die Standardordner und die Konfiguration an und
  überspringt vorhandene Dateien.

## Konfiguration: `leanpowers.json`

Die Datei liegt im Projekt-Root. Eine optionale Benutzerdatei unter
`~/.config/leanpowers/config.json` (bzw. `$XDG_CONFIG_HOME/leanpowers/config.json`, wenn die
Variable gesetzt ist) wird ebenfalls gelesen; die Projektdatei hat Vorrang. Fehlende
Schlüssel erhalten Standardwerte. Eine ungültige Datei wird mit Pfad und Feld gemeldet, danach
gelten die Standardwerte. Das Schema liegt in `schema/leanpowers.schema.json`.

| Schlüssel | Bedeutung | Standard |
| --- | --- | --- |
| `$schema` | Pfad oder URL des Schemas, für Editor-Unterstützung. | keiner |
| `skills` | Schalter nach Skill-Name oder `skill.option`, Wert true oder false. | `worktrees` und `design.visualCompanion` aus |
| `extraSkillDirs` | Zusätzliche Ordner mit eigenen Skills. | `[]` |
| `paths.specs` / `plans` / `reports` / `runs` | Ablage für Specs, Pläne, Berichte und Lauf-Ordner. | `docs/specs`, `docs/plans`, `docs/reports`, `.leanpowers/runs` |
| `commands.test` / `typecheck` / `lint` | Shell-Befehle für die Gates; leer heißt übersprungen. | leer |
| `structure.newFolders` | Neue Ordner: `ask`, `allow` oder `deny`. | `ask` |
| `structure.rules` | Liste aus `{ "path": Glob, "allow": [Globs] }`: welche Dateien wohin gehören. | `[]` |
| `review.batch` | Wie viele risikoarme Aufgaben gemeinsam geprüft werden. | `3` |
| `review.maxFixRounds` | Nachbesserungsrunden, bevor ein Review eskaliert. | `2` |
| `models.small` / `medium` / `large` | Modell je Stufe; `auto` nimmt die Tabelle der Plattform. | `auto` |
| `summarizer` | Shell-Befehl, der lange Fehlerausgaben der Gates kürzt; `none` schaltet ihn ab. | `none` |
| `orchestration` | `auto`, `switch` oder `recommend`. | `auto` |

## Danksagung und Lizenz

leanpowers übernimmt Ideen und Texte aus [Superpowers](https://github.com/obra/superpowers) von
Jesse Vincent (MIT); siehe `NOTICE`. leanpowers steht unter der MIT-Lizenz.
