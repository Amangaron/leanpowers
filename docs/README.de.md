# leanpowers: Installation und Nutzung

Englische Version: [README.md](README.md)

leanpowers ist ein schlankes Workflow-Plugin: Es führt von der Idee über Entwurf und Plan zu einem
Lauf, der Aufgabe für Aufgabe von Subagenten ausgeführt wird. Wo möglich, prüfen Skripte statt
Modellaufrufen. Der immer geladene Text umfasst etwa 515 Token, bei Superpowers 6.3.0 sind es
etwa 1.030 Token (mit derselben Methode gezählt; berechnet, nicht gemessen).

## Stand der Plattformen

| Plattform | Paket | Stand |
| --- | --- | --- |
| Claude Code | `dist/claude-plugin` | gebaut, Installation über den Marktplatz unter macOS bestätigt (Skills, Befehle und Starttext in einer Sitzung gesehen; Aufruf eines Befehls oder Skills nicht bestätigt, siehe `docs/research/2026-10-29-verifikation.md`) |
| Codex | `dist/codex-plugin` | gebaut, Installation über den Marktplatz unter macOS bestätigt (installierte Dateien gleich `dist/codex-plugin`); Nutzung in einer Sitzung ungeprüft |
| Gemini CLI | `dist/gemini-extension` | aus der Dokumentation gebaut, ungeprüft |

Abgesehen von diesen Installationen ist bisher nichts als geprüft markiert. Angaben, die noch
einen echten Lauf brauchen, stehen in `platforms/*.md` mit dem Zusatz `(unverified)`.

## Stand / Selbst prüfen

Version 0.1.3. Die Autoren haben keine kostenpflichtigen Testläufe gemacht (bewusste
Entscheidung, siehe Entwurf, Abschnitt 16). So ist der Stand:

Bestätigt:

- Die deterministischen Tests laufen in der CI auf macOS, Windows und Linux mit Node 20 und 22 durch.
- Das Claude-Code-Paket lädt (aus dem Init-Ereignis geschlossen).
- Die Installation über den Marktplatz funktioniert unter macOS für Claude Code (0.1.0, danach
  auf 0.1.1 aktualisiert; in einer Sitzung waren Skills und Befehle gelistet, und der
  SessionStart-Hook fügte seinen Starttext ein) und für Codex (die installierten Dateien
  entsprechen `dist/codex-plugin`).

Nicht bestätigt:

- Wie sich Modelle mit den Skills verhalten.
- Die Token-Ersparnis in der Praxis. Rund 50 % weniger immer geladener Text sind berechnet, nicht gemessen.
- Ob Codex die Skills in einer Sitzung lädt und benutzt.
- Das Paket für Gemini CLI.
- Unter Windows der SessionStart-Hook von Claude Code (die Tests prüfen ihn nicht).

Selbst prüfen:

- Claude Code: nach `/login` `node scripts/verify-claude.mjs` ausführen. Das Skript macht einige
  kleine Modellaufrufe mit Ihrem eigenen Claude-Login (verbraucht also Ihr Kontingent) und legt ein
  temporäres Git-Repository an.
- Codex: `bash scripts/verify-codex.sh` ausführen. Sie werden gefragt, bevor Ihre Codex-Konfiguration geändert wird (lokaler Marktplatz und Plugin
  werden hinzugefügt); das Skript gibt auch aus, wie Sie beides wieder entfernen.

Siehe [CHANGELOG.md](../CHANGELOG.md) und [RELEASE.md](RELEASE.md) (englisch).

## Installation

Die Pakete in `dist/` sind eingecheckt, eine Installation über den Marktplatz braucht keinen
Build-Schritt.

**Claude Code**

```
claude plugin marketplace add Amangaron/leanpowers
claude plugin install leanpowers@leanpowers-marketplace
```

Ein SessionStart-Hook gibt einen kurzen Starttext aus. Die Workflow-Skills rufen Sie direkt als
`/leanpowers:<Name>` auf (`/leanpowers:design`, `plan`, `staff`, `run`, `debug`, `finish`); nur die
Kommandozeilen-Befehle `/leanpowers:check`, `skills` und `init` sind Befehlsdateien. Das ist
`(unverified)` bis zum Prüflauf: das Plugin lädt (aus dem Init-Ereignis geschlossen), aber noch
kein Modelllauf hat einen Befehl oder Skill-Aufruf bestätigt.

**Codex** (Installation unter macOS bestätigt; Nutzung in einer Sitzung ungeprüft)

```
codex plugin marketplace add Amangaron/leanpowers
codex plugin add leanpowers@leanpowers-marketplace
```

Codex hat für Plugins keine Slash-Befehle und keinen Session-Hook: Skills rufen Sie mit
`$leanpowers-<name>` auf, die Kommandozeile über ihren Pfad, `node <Plugin-Pfad>/bin/leanpowers.mjs <Befehl>`.
Im Codex-Paket nennt jeder Skill, der die Kommandozeile benutzt, diesen Aufruf selbst.
Zum Prüfen des Pakets starten Sie selbst `bash scripts/verify-codex.sh`. Das Skript fragt nach,
bevor es Ihre Codex-Konfiguration ändert (lokaler Marktplatz und Plugin), und gibt aus, wie Sie
beides wieder entfernen.

**Gemini CLI** (ungeprüft)

```
gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension
```

Der Zweig `gemini-extension` enthält nur die gebaute Erweiterung im Wurzelverzeichnis (die
Wurzel des Repositorys enthält Quell-Skills, die Gemini sonst laden würde). Er wird bei jedem
Release mit `node scripts/gemini-branch.mjs` neu erzeugt; das Skript baut ihn lokal aus dem
eingecheckten `dist/gemini-extension` und gibt den Befehl `git push origin gemini-extension` zum
Selbstausführen aus; es pusht nie.

Lokale Installation aus einem Klon:

```
git clone https://github.com/Amangaron/leanpowers
gemini extensions link <clone>/dist/gemini-extension
```

Die Befehle liegen im Namensraum `leanpowers`; drei erzeugte
Agenten (`lp-small`, `lp-medium`, `lp-large`) stehen für die Modellstufen.

Starten Sie nach einem Plugin-Update eine neue Sitzung: laufende Sitzungen behalten die Skills und den CLI-Pfad der alten Version.

Jedes Paket enthält seine Plattform-Zuordnung als `platform.md` (aus `platforms/<Plattform>-<cli>.md`, zum Beispiel `platforms/claude-code.md`):
wie Subagenten gestartet werden, welche Modelle die Stufen meinen und ob Subagenten verschachtelt
werden können.

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
passenden Skill (in Claude Code sind sie die Skills selbst); `review`, `tdd`, `verify`,
`worktrees` und `write-skill` werden von diesen Skills benutzt.

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
| `extraSkillDirs` | Zusätzliche Ordner mit eigenen Skills. Ein Eintrag `plugin:<name>` nutzt die Skills eines installierten Plugins (Claude Code, Codex oder Gemini); ein nicht gefundenes Plugin ergibt nur eine Warnung. | `[]` |
| `paths.specs` / `plans` / `reports` / `runs` | Ablage für Specs, Pläne, Berichte und Lauf-Ordner. | `docs/specs`, `docs/plans`, `docs/reports`, `.leanpowers/runs` |
| `commands.test` / `typecheck` / `lint` | Shell-Befehle für die Gates; leer heißt übersprungen. | leer |
| `structure.newFolders` | Neue Ordner: `ask`, `allow` oder `deny`. | `ask` |
| `structure.rules` | Liste aus `{ "path": Glob, "allow": [Globs] }`: welche Dateien wohin gehören. | `[]` |
| `review.batch` | Wie viele risikoarme Aufgaben gemeinsam geprüft werden. | `3` |
| `review.maxFixRounds` | Nachbesserungsrunden, bevor ein Review eskaliert. | `2` |
| `docLint.ignore` | Spec- und Plan-Dateien, die doc-lint überspringt, als Muster relativ zum Projekt-Root (für Dokumente aus der Zeit vor leanpowers). | `[]` |
| `models.small` / `medium` / `large` | Modell je Stufe; `auto` nimmt die Tabelle der Plattform. | `auto` |
| `summarizer` | Shell-Befehl, der lange Fehlerausgaben der Gates kürzt; `none` schaltet ihn ab. | `none` |
| `orchestration` | `auto`, `switch` oder `recommend`. | `auto` |

## Danksagung und Lizenz

leanpowers übernimmt Ideen und Texte aus [Superpowers](https://github.com/obra/superpowers) von
Jesse Vincent (MIT); siehe `NOTICE`. leanpowers steht unter der MIT-Lizenz.
