# leanpowers – Design-Spezifikation

- **Datum:** 2026-10-29
- **Status:** zur Prüfung durch den Nutzer
- **Vorlage:** Superpowers 6.3.0 (MIT, Copyright (c) 2025 Jesse Vincent). Es ist kein Fork. Übernommene Ideen und Textteile werden in `NOTICE` gekennzeichnet.

## 1. Ziel

leanpowers ist ein kostenloses, öffentliches Plugin für KI-Coding-Assistenten. Es bildet den bewährten Ablauf
Design → Plan → Subagenten-Ausführung → Abschluss ab und hat dabei folgende Eigenschaften:

1. **Es braucht deutlich weniger Token als Superpowers.** Das Ziel sind 40–60 % weniger pro Plan, gemessen in den Szenario-Tests (Abschnitt 11).
2. **Es nutzt Subagenten konsequent.** Das Hauptfenster entscheidet, Subagenten programmieren.
3. **Es hält Ordnerstrukturen ein.** Dazu gehören feste Ablageorte, Projekt-Strukturregeln und Vorlagen für neue Projekte.
4. **Es prüft möglichst viel ohne KI**, mit deterministischen Skripten. Die KI sieht nur kurze Ergebnisse.
5. **Es läuft auf Claude Code, OpenAI Codex und Gemini CLI.**
6. **Es ist erweiterbar und schaltbar.** Eigene Skills lassen sich ergänzen, und jeder Skill kann per Konfig bzw. Checkbox an- und abgeschaltet werden.

## 2. Nicht-Ziele (für dieses Plugin)

- **Keine LIDO-spezifischen Regeln.** Dafür gibt es ein eigenes Plugin `leanpowers-lido`, das auf leanpowers aufbaut und einen eigenen Spec-/Plan-Zyklus nach diesem Plugin bekommt.
- **Keine eigene Ollama-Anbindung.** Ollama kommt später über LIDO Code Studio. leanpowers bietet dafür nur die Schnittstelle `summarizer` (Abschnitt 7.4) und den Besetzungsschritt, der auch ein lokales Modell nutzen kann.
- **Weitere Plattformen** (Cursor, OpenCode, Copilot …) sind nicht Teil von Version 0.1. Die Architektur lässt sie über eine weitere Datei in `platforms/` zu.
- **Keine Synchronisation mit Superpowers-Updates.**

## 3. Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| Aufbau | Zwei Plugins: das öffentliche `leanpowers` und später `leanpowers-lido` |
| Ansatz | Neues Repository, Superpowers dient nur als Vorlage |
| Plattformen v0.1 | Claude Code, OpenAI Codex, Gemini CLI |
| Auslösung | Nach Aufgabengröße, ohne „1 %-Regel“ |
| Review | Gestaffelt nach Risiko, höchstens 2 Korrekturrunden |
| Orchestrierung | Ein kleines Modell erstellt eine Besetzung; das gewählte Modell übernimmt automatisch als Orchestrierungs-Subagent (Claude Code, Codex), auf Gemini CLI per Umschalten (Entscheidung 2026-10-29, ersetzt „immer umschalten“) |
| Skills | Alle Superpowers-Fähigkeiten werden übernommen, erweiterbar und einzeln abschaltbar |
| Schalter | Konfig-Datei + Terminal-Ankreuzliste; LIDO Code Studio zeigt Checkboxen |
| Sprache | Skills auf Englisch, Doku auf Englisch und Deutsch, Antworten in der Sprache des Nutzers |
| Name | `leanpowers` |
| Ort | `~/Developer/leanpowers`, Veröffentlichung über das persönliche GitHub-Konto des Autors |

## 4. Repository-Aufbau

```
leanpowers/
  skills/<skill>/SKILL.md      Kern-Anweisung, Englisch, max. 600 Wörter
  skills/<skill>/details/*.md  Vertiefung, wird nur bei Bedarf gelesen
  agents/*.md                  Auftrags-Vorlagen für Subagenten (implementer, reviewer, staffer), je max. 400 Wörter
  checks/                      KI-unabhängige Prüf-Skripte (Node >= 20, keine Abhängigkeiten)
  platforms/{claude,codex,gemini}.md   Zuordnung „Handlung → Werkzeug“ je Assistent
  build/                       Build-Skript: erzeugt dist/ aus skills/, agents/, platforms/, checks/
  dist/claude-plugin/          erzeugt: .claude-plugin/plugin.json, Hooks, Befehle, Skills
  dist/codex-plugin/           erzeugt: .codex-plugin/plugin.json, Skills, AGENTS.md-Baustein
  dist/gemini-extension/       erzeugt: gemini-extension.json, GEMINI.md, Befehle (TOML)
  templates/project-default/   Ordnergerüst + Strukturregeln für neue Projekte
  templates/leanpowers.json    kommentierte Beispiel-Konfiguration
  schema/leanpowers.schema.json   JSON-Schema der Konfig
  docs/README.md, docs/README.de.md, docs/writing-skills.md
  tests/                       node:test – Skripte, Build, Skill-Format
  .claude-plugin/marketplace.json   Marketplace-Eintrag, zeigt auf dist/claude-plugin
  LICENSE (MIT), NOTICE
```

**Grundprinzip:** Skills nennen keine Werkzeuge, sondern Handlungen, z. B. „dispatch a subagent“, „run check“ oder „ask the user“. Was das auf welcher Plattform bedeutet, steht in `platforms/*.md`. Das Build-Skript fügt beides zusammen.

**Neue Plattform:** Wer eine Plattform ergänzen will, schreibt `platforms/<name>.md` und eine Build-Funktion. An den Skills ändert sich nichts.

## 5. Skills

Alle Fähigkeiten von Superpowers 6.3.0 bleiben erhalten. Sie werden zusammengefasst und gekürzt.

| leanpowers-Skill | Ersetzt (Superpowers) | Standard |
|---|---|---|
| `start` (Starttext, Abschnitt 6.1) | using-superpowers | an |
| `design` | brainstorming (Visual Companion → `details/`, standardmäßig aus) | an |
| `plan` | writing-plans | an |
| `staff` (neu) | – | an |
| `run` | subagent-driven-development, dispatching-parallel-agents, executing-plans (als Fallback) | an |
| `review` | requesting-code-review, receiving-code-review | an |
| `tdd` | test-driven-development | an |
| `debug` | systematic-debugging | an |
| `verify` | verification-before-completion (stützt sich auf `check`) | an |
| `worktrees` | using-git-worktrees | **aus** |
| `finish` | finishing-a-development-branch | an |
| `write-skill` | writing-skills | an |

**Eigene Skills** liegen in einem Ordner, der in `leanpowers.json` unter `extraSkillDirs` eingetragen ist, z. B. die Skills aus `leanpowers-lido`. Sie unterliegen denselben Regeln: gleiches Format, Lint und Schalter.

## 6. Start, Auslösung, Befehle

### 6.1 Starttext

- Wird injiziert per SessionStart-Hook (Claude Code), über den `AGENTS.md`-Baustein (Codex) bzw. über `GEMINI.md` (Gemini CLI).
- **Größe:** höchstens 150 Token, geprüft durch `skill-lint`.
- **Inhalt:** die Größenregel, die Liste der *aktiven* Befehle und der Hinweis „User instructions win“.
- Subagenten bekommen den Starttext nicht. Wo die Plattform das nicht unterdrücken kann, beginnt er mit einer einzeiligen Ausnahme für Subagenten.

### 6.2 Größenregel

| Größe | Kennzeichen | Ablauf |
|---|---|---|
| klein | eine Datei, klarer Fix, keine Schnittstellenänderung | direkt umsetzen → `check` |
| mittel | abgegrenzte Funktion in bestehendem Code | kurzes Design im Chat → Freigabe → ein Subagent → `check` |
| groß | neues Feature/Projekt, mehrere Bereiche, Schnittstellen | `design` → Spec → `plan` → `staff` → `run` → `finish` |

- Ist die Größe unklar, gilt die nächstgrößere Stufe.
- Ein ausdrücklicher Befehl oder eine Anweisung des Nutzers („direkt umsetzen“) übersteuert die Regel immer.

### 6.3 Befehle

`/leanpowers:design`, `plan`, `staff`, `run`, `debug`, `finish`, `check`, `skills`, `init`

- Auf allen drei Plattformen gibt es Befehle mit demselben Namen: Claude-Code-Commands, Codex-Prompts/Skills und Gemini-TOML-Befehle.

## 7. Ausführung

### 7.1 Rollen

- **Orchestrierer:** das Hauptfenster. Es entscheidet, trifft Rulings und schreibt keinen Produktionscode.
- **Implementer:** ein Subagent pro Aufgabe.
- **Reviewer:** ein Subagent.
- **Staffer:** ein kleines Modell, das die Besetzung vorschlägt.

### 7.2 Besetzung (`staff`)

1. Nach der Freigabe des Plans liest ein Subagent mit dem kleinsten konfigurierten Modell (`models.small`) den Plan.
2. Er schreibt `besetzung.md` (max. 200 Wörter) in den Run-Ordner. Die Datei enthält:
   - das empfohlene Modell für die Orchestrierung, mit Begründung (Umfang, Risiko, Art der Aufgaben)
   - die Modellstufe pro Aufgabe für Implementer und Reviewer
3. Das Hauptfenster zeigt die Empfehlung an. Wie das gewählte Modell übernimmt, bestimmt `orchestration` in der Konfig:
   - `auto` (Standard): Wo die Plattform verschachtelte Subagenten mit Modellwahl kann (Claude Code, Codex), startet das Hauptfenster einen **Orchestrierungs-Subagenten** mit dem gewählten Modell. Dieser führt `run` aus und startet Implementer und Reviewer selbst. Das Hauptfenster leitet nur Rückfragen weiter und meldet das Ergebnis. Rückfragen, die der Orchestrierer nicht selbst per Ruling entscheiden darf (die vier Stopp-Gründe aus `run`), gibt er mit Status `NEEDS_USER` an das Hauptfenster zurück; danach wird er mit der Antwort fortgesetzt. Auf Plattformen ohne Verschachtelung (Gemini CLI) gilt automatisch `switch`.
   - `switch`: Nach Bestätigung schaltet der Nutzer das Modell der Sitzung um (`/model`, später in LIDO Code Studio per Klick); dieselbe Sitzung führt `run` aus.
   - `recommend`: Die Orchestrierung bleibt beim aktuellen Modell; nur die Modellstufen pro Aufgabe gelten.
4. Ist kein Umschalten möglich oder lehnt der Nutzer ab, geht die Arbeit mit dem aktuellen Modell weiter. Die Modellstufen pro Aufgabe gelten trotzdem.
5. Die Tiefe bleibt begrenzt: Orchestrierer → Implementer/Reviewer. Implementer und Reviewer starten nie eigene Subagenten.
6. **Modellstufen:** Die Konfig arbeitet mit Stufen (`small`, `medium`, `large`). Pro Plattform werden sie auf konkrete Modellnamen abgebildet. So bleibt die Konfig unabhängig vom Assistenten.

### 7.3 Ablauf pro Aufgabe (`run`)

1. **Brief:** `checks/brief` erzeugt aus dem Plan `task-N-brief.md`. Der Brief enthält:
   - die Aufgabe
   - die erlaubten Dateien
   - die Schnittstellen aus früheren Aufgaben
   - die Abnahmekriterien
   - die globalen Regeln
   - die Strukturregeln, die für diese Dateien gelten

   Der Subagent bekommt nur den Pfad. Er bekommt nie den ganzen Plan und nie den Chatverlauf.
2. **Umsetzung:** Der Implementer arbeitet testgetrieben, führt `check` aus und schreibt `task-N-report.md` (max. 150 Wörter).
3. **Gate:** Der Orchestrierer führt `check` aus (Abschnitt 8). Ist das Gate rot, geht die Aufgabe an denselben Implementer zurück.
4. **Review nach Risiko:** Der Plan markiert jede Aufgabe mit `risk: low` oder `risk: high`.
   - `high`: Der Reviewer prüft die Aufgabe sofort.
   - `low`: Die Aufgaben werden gesammelt und alle 3 gemeinsam geprüft (Wert `reviewBatch` in der Konfig).
5. **Korrekturen:** höchstens 2 Runden. Danach entscheidet der Orchestrierer über jeden offenen Punkt und trägt die Entscheidung ins Protokoll ein.
6. **Protokoll:** `progress.md` im Run-Ordner. Es enthält:
   - den Status pro Aufgabe
   - die Rulings mit „cost if wrong“
   - die zurückgestellten Kleinigkeiten
   - die Kennzahlen (Abschnitt 8)
7. **Abschluss:** ein Gesamt-Review, danach `check --all` und dann `finish`.

- **Parallelität:** Unabhängige Aufgaben ohne gemeinsame Dateien dürfen parallel laufen, wenn der Plan sie als `parallel: true` markiert.
- **Fallback:** Kann eine Plattform keine Subagenten starten, arbeitet dieselbe Sitzung die Aufgaben der Reihe nach ab. Briefs und Gates bleiben gleich.

### 7.4 Zusammenfasser (Schnittstelle)

- Die Konfig enthält `summarizer: "none"` (Standard) oder einen Befehl, der lange Ausgaben auf stdin liest und eine Kurzfassung ausgibt, z. B. später ein lokales Modell über Ollama.
- `check` ruft den Zusammenfasser nur auf, wenn die relevante Rohausgabe eines Gates mehr als 60 Zeilen hat. Seine Antwort wird anschließend wie jede andere Ausgabe auf höchstens 20 Zeilen gekürzt. Schlägt der Zusammenfasser fehl, wird normal gekürzt.

## 8. Prüf-Skripte (`checks/`, ohne KI)

- **Aufruf:** über einen Einstiegspunkt `leanpowers check [--all] [--plan <file> --task <n>]`, auf allen Plattformen gleich.
- **Ausgabe im Erfolgsfall:** genau eine Zeile.
- **Ausgabe bei Fehlern:** nur die ersten 20 entdoppelten Fehlermeldungen pro Prüfung.

| Skript | Prüft | Datenquelle |
|---|---|---|
| `gates` | Tests, Typecheck, Lint | Befehle aus `leanpowers.json` → `commands` |
| `scope` | Geänderte Dateien (git diff seit Aufgabenstart) liegen in der erlaubten Liste des Briefs | Brief |
| `structure` | Strukturregeln, keine unerlaubten neuen Ordner | `structure` in der Konfig |
| `doc-lint` | Spec/Plan: Pflichtabschnitte, keine Platzhalter-Wörter (`TBD`, `TODO`, `???`; Inline-Code und Code-Blöcke werden ignoriert), jede Plan-Aufgabe hat `risk` und Dateiliste | Dateien in `paths.specs` / `paths.plans` |
| `skill-lint` | Wortobergrenzen, Kopfdaten, Verweise, Starttext ≤ 150 Token | `skills/`, `extraSkillDirs` |
| `config` | `leanpowers.json` gegen das JSON-Schema | Schema |
| `brief` | erzeugt Task-Briefs (Abschnitt 7.3) | Plan |
| `metrics` | zählt Subagenten-Starts, Größe von Briefs, Berichten und Reviews pro Run und trägt sie in `progress.md` ein | Run-Ordner |

- Ist für `gates` kein Befehl konfiguriert, meldet `check` ausdrücklich „no test command configured“. Ein „grün“ gibt es in diesem Fall nicht.
- Die Skripte laufen auch in CI, unabhängig vom Assistenten.

## 9. Konfiguration (`leanpowers.json`)

- **Ablage:** Die Datei liegt im Projekt-Root. Eine optionale Benutzerdatei liegt unter `~/.config/leanpowers/config.json`.
- **Vorrang:** Bei Widersprüchen gilt die Projekt-Datei.
- **Schema:** Das JSON-Schema liegt in `schema/`.

```json
{
  "$schema": "https://raw.githubusercontent.com/Amangaron/leanpowers/main/schema/leanpowers.schema.json",
  "skills": { "worktrees": false, "design.visualCompanion": false },
  "extraSkillDirs": [],
  "paths": {
    "specs": "docs/specs", "plans": "docs/plans", "reports": "docs/reports",
    "runs": ".leanpowers/runs"
  },
  "commands": { "test": "npm test", "typecheck": "npm run typecheck", "lint": "" },
  "structure": {
    "newFolders": "ask",
    "rules": [{ "path": "src/components/**", "allow": ["*.tsx", "*.ts"] }]
  },
  "review": { "batch": 3, "maxFixRounds": 2 },
  "models": { "small": "auto", "medium": "auto", "large": "auto" },
  "orchestration": "auto",
  "summarizer": "none"
}
```

- Fehlende Werte werden mit Standardwerten ergänzt.
- Ist die Datei ungültig, gibt es eine Meldung mit Pfad und Feld. Danach wird mit Standardwerten weitergearbeitet.
- `/leanpowers:skills` zeigt eine Ankreuzliste aller Skills (eingebaute und `extraSkillDirs`) und schreibt `skills`.
- **Abschalten wirkt dreifach:**
  1. Der Starttext führt nur aktive Skills auf.
  2. Wo die Plattform es erlaubt, wird der Skill technisch ausgeblendet. Der Mechanismus pro Plattform wird in der Planung geprüft (offener Punkt O2).
  3. Jeder Skill prüft in seiner ersten Zeile seinen Schalter und bricht ab, wenn er aus ist.

## 10. Ordnerstruktur

### 10.1 Ablage

| Inhalt | Standard | Git |
|---|---|---|
| Specs | `docs/specs/YYYY-MM-DD-<thema>-design.md` | ja |
| Pläne | `docs/plans/YYYY-MM-DD-<thema>.md` | ja |
| Abnahmeberichte | `docs/reports/YYYY-MM-DD-<thema>.md` | ja |
| Arbeitsdateien | `.leanpowers/runs/YYYY-MM-DD-<thema>/` (progress.md, besetzung.md, task-N-brief/report.md, review-*.diff) | nein (eigene `.gitignore` mit `*`) |

- Alle Pfade sind über `paths` änderbar.
- Kein Skill nennt einen festen Pfad. Skills verweisen immer auf `paths.*`.

### 10.2 Projektstruktur respektieren

- `/leanpowers:init` durchsucht das Projekt per Skript: Ordner, Dateitypen pro Ordner, vorhandene Testbefehle in `package.json`, `Makefile` usw.
- Daraus schlägt es `structure.rules` und `commands` vor. Der Nutzer bestätigt, dann wird `leanpowers.json` geschrieben.
- `newFolders`:
  - `ask`: Ein neuer Ordner braucht ein Ruling oder eine Freigabe im Plan.
  - `allow`: Neue Ordner sind ohne Freigabe erlaubt.
  - `deny`: Neue Ordner sind nicht erlaubt.

### 10.3 Vorlagen

- `templates/<name>/` enthält das Ordnergerüst und eine `leanpowers.json` mit passenden Strukturregeln.
- `/leanpowers:init --template <name>` legt ein neues Projekt aus der Vorlage an.
- Weitere Plugins (z. B. `leanpowers-lido`) bringen eigene Vorlagen im selben Format mit.

## 11. Tests

- **Deterministisch (CI: macOS, Windows, Linux):**
  - Unit-Tests aller `checks/`-Skripte
  - Build-Tests: Vergleich mit gespeicherten Sollständen (Snapshots) von `dist/` pro Plattform
  - `skill-lint` und `config` über das Repository und die Vorlagen
- **Szenario-Tests (manuell bzw. vor einem Release, kosten Token):**
  - Ein Beispielprojekt in `tests/scenarios/` mit je einer kleinen, mittleren und großen Aufgabe.
  - Die Läufe erfolgen headless mit Claude Code, Codex und Gemini CLI.
  - `metrics` misst Token und Subagenten. Zum Vergleich läuft Superpowers 6.3.0 auf Claude Code mit denselben Aufgaben.
- **Abnahme v0.1:**
  - Alle deterministischen Tests sind grün.
  - Die große Szenario-Aufgabe läuft auf allen drei Plattformen durch.
  - Auf Claude Code braucht sie mindestens 40 % weniger Token als Superpowers.
  - Ein Pilotlauf mit einem echten Plan in LIDO Code Studio ist erfolgreich (mit `paths` auf `docs/superpowers/...`).

## 12. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Kein Testbefehl | `check` meldet das ausdrücklich, kein falsches „grün“ |
| Konfig ungültig | Meldung mit Feld, dann weiter mit Standardwerten |
| Plattform ohne Subagenten | Aufgaben der Reihe nach in der Sitzung, gleiche Gates |
| Modellwechsel nicht möglich/abgelehnt | Besetzung bleibt Empfehlung, Arbeit geht weiter |
| Gate nach 2 Korrekturrunden rot | Orchestrierer trifft ein Ruling: zurückstellen, Plan anpassen oder den Nutzer fragen |
| Implementer ändert Dateien außerhalb des Briefs | `scope` schlägt fehl, zurück an den Implementer |

## 13. Veröffentlichung

- **Repository:** öffentliches GitHub-Repo `leanpowers` im persönlichen Konto des Autors.
- **Installationswege:**
  - Claude Code: Marketplace-Eintrag im Repository
  - Codex und Gemini CLI: Installation per GitHub-URL
- **Versionierung:** SemVer mit `CHANGELOG.md`.
- **Lizenz:** MIT. `NOTICE` nennt Superpowers (Jesse Vincent) als Vorlage.
- **Reihenfolge:** zuerst v0.1 als Pilot an LIDO Code Studio, danach die öffentliche Ankündigung.

## 14. Offene Punkte (in der Planung zu klären)

- **O1 (erledigt 2026-10-29):** GitHub-Konto ist `Amangaron`; Repository `github.com/Amangaron/leanpowers`.
- **O2:** Technischer Mechanismus, um einen Skill auf der jeweiligen Plattform auszublenden, für Claude Code, Codex und Gemini CLI. Ist das nicht möglich, gilt die Rückfallebene aus Abschnitt 9.
- **O3:** Subagenten-Fähigkeiten von Codex und Gemini CLI zum Planungszeitpunkt: ob sie verfügbar sind, wie die Modellwahl pro Subagent funktioniert und wie sich der Starttext für Subagenten unterdrücken lässt. Die Zuordnung in `platforms/*.md` richtet sich danach.

## 15. Anforderungen aus Plan 2 (für Plan 3 und 4)

- **A1 (Plan 3):** Subagenten müssen den Befehl `leanpowers` aufrufen können. Briefs enthalten wörtlich `leanpowers check …`. Deshalb legt die Installation `leanpowers` in den PATH, oder `leanpowers brief` schreibt den aufgelösten Aufruf in den Brief. Ein Umschreiben beim Build erreicht Briefs nicht, die erst zur Laufzeit entstehen.
- **A2 (Plan 3):** Die fünf Vorlagen aus `agents/` werden nicht als dauerhaft geladene Plattform-Agenten registriert, sondern als Prompt-Text übergeben. Ausnahme Gemini: dort gibt es die Agent-Dateien `lp-<tier>` mit einer kurzen Beschreibung. Andernfalls kämen etwa 177 Token zum immer geladenen Text hinzu.
- **A3 (Plan 3):** Alle in `platforms/*.md` als `(unverified)` markierten Angaben werden durch echte Läufe bestätigt oder korrigiert.
- **A4 (Plan 4):** Die Szenario-Tests decken vier Fälle ab:
  - Lauf gestartet auf `main` (Branch-Schutz)
  - Worktrees eingeschaltet
  - mittlere Aufgabe (ein Subagent)
  - Stopp bei roter Prüfung mit der Antwort „trotzdem weiter“
- **Gemessen nach Plan 2:**
  - Dauerhaft geladen sind etwa 515 Token: der Starttext und alle Skill-Beschreibungen.
  - Superpowers 6.3.0 kommt nach derselben Messmethode auf etwa 1.030 Token, leanpowers spart also rund 50 %.

## 16. Entscheidung 2026-10-29: keine kostenpflichtigen Testläufe

- **Was wegfällt:**
  - Szenario-Tests aus Abschnitt 11 und Anforderung A4.
  - Token-Messung gegen Superpowers.
  - Echte Prüfläufe mit Claude Code, Codex und Gemini.
- **Warum:** leanpowers wird hauptsächlich mit Claude genutzt. Wer das Plugin einsetzen will, prüft selbst, ob es für ihn gut funktioniert.
- **Was bleibt:**
  - Die Prüfskripte `scripts/verify-claude.mjs` und `scripts/verify-codex.sh` liegen weiter im Repository, damit Nutzer selbst prüfen können.
  - Die Ersparnis von etwa 50 % beim dauerhaft geladenen Text ist **berechnet** (Wörter × 4/3), nicht gemessen. Die Anleitungen sagen das so.
- **Abnahme v0.1 (ersetzt die Abnahme in Abschnitt 11):**
  - Alle deterministischen Tests sind grün, auch in CI auf macOS, Windows und Linux.
  - Das Claude-Paket lädt in Claude Code: Das ist bestätigt.
  - Codex und Gemini sind als „gebaut, ungeprüft“ gekennzeichnet.
- **Pilot an LIDO Code Studio:** Ob es ihn gibt, entscheidet der Nutzer. Er ist normaler Einsatz, kein Test, und keine Bedingung für v0.1.
- **Veröffentlichung:** Das Hochladen auf GitHub (Push, Repository anlegen) geschieht nur nach ausdrücklicher Zustimmung des Nutzers.
