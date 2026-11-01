# leanpowers 0.1.6 – Mittlerer Weg, Besetzung mit der Plan-Freigabe, Feature-Branch – Design-Spezifikation

**Stand:** 2026-11-01 · **Status:** vom Nutzer freigegeben (Design abschnittsweise am 2026-11-01; Spec-Durchsicht steht
aus) · **Grundlage:** Prüflauf von 0.1.5 auf Sonnet in einem Testprojekt (kleine TypeScript-CLI) · **Bezug:** Haupt-Spec
`docs/specs/2026-10-29-leanpowers-design.md`, Spec 0.1.5 `docs/specs/2026-11-01-leanpowers-0.1.5-design.md`, Stand des
Repos 0.1.5 (`0398ffe`).

## 1. Ziel

Der mittlere Weg läuft Schritt für Schritt nach `details/medium.md` oder hält an, statt zu improvisieren; die Besetzung
erreicht den Nutzer sicher, weil sie mit der Plan-Freigabe kommt; Spec, Plan, Code und Bericht liegen auf einem
Feature-Branch, den das Hauptfenster anlegt, sodass `finish` etwas zu mergen hat. Der Charakter bleibt: schlank,
technikneutral, gleiche Regeln für Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests
(Haupt-Spec Abschnitt 16).

## 2. Befunde aus dem Prüflauf 0.1.5 (neutral zusammengefasst)

1. **Mittlerer Weg improvisiert.** Das Lesen von `skills/design/details/medium.md` wurde im Prüfaufbau verweigert: Der
   Plugin-Ordner lag per `--plugin-dir` außerhalb des Projekts, ohne `--add-dir`. Danach improvisierte das Modell:
   eigener Subagent-Auftrag „nicht committen“, kein Branch, keine Brief-Datei, kein `brief --file` und kein
   `check --brief`, kein `finish`. Ob der Weg mit lesbarer Datei hält, ist offen. Die Gesamtauswertung hatte die Datei
   fälschlich als „gelesen“ notiert.
2. **Besetzung nicht gezeigt.** Das Hauptfenster las `besetzung.md` und dispatchte den Orchestrierer sofort, obwohl
   `staff` Schritt 3 die drei Zeilen „in every mode“ vor Schritt 4 verlangt.
3. **Kein Feature-Branch, in keinem Lauf.** Das Hauptfenster schrieb in den Orchestrierer-Auftrag die Beschreibung
   „Working directory: … (branch main, no worktree)“. Der Orchestrierer las sie als Nutzeranweisung, ein Ledger-Ruling
   behauptete „user instructions name branch main“. Die Regel in `run/details/ledger.md` (Branch guard: „User
   instructions that name a branch … win“) ließ das zu. `finish` bot deshalb keinen Merge an.
4. **Größe trotz genanntem Merkmal zu klein.** Der mittlere Prüfauftrag „CSV-Export“ ist nach der Regel von 0.1.5
   wörtlich large („a new command“; kein bestehender Ablauf → nicht medium). Das Modell schrieb „Size: medium – ein
   neuer Befehl in der bestehenden CLI“, nannte also das Large-Merkmal und wählte trotzdem medium.

## 3. Nicht-Ziele

- Der Orchestrierer endete einmal ohne Status-Zeile; die Resume-Regel aus 0.1.5 griff. Keine Änderung.
- Versuche mit Shell-Variablen: Die Harness blockt sie, die Regel aus 0.1.5 steht. Keine Änderung.
- Keine Lockerung der Größenregel.
- Keine Branch-Warnung in `check --all` oder im einfachen `check`: Nach jedem regulären Merge nach `main` gäbe es dort
  Fehlalarme.
- Keine Git-Schreibbefehle in der CLI; sie bleibt lesend.
- `finish` bleibt unverändert.
- `agents/staffer.md` und das Format von `besetzung.md` bleiben unverändert.
- Höhere Wortgrenzen (Skills 600, Agent-Vorlagen 400).

## 4. Größenregel und mittlerer Weg

### 4.1 `design`

- **Größenregel** bleibt wörtlich. Neues Red flag:
  `"Just one new command in the existing CLI" → a new command is large.`
- **Medium-Zeile** nennt die Schritte:
  `Medium → follow [details/medium.md](details/medium.md) step by step: branch, brief, base, dispatch, check, finish.
  No spec, no plan.`
- **Unlesbare Dateien:**
  `A linked file you cannot read: name its path, ask the user for access and stop; never improvise its steps.`

### 4.2 Gleiche Regel in `plan`, `staff` und `run`

Je ein Satz mit demselben Inhalt wie in 4.1:

- `plan`: für `details/plan-format.md`;
- `staff`: für `platform.md` und die Vorlagen (`agents/staffer.md`, `agents/orchestrator.md`);
- `run`: für `details/ledger.md`, `details/loops.md` und `platform.md`. Läuft `run` in einem Orchestrierer-Subagenten,
  heißt „stop“: eine Zeile `Stop: <Frage>` ins Ledger schreiben und `NEEDS_USER` zurückgeben.

### 4.3 `details/medium.md`

Inhaltlich gleich. Nur Schritt 1 bekommt die Branch-Regel aus Abschnitt 6.1.

### 4.4 Platz

Wortzahlen heute (Body, `checks/skill-lint.mjs`): `design` 599, `run` 600, `staff` 531, `plan` 457, `finish` 597,
`agents/orchestrator.md` 399. Grenzen: Skills ≤ 600, Agent-Vorlagen ≤ 400.

- `design` wächst durch 4.1, 5.3 und 6.1. Gekürzt wird in derselben Datei, etwa das lange Beispiel in „Classify“ und
  das Red flag „I'll call it medium to skip the spec“, das „Unsure → take the larger class“ wiederholt; weitere
  Kürzungen ebenfalls in `design`, bis der Body ≤ 600 ist.
- `run` (600/600) wächst um den Satz aus 4.2 und kürzt in derselben Datei im gleichen Umfang.
- `plan` und `staff` wachsen und bleiben unter 600. `agents/orchestrator.md` bleibt unverändert.
- Den genauen Wortlaut der Kürzungen legt der Plan fest.

### 4.5 Tests

`tests/skills-content.test.mjs`:

- `design` enthält das neue Red flag, die Schrittzeile aus 4.1 und die Lesbarkeitsregel;
- `plan`, `staff` und `run` enthalten je ihre Lesbarkeitsregel, `run` dazu `Stop:` und `NEEDS_USER` in diesem Satz;
- der bisherige Anker `'Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.'` wird
  auf die neue Schrittzeile angepasst.

Skill-Lint bleibt grün (≤ 600 bzw. ≤ 400).

## 5. Besetzung mit der Plan-Freigabe

### 5.1 `plan`

- Schritt 10 wird:
  `Run staff steps 1–3, then ask the user to approve the plan and the staffing in one message.`
  Ändert sich der Plan nach Rückmeldung des Nutzers, läuft der Staffer nach der Überarbeitung neu.
- Schritt 11 bleibt `Invoke the staff skill.`; `staff` führt nach der gemeinsamen Freigabe direkt Schritt 4 (Start)
  aus.

### 5.2 `staff`

- **Schritt 1:** Die Wiederverwendung (`besetzung.md` vorhanden, Plan seitdem unverändert) geht nur dann direkt zu
  Schritt 4, wenn der Nutzer Plan und Besetzung zusammen freigegeben hat.
- **Schritt 3** gilt weiter in jedem Modus: Die drei Zeilen stehen in der Nachricht mit der Plan-Freigabefrage. Läuft
  `staff` ohne diese Freigabe (der Nutzer ruft den Befehl `staff` direkt auf), zeigt es die drei Zeilen und wartet vor
  Schritt 4 auf das Ja des Nutzers. Änderungen an Stufen kommen wie bisher in `besetzung.md`.

### 5.3 `design`

Die Gate-Zeile unter Large Schritt 4 wird:
`Until the plan is approved, subagents may read, review or write the spec, plan and staffing, never code.`

### 5.4 Unverändert

`agents/staffer.md`, das Format von `besetzung.md` und die Orchestrierungsmodi (`auto`, `switch`, `recommend`).

### 5.5 Tests

`tests/skills-content.test.mjs`:

- `plan` enthält `staff steps 1–3` und `plan and the staffing in one message`;
- `staff` Schritt 3 enthält den Fall ohne Plan-Freigabe (Zeilen zeigen, auf das Ja warten);
- das `design`-Gate enthält `staffing`;
- der bisherige Anker `3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:`
  wird auf den neuen Wortlaut von Schritt 3 angepasst.

## 6. Feature-Branch

### 6.1 Regel im Hauptfenster

- **`design` Large Schritt 5**, vor dem Spec-Commit: Steht HEAD auf dem Standard-Branch (HEAD-Branch eines Remotes,
  sonst `main` oder `master`), `feat/<topic>` anlegen und dorthin wechseln. Spec, Plan, Code und Bericht liegen dann
  auf einem Branch, und `finish` hat etwas zu mergen.
- **`details/medium.md` Schritt 1:** dieselbe Regel.
- **Ausnahme**, an beiden Stellen nur: ein Branch, den der Nutzer in eigenen Worten genannt hat – im Chat oder in
  `CLAUDE.md`, `AGENTS.md` oder `GEMINI.md`; bei einem Plan zusätzlich in dessen Global Constraints.

### 6.2 Zitatregel im Ledger

`run/details/ledger.md`, Branch guard:

- Eine Beschreibung des aktuellen Stands im Dispatch-Auftrag (Arbeitsordner, Branch, Worktree) ist keine
  Nutzeranweisung.
- Ein Ruling, das sich auf eine Nutzeranweisung beruft, zitiert sie wörtlich:
  `Ruling: work on main — user: "<quote>" — <cost if wrong>`.
- Ohne Zitat greift der Branch guard.

### 6.3 `staff` Schritt 4

Der Orchestrierer-Auftrag nennt keinen Branch; der Branch guard entscheidet. Der bestehende Satz zum Worktree (dessen
Root als Arbeitsordner nennen) bleibt.

### 6.4 Code: Warnung auf dem Standard-Branch

`checks/lib/git.mjs` bekommt drei Funktionen:

- `currentBranch(root)`: Name des aktuellen Branches; `null` bei detached HEAD oder ohne Git.
- `defaultBranch(root)`: der HEAD-Branch eines Remotes, `origin` zuerst, über `refs/remotes/<remote>/HEAD`; ohne
  Remote-HEAD `main`, wenn der Branch existiert, sonst `master`, wenn er existiert, sonst `null`.
- `defaultBranchWarning(root)`: Warntext oder `null`. Text:
  `on default branch <name>: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch`.
  `null` ohne Git, bei detached HEAD, ohne bestimmbaren Standard-Branch und auf jedem anderen Branch.

Wo die Warnung erscheint:

- `check --plan … --task …` und `check --brief …`: in der Warnungsliste von `formatResults` (`runCheck` in
  `checks/check.mjs`, neben der Pfadwarnung aus 0.1.5);
- `brief --plan … --task …` und `brief --file …`: als Zeile `warning: …` auf stderr (`bin/leanpowers.mjs`, neben
  `warnOutside`).

Die Warnung scheitert nie; Exit-Code und stdout bleiben unverändert. Sie erscheint nicht bei `check --all` ohne Task
oder Brief und nicht im einfachen `check`.

### 6.5 `finish`

Unverändert. Liegt die Arbeit doch auf dem Basis-Branch, gilt das Verhalten von 0.1.5 (Spec 0.1.5, Abschnitt 6.2).

### 6.6 Tests

- `tests/git.test.mjs` mit temporären Repos: Standard-Branch `main`; `master`; Remote-HEAD auf einen anderen Namen
  (`trunk`); detached HEAD (`currentBranch` → `null`, keine Warnung); Warnung auf dem Standard-Branch, keine auf
  `feat/x`.
- `tests/check.test.mjs`: Warnung in der `--brief`- und in der `--plan`-Form auf `main`, keine auf `feat/x`, keine bei
  `--all`.
- `tests/cli.test.mjs`: `brief` schreibt die Warnung auf stderr, Exit 0.
- `tests/skills-content.test.mjs`: Textanker für `design` Schritt 5, `details/medium.md` Schritt 1, die Zitatregel in
  `ledger.md` und `staff` Schritt 4 (kein Branch im Orchestrierer-Auftrag).

## 7. Release 0.1.6

Version `0.1.6` in `package.json` und allen erzeugten Manifesten; `CHANGELOG.md` mit `## [0.1.6] - 2026-11-01`;
`docs/README.md` und `docs/README.de.md`: Besetzung mit der Plan-Freigabe, Branch im Hauptfenster, Warnung von `brief`
und Task-Check auf dem Standard-Branch, Status 0.1.6; `dist/` neu gebaut. `npm test` und
`node bin/leanpowers.mjs check --all` grün. Merge, Tag `v0.1.6`, Push, Marketplace und Gemini-Extension-Branch nur
nach ausdrücklichem Ja des Nutzers im `finish`-Schritt.

## 8. Prüflauf nach der Umsetzung

### 8.1 Aufbau

- Frische Klone des Testprojekts ab Tag `ausgangsstand`; `node_modules` aus dem Original kopiert, kein Download.
- `claude -p` ohne `--model` (Standardmodell Sonnet), mit `--plugin-dir <worktree>/dist/claude-plugin` und
  `--add-dir <worktree>/dist/claude-plugin`; ohne `--add-dir` sind Plugin-Dateien headless nicht lesbar (Befund 1).
  Das installierte 0.1.5 wird per `--settings` nur für diese Aufrufe abgeschaltet; die Installation des Nutzers bleibt
  unverändert.
- Ein Subagent spielt den Nutzer: Er wählt immer die Empfehlung, bei `finish` „lokal mergen“.

### 8.2 Aufträge und Prüfpunkte

1. **Größen-Stichprobe**, nur die erste Antwort: „Füge einen Export der Aufgaben als CSV hinzu.“ Erwartet:
   `Size: large`.
2. **Mittel:** „`list` soll offene Aufgaben vor erledigten anzeigen.“ – eine begrenzte Änderung am bestehenden `list`,
   kein neuer Befehl, kein Feld, keine Schnittstelle. Geprüft: `details/medium.md` lesbar und gelesen, Branch vor dem
   Code, Brief unter `.leanpowers/runs/…`, `brief --file`, `check --brief`, `finish` mit vier Optionen und Merge.
3. **Groß:** „Füge wiederkehrende Aufgaben mit Erinnerungen hinzu.“ Geprüft: Branch vor dem Spec-Commit, drei
   Besetzungszeilen in der Nachricht mit der Plan-Freigabefrage, kein Ruling auf eine Nutzeranweisung ohne Zitat, keine
   Branch-Warnung, Bericht in `docs/reports`, `finish` mit vier Optionen und Merge.

### 8.3 Kosten und Belege

Kostenrahmen 5–10 USD, vom Nutzer freigegeben (Schätzung: 0,2 + 1 + 5 USD). Kostenwerte aus `claude -p --resume` sind
je Sitzung kumulativ. Belege liegen außerhalb des Repos.

## 9. Entscheidungen des Nutzers

- **F1 – Größe des CSV-Exports:** entschieden (a), Regel bleibt wörtlich, neues Red flag, neuer mittlerer
  Prüfauftrag. Verworfen: (b) Regel lockern; (c) nur das Red flag.
- **F2 – Besetzung:** entschieden (a), mit der Plan-Freigabe. Verworfen: (b) eigene Pause vor dem Start; (c) nur
  Textschärfung.
- **F3 – Branch:** entschieden (a), Branch im Hauptfenster, Zitatregel im Ledger, Warnung in `brief` und im
  Task-Check. Verworfen: (b) roter Task-Check mit Ausnahme über Global Constraints; (c) Warnung in `check --all`.
- **Abschnitte 1–4 des Designs** (Abschnitte 4–8 dieser Spec) einzeln freigegeben, Abschnitt 4 einschließlich
  Prüflauf und Kostenrahmen.

## 10. Reihenfolge und Größe

Nach der eigenen Regel **groß** (Checks, mehrere Skills, CLI). Plan mit etwa fünf Aufgaben:

1. Code: Branch-Warnung – `checks/lib/git.mjs`, `checks/check.mjs`, `bin/leanpowers.mjs`, Tests (6.4, 6.6).
2. Texte Größenregel und mittlerer Weg: `design`, `details/medium.md`, Lesbarkeitsregel in `plan`, `staff` und `run`,
   Tests (4).
3. Texte Besetzung und Branch: `plan`, `staff`, `run/details/ledger.md`, `design` Schritt 5, Tests (5, 6.1–6.3).
4. Release 0.1.6: Version, CHANGELOG, READMEs, `dist/` (7).
5. Prüflauf (8), Auswertung im Hauptfenster.
