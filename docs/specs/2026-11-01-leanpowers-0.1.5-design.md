# leanpowers 0.1.5 – Größenregel modellunabhängig, Abschluss ohne Lücken – Design-Spezifikation

**Stand:** 2026-11-01 · **Status:** Design abschnittsweise vom Nutzer freigegeben; Spec zur Durchsicht · **Grundlage:**
Pilotlauf mit 0.1.4 am 2026-11-01 in einem Testprojekt (kleine TypeScript-CLI), je ein mittlerer und ein großer Auftrag,
mit Claude Code (Sonnet und Opus) und Codex CLI · **Bezug:** Haupt-Spec `docs/specs/2026-10-29-leanpowers-design.md`,
Spec 0.1.4 `docs/specs/2026-11-01-leanpowers-0.1.4-design.md`, Stand des Repos 0.1.4 (`72573e0`).

## 1. Ziel

Der große Weg greift unabhängig vom Modell, `finish` fällt nie weg, eigene Pfade gelten vor fremden, und das Ergebnis
eines Laufs bleibt nach dem Aufräumen erhalten. Der Charakter bleibt: schlank, technikneutral, gleiche Regeln für
Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests (Haupt-Spec Abschnitt 16).

## 2. Befunde aus dem Pilot (neutral zusammengefasst)

1. **Größe hängt am Modell.** Ein kleineres Claude-Modell stufte den großen Auftrag in drei von drei Versuchen als
   `medium` ein. Es rief den `design`-Skill nie auf; der Skill stand nur in der Skill-Liste. Es arbeitete allein nach
   dem Starttext, dessen Größenregel weicher ist als die im Skill („bounded change in existing code“ statt „no existing
   flow → not medium“). Das größere Modell lud `design`, `plan`, `staff` und `finish` von selbst.
2. **Abschluss bricht weg.** In einer Sandbox, die `.git` sperrt, endeten beide Codex-Läufe ohne Commit und ohne die
   vier Optionen von `finish`. Ein Claude-Lauf ohne Feature-Branch deutete die Optionen um und committete auf `main`.
   `finish` löschte im großen Lauf den Run-Ordner samt Ledger und neun offenen Kleinigkeiten.
3. **Eigene Pfade nicht durchgesetzt.** Run-Artefakte lagen unter `/tmp` – eine Wahl der KI, nachdem sie für neue
   Ordner gerügt worden war, keine Sperre. Spec und Plan landeten im Pfad eines anderen Plugins, dessen Skills die KI
   über eine globale Nutzerdatei gelesen hatte. Neue Ordner entstanden ohne Rückfrage trotz `newFolders: "ask"`, und
   Spec und Plan behaupteten eine Freigabe, die es nicht gab.
4. **Kleinere Punkte.** `staff` zeigte die Besetzung bei `auto` nicht, das Hauptfenster hob drei Stufen still an.
   Vorlagenpfade wurden relativ zum Skill-Ordner gesucht (`skills/<x>/prompts/…`). Befehle und Pfade in
   Shell-Variablen wurden in Hauptfenster, Orchestrierer, Implementer und Schluss-Review blockiert. Ein
   Codex-Orchestrierer wählte einen Modellnamen aus einem lokalen Katalog. Design-Fragen kamen einzeln, auch
   unabhängige (sieben Runden bis zur Spec).

Dazu vier offene Kleinigkeiten aus dem Schluss-Review von 0.1.4 (Abschnitt 8).

## 3. Nicht-Ziele

- Eine Prüfung, ob die KI die Größe „richtig“ wählt. Das zeigt nur ein Lauf mit echter KI (Abschnitt 10).
- Höhere Wortgrenzen (Skills 600, Agent-Vorlagen 400, Starttext 150 Token).
- Eine Suche im ganzen Repo nach Spec- oder Plan-artigen Dateien außerhalb der eigenen Pfade: nicht deterministisch,
  würde in Projekten mit älteren Dokumenten dauerhaft warnen.
- `Size:` zusätzlich in der letzten Nachricht der ersten Antwort (Pilot-Vorschlag 8): Der Befund kam aus dem
  Testaufbau (`codex exec -o` zeigt nur die letzte Nachricht); im Chat steht die Marke am Anfang. Verworfen.
- Commits pro Aufgabe in einer Sandbox ohne Git-Schreibrecht. `finish` deckt den Fall ab (Abschnitt 6.3); der Lauf
  selbst bleibt bei den bestehenden Gate-Regeln.
- Änderungen an `agents/implementer.md` (400/400 Wörter); was der Implementer zusätzlich braucht, kommt über den
  erzeugten Brief.

## 4. Starttext und Größenregel

### 4.1 Neuer Starttext (vollständig)

```text
Subagents ignore this text.

leanpowers: before answering any change request, invoke the `design` skill; it holds the size rule and the gates. Open with `Size: small|medium|large` (unclear → larger):
- Small: one file, clear fix.
- Medium: bounded change to a flow that already exists.
- Large: new feature, command or data field, several areas, or interfaces.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions win, but Medium needs design approval and Large plan approval before any code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

Die drei Ablaufzeilen von 0.1.4 entfallen; die Abläufe stehen im `design`-Skill, den der Starttext jetzt zuerst
verlangt. `startText()` ersetzt weiterhin nur die `Commands:`-Zeile.

### 4.2 Budget

Zählregel: `estimateTokens` = ⌈Wörter × 4/3⌉ (`checks/skill-lint.mjs`), Grenze 150.

| Variante | 0.1.4 | 0.1.5 |
| --- | --- | --- |
| Body | 100 Wörter → 134 Token | 101 Wörter → 135 Token |
| mit CLI-Zeile (SessionStart, Pfad ohne Leerzeichen) | 142 | 143 |
| `AGENTS.md`-Block | 128 | 130 |
| `GEMINI.md` | 148 | 148, weil `CONTEXT_FALLBACK` in `build/gemini.mjs` kürzer wird: `else: folder of gemini-extension.json` |

### 4.3 `design`-Skill

- **Größenregel**, Large: `new feature or project, a new command or data field, several areas, or changed
  interfaces.` Small und Medium bleiben. Starttext und Skill nennen für Large dieselben Merkmale.
- **Gate:** `dispatch no subagent` wird `dispatch no implementer`. Unter Large Schritt 4, nach `This yes opens the
  spec, not the code: no implementer before an approved plan.`, folgt: Subagenten dürfen vor der Plan-Freigabe lesen,
  prüfen und Spec oder Plan schreiben, nie Code.
- **Fragen:** Large Schritt 2 und der Abschnitt für klein und mittel: bis zu drei unabhängige Fragen pro Nachricht,
  jede als Auswahl mit der Empfehlung zuerst; eine Frage, von der andere abhängen, kommt allein.
- **Spec-Pfad:** Schritt 5 schreibt nach `paths.specs`, auch wenn ein anderes Plugin oder eine andere Anleitung einen
  anderen Ort nennt (Abschnitt 5). Spec und Plan nennen nur Freigaben, die der Nutzer wirklich gab.
- **Mittlerer Weg:** Die Anleitung nach der Freigabe (Brief, `brief --file`, Dispatch, Status, `check --brief`,
  `finish`) wandert nach `details/medium.md`. Im Skill bleibt: `Medium → follow [details/medium.md](details/medium.md)
  step by step.` So bleibt `design` unter 600 Wörtern (heute 593).

### 4.4 Tests

- `tests/start.test.mjs` und `tests/skills-content.test.mjs`: Starttext enthält `` invoke the `design` skill ``,
  `command or data field` und `before any code or implementer dispatch`; Budget ≤ 150 Token mit CLI-Zeile; der
  bisherige Anker `before any code or subagent dispatch` wird ersetzt.
- `design/SKILL.md` enthält `command or data field`, `dispatch no implementer` und den Verweis auf `details/medium.md`.
- `tests/build.test.mjs`: `GEMINI.md` ≤ 150 Token.

## 5. Pfade und Ordner

### 5.1 Regel

`paths.specs`, `paths.plans`, `paths.runs` und `paths.reports` aus `leanpowers.json` gelten vor `/tmp`, vor einem
Scratchpad und vor Pfaden anderer Plugins oder Anleitungen. Diese Ordner sind durch die Konfiguration freigegeben:
Sie anzulegen braucht keine Rückfrage, auch nicht bei `newFolders: "ask"`.

Ort der Regel im Text: `design` Schritt 5 (Spec), `plan` Schritt 7 (Plan), `staff` Schritt 1 (Run-Ordner: nie
`/tmp`), `design/details/medium.md` (Brief). `run` verweist für den Run-Ordner auf `staff` und wird nicht länger.

### 5.2 Code

- **`init`:** `proposeConfig` schreibt `paths` mit den vier Standardwerten aus `DEFAULTS.paths` ausdrücklich in den
  Vorschlag, Reihenfolge `$schema`, `paths`, `commands`, `structure`.
- **Struktur-Check:** `checkStructure` bekommt `ownFolders` (die vier Pfade, posix, ohne `./` und Schrägstrich am
  Ende). Ein Ordner, der einer davon ist oder ein Elternordner davon, wird nie als neuer Ordner gemeldet – bei `ask`
  und bei `deny`. Unterordner eigener Pfade (`.leanpowers/runs/<plan>`) zählen ebenfalls als eigen.
- **Warnungen** (scheitern nie, Text `plan outside paths.plans (<paths.plans>): <pfad>` bzw. `brief outside
  paths.runs (<paths.runs>): <pfad>`):
  - `check --plan … --task …` und `check --brief …`: in der Warnungsliste von `formatResults`;
  - `brief --plan`, `brief --file`, `metrics --plan`: als Zeile `warning: …` auf stderr, Exit-Code unverändert.
  Eine gemeinsame Funktion in `checks/lib/paths.mjs` entscheidet „liegt innerhalb“ (posix, relativ zum Projekt).

### 5.3 Tests

`init`-Vorschlag enthält `paths`; `structure` grün für neues `docs/specs/x.md` und `.leanpowers/runs/p/x.md` bei
`ask` und `deny`, rot für `docs/neu/x.md`; Warnung für Plan bzw. Brief außerhalb, keine innerhalb.

## 6. Abschluss

### 6.1 Neuer Befehl `leanpowers report --plan <plan>`

- Quelle: `<paths.runs>/<plan-basename>/progress.md`. Fehlt sie: Exit 1, `no ledger for <plan>: <pfad>`.
- Ziel: `<paths.reports>/<plan-basename>.md`; der Ordner wird bei Bedarf angelegt (eigener Pfad, Abschnitt 5.1); eine
  vorhandene Datei wird überschrieben, gleiche Eingabe ergibt gleiche Datei. Ausgabe auf stdout: der Pfad der Datei.
- Inhalt:

  ```markdown
  # Run report — <plan-basename>

  Plan: <plan path>
  <Kopfzeile des Ledgers, die mit "Run base:" beginnt; fehlt sie, entfällt die Zeile>

  ## Rulings and open points

  <jede Ledger-Zeile, die "Ruling:", "minor (deferred)" oder " parked — " enthält oder mit "Stop:" bzw. "Final:"
  beginnt, wörtlich, in Ledger-Reihenfolge, jede Zeile nur einmal; keine solche Zeile → "none">

  <der Abschnitt "## Metrics" aus dem Ledger bis zum Dateiende, wörtlich, falls vorhanden>
  ```

- Ort: `checks/report.mjs`, Aufruf in `bin/leanpowers.mjs`, Usage-Zeile `report --plan <plan>`.
- `run` Ende, Schritt 4: nach `leanpowers metrics --plan <plan>` folgt `leanpowers report --plan <plan>` und ein Commit
  der Berichtsdatei (`docs: run report <topic>`). `run` bleibt ≤ 600 Wörter; dafür wird an anderer Stelle gekürzt.
- `finish` Schritt 5: Der Run-Ordner wird nur entfernt, wenn der Bericht existiert; fehlt er, erst `leanpowers report`
  ausführen.

### 6.2 Feature-Branch

- **Mittlerer Weg** (`design/details/medium.md`): vor dem Dispatch die Branch-Regel aus `run/details/ledger.md` (Branch
  guard, Punkt 2): Steht HEAD auf dem Standard-Branch, `feat/<topic>` anlegen und wechseln; ein vom Nutzer genannter
  Branch gilt vor.
- **`finish` Schritt 2:** Liegt die Arbeit uncommittet auf dem Basis-Branch, erst `feat/<topic>` anlegen und dort
  committen (nach der Rückfrage aus Schritt 1), dann die vier Optionen. Ist sie dort schon committet: das offen sagen;
  Merge und PR entfallen, angeboten werden nur „behalten“ und „pushen“; die Historie des Basis-Branches wird nie
  umgeschrieben.

### 6.3 Ohne Git-Schreibrecht

Scheitert ein Git-Schreibbefehl, weil `.git` nicht beschreibbar ist (Sandbox, Rechte): `finish` prüft trotzdem
(`check --all`), bietet die vier Optionen an, gibt für die gewählte die genauen Git-Befehle zum Selbst-Ausführen aus,
sagt klar, dass nichts committet ist, und räumt nichts auf. `design/details/medium.md`: `finish` wird auch dann
aufgerufen, wenn der Commit scheiterte.

### 6.4 Budgets und Tests

`finish` wächst von 510 auf höchstens 600 Wörter (Ziel ≈ 570). Tests: `tests/report.test.mjs` (Zeilenauswahl,
Reihenfolge, Metrics, Idempotenz, fehlendes Ledger, „none“); Textanker in `finish` (`report`, read-only Git) und
`medium.md` (Branch, `finish` nach gescheitertem Commit); CLI-Usage nennt `report`.

## 7. Orchestrierung und Vorlagen

### 7.1 `staff`

- Schritt 3 gilt in jedem Modus, auch `auto`, und steht vor Schritt 4: drei Zeilen an den Nutzer. Ändert das
  Hauptfenster selbst die Empfehlung des Staffers, nennt es jede Änderung mit Grund und schreibt sie in
  `besetzung.md`.
- Der Satz `Add the "Wait for a subagent" line of platform.md to its prompt verbatim.` steht direkt hinter dem
  Dispatch-Satz des Orchestrierers (Kleinigkeit aus 0.1.4).

### 7.2 Codex-Modelle

`platforms/codex-cli.md`, Abschnitt Model tiers: Die Stufe kommt nur über `reasoning_effort`. `model` wird nur
gesetzt, wenn `models.*` in `leanpowers.json` einen Wert vorgibt. Nie einen Modellnamen aus einem Katalog oder einer
Modellliste wählen.

### 7.3 Vorlagenpfade

`build/runtime.mjs` schreibt in kopierten `skills/**/*.md` `` `agents/ `` als `` `<plugin>/prompts/ `` (bisher
`` `prompts/ ``); `(agents/` wird weiter zu `(prompts/`. Jede `platforms/*.md` definiert `<plugin>`: der Plugin-Ordner,
zwei Ebenen über jeder leanpowers-`SKILL.md` (Claude Code: `${CLAUDE_PLUGIN_ROOT}`; Gemini: `${extensionPath}`).
Wortzahlen der Quellen ändern sich nicht.

### 7.4 Keine Shell-Variablen

Regeltext: `Write every shell command and path out in full; never store a command or path in a shell variable (zsh
does not split words, and some harnesses block variables).`

- `platforms/*.md` (alle drei), neuer Abschnitt `## Shell`: für Hauptfenster und alle Rollen.
- `agents/orchestrator.md`: die bestehende CLI-Zeile wird auf diese Regel verallgemeinert; die Vorlage bleibt ≤ 400.
- `agents/reviewer.md` und `agents/re-reviewer.md`: je ein Satz unter Hard rules.
- `checks/brief.mjs`: der bestehende Satz im When-done-Teil des erzeugten Briefs wird auf Befehle und Pfade
  erweitert; so erreicht die Regel den Implementer ohne Änderung an `implementer.md`.

### 7.5 Ledger-Zeile des Implementers

Die ID eines Agenten steht erst nach dem Dispatch fest. `run/details/ledger.md`:

- vor dem Dispatch: `Task <n>: implementer dispatched (<name>)` – `<name>` ist der Name, den der Dispatch dem Agenten
  gibt, wo die Plattform einen annimmt (Codex `task_name`); sonst `-`;
- sobald die ID bekannt ist: `Task <n>: implementer id <id>`;
- Resume: eine `implementer id`-Zeile hat Vorrang; sonst gilt der Name aus der `dispatched`-Zeile.

### 7.6 Tests

`build.test.mjs`: in allen Paketen kein `` `agents/ `` und kein `` `prompts/ `` ohne `<plugin>/` in Skills; jede
`platform.md` definiert `<plugin>` und enthält `## Shell`. Textanker: Variablen-Regel in `orchestrator.md`,
`reviewer.md`, `re-reviewer.md` und im erzeugten Brief (`brief.test.mjs`); `staff` Schritt 3 „in every mode“;
Codex-Regel; `implementer id` in `ledger.md`.

## 8. Kleinigkeiten aus 0.1.4

1. **Brief-Muster doppelt:** `checks/brief.mjs` exportiert `briefTaskNumber(file)` (Zahl oder `null`) und die
   Meldungskonstante für `brief --file`; `check.mjs`, `brief.mjs` und `bin/leanpowers.mjs` nutzen sie statt eigener
   Regex bzw. String-Vergleich.
2. **„1 files“:** `uncommittedWarning` schreibt `1 file`, ab zwei `files`.
3. **Satz in `staff`:** Abschnitt 7.1.
4. **Ledger-Zeile vor der Agent-ID:** Abschnitt 7.5.

Tests: `check.test.mjs` für beide Plural-Formen; bestehende Tests zu `brief --file`/`check --brief` bleiben grün.

## 9. Release 0.1.5

Version `0.1.5` in `package.json` und allen erzeugten Manifesten; `CHANGELOG.md` mit `## [0.1.5] - 2026-11-01`;
`docs/README.md` und `docs/README.de.md`: `report`, Pfadregel, `finish` ohne Git-Schreibrecht, Status 0.1.5; `dist/`
neu gebaut. `npm test` und `node bin/leanpowers.mjs check --all` grün. Merge, Tag `v0.1.5`, Push, Marketplace und
Gemini-Extension-Branch nur nach ausdrücklichem Ja des Nutzers im `finish`-Schritt.

## 10. Prüflauf nach der Umsetzung

- Zwei frische Klone des Testprojekts ab Tag `ausgangsstand`; `node_modules` aus dem Original kopiert, kein Download.
- `claude -p` ohne `--model` (Standardmodell, das kleinere Modell aus Befund 1), mit `--plugin-dir
  <worktree>/dist/claude-plugin` und per `--settings` nur für diesen Aufruf abgeschaltetem installiertem 0.1.4. Die
  Installation des Nutzers bleibt unverändert.
- Aufträge wie im Pilot: mittel „Füge einen Export der Aufgaben als CSV hinzu.“, groß „Füge wiederkehrende Aufgaben
  mit Erinnerungen hinzu.“ Ein Subagent spielt den Nutzer.
- Ausgewertet: `Size:`-Marke; `design` per Skill aufgerufen (Transkript); groß: Spec und Plan in den eigenen Pfaden,
  Besetzung sichtbar, Bericht in `paths.reports`, `finish` mit vier Optionen; mittel: Feature-Branch, Brief, `finish`.
- Kostenrahmen 4–8 USD, vom Nutzer freigegeben. Belege außerhalb des Repos.

## 11. Entscheidungen des Nutzers

- **F1 – Ablage des Ledger-Schlusses:** entschieden (a), Bericht über den neuen Befehl `report` in `paths.reports`.
  Verworfen: (b) Anhang am Plan; (c) Run-Ordner behalten.
- **F2 – Subagenten vor der Plan-Freigabe bei large:** entschieden (a), erlaubt zum Lesen, Prüfen und Schreiben von
  Spec und Plan, nie Code. Verworfen: (b) gar keine.
- **F3 – Design-Fragen:** entschieden (a), bis zu drei unabhängige pro Nachricht. Verworfen: (b) eine pro Nachricht.
- **Abschnitte 1–5 des Designs** einzeln freigegeben, Abschnitt 5 einschließlich Prüflauf und Kostenrahmen.

## 12. Reihenfolge und Größe

Nach der eigenen Regel **groß** (neuer Befehl, Checks, mehrere Skills, Vorlagen, Plattform-Dateien, Build). Plan mit
etwa sieben Aufgaben:

1. Code: `report`-Befehl (Abschnitt 6.1, ohne Skill-Texte).
2. Code: Pfade – `init`, `ownFolders`, Warnungen, `lib/paths.mjs` (5.2) – und Kleinigkeiten 1–2 (8).
3. Code: Build – Vorlagenpfade, Gemini-Fallback (7.3, 4.2) – und Brief-Satz (7.4).
4. Texte Größenregel: Starttext, `design`, `design/details/medium.md` (4, 5.1, 6.2, 6.3).
5. Texte Orchestrierung und Abschluss: `staff`, `run`, `run/details/ledger.md`, `finish`, `plan`, Vorlagen,
   `platforms/*.md` (5.1, 6.1, 6.2, 6.3, 7).
6. Release 0.1.5: Version, CHANGELOG, READMEs, `dist/` (9).
7. Prüflauf (10), Auswertung im Hauptfenster.
