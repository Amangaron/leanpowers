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
| `check-command` (`/leanpowers:check` führt die mitgelieferte Kommandozeile aus) | UNCLEAR | Kein Modelllauf möglich (nicht angemeldet). |
| `plugin-root-var` (`${CLAUDE_PLUGIN_ROOT}` in `commands/*.md` ersetzt) | UNCLEAR | Hängt am Lauf von `check-command`. |
| `coexist` (Plugin geladen, Einträge `leanpowers:check` und `leanpowers:plan` vorhanden) | PASS | Das `system/init`-Event (ohne Modellaufruf) listet das Plugin `leanpowers@0.0.1` mit dem Pfad `dist/claude-plugin` sowie die Einträge `leanpowers:check` und `leanpowers:plan`. Damals gab es `design`, `plan`, `staff`, `run`, `debug` und `finish` sowohl als Command als auch als Skill; seither erzeugt der Build nur noch `check`, `skills` und `init` als Commands, die Workflow-Skills werden direkt als `/leanpowers:<Name>` aufgerufen. Das Init-Event von Claude Code 2.1.289 enthält kein Feld `plugin_errors`; das Laden ist daher nur aus der Plugin-Liste und den Einträgen mit Namensraum geschlossen. Ob `/leanpowers:plan` im Modelllauf den Skill lädt, ist damit nicht gezeigt. |

Hinweis zur Isolation: `--bare` wird bewusst nicht benutzt. Es überspringt Hooks (der Test des
Start-Texts wäre unmöglich) und liest nur `ANTHROPIC_API_KEY`, kein OAuth; außerdem listet der
Lauf mit `--bare` weiterhin die installierten Plugins. Andere installierte Plugins sind deshalb
im Lauf sichtbar; die Prüfstrings (`Commands: design, plan`, `leanpowers check:`) sind
leanpowers-spezifisch.

Das Skript meldet Startfehler, Zeitüberschreitung und fehlendes `claude` als UNCLEAR (Exit-Code 2),
nicht als FAIL; das gilt auch für einen Lauf ohne `result`-Ereignis. Pfade werden mit `realpath`
verglichen.

## Kriterien für `check-command` und `plugin-root-var`

Die oben stehenden Läufe nutzten noch ältere, schwächere Kriterien; seither gilt:

- Der zweite Lauf sendet genau `/leanpowers:check` als Prompt (jeder Zusatztext würde als
  `$ARGUMENTS` an die Kommandozeile gehen) und setzt `LEANPOWERS_CLI=leanpowers`. Dadurch enthält
  der Start-Text keinen Pfad; der Pfad zur Kommandozeile kann nur aus dem expandierten
  `commands/check.md` stammen.
- `check-command` ist PASS nur, wenn ein Bash-`tool_use` mit `leanpowers.mjs` im Befehl vorkommt
  und das zugehörige `tool_result` (gleiche `tool_use_id`) die echte Ausgabezeile
  `✔ leanpowers check: ok (…` oder `✖ leanpowers check: <n> failed` enthält; das ist dieselbe Zuordnung wie im
  Codex-Skript. Gibt das Modell die Zeile nur selbst aus oder steht sie im Ergebnis eines anderen
  Aufrufs, ist das FAIL. UNCLEAR nennt immer seinen Grund: nicht angemeldet, Lauf nicht
  abgeschlossen, oder ein Bash-Aufruf ohne `tool_result`-Ereignis.
- `plugin-root-var` ist PASS nur, wenn ein Nutzer-Ereignis (der expandierte Slash-Befehl, kein
  `tool_result`) den absoluten Pfad `dist/claude-plugin/bin/leanpowers.mjs` enthält und die Quelle
  `commands/check.md` `${CLAUDE_PLUGIN_ROOT}` enthält. Steht die Variable unersetzt im expandierten
  Text, ist das FAIL. Ein Bash-Befehl mit dem Plugin-Pfad allein beweist die Ersetzung nicht; ohne
  expandierten Text im Stream ist das Ergebnis UNCLEAR.
- Die Auswertung liegt in den exportierten Funktionen `checkCommandEvidence` und
  `pluginRootEvidence` und wird ohne Modelllauf in `tests/verify-claude.test.mjs` geprüft.

## Installationstest durch den Maintainer (2026-10-30)

Von Hand unter macOS ausgeführt, ohne Prüfskript. Geprüft wurde die Installation über den
Marktplatz, nicht das Verhalten der Modelle.

Claude Code:

- `claude plugin marketplace add Amangaron/leanpowers` und
  `claude plugin install leanpowers@leanpowers-marketplace` liefen durch (Scope `user`, Version 0.1.0).
- `claude plugin update leanpowers@leanpowers-marketplace` hob das Plugin von 0.1.0 auf 0.1.1
  (Meldung `Restart to apply changes`).
- In einer laufenden Sitzung, die das installierte Plugin 0.1.0 geladen hatte, waren die Skills und
  Befehle des Plugins gelistet, und der SessionStart-Hook fügte seinen Starttext ein.

Codex:

- Version `codex-cli 0.165.0-alpha.1.2`, mitgeliefert in ChatGPT.app
  (`/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`). Ein eigenständiges `codex`
  gab es im `PATH` nicht; dafür war ein Alias nötig.
- `codex plugin marketplace add Amangaron/leanpowers` meldete
  ``Added marketplace `leanpowers-marketplace` from https://github.com/Amangaron/leanpowers.git``.
- `codex plugin add leanpowers@leanpowers-marketplace` installierte nach
  `~/.codex/plugins/cache/leanpowers-marketplace/leanpowers/0.1.1`.
- Der installierte Ordner wurde mit `diff -rq` gegen `dist/codex-plugin` des Repositorys
  verglichen: identisch. 12 Skills sind vorhanden, `plugin.json` nennt Version 0.1.1.
- Nicht geprüft: ob Codex die Skills in einer Sitzung lädt und benutzt (dafür wäre ein Modelllauf
  nötig).

Gemini CLI:

- `@google/gemini-cli` 0.66.0 wurde über npm installiert; für die nativen Module war
  `--allow-scripts=@github/keytar,node-pty` nötig.
- Anmeldung und `gemini extensions install … --ref gemini-extension` standen an diesem Tag noch
  aus; die Installation wurde am 2026-10-31 nachgeholt (nächster Abschnitt).

## Gemini-CLI-Installation durch den Maintainer (2026-10-31)

Von Hand unter macOS ausgeführt, ohne Prüfskript. Geprüft wurde die Installation der Erweiterung,
nicht das Verhalten der Modelle.

- `@google/gemini-cli` 0.66.0 über npm; die nativen Module wurden mit
  `npm install -g --allow-scripts=@github/keytar,node-pty @google/gemini-cli` gebaut. Für die
  Installation der Erweiterung war keine Anmeldung nötig.
- `gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension` lief
  einmal im Ordner des Repositorys und einmal im Home-Ordner. Gemini fragte
  `The current workspace at … is not trusted. Do you want to trust this workspace to install extensions?`;
  im Home-Ordner wurde mit `y` geantwortet.
- Danach meldete Gemini
  `Error downloading github release for https://github.com/Amangaron/leanpowers … Failed to fetch release data for Amangaron/leanpowers at tag gemini-extension: Request failed with status code 404.`
  (`gemini-extension` ist ein Zweig, kein Release) und fragte
  `Would you like to attempt to install via "git clone" instead?`; Antwort `y`.
- Es folgte die Warnung zu Erweiterungen von Drittanbietern mit der Liste der 12 Skills; Antwort
  `y`, dann `Extension "leanpowers" installed successfully and enabled.`
- `gemini extensions list` zeigt `leanpowers (0.1.3)`, Pfad `~/.gemini/extensions/leanpowers`,
  Quelle `https://github.com/Amangaron/leanpowers` (Type: git), Ref `gemini-extension`,
  Enabled (User) `true`, Kontextdatei `GEMINI.md` und 12 Agent-Skills (write-skill, worktrees,
  verify, tdd, start, staff, run, review, plan, finish, design, debug).
- Nicht geprüft: ob Gemini die Skills, die Befehle und die Agenten `lp-small`, `lp-medium` und
  `lp-large` in einer Sitzung lädt und benutzt (dafür wären Anmeldung und ein Modelllauf nötig).

## Was offen bleibt

- Claude Code: `session-start`, `check-command` und `plugin-root-var` müssen mit angemeldetem
  `claude` (`/login`) laufen: `node scripts/verify-claude.mjs` (erwartete Kosten unter 0,10 USD).
  Bis dahin bleiben die `(unverified)`-Markierungen in `platforms/claude-code.md` bestehen.
- Codex: Die Installation über den Marktplatz ist bestätigt (siehe oben). Ob Codex die Skills in
  einer Sitzung lädt und benutzt, bleibt ungeprüft, bis der Nutzer `bash scripts/verify-codex.sh`
  selbst ausführt (das Skript ändert die Codex-Konfiguration und wird nie von einem Agenten
  gestartet). Es meldet PASS nur, wenn ein einzelnes JSONL-Ereignis sowohl einen Befehl `node … leanpowers.mjs` als auch die echte
  Ausgabezeile `✔|✖ leanpowers check:` enthält (Skill-Text mit der Beispielzeile genügt nicht);
  mit `CODEX_MODEL=<kleines Modell>` lässt sich ein günstiges Modell wählen; die Entfernungs-
  hinweise erscheinen auch bei Fehlern.
- Gemini CLI: Die Installation der Erweiterung ist bestätigt (siehe oben). Ob Gemini die Skills,
  Befehle und Agenten in einer Sitzung lädt und benutzt, bleibt ungeprüft (dafür wären Anmeldung
  und ein Modelllauf nötig).
