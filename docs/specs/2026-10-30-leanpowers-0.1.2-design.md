# leanpowers 0.1.2 – Verbesserungen aus dem Pilot – Design-Spezifikation

**Stand:** 2026-10-30 · **Status:** vom Nutzer freigegeben · **Grundlage:** Pilot-Läufe in LIDO Code Studio (Segment 1c,
Teil 1) und leanpowers-lido (Teil 2a) sowie die Abnahme von Segment 1c. Quellen der Beobachtungen:
`LIDO-Code-Studio/docs/abnahme/segment-1c-zwischenstand-teil-1.md` (12 Punkte) und
`LIDO-Code-Studio/docs/abnahme/segment-1c.md` (Abschnitt „Entscheidungen“, 5 Punkte, dazu Auffälligkeiten 3 und 4).

## 1. Ziel

Die in zwei echten Läufen gefundenen Reibungen beheben, ohne den Charakter von leanpowers zu ändern: schlank, technikneutral,
gleiche Regeln für Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests (Spec 16 der
Haupt-Spec `docs/specs/2026-10-29-leanpowers-design.md` bleibt gültig).

## 2. Nicht-Ziele

- Neue Workflow-Skills oder neue Rollen.
- Eine Ollama-Anbindung (bleibt Sache von LIDO Code Studio).
- Automatisches Einbetten ganzer Spec-Abschnitte in Aufträge (zu fehleranfällig); stattdessen gezieltes Lesen (A3).

## 3. Paket A – Plan, Auftrag, Review

**A1 Ordnerfreigabe durch `Test:`.** In `checks/check.mjs` geben Dateien der Art `Create` und `Test` ihren Ordner frei
(`approvedFolders`). `Modify` gibt keinen Ordner frei.

**A2 Freigegebene Ordner im Auftrag.** `buildBrief` ergänzt unter „## Structure rules“ nach der Zeile `New folders: …` die
Zeile `Approved new folders: <liste>` – die Ordner (posix, ohne `.`) aller `Create`- und `Test`-Dateien des Tasks, die beim
Schreiben des Auftrags noch nicht existieren, sortiert, durch `, ` getrennt; keine → Zeile entfällt.

**A3 Spec und Quellen.**
- `parsePlan` liest zusätzlich den optionalen Kopf `**Sources:** <pfade>` (Komma-getrennt, Backticks entfernt) als
  `sources: string[]` (fehlt → `[]`); `spec` wird wie bisher gelesen.
- Der Auftrag bekommt nach der Kopfzeile `**Risk:** …` die Zeile `**Spec:** <spec>` und, wenn `sources` nicht leer ist,
  einen Abschnitt `## Sources` mit je einer Zeile `- <pfad>` und dem Satz „Read-only references for facts; read only what the
  task needs.“
- `agents/implementer.md`: Schritt 1 erlaubt, die Spec dort zu lesen, wo der Auftrag einen Abschnitt zitiert (nur diesen
  Abschnitt), und die `## Sources` des Auftrags.
- `agents/reviewer.md`: neue Eingaben `{{spec}}` (Spec-Pfad) und `{{sources}}` (Liste oder `none`); der Reviewer prüft
  Fakten gegen diese Quellen, wenn die Aufgabe Fakten behauptet.

**A4 Constraints als Datei.** `writeBrief` schreibt zusätzlich `<run>/constraints.md` (Global Constraints wörtlich, mit
Zeilenumbruch am Ende; bei jedem Aufruf neu). `agents/reviewer.md`: `{{constraints}}` ist der Pfad dieser Datei. `run`
übergibt den Pfad statt Text.

**A5 Basis neu setzen.** `leanpowers brief --plan <p> --task <n> --reset-base` schreibt `task-<n>-base.txt` mit dem aktuellen
HEAD neu (ohne den Schalter bleibt die Basis wie bisher unverändert). `ledger.md` bekommt die Zeile
`Task <n>: base reset (<sha7>) — <grund>` und die Regel, dass ein Neusetzen nur nach einer Plan-Korrektur vor den Commits
des Tasks erfolgt und als Ruling geloggt wird.

**A6 Sollstand-Tests.** `skills/plan/details/plan-format.md` beschreibt Tests gegen gespeicherte Sollstände: RED-Schritt
„Modul fehlt“, nach GREEN ein eigener Schritt „Sollstand erzeugen und prüfen“, danach erneut PASS. `skills/plan/SKILL.md`
verweist darauf in einem Satz.

**A7 Fehlende Konfiguration.** Hat das Projekt keine `leanpowers.json` und ist kein Testbefehl konfiguriert, lautet die
Meldung von `gates:test` `no test command configured (no leanpowers.json found)`; sonst unverändert
`no test command configured`.

## 4. Paket B – Orchestrierung robust

**B1 Warten statt Stillstand.** `skills/run/SKILL.md`, `skills/run/details/loops.md`, `agents/orchestrator.md` und alle drei
`platforms/*.md` sagen ausdrücklich: Subagenten im Vordergrund starten und auf ihr Ergebnis warten; ein per Nachricht
fortgesetzter Agent meldet sich mit einer eigenen Benachrichtigung – darauf warten, nicht pollen und nicht den Turn beenden.
Ein Orchestrierer beendet seinen Turn nur mit `Status: DONE` oder `Status: NEEDS_USER`. `skills/staff/SKILL.md`: endet der
Orchestrierer mit keinem von beiden, wird wie bisher einmal neu gestartet; der neue Auftrag nennt die letzte Ledger-Zeile.

**B2 Branch-Regel.** `skills/run/details/ledger.md`, Branch-Guard Punkt 2: Nennen die Global Constraints des Plans einen
Branch (auch den Standard-Branch), gilt das wie eine Nutzeranweisung; Ruling-Zeile wie bisher.

**B3 Freigabe vor Delegation.** `skills/start/SKILL.md` (Starttext) und `skills/design/SKILL.md` stellen klar: Die Freigabe
des Designs gilt auch dann, wenn Nutzerregeln Arbeit ohne Nachfrage an Subagenten geben; Delegation bestimmt, wer baut, nicht
ob freigegeben ist. Nur eine ausdrückliche Anweisung für genau diese Aufgabe („setz direkt um“) überspringt die Freigabe.
Starttext weiterhin ≤ 150 Token.

## 5. Paket C – Protokoll und Doku

**C1** `ledger.md`: neue Zeilen `Final: minor (deferred): <one-liner>` und `Final: Ruling: <what> — <why> — <cost if wrong>`.

**C2** `ledger.md`: Zusatzabschnitte (z. B. `## Notes`) stehen zwischen Kopfzeile und `## Tasks`; alles Weitere bleibt unter
`## Tasks`, `## Metrics` bleibt der letzte Abschnitt.

**C3** `README.md`, `docs/README.md`, `docs/README.de.md`: Hinweis, nach einem Plugin-Update eine neue Sitzung zu starten,
weil laufende Sitzungen Skills und CLI-Pfad der alten Version behalten.

## 6. Paket D – Plattform-Lücken

**D1 Starttext für Codex über `AGENTS.md`.**
- `checks/agents-md.mjs`: `export function updateAgentsMd(root: string, text: string): 'created' | 'updated' | 'unchanged'`.
  Der Block ist `<!-- leanpowers:start -->\n<text>\n<!-- leanpowers:end -->`. Fehlt `AGENTS.md`, wird sie mit dem Block
  angelegt; fehlt der Block, wird er mit einer Leerzeile Abstand ans Ende angehängt; sonst wird nur der Inhalt zwischen den
  Marken ersetzt. Text außerhalb der Marken bleibt byte-gleich. Mehrere Blöcke oder eine Marke ohne Gegenstück → Fehler
  `AGENTS.md: leanpowers block markers are broken`, Datei unverändert.
- `<text>` = der Starttext ohne die Zeile „Subagents ignore this text.“ und ohne CLI-Zeile (Codex-Skills tragen die CLI-Zeile
  selbst).
- `leanpowers init --write` und `leanpowers init --template <name>` rufen `updateAgentsMd` nach dem Schreiben auf und melden
  `AGENTS.md: <ergebnis>`; neu `leanpowers init --agents-md` aktualisiert nur den Block.

**D2 Skills anderer Plugins.**
- `extraSkillDirs` erlaubt Einträge `plugin:<name>`. `checks/lib/plugins.mjs`:
  `export function resolvePluginSkillDir(name: string, { home = os.homedir() } = {}): string | null` sucht in dieser
  Reihenfolge und liefert den ersten vorhandenen Ordner `<plugin>/skills`:
  1. Claude Code: `<home>/.claude/plugins/installed_plugins.json`, Schlüssel `<name>@<marketplace>` (beliebiger
     Marketplace), erster Eintrag, `installPath`.
  2. Codex: `<home>/.codex/plugins/cache/*/<name>/<version>` mit der höchsten Version (numerischer Vergleich der
     Punkt-Teile).
  3. Gemini: `<home>/.gemini/extensions/<name>`.
- `listSkills` (skills-cmd) und `lintSkills` (skill-lint) lösen `plugin:`-Einträge damit auf. Nicht gefunden → Warnung
  `extraSkillDirs: plugin <name> not found`, kein Fehler, der Eintrag wird übersprungen. Quelle in der Liste: `plugin:<name>`.

## 7. Release 0.1.2

Version `0.1.2` in `package.json` und allen erzeugten Manifesten, `CHANGELOG.md` mit Abschnitt `## [0.1.2] - <datum>`,
README-Status aktualisiert, `dist/` neu gebaut. Merge nach `main`, Push, CI und Tag `v0.1.2` nur nach Rückfrage beim Nutzer.

## 8. Tests

Unit-Tests (`node:test`) für A1, A2, A3 (Parser und Auftrag), A4, A5, A7, D1, D2; vorhandene Tests für Skill-Form
(`skill-lint`, `skills-content`) decken die Textänderungen in Skills und Templates ab (Wortgrenzen, Starttext ≤ 150 Token);
Build-Sollstände (`dist/` gleich frischem Build). `npm test` und `node bin/leanpowers.mjs check --all` grün; CI auf macOS,
Windows und Linux mit Node 20 und 22.
