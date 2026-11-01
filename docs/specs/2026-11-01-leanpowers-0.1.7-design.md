# leanpowers 0.1.7 – `design` vor jedem Text, Freigabe für jede Größe, Small mit Test – Design-Spezifikation

**Stand:** 2026-11-01 · **Status:** vom Nutzer freigegeben (Design abschnittsweise am 2026-11-01; Spec-Durchsicht
steht aus) · **Grundlage:** Prüflauf von 0.1.6 auf Sonnet in einem Testprojekt (kleine TypeScript-CLI) · **Bezug:**
Haupt-Spec `docs/specs/2026-10-29-leanpowers-design.md`, Spec 0.1.6 `docs/specs/2026-11-01-leanpowers-0.1.6-design.md`,
Stand des Repos 0.1.6 (`057ad52`).

## 1. Ziel

Ein Änderungsauftrag führt zuerst in den `design`-Skill, bevor das Modell Text schreibt oder ein Tool aufruft; die
Größe steht erst nach dem Lesen des Codes fest; jede Größe braucht vor Code oder Implementierer-Dispatch das Ja des
Nutzers, und das sagt schon der Starttext. Damit soll der mittlere Weg aus 0.1.6 im Prüflauf überhaupt erreicht werden.
Der Charakter bleibt: schlank, technikneutral, gleiche Regeln für Claude Code, Codex CLI und Gemini CLI, keine
kostenpflichtigen KI-Läufe in Tests (Haupt-Spec Abschnitt 16).

## 2. Befunde aus dem Prüflauf 0.1.6 (neutral zusammengefasst)

1. **Großer Weg vollständig.** Feature-Branch vor dem Spec-Commit, Besetzung mit der Plan-Freigabe, keine erfundene
   Nutzeranweisung im Ledger, Bericht, `finish` mit vier Optionen und Merge. Die Größen-Stichprobe „CSV-Export“ ergab
   `Size: large`, `design` zuerst.
2. **Mittlerer Auftrag nicht erreicht, in 2 von 2 Läufen.** Auftrag: „`list` soll offene Aufgaben vor erledigten
   anzeigen.“ Das Modell schrieb vor jedem Tool-Aufruf „Size: small“: einmal „vorläufig“ und danach medium, einmal
   „vermutlich eine Datei“ und trotz drei genannter Dateien small. `design` wurde nie geladen. Im zweiten Lauf setzte
   das Modell ohne Freigabe per Subagent um und berief sich auf eine globale Delegationsregel des Nutzers; kein Commit,
   kein `finish`. Der mittlere Weg aus 0.1.6 (Branch, Brief, `brief --file`, `check --brief`, `finish`) ist damit
   ungeprüft.
3. **Vermutete Ursachen.**
   - Der Starttext verlangt „Open with `Size:`“ als eigene Anweisung neben „invoke the `design` skill“. Das Modell
     erfüllt die erste sofort und rät die Größe.
   - Der Starttext nennt Freigaben nur für Medium und Large; dass auch Small eine Freigabe braucht, steht nur im Skill.
   - „Small: one file“ wurde gehalten, obwohl drei Dateien betroffen waren.
4. **Prüfaufbau.** Ohne Freigabe für `git` und `npm` liefen Commits und Tests headless nicht. Der Prüflauf von 0.1.6
   lief deshalb mit `--allowedTools` für `git`, `npm`, `node` und `mkdir`.

## 3. Nicht-Ziele

- Kein Hook pro Nachricht (verworfen, F1 b).
- Keine PreToolUse-Sperre (verworfen, F1 c).
- Keine Änderungen an `plan`, `staff`, `run`, `finish`, an den Vorlagen und am CLI-Code; Tests ausgenommen.
- Keine höheren Grenzen (Starttext 150 Token, Skills 600 Wörter).
- Keine Änderung der Kriterien für Medium und Large.

## 4. Starttext (F1 = a, F2 = a)

### 4.1 Neuer Text

Body von `skills/start/SKILL.md`, vollständig:

```text
Subagents ignore this text.

leanpowers: on a change request, invoke the `design` skill before any text or tool; after reading the code it opens with `Size: small|medium|large` (unclear → larger):
- Small: one file plus its test, clear fix.
- Medium: bounded change to an existing flow.
- Large: new feature, command or data field, several areas, or interfaces.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

### 4.2 Änderungen gegenüber 0.1.6

- `design` kommt vor jedem Text und jedem Tool, nicht nur vor der Antwort.
- Die Markierung `Size:` setzt der Skill nach dem Lesen des Codes; die eigene Anweisung „Open with `Size: …`“ entfällt.
- Small heißt: eine Datei plus ihr Test.
- Die Medium-Zeile ist kürzer formuliert („an existing flow“, wie im Beispiel des `design`-Skills); das Kriterium
  bleibt gleich.
- Freigabe für jede Größe, bei Large zusätzlich für den Plan; das gilt auch gegen Delegationsregeln.
- Die Einleitung „User instructions win, but“ entfällt aus Platzgründen. Sie leitete nur die Ausnahme ein; andere
  Anweisungen des Nutzers gelten weiter.
- `startText()` in `checks/start.mjs` ersetzt weiterhin nur die Zeile `Commands:`.

### 4.3 Platz

Zählregel `estimateTokens` in `checks/skill-lint.mjs`: ⌈Wörter × 4/3⌉, Grenze 150 Token.

| Text | 0.1.6 | 0.1.7 |
| --- | --- | --- |
| Body `skills/start/SKILL.md` | 135 | 136 |
| Claude mit `CLI:`-Zeile (je nach Pfadlänge) | 143–144 | 144 |
| `GEMINI.md` | 148 | 150 (genau an der Grenze) |
| Block in `AGENTS.md` (`agentsMdText`) | 130 | 131 |

Den endgültigen Wortlaut legt der Plan fest. Ist ein Wort zu viel, wird an anderer Stelle im Starttext gekürzt, nie im
Satz mit der Freigabe.

### 4.4 Tests

- `tests/start.test.mjs` und `tests/skills-content.test.mjs` bekommen die Anker `before any text or tool`,
  `one file plus its test` und `Every size needs the user's yes`.
- Die bisherigen Anker `before any code or implementer dispatch`, `leanpowers: before answering any change request`
  und ``Open with `Size: small|medium|large` (unclear → larger):`` werden entfernt oder angepasst; der Anker der
  Medium-Zeile folgt dem neuen Wortlaut.
- `tests/build.test.mjs`: `GEMINI.md` ≤ 150 Token (besteht schon).

## 5. `design`-Skill

### 5.1 Classify

- Der erste Satz unter „Classify“ wird sinngemäß:
  `Read the code the request touches and count its files first; then open your reply with the class in this exact
  form, in any language: "Size: medium — a bounded change to an existing flow."`
- Die Small-Zeile wird:
  `- **Small:** one file plus its test, clear fix, no interface change.`
- Die Zeilen für Medium und Large bleiben unverändert.

### 5.2 Red flag

Neu: `"Probably one file" → read the code first, then count.`

### 5.3 Unverändert

Das Gate (gilt für jede Größe), der kleine Weg, der mittlere Weg und `details/medium.md`. Kein anderer Skill, keine
Vorlage und kein Code ändert sich; nur die Skill-Texte werden neu nach `dist/` gebaut.

### 5.4 Platz

`design` hat heute 599 von 600 Wörtern (Body, `checks/skill-lint.mjs`). 5.1 und 5.2 bringen zusammen etwa 21 Wörter
dazu. Gekürzt wird in derselben Datei, bis der Body ≤ 600 ist; den genauen Wortlaut legt der Plan fest.

### 5.5 Tests

`tests/skills-content.test.mjs`:

- Anker für `count its files first`, die neue Small-Zeile und das neue Red flag;
- die bestehenden Anker zur Größe (`command or data field`, `No existing flow → not medium`) bleiben.

Skill-Lint bleibt grün (≤ 600).

## 6. Release 0.1.7

Version `0.1.7` in `package.json` und allen erzeugten Manifesten; `CHANGELOG.md` mit `## [0.1.7] - 2026-11-01`;
`docs/README.md` und `docs/README.de.md`: `design` vor jedem Text, Freigabe für jede Größe, Small heißt eine Datei plus
ihr Test, Status 0.1.7; `dist/` neu gebaut. `npm test` und `node bin/leanpowers.mjs check --all` grün.

Die Arbeit liegt auf dem Branch `feat/leanpowers-0-1-7`, angelegt von `main` (`057ad52`) vor dem Spec-Commit. Merge,
Push, Tag, Gemini-Extension-Branch und die Aktualisierung der lokalen Installation nur nach ausdrücklichem Ja des
Nutzers.

## 7. Prüflauf nach der Umsetzung

### 7.1 Aufbau

Wie bei 0.1.6:

- Frische Klone des Testprojekts ab Tag `ausgangsstand`.
- `claude -p` ohne `--model` (Standardmodell Sonnet), mit `--plugin-dir <worktree>/dist/claude-plugin` und
  `--add-dir <worktree>/dist/claude-plugin`. Das installierte leanpowers wird per `--settings` nur für diese Aufrufe
  abgeschaltet.
- `--permission-mode acceptEdits` mit `--allowedTools` für `git`, `npm`, `node` und `mkdir` (Befund 4).
- Ein Subagent spielt den Nutzer: Er wählt immer die Empfehlung, bei `finish` „lokal mergen“.

### 7.2 Aufträge und Prüfpunkte

1. **Klein:** „Die Fehlermeldung bei unbekannter Id soll ‚Aufgabe N gibt es nicht‘ lauten.“ Geprüft: `design` vor
   jedem Text, `Size: small` erst nach dem Lesen, Freigabe vor der ersten Änderung, danach `leanpowers check`.
2. **Mittel, zweimal (Läufe 2 und 3):** „`list` soll offene Aufgaben vor erledigten anzeigen.“ Geprüft: `design`
   zuerst, `Size: medium` nach dem Lesen, Freigabe, `details/medium.md` gelesen, Branch vor dem Code, Brief,
   `brief --file`, Implementierer mit dem Brief, `check --brief`, `finish` mit vier Optionen und Merge.

### 7.3 Kosten und Belege

Kostenrahmen 1,5–3 USD, vom Nutzer freigegeben (Schätzung: 0,3 + 2 × 0,5–1 USD). Kostenwerte aus
`claude -p --resume` sind je Sitzung kumulativ. Belege liegen außerhalb des Repos.

## 8. Entscheidungen des Nutzers

- **F1 – Durchsetzung:** entschieden (a), nur Text, auf allen Plattformen. Verworfen: (b) Claude-Hook pro Nachricht;
  (c) Claude-Sperre per PreToolUse.
- **F2 – Small:** entschieden (a), eine Datei plus ihr Test. Verworfen: (b) streng eine Datei einschließlich Tests;
  (c) unverändert.
- **F3 – Prüflauf:** entschieden (a), ein kleiner Lauf und zwei mittlere. Verworfen: (b) ein mittlerer Lauf.
- **Abschnitte 1–3 des Designs** (Abschnitte 4–7 dieser Spec) einzeln freigegeben, Abschnitt 3 einschließlich
  Prüflauf und Kostenrahmen.

## 9. Reihenfolge und Größe

Nach der eigenen Regel **groß** (Starttext für alle Plattformen, Skill, Tests, Prüflauf). Plan mit etwa zwei Aufgaben:

1. Starttext und `design` mit Tests und `dist/` (4, 5).
2. Release 0.1.7: Version, CHANGELOG, READMEs, `dist/` (6).

Danach der Prüflauf (7) im Hauptfenster.
