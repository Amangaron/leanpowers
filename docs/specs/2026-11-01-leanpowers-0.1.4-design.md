# leanpowers 0.1.4 – Verbesserungen aus dem zweiten Pilot – Design-Spezifikation

**Stand:** 2026-11-01 · **Status:** vom Nutzer freigegeben · **Grundlage:** sechs Beobachtungen aus Pilotläufen am 2026-10-31
mit Claude Code und Codex CLI in Wegwerf-Testprojekten · **Bezug:** Haupt-Spec `docs/specs/2026-10-29-leanpowers-design.md`,
Spec 0.1.2 `docs/specs/2026-10-30-leanpowers-0.1.2-design.md`, Stand des Repos 0.1.3 (`5f71343`).

## 1. Ziel

Die im zweiten Pilot gefundenen Abweichungen beheben: Die Größenregel wird sichtbar benannt und für „groß“ wirklich
durchlaufen, Konfiguration und Ordnerregeln werden auch auf dem mittleren Weg geprüft, der Orchestrierer hält nicht
mehr an, und Arbeit endet mit Commit und `finish`. Der Charakter bleibt: schlank, technikneutral, gleiche Regeln für
Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests (Haupt-Spec Abschnitt 16).

## 2. Nicht-Ziele

- Neue Workflow-Skills oder Rollen.
- Höhere Wortgrenzen (Skills 600, Agent-Vorlagen 400, Starttext 150 Token). Alle Änderungen passen in die
  bestehenden Grenzen (Abschnitt 3).
- Eine Prüfung, ob die KI die Größenklasse „richtig“ wählt. Das lässt sich deterministisch nicht entscheiden.
- Struktur- und Scope-Prüfung im einfachen `leanpowers check` ohne Auftrag (der kleine Weg und das Ersatz-Gate aus
  `loops.md` hängen an „nur Test-Gates“).
- Schutz davor, dass ein Task `leanpowers.json` ändert und damit die Regeln des eigenen Checks verschiebt
  (`loadConfig` liest den Arbeitsbaum). `scope` meldet die Datei ohnehin, solange sie nicht im Auftrag steht; der
  Rest wäre Aufwand ohne Pilot-Befund.

## 3. Wortbudgets (Vorab-Befund)

Mehrere betroffene Texte stehen bereits an der Grenze von `skill-lint`. Gezählt mit `countWords` aus
`checks/skill-lint.mjs` (Body ohne Frontmatter):

| Datei | heute | Grenze | nach dieser Spec |
| --- | --- | --- | --- |
| `skills/start/SKILL.md` (Starttext) | 92 Wörter ≈ 123 Token | 150 Token | 100 Wörter ≈ 134 Token |
| `skills/design/SKILL.md` | 597 | 600 | 593 |
| `skills/run/SKILL.md` | 599 | 600 | 599 (unverändert) |
| `skills/staff/SKILL.md` | 440 | 600 | 496 |
| `skills/finish/SKILL.md` | 484 | 600 | 510 |
| `agents/orchestrator.md` | 400 | 400 | 400 |
| `agents/implementer.md` | 400 | 400 | 400 (unverändert) |

Folge: `run` und `implementer` werden nicht angefasst; was dort hingehörte, steht in `details/`-Dateien (ohne
Wortgrenze), im erzeugten Auftrag oder in der Orchestrierer-Vorlage, die dafür an anderer Stelle kürzer wird.

## 4. Befund 1 – „Groß“ ohne Spec und Plan

**Beobachtung.** In 3 von 4 Läufen nannten beide KIs „groß“, legten ein Design vor, warteten auf die Freigabe und
arbeiteten dann ohne Spec, Plan, `staff` und `run` mit einem einzigen Implementierungs-Subagenten weiter. Einmal lief
Claude den vollen Weg.

**Ursache im Text.**
- Der Starttext (`skills/start/SKILL.md:14`) setzt für mittel und groß dieselbe harte Schranke: „Medium/Large need
  design approval before any code or subagent dispatch“. Nach dem Ja zum Design ist diese Schranke erfüllt; der Rest
  von Zeile 10 („`design`, `plan`, `staff`, `run`, `finish`“) ist nur eine Aufzählung ohne Schranke.
- `skills/design/SKILL.md:9` (Gate) spricht ebenfalls nur von der Design-Freigabe. Die Schritte 5–8 in §3 (Spec,
  Check, Review, `plan`) folgen erst nach Schritt 4 „get approval after each“ – genau dort, wo das Ja fällt, steht
  nicht, dass es noch keine Freigabe für Code ist.
- Nutzerregeln, die Programmierarbeit generell an Subagenten geben, verstärken den Sog: ein Implementer nach dem Ja
  sieht für die KI regelkonform aus. Die Red flags (`design/SKILL.md:42–46`) decken „mittel nennen, um die Spec zu
  sparen“ ab, nicht „groß nennen und trotzdem den mittleren Weg gehen“.

**Änderung.**
- Starttext, letzter Absatz (vollständiger neuer Starttext in Abschnitt 10):
  `User instructions win, but Medium needs design approval and Large plan approval before any code or subagent
  dispatch, delegation rules included; only "implement directly" for this task skips it.`
  Zeile Large: `` `design` (spec), `plan`, `staff`, `run`, `finish` ``.
- `skills/design/SKILL.md` §3, neuer Satz direkt unter Schritt 4:
  `This yes opens the spec, not the code: no implementer before an approved plan.`
- `skills/design/SKILL.md`, neuer Red flag:
  `- "Design approved, one implementer will do" → that is medium; large needs spec and plan.`

**Deterministische Prüfung.** Nicht machbar: Ob eine Aufgabe groß ist, kann kein Skript entscheiden, und ein
Implementer ohne Plan hinterlässt keine Spur, die sich von einem korrekten mittleren Lauf unterscheidet. Die
Sichtbarkeit kommt aus Befund 2 (die Klasse steht als feste Marke im Chat, der Nutzer sieht den Widerspruch).

**Tests.** `tests/skills-content.test.mjs`: Starttext enthält `Large plan approval before any code or subagent
dispatch`; `design/SKILL.md` enthält `no implementer before an approved plan`. Der bestehende Test auf
`before any code or subagent dispatch` bleibt gültig.

**Risiko.** Gering. Die Wirkung ist nur im echten Lauf nachweisbar; der Nutzer prüft sie im nächsten Pilot.

## 5. Befund 2 – Keine Größenklasse genannt

**Beobachtung.** Codex schrieb „größere Erweiterung“ statt einer der Klassen klein/mittel/groß.

**Ursache im Text.** `skills/design/SKILL.md:13` verlangt nur „say the class aloud“ mit einem englischen
Beispielsatz („This looks medium …“). Antwortet die KI auf Deutsch, übersetzt oder umschreibt sie die Klasse – eine
„größere Erweiterung“ ist eine sinngemäße, aber nicht prüfbare Umschreibung. Der Starttext (`start/SKILL.md:7`)
nennt die Klassen, verlangt aber nicht, sie zu nennen. Ob im Codex-Testprojekt der `AGENTS.md`-Block (`init
--agents-md`) gesetzt war, ist im Befund nicht festgehalten; ohne ihn kennt Codex die Größenregel nur, wenn es
`start` oder `design` lädt.

**Änderung.** Eine feste, sprachunabhängige Marke nach dem Vorbild von `Status: DONE`:
- Starttext Zeile 7: `` leanpowers workflow by size (unclear → larger), named first as `Size: small|medium|large`: ``
- `skills/design/SKILL.md` §1:
  `Apply the size rule; open your reply with the class in this exact form, in any language, so the user can override
  it: "Size: medium — a bounded change to existing code, so a short design here, no spec."`

**Deterministische Prüfung.** Nicht im Test-Satz (Chat-Ausgabe, kostenpflichtiger Lauf). Optional für Nutzer:
`scripts/verify-claude.mjs` kann in einem eigenen Prüffall verlangen, dass die erste Antwort auf eine Aufgabe mit
`Size: ` beginnt (läuft nur auf Wunsch des Nutzers mit dessen Kontingent).

**Tests.** `tests/start.test.mjs`: Starttext enthält `` `Size: small|medium|large` ``; `skills-content`:
`design/SKILL.md` enthält `"Size: medium —`.

**Risiko.** Gering. Eine englische Marke in einer deutschen Antwort wirkt etwas technisch; dafür ist sie eindeutig.
Entschieden in Abschnitt 12 (F1).

## 6. Befund 3 – `structure.newFolders: "ask"` umgangen

**Beobachtung.** Codex trug selbst fünf Ordnerregeln in `leanpowers.json` ein, ohne zu fragen.

**Ursache im Code.**
- `scope` erkennt das grundsätzlich: `checkScope` (`checks/scope.mjs:8`) meldet `not in brief: leanpowers.json`,
  sobald die Datei geändert ist und nicht in den erlaubten Dateien steht; `checkStructure`
  (`checks/structure.mjs:24–36`) meldet neue Ordner ohne Freigabe.
- Beides läuft aber nur in der Task-Form `check --plan <p> --task <n>` (`checks/check.mjs:61`, `taskChecks`
  `check.mjs:25–51`). Der mittlere Weg schreibt einen Auftrag von Hand und lässt als „When done“ nur
  `leanpowers check` laufen (`skills/design/SKILL.md:25`); `runCheck` ohne Plan führt nur die Gates aus
  (`check.mjs:60–64`). Auf dem mittleren Weg – und auf dem Weg „groß ohne Plan“ aus Befund 1 – prüft also nichts
  Scope oder neue Ordner.
- Zudem sagt kein Text, dass `leanpowers.json` die Konfiguration des Nutzers ist. `ask` ist in der Haupt-Spec
  (Abschnitt 10.2) als „Ruling oder Freigabe im Plan“ definiert; ohne Plan gibt es keine Stelle, an der gefragt wird.
- Beifund: `skills/verify/SKILL.md:13` sagt, `leanpowers check` führe „tests, doc-lint, skill-lint“ aus. Doc- und
  Skill-Lint laufen nur mit `--all`.

**Änderung.**
1. **`leanpowers brief --file <brief>`** (neu): erzeugt keinen Auftrag, sondern schreibt für einen von Hand
   geschriebenen Auftrag `task-<n>-base.txt` (HEAD) in dessen Ordner; `<n>` aus dem Dateinamen `task-<n>-brief.md`
   (anderer Name → Fehler `brief --file needs a task-<n>-brief.md`). Vorhandene Basis bleibt, `--reset-base` wie
   bisher. Ausgabe: der Pfad des Auftrags.
2. **`leanpowers check --brief <brief>`** (neu, schließt `--plan`/`--task` aus, kombinierbar mit `--all`): liest
   aus dem Auftrag die Zeilen `- <pfad>` unter `## Allowed files` (Backticks entfernt) und die Zeile
   `Approved new folders: <liste>`, die Basis aus `task-<n>-base.txt` daneben, und führt `scope` und `structure`
   genau wie die Task-Form aus (gemeinsame Funktion statt `taskChecks`-Kopie, Ignorierliste `paths.runs/**`).
   Fehlt die Basis → `scope` rot: `no base for <brief>, run: leanpowers brief --file <brief>`. Kein stilles
   Nachholen, damit ein vergessener Aufruf nie ein falsches Grün ergibt.
3. **Klare Meldung** in beiden Formen: ist `leanpowers.json` außerhalb der erlaubten Dateien geändert, lautet die
   Zeile `not in brief: leanpowers.json (project configuration: change it only with the user's yes)`.
4. **`skills/design/details/medium.md`** (neu, ohne Wortgrenze) übernimmt die Auftragsform aus `design/SKILL.md:25`
   und ergänzt sie:

   ```markdown
   # Medium brief

   Write `<paths.runs>/YYYY-MM-DD-<topic>/task-1-brief.md` (a new folder gets a `.gitignore` containing `*`):

   - `## Allowed files`: one `- <path>` line per file, tests included. `leanpowers.json` is the user's
     configuration: list it only when the user asked for that change.
   - `## Global constraints`: the user's project rules.
   - `## Structure rules`: the `structure.rules` that match the allowed files, then `New folders: <structure.newFolders>`.
     With `ask`, a folder that does not exist yet needs the user's yes in the approved design; list those folders
     as `Approved new folders: <folders>`.
   - `## Task`: the approved design.
   - `## When done`: run the `check` command as the `CLI:` line names it, with absolute paths (none →
     `leanpowers check`), in the form `<cli> check --brief <brief path>`; write it out in every call, never store
     it in a shell variable. Commit with `<type>: <topic>`, one commit. Write the report to `task-1-report.md` in
     the same folder.

   Then run `leanpowers brief --file <brief path>`: it records the base commit the check compares against.
   ```

5. **`skills/design/SKILL.md` §2**, Absatz „After approval“ (ersetzt den langen Absatz, spart rund 70 Wörter):
   `After approval: small → implement, then run `leanpowers check`. Medium → write the brief as
   [details/medium.md](details/medium.md) says and run `leanpowers brief --file <brief>` to record its base.
   Dispatch a subagent at tier medium with template `agents/implementer.md`, `{{brief}}` that file and `{{report}}`
   the report path. Handle its status as `run` does (per task, step 3), run `leanpowers check --brief <brief>`
   yourself, then invoke the `finish` skill. No spec, no plan.`
6. **`skills/verify/SKILL.md:13`** richtigstellen: `Run `leanpowers check`, which runs the configured gates (tests,
   typecheck, lint); `--all` adds doc-lint and skill-lint.` Neuer Satz unter „Inside a run“: `For a medium task,
   use `leanpowers check --brief <brief>`.`
7. Doku: `docs/README.md:123`, `docs/README.de.md:130` und die Usage-Zeilen in `bin/leanpowers.mjs` nennen
   `check --brief` und `brief --file`.

**Deterministische Prüfung.** Ja, für mittel und groß mit Plan (siehe oben). Klein bleibt ohne Scope-Prüfung
(Nicht-Ziel).

**Tests.**
- `tests/check.test.mjs`: `--brief` meldet `not in brief: extra/b.ts` und `new folder needs approval: extra`;
  `Approved new folders: extra` macht `structure` grün; geänderte `leanpowers.json` ergibt die neue Zeile; fehlende
  Basis ist rot mit dem `brief --file`-Hinweis; `--brief` zusammen mit `--plan` ist ein Usage-Fehler (CLI-Test).
- `tests/brief.test.mjs`: `writeBaseFor(briefPath)` schreibt `task-1-base.txt`, behält sie beim zweiten Aufruf,
  ersetzt sie mit `resetBase`, lehnt einen falschen Dateinamen ab.
- `tests/skills-content.test.mjs`: der Pin `` `## When done`: run the `check` command as the `CLI:` line names it ``
  zieht von `design/SKILL.md` nach `design/details/medium.md` um; `design/SKILL.md` enthält `check --brief`.

**Risiko.** Mittel. Neue CLI-Form mit eigenem Parser für einen von Hand geschriebenen Auftrag: Schreibt die KI die
Dateiliste anders (z. B. als Tabelle), findet der Parser nichts und `scope` meldet jede Änderung. Das ist laut, aber
nicht gefährlich. Die Auftragsform aus `brief` (`- <pfad>`) bleibt das einzige Format.

## 7. Befund 4 – Orchestrierer hält an

**Beobachtung.** In mehreren Läufen beendete der Orchestrierungs-Subagent seinen Turn mit „Waiting for the
implementer…“, obwohl die Warteregel aus 0.1.2 in der Vorlage steht. Ein frischer Orchestrierer musste übernehmen;
einmal arbeiteten danach zwei Implementer parallel an derselben Aufgabe. Zuverlässig half eine schärfere Anweisung
im Dispatch-Text (wörtlich in Abschnitt „Änderung“); damit liefen drei Orchestrierungen hintereinander ohne
Stillstand.

**Ursache im Text.**
- Die Warteregel steht in `agents/orchestrator.md:38` als erster Punkt der „Hard rules“ am Ende der Vorlage, nach
  Prozess und Antwortformat. Die Quelle der Vorlage ist `agents/orchestrator.md`; der Build legt sie als
  `prompts/orchestrator.md` in die Pakete.
- „in the foreground“ ist eine neutrale Handlung; das Werkzeug-Detail steht nur in `platforms/claude-code.md:11`
  („Dispatch in the foreground“), ohne den Parameter zu nennen, der den Hintergrund auslöst. Den Fall „Ergebnis
  kommt trotzdem asynchron“ beschreibt nur der Satz zum fortgesetzten Agenten.
- Kein Text verbietet einen zweiten Implementer für dieselbe Aufgabe. Im Gegenteil: `staff/SKILL.md:21` startet bei
  fehlendem Status sofort einen frischen Orchestrierer, und `run/details/ledger.md:72` lässt ihn bei „Basis da, keine
  Ledger-Zeile, keine Arbeit sichtbar“ neu dispatchen – während der erste Implementer noch arbeitet.

**Änderung.**
1. `agents/orchestrator.md`, neuer Abschnitt direkt nach dem ersten Satz (Pilot-Wortlaut, neutral formuliert,
   „final reply“ behalten, damit der bestehende Test greift):

   ```markdown
   ## Turn rule

   Dispatch every implementer and reviewer in the foreground, never in the background. If a dispatched or resumed
   agent's result arrives asynchronously anyway, wait for it, never poll; never end your turn while any subagent of
   yours is still working. Your turn ends only with a final reply whose first line is `Status: DONE` or
   `Status: NEEDS_USER`. Never dispatch a second implementer for a task while the first may still be working.
   ```

   Ausgleich auf genau 400 Wörter: Hard-rules-Punkt 1 entfällt (steht jetzt oben); Prozess 3 wird zu `Rule on
   ambiguities, plan conflicts and findings left at the round cap; log `Ruling: <what> — <why> — <cost if wrong>`.
   Never stop for what you may rule on; never rule through a red deterministic gate.`; Prozess 4 beginnt mit `Stop
   only for the four reasons in `run`.` (die Aufzählung steht in `run`); in Prozess 5 entfällt der Satz zur
   unbeantworteten `Stop:`-Zeile (steht wörtlich in `ledger.md`, Abschnitt Resume).
2. `platforms/claude-code.md`, Zeile „Wait for a subagent“: `Dispatch in the foreground: never set
   `run_in_background`. A resumed agent's result arrives as a task notification: wait for it; never poll or end the
   turn before it arrives.` Codex und Gemini: Zeile bleibt, ergänzt um `Never dispatch a second agent for a task while
   the first may still be working.` (Codex-Wartemechanismus bleibt „unverified“ und wird im nächsten Pilot benannt.)
3. `skills/staff/SKILL.md` Schritt 4 (`auto`), statt „If it ends with neither, dispatch a fresh one once …“:
   `Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim. If it ends with neither, resume the
   same orchestrator once: "Your turn ended without a status line. Wait for your running subagents, then continue;
   the turn rule applies." Its subagents may still be working and report to it. Only if it cannot be resumed or ends
   with neither again, dispatch a fresh one with the same inputs, its prompt naming the ledger's last line; the
   ledger lets it resume.` (Rest des Schritts unverändert.)
4. `skills/run/details/ledger.md`: neue Zeile `Task <n>: implementer dispatched (<agent name or id>)` vor jedem
   Implementer-Dispatch. Resume-Regel (Zeile 72) wird: `… otherwise, if a dispatched line names an implementer,
   resume that one; re-dispatch only when it cannot be resumed.`
5. `skills/run/details/loops.md:7`: der Satz `Never dispatch a second implementer for a task while the first may
   still be working.` wird angehängt. `run/SKILL.md` bleibt unverändert (599 Wörter).

**Deterministische Prüfung.** Nicht für den Stillstand selbst (Verhalten im Lauf). Teilweise für die Doppelung:
`leanpowers metrics` könnte melden, wenn ein Task zwei `implementer dispatched`-Zeilen ohne `gate retry`,
`gate escalated` oder `review round` dazwischen hat. Entschieden: nicht in 0.1.4, erst wenn die Ledger-Zeile sich im
Pilot bewährt.

**Tests.** `skills-content`: Vorlage enthält `## Turn rule` vor `## Inputs` und `Never dispatch a second implementer
for a task`; `staff/SKILL.md` enthält `resume the same orchestrator once`; `platforms/claude-code.md` enthält
`never set \`run_in_background\``; `ledger.md` enthält `implementer dispatched`. Der Test „skills and agents never
name platform tools“ bleibt grün, weil `run_in_background` nur in der Plattform-Datei steht. `build.test.mjs`
(Sollstände von `dist/`) nach Neubau.

**Risiko.** Mittel. Die Vorlage steht danach wieder auf genau 400 Wörtern; jede spätere Ergänzung braucht eine
Kürzung. Das Fortsetzen statt Neustart hängt davon ab, dass die Plattform einen beendeten Subagenten fortsetzen kann
(Claude Code: ja; Codex: unverified; Gemini: kein Orchestrierer-Subagent).

## 8. Befund 5 – Arbeit nicht committet, kein `finish`

**Beobachtung.** Codex ließ die Arbeit uncommittet und bot `finish` nicht an.

**Ursache im Text.**
- Der mittlere Weg endet in `skills/design/SKILL.md:25` mit „then run `leanpowers check`. No spec, no plan.“ – ohne
  Commit und ohne `finish`. Der Starttext (`start/SKILL.md:9`) endet für mittel ebenfalls bei `leanpowers check`.
  Nur der Plan-Weg führt über `run` (End, Schritt 5) zu `finish`.
- Der Implementer committet „with the message the task gives“ (`agents/implementer.md:20`); der von Hand
  geschriebene mittlere Auftrag gibt keine Nachricht vor.
- `finish/SKILL.md:13` prüft nur `check --all`, nicht den Arbeitsbaum.

**Änderung.**
- Starttext Zeile 9: `` Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`, `finish`. ``
- `details/medium.md` verlangt im `## When done` eine Commit-Nachricht (Abschnitt 6, Punkt 4); `design/SKILL.md` §2
  endet mit `invoke the `finish` skill` (Abschnitt 6, Punkt 5).
- `checks/check.mjs`: mit `--all` eine Warnung (kein Fehler), wenn der Arbeitsbaum außerhalb von `paths.runs`
  uncommittete oder unversionierte Dateien hat: `⚠ uncommitted changes: <n> files (<bis zu 3 Pfade>)`. Quelle:
  `git status --porcelain`.
- `skills/finish/SKILL.md` §1, angehängt: `Uncommitted changes outside the run folder (the check warns about them)
  also block merge and pull request: list them and ask whether to commit them first.`

**Deterministische Prüfung.** Ja für den Commit (Warnung in `check --all`, Sperre in `finish`). Nein für „`finish`
angeboten“ (Chat-Verhalten).

**Tests.** `check.test.mjs`: `--all` mit einer unversionierten Datei außerhalb des Run-Ordners zeigt die Warnung und
bleibt `ok`; Dateien im Run-Ordner zählen nicht; ohne `--all` keine Warnung. `skills-content`: Starttext-Zeile
Medium enthält `` `finish` ``; `finish/SKILL.md` enthält `Uncommitted changes outside the run folder`.

**Risiko.** Gering. Wer `check --all` mitten in der Arbeit aufruft, sieht eine Warnung mehr. Entschieden in Abschnitt 12 (F3).

## 9. Befund 6 – zsh und CLI-Befehl in einer Variable

**Beobachtung.** Subagenten legten den CLI-Befehl wiederholt in einer Variable ab (`S="node …"; $S`). zsh teilt
unquotierte Variablen nicht in Wörter, der Aufruf schlägt fehl.

**Ursache im Text.** Der Auftrag nennt den Befehl mit absolutem, gequotetem Pfad (`checks/brief.mjs:47`); kein Text
sagt, ihn ausgeschrieben zu verwenden. Der Befehl ist lang, also kürzen ihn Subagenten selbst ab.

**Änderung.**
- `checks/brief.mjs:47`, Satz „When done“: `` Run `<cli> check --plan <p> --task <n>`, written out in every call (never
  stored in a shell variable). Write your report … ``
- `agents/orchestrator.md`, Inputs: `` - CLI: run every `leanpowers` command as `{{cli}}`, written out, never from a
  shell variable. `` (in der Wortbilanz aus Abschnitt 7 enthalten).
- `skills/run/details/loops.md:9`, angehängt: `` Write the command out in every call; never store it in a shell
  variable (`S="node …"; $S` fails in zsh, which does not split words). ``
- `details/medium.md`: derselbe Hinweis (Abschnitt 6, Punkt 4).
- `agents/implementer.md` bleibt unverändert (400 Wörter); der Implementer bekommt den Hinweis über den Auftrag.

**Deterministische Prüfung.** Nicht nötig; der Fehler zeigt sich sofort im Lauf.

**Tests.** `brief.test.mjs`: die Regex in „brief names the plan path in the check command“ (endet heute auf
`` `\. ``) und „brief names exactly the resolvable CLI command“ werden an den neuen Satz angepasst; neuer Test auf
`never stored in a shell variable`. `skills-content`: bestehender Pin `` run every `leanpowers` command as `{{cli}}` ``
bleibt gültig.

**Risiko.** Gering.

## 10. Starttext neu (vollständig)

```text
Subagents ignore this text.

leanpowers workflow by size (unclear → larger), named first as `Size: small|medium|large`:
- Small (one file, clear fix): do it, `leanpowers check`.
- Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`, `finish`.
- Large (new feature or project, several areas, interfaces): `design` (spec), `plan`, `staff`, `run`, `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions win, but Medium needs design approval and Large plan approval before any code or subagent dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

Zählregel des Repos: `estimateTokens` = ⌈Wörter × 4/3⌉ (`checks/skill-lint.mjs:40`), Grenze 150
(`skill-lint.mjs:9`, `tests/start.test.mjs:21` und `:58`).

| Variante | heute | neu |
| --- | --- | --- |
| Body (`skill-lint`, Test Zeile 21) | 92 Wörter → 123 Token | 100 Wörter → 134 Token |
| mit CLI-Zeile `CLI: run leanpowers as node "<pfad>".` (Test Zeile 58, SessionStart) | 98 → 131 | 106 → 142 |
| `AGENTS.md`-Block (ohne Subagenten- und CLI-Zeile) | 88 → 118 | 96 → 128 |

Reserve mit CLI-Zeile: 8 Token (6 Wörter; ein Pfad mit Leerzeichen kostet je Leerzeichen ein Wort). Weggefallen
gegenüber heute: „and explicit requests“ (die Haupt-Spec 6.1 sagt ohnehin nur „User instructions win“). Nicht im
Starttext, weil das Budget fehlt: die Regel zu `leanpowers.json`; sie steht in `details/medium.md` und wird von
`check --brief` und `check --plan … --task …` erzwungen.

## 11. Release 0.1.4

Version `0.1.4` in `package.json` und allen erzeugten Manifesten, `CHANGELOG.md` mit Abschnitt `## [0.1.4] -
<datum>`, README-Status, `dist/` neu gebaut, `gemini-extension`-Branch neu erzeugt. `npm test` und
`node bin/leanpowers.mjs check --all` grün; CI auf macOS, Windows und Linux mit Node 20 und 22. Merge, Push und Tag
nur nach Rückfrage beim Nutzer. Veröffentlichung (Marketplace und Gemini-Extension) ebenso.

## 12. Entscheidungen des Nutzers

- **F1 – Form der Größenmarke:** entschieden (a), feste englische Marke `Size: small|medium|large` am Anfang der
  ersten Antwort, in jeder Sprache. Verworfen: (b) Klasse in Nutzersprache mit englischem Begriff in Klammern;
  (c) keine Marke.
- **F2 – Prüfung auf dem mittleren Weg:** entschieden (a), `brief --file` und `check --brief` für den von Hand
  geschriebenen Auftrag (Abschnitt 6). Verworfen: (b) Ein-Task-Plan; (c) nur Textregel.
- **F3 – Uncommittete Arbeit:** entschieden (a), Warnung in `check --all`, `finish` sperrt Merge und PR bis zum
  Commit. Verworfen: (b) `check --all` schlägt fehl; (c) nur Satz in `finish`.

## 13. Reihenfolge und Größe

Nach der eigenen Größenregel ist 0.1.4 **groß** (CLI, Checks, mehrere Skills, Vorlage, Plattform-Dateien, Tests):
aus dieser Spec ein Plan mit etwa sechs Aufgaben, `staff`, `run`, `finish`.

1. **Code: `brief --file` und `check --brief`** inkl. gemeinsamer Scope-/Struktur-Funktion und
   `leanpowers.json`-Meldung (Risiko high, gemeinsamer Vertrag; Befund 3).
2. **Code: Warnung für uncommittete Dateien in `check --all`** und neuer When-done-Satz in `brief.mjs` (low;
   Befunde 5, 6).
3. **Texte Größenregel:** Starttext, `design/SKILL.md`, neue `design/details/medium.md`, `verify/SKILL.md` (high,
   weil Starttext und Wortgrenzen; Befunde 1, 2, 3, 5).
4. **Texte Orchestrierung:** `agents/orchestrator.md`, `staff/SKILL.md`, `run/details/loops.md`,
   `run/details/ledger.md`, `platforms/*.md` (high; Befunde 4, 6).
5. **Texte Abschluss:** `finish/SKILL.md`, Doku `docs/README.md`, `docs/README.de.md`, Usage (low; Befunde 3, 5).
6. **Release 0.1.4:** Version, CHANGELOG, `dist/`, Gemini-Branch (low).

Aufgaben 1 und 2 sind dateigetrennt bis auf `check.mjs` – also nacheinander. Aufgabe 3 hängt an 1 (`check --brief`
muss existieren, bevor `design` es nennt). Danach ein Pilotlauf auf beiden Plattformen mit je einer mittleren und
einer großen Aufgabe, gezielt auf: `Size:`-Marke, Spec und Plan bei groß, kein Stillstand, Commit und `finish`.
