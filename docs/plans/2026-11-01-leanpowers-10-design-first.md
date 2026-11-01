# leanpowers Plan 10 – `design` before any text, a yes for every size, small counts its test (v0.1.7) Implementation Plan

**Goal:** Make a change request lead into the `design` skill before any text or tool, set the size only after the code is read, say in the start text that every size needs the user's yes before code or implementer dispatch, and count a file's test as part of small – released as 0.1.7.

**Spec:** `docs/specs/2026-11-01-leanpowers-0.1.7-design.md`

**Architecture:** Text changes only: the start text in `skills/start/SKILL.md` (which `checks/start.mjs` turns into the Claude start text, `GEMINI.md` and the `AGENTS.md` block without code changes) and the `design` skill, with their test anchors and the rebuilt `dist/` files (Task 1, spec sections 4 and 5); then a release task (Task 2, spec section 6). Both tasks touch `tests/skills-content.test.mjs`, so they run one after the other. The test run with a real assistant (spec section 7) is not part of this plan; the main session runs it after the release task.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Work on branch `feat/leanpowers-0-1-7` (already checked out); never push, never tag, never merge, never `git stash`.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` after its commit.
- After changing anything the build copies (`skills/`, `agents/`, `checks/`, `bin/`, `platforms/`, `schema/`, `templates/`) or `package.json`, run `npm run build`: the test `committed dist matches a fresh build` fails otherwise. Stage only the generated `dist/` files your task lists under **Files:**, by path.
- Skill and agent texts stay within the limits checked by `skill-lint` (skills ≤ 600 words, agents ≤ 400 words, description ≤ 60 words, start text ≤ 150 tokens); token counts use `estimateTokens` from `checks/skill-lint.mjs` (⌈words × 4/3⌉).
- Skill and platform texts are English; keep the existing style (short imperative sentences); never name platform tools in `skills/` or `agents/` (only in `platforms/`); never name another plugin or a fixed docs path in `skills/` or `agents/` (`tests/skills-content.test.mjs` rejects them).
- Write every shell command and path out in full in every call; never store a command or path in a shell variable (`S="node …"; $S` fails in zsh, which does not split words, and some harnesses block variables).
- Public repository: no names of private or customer projects in code, texts, tests, CHANGELOG or commit messages; describe the trigger only as "test run" or "test project".
- When a task cites a spec section, the implementer may read exactly that section of `docs/specs/2026-11-01-leanpowers-0.1.7-design.md` (German).
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.
- Spec, section 1 (verbatim): "Der Charakter bleibt: schlank, technikneutral, gleiche Regeln für Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests (Haupt-Spec Abschnitt 16)." (Lean, technology-neutral, the same rules for all three assistants, no paid AI runs in tests.)
- Spec, section 3 (verbatim): "Kein Hook pro Nachricht (verworfen, F1 b)." (No per-message hook.)
- Spec, section 3 (verbatim): "Keine PreToolUse-Sperre (verworfen, F1 c)." (No PreToolUse block.)
- Spec, section 3 (verbatim): "Keine Änderungen an `plan`, `staff`, `run`, `finish`, an den Vorlagen und am CLI-Code; Tests ausgenommen." (`skills/plan/`, `skills/staff/`, `skills/run/`, `skills/finish/`, `agents/`, `templates/`, `checks/`, `bin/` and `build/` do not change; tests may.)
- Spec, section 3 (verbatim): "Keine höheren Grenzen (Starttext 150 Token, Skills 600 Wörter)." (The limits are not raised.)
- Spec, section 3 (verbatim): "Keine Änderung der Kriterien für Medium und Large." (The medium and large criteria stay; only the wording of the start text's medium line changes, spec section 4.2.)
- Spec, section 4.3 (verbatim): "Ist ein Wort zu viel, wird an anderer Stelle im Starttext gekürzt, nie im Satz mit der Freigabe." (A start text over budget is cut elsewhere, never in the sentence "Every size needs …".)
- Spec, section 5.3 (verbatim): "Das Gate (gilt für jede Größe), der kleine Weg, der mittlere Weg und `details/medium.md`. Kein anderer Skill, keine Vorlage und kein Code ändert sich; nur die Skill-Texte werden neu nach `dist/` gebaut." (In `skills/design/SKILL.md` the **Gate:** paragraph and section `## 2. Small and medium` stay word for word; `skills/design/details/medium.md` does not change.)

---

### Task 1: Start text and `design` (spec sections 4, 5)

**Risk:** high

**Files:**
- Modify: `skills/start/SKILL.md`
- Modify: `skills/design/SKILL.md`
- Test: `tests/start.test.mjs`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/claude-plugin/skills/start/SKILL.md`
- Modify: `dist/codex-plugin/skills/start/SKILL.md`
- Modify: `dist/gemini-extension/skills/start/SKILL.md`
- Modify: `dist/gemini-extension/GEMINI.md`
- Modify: `dist/claude-plugin/skills/design/SKILL.md`
- Modify: `dist/codex-plugin/skills/design/SKILL.md`
- Modify: `dist/gemini-extension/skills/design/SKILL.md`

**Why:** In the test run of 0.1.6 the model wrote "Size: small" before any tool call, guessed the size, never loaded `design` and once implemented without approval, citing a delegation rule. The start text told it to open with `Size:` as an instruction of its own and named approvals only for medium and large. Now `design` comes before any text or tool and sets the marker after reading the code, the start text gates every size, and small counts a file's test.

**Interfaces (exact texts):** each change replaces the first text with the second; every old text occurs exactly once. Nothing else in these files changes. No other source file quotes the old start text: `build/gemini.mjs` builds `GEMINI.md` and `checks/start.mjs` builds the `AGENTS.md` block from `skills/start/SKILL.md`; both stay unchanged, and `tests/build.test.mjs` and `tests/agents-md.test.mjs` quote no changed text.

`skills/start/SKILL.md` – two changes.

1. Old:

```text
leanpowers: before answering any change request, invoke the `design` skill; it holds the size rule and the gates. Open with `Size: small|medium|large` (unclear → larger):
- Small: one file, clear fix.
- Medium: bounded change to a flow that already exists.
```

New:

```text
leanpowers: on a change request, invoke the `design` skill before any text or tool; after reading the code it opens with `Size: small|medium|large` (unclear → larger):
- Small: one file plus its test, clear fix.
- Medium: bounded change to an existing flow.
```

2. Old:

```text
User instructions win, but Medium needs design approval and Large plan approval before any code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

New:

```text
Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

The resulting body (after the unchanged frontmatter) is exactly the text of spec section 4.1:

```text
Subagents ignore this text.

leanpowers: on a change request, invoke the `design` skill before any text or tool; after reading the code it opens with `Size: small|medium|large` (unclear → larger):
- Small: one file plus its test, clear fix.
- Medium: bounded change to an existing flow.
- Large: new feature, command or data field, several areas, or interfaces.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

Measured with `estimateTokens` (all ≤ 150, so no further cut is needed): body 136 tokens (102 words); Claude start text with a CLI line `CLI: run leanpowers as node "<path without spaces>/bin/leanpowers.mjs".` 144 (each space in the path adds one word); `dist/gemini-extension/GEMINI.md` (CLI line with `${extensionPath}` and the fallback `(else: folder of gemini-extension.json)`) 150 (112 words, at the limit); `AGENTS.md` block (`agentsMdText`) 131.

`skills/design/SKILL.md` – the body goes from 599 to 599 words (counted with `countWords` from `checks/skill-lint.mjs` on the body after the frontmatter). Changes 1, 2 and 12 are the spec texts (+22 words); changes 3–11 are the cuts that pay for them, all in section 1's closing line, section `## 3. Large` and nowhere in the gate or section 2; no rule is dropped:

1. Classify, first sentence (spec 5.1). Old:

```text
Apply the size rule; open your reply with the class in this exact form, in any language:
```

New:

```text
Read the code the request touches and count its files first; then open your reply with the class in this exact form, in any language:
```

2. Small line (spec 5.1). Old:

```text
- **Small:** one file, clear fix, no interface change.
```

New:

```text
- **Small:** one file plus its test, clear fix, no interface change.
```

3. Line after the size bullets. Old:

```text
Unsure → take the larger class. If hidden complexity shows up, stop, say so and step up; never step down.
```

New:

```text
Unsure → larger class. Hidden complexity later → stop, say so and step up; never step down.
```

4. Large step 1. Old:

```text
If the request spans independent subsystems, help split it;
```

New:

```text
Help split independent subsystems;
```

5. Large step 2. Old:

```text
**Ask** up to three independent questions per message, each multiple choice with your recommendation first; a question others depend on goes alone. Go on until purpose, constraints and success criteria are clear.
```

New:

```text
**Ask** up to three independent questions per message until purpose, constraints and success criteria are clear; each multiple choice, recommendation first; a question others depend on goes alone.
```

6. Large step 3. Old:

```text
with trade-offs; lead with your recommendation and why.
```

New:

```text
with trade-offs, recommendation first with reasons.
```

7. Large step 4, approval per section. Old:

```text
testing) and get approval after each.
```

New:

```text
testing) and get each approved.
```

8. Large step 4, YAGNI. Old:

```text
cut everything not needed now (YAGNI).
```

New:

```text
cut the unneeded (YAGNI).
```

9. Large step 5. Old:

```text
no placeholders, and only approvals the user gave.
```

New:

```text
no placeholders, only approvals the user gave.
```

10. Large step 6. Old:

```text
run `leanpowers check --all` and fix every doc-lint finding. Then reread the spec and fix contradictions and ambiguities inline.
```

New:

```text
run `leanpowers check --all`; fix every doc-lint finding. Reread the spec; fix contradictions and ambiguities inline.
```

11. Large step 7. Old:

```text
Apply changes and repeat step 6 until they approve.
```

New:

```text
Apply changes and repeat step 6 until approved.
```

12. Red flags, new last line (spec 5.2). Old:

```text
- "Just one new command in the existing CLI" → a new command is large.
```

New:

```text
- "Just one new command in the existing CLI" → a new command is large.
- "Probably one file" → read the code first, then count.
```

The medium and large bullets, the gate paragraph, section `## 2. Small and medium`, the lines `This yes opens the spec, not the code: …` and `Until the plan is approved, …`, the branch sentence of step 5, step 8, the visual mockups section and the other red flags stay as they are.

`npm run build` changes exactly the seven `dist/` files listed under **Files:** (the start skill in all three packages, `GEMINI.md`, and the design skill in all three packages); the Codex start skill gets no CLI line because it has no backticked `leanpowers` command.

- [ ] **Step 1: Write the failing tests**

In `tests/start.test.mjs`, change the import line

```js
import { startText, cliCommand, COMMANDS } from '../checks/start.mjs';
```

to

```js
import { startText, agentsMdText, cliCommand, COMMANDS } from '../checks/start.mjs';
```

and replace the whole test `start text invokes design first, names the size marker, the large criteria and the plan gate` with:

```js
test('start text invokes design before any text or tool, names the sizes and a gate for every size', () => {
  const t = startText(repo, DEFAULTS, 'leanpowers');
  assert.ok(t.includes('leanpowers: on a change request, invoke the `design` skill before any text or tool; after reading the code it opens with `Size: small|medium|large` (unclear → larger):'));
  assert.match(t, /^- Small: one file plus its test, clear fix\.$/m);
  assert.match(t, /^- Medium: bounded change to an existing flow\.$/m);
  assert.match(t, /^- Large: new feature, command or data field, several areas, or interfaces\.$/m);
  assert.ok(t.includes(`Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it.`));
  assert.doesNotMatch(t, /before answering any change request|Open with `Size|User instructions win|subagent dispatch/);
  assert.ok(estimateTokens(t) <= 150);
  assert.ok(estimateTokens(agentsMdText(repo, DEFAULTS)) <= 150);
});
```

In `tests/skills-content.test.mjs`, test `orchestration waits instead of stalling and approval comes before delegation`, replace

```js
  assert.ok(read('skills/start/SKILL.md').includes('before any code or implementer dispatch'), 'start');
```

with

```js
  assert.ok(read('skills/start/SKILL.md').includes("Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch"), 'start');
```

and append at the end of the file (after one blank line):

```js
test('start and design read the code before the size, count a file with its test and gate every size', () => {
  const start = read('skills/start/SKILL.md');
  assert.ok(start.includes('invoke the `design` skill before any text or tool'), 'start: design first');
  assert.ok(start.includes('- Small: one file plus its test, clear fix.'), 'start: small');
  assert.ok(start.includes("Every size needs the user's yes on its design (Large: and plan)"), 'start: gate');
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('Read the code the request touches and count its files first; then open your reply with the class'), 'design: count first');
  assert.ok(design.includes('- **Small:** one file plus its test, clear fix, no interface change.'), 'design: small');
  assert.ok(design.includes('- "Probably one file" → read the code first, then count.'), 'design: red flag');
  assert.ok(design.includes('No existing flow → not medium.'), 'design: medium');
  assert.ok(design.includes('a new command or data field'), 'design: large');
});
```

The existing anchors `open your reply with the class in this exact form, in any language`, `"Size: medium —`, the large bullet and `^- Large: new feature, command or data field` in `tests/skills-content.test.mjs` stay unchanged and keep passing.

- [ ] **Step 2: Run them** – `node --test tests/start.test.mjs tests/skills-content.test.mjs` → FAIL in exactly three tests (`orchestration waits instead of stalling and approval comes before delegation`, `start and design read the code before the size, count a file with its test and gate every size`, `start text invokes design before any text or tool, names the sizes and a gate for every size`).
- [ ] **Step 3: Implement** the exact texts above in `skills/start/SKILL.md` and `skills/design/SKILL.md`.
- [ ] **Step 4: Run them** – same command → PASS; `npm run build`; `git status --short` lists exactly the two skill files, the two test files and the seven `dist/` files of **Files:**; `npm test` → all PASS; then confirm the counts with `node --input-type=module -e "import fs from 'node:fs'; import { countWords, estimateTokens, parseFrontmatter } from './checks/skill-lint.mjs'; import { startText, agentsMdText } from './checks/start.mjs'; import { DEFAULTS } from './checks/lib/defaults.mjs'; const body = (f) => parseFrontmatter(fs.readFileSync(f, 'utf8')).body; console.log(estimateTokens(body('skills/start/SKILL.md')), estimateTokens(startText('.', DEFAULTS)), estimateTokens(fs.readFileSync('dist/gemini-extension/GEMINI.md', 'utf8')), estimateTokens(agentsMdText('.', DEFAULTS)), countWords(body('skills/design/SKILL.md')))"` → prints `136 144 150 131 599` (body, Claude start text with this repo's CLI path, `GEMINI.md`, `AGENTS.md` block, `design` words).
- [ ] **Step 5: Commit** – `git add skills/start/SKILL.md skills/design/SKILL.md tests/start.test.mjs tests/skills-content.test.mjs dist/claude-plugin/skills/start/SKILL.md dist/codex-plugin/skills/start/SKILL.md dist/gemini-extension/skills/start/SKILL.md dist/gemini-extension/GEMINI.md dist/claude-plugin/skills/design/SKILL.md dist/codex-plugin/skills/design/SKILL.md dist/gemini-extension/skills/design/SKILL.md` then `git commit -m "feat: design before any text or tool, a yes for every size, small counts its test"` (trailer as in Global Constraints); then `node bin/leanpowers.mjs check --all` → ok.

### Task 2: Release 0.1.7 (spec section 6)

**Risk:** low

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/claude-plugin/.claude-plugin/plugin.json`
- Modify: `dist/claude-plugin/package.json`
- Modify: `dist/codex-plugin/.codex-plugin/plugin.json`
- Modify: `dist/codex-plugin/package.json`
- Modify: `dist/gemini-extension/gemini-extension.json`
- Modify: `dist/gemini-extension/package.json`

**Why:** Ship the changes as 0.1.7 with notes users can act on. The root `README.md` and the readme test carry the version too, so they belong to this task.

**Interfaces (exact texts):** each change replaces the first text with the second; every old text occurs exactly once in its file.

- `package.json`: `"version": "0.1.6"` → `"version": "0.1.7"`. `npm run build` regenerates the six manifest and `package.json` files under `dist/` listed in **Files:**, and nothing else.
- `CHANGELOG.md`: insert this section directly above `## [0.1.6] - 2026-11-01`, followed by one blank line:

```markdown
## [0.1.7] - 2026-11-01

These changes follow from a test run of 0.1.6 in a test project.

### Changed

- The start text invokes `design` before any text or tool; `design` opens with the `Size:` marker only after reading the code and counting its files, and a new red flag says to read the code before calling a request one file.
- The start text says that every size needs the user's yes on its design (large: also on the plan) before code or implementer dispatch, delegation rules included.
- Small means one file plus its test, in the start text and in `design`.
```

- `README.md`: `Current version: 0.1.6.` → `Current version: 0.1.7.`; `Version 0.1.6. The authors` → `Version 0.1.7. The authors`.
- `docs/README.md`: `Version 0.1.6.` → `Version 0.1.7.`; after the paragraph that ends `nor the exit code.` add one blank line and this paragraph:

```text
Every change request starts in `design`, before any text or tool: it reads the code first and then
names the size (`Size: small|medium|large`). Small means one file plus its test. Every size needs
your yes on its design before code or an implementer dispatch, also when delegation rules say
otherwise; large also needs your yes on the plan. Only "implement directly" for this task skips it.
```

- `docs/README.de.md`: `Version 0.1.6.` → `Version 0.1.7.`; after the paragraph that ends `die Warnung ändert weder das Ergebnis noch den Exit-Code.` add one blank line and this paragraph:

```text
Jeder Änderungsauftrag beginnt in `design`, vor jedem Text und jedem Tool: Der Skill liest zuerst
den Code und nennt dann die Größe (`Size: small|medium|large`). Klein heißt: eine Datei plus ihr
Test. Jede Größe braucht Ihr Ja zum Design, bevor Code entsteht oder ein Implementierer startet,
auch wenn Delegationsregeln etwas anderes sagen; groß braucht zusätzlich Ihr Ja zum Plan. Nur
„implement directly“ für diese Aufgabe überspringt das.
```

- [ ] **Step 1: Write the failing test** – in `tests/skills-content.test.mjs`, replace the whole test `readmes name the report command, staffing with the plan, the branch warning and version 0.1.6` with:

```js
test('readmes name the report command, staffing with the plan, the branch warning, design first and version 0.1.7', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  const en = flat(read('docs/README.md'));
  assert.ok(en.includes('| `report --plan <file>` |'), 'en report');
  assert.ok(en.includes('Version 0.1.7.'), 'en version');
  assert.ok(en.includes('`plan` asks you to approve the plan and the staffing in one message.'), 'en staffing');
  assert.ok(en.includes('`design` (before the spec commit) and the medium path create `feat/<topic>`'), 'en branch');
  assert.ok(en.includes('warn when HEAD is on the default branch; the warning changes neither the result nor the exit code.'), 'en warning');
  assert.ok(en.includes('Every change request starts in `design`, before any text or tool: it reads the code first and then names the size'), 'en design first');
  assert.ok(en.includes('Small means one file plus its test. Every size needs your yes on its design before code or an implementer dispatch'), 'en every size');
  const de = flat(read('docs/README.de.md'));
  assert.ok(de.includes('| `report --plan <Datei>` |'), 'de report');
  assert.ok(de.includes('Version 0.1.7.'), 'de version');
  assert.ok(de.includes('`plan` fragt die Freigabe von Plan und Besetzung in einer Nachricht ab.'), 'de staffing');
  assert.ok(de.includes('legen `design` (vor dem Spec-Commit) und der mittlere Weg `feat/<topic>` an'), 'de branch');
  assert.ok(de.includes('warnen, wenn HEAD auf dem Standard-Branch steht; die Warnung ändert weder das Ergebnis noch den Exit-Code.'), 'de warning');
  assert.ok(de.includes('Jeder Änderungsauftrag beginnt in `design`, vor jedem Text und jedem Tool: Der Skill liest zuerst den Code und nennt dann die Größe'), 'de design first');
  assert.ok(de.includes('Klein heißt: eine Datei plus ihr Test. Jede Größe braucht Ihr Ja zum Design, bevor Code entsteht oder ein Implementierer startet'), 'de every size');
  assert.ok(read('README.md').includes('Current version: 0.1.7.'), 'root readme');
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.7\] - 2026-11-01$/m);
});
```

- [ ] **Step 2: Run it** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces; `npm run build`.
- [ ] **Step 4: Run it** – same command → PASS; `git status --short` lists exactly the twelve files of **Files:**; `npm test` → all PASS; `grep -n "0\.1\.6" README.md docs/README.md docs/README.de.md package.json` prints nothing (history lines in `CHANGELOG.md` stay).
- [ ] **Step 5: Commit** – `git add package.json CHANGELOG.md README.md docs/README.md docs/README.de.md tests/skills-content.test.mjs dist/claude-plugin/.claude-plugin/plugin.json dist/claude-plugin/package.json dist/codex-plugin/.codex-plugin/plugin.json dist/codex-plugin/package.json dist/gemini-extension/gemini-extension.json dist/gemini-extension/package.json` then `git commit -m "chore: release v0.1.7 notes and version"` (trailer as in Global Constraints); then `node bin/leanpowers.mjs check --all` → ok. No tag, no push, no merge.
