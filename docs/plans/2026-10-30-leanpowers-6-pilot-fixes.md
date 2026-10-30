# leanpowers Plan 6 – Pilot fixes (v0.1.2) Implementation Plan

**Goal:** Fix the frictions found in the first two real leanpowers runs (LIDO Code Studio pilot and leanpowers-lido): sharper plan/brief/review contract, no orchestrator stalls, clearer approval gate, ledger formats, a Codex start text via `AGENTS.md`, and skills of other plugins in `extraSkillDirs` – released as 0.1.2.

**Spec:** `docs/specs/2026-10-30-leanpowers-0.1.2-design.md`

**Architecture:** Small, local changes in `checks/` (pure functions, unit-tested), new modules `checks/agents-md.mjs` and `checks/lib/plugins.mjs`, text changes in `skills/`, `agents/` and `platforms/`, then a release task. Runtime behaviour of existing commands stays the same unless a task says otherwise.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Work on branch `feat/0.1.2` (already checked out); never push, never tag, never merge, never `git stash`.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- After changing anything the build copies (`skills/`, `agents/`, `checks/`, `bin/`, `platforms/`, `schema/`, `templates/`), run `npm run build` and commit the regenerated `dist/`; generated `dist/**` is exempt from scope and structure findings.
- Skill and agent texts stay within the limits checked by `skill-lint` (skills ≤ 600 words, agents ≤ 400 words, description ≤ 60 words, start text ≤ 150 tokens).
- Skill, agent and platform texts are English; keep the existing style (short imperative sentences).
- When a task cites a spec section, the implementer may read exactly that section of `docs/specs/2026-10-30-leanpowers-0.1.2-design.md`.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.

---

### Task 1: Folder approval and approved folders in the brief (A1, A2)

**Risk:** high

**Files:**
- Modify: `checks/check.mjs`
- Modify: `checks/brief.mjs`
- Test: `tests/brief.test.mjs`
- Test: `tests/approved-folders.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `export function approvedFoldersFor(files: { kind: 'Create'|'Modify'|'Test', path: string }[]): string[]` in `checks/check.mjs` – posix parent folders of all `Create` and `Test` files, without `.`, de-duplicated, sorted (string compare). `taskChecks` uses it instead of its inline filter.
- Produces: `buildBrief(plan, n, config, runDirRel, planRel = 'the plan', exists = () => false)` – new last parameter `exists(dir: string): boolean`. After the line `New folders: …` the brief adds `Approved new folders: <a>, <b>` listing `approvedFoldersFor(task.files)` filtered to those where `exists(dir)` is false; no such folder → no line. `writeBrief` passes `(dir) => fs.existsSync(path.join(root, dir))`.

- [ ] **Step 1: Write the failing tests** – create `tests/approved-folders.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedFoldersFor } from '../checks/check.mjs';

test('Create and Test files approve their folders, Modify does not', () => {
  assert.deepEqual(approvedFoldersFor([
    { kind: 'Create', path: 'pakete/x/src/a.ts' },
    { kind: 'Test', path: 'pakete/x/tests/a.test.ts' },
    { kind: 'Modify', path: 'lib/old/b.ts' },
    { kind: 'Create', path: 'root.json' },
    { kind: 'Test', path: 'pakete/x/tests/b.test.ts' },
  ]), ['pakete/x/src', 'pakete/x/tests']);
});
```

and append to `tests/brief.test.mjs`:

```js
test('brief lists approved new folders that do not exist yet', () => {
  const plan = parsePlan(PLAN);
  const none = buildBrief(plan, 1, config, 'r', 'p.md', () => true);
  assert.doesNotMatch(none, /Approved new folders/);
  const fresh = buildBrief(plan, 1, config, 'r', 'p.md', (d) => d === 'src/components');
  assert.match(fresh, /New folders: ask\nApproved new folders: tests\n/);
  const both = buildBrief(plan, 1, config, 'r', 'p.md', () => false);
  assert.match(both, /Approved new folders: src\/components, tests\n/);
});
```

- [ ] **Step 2: Run** – `node --test tests/approved-folders.test.mjs tests/brief.test.mjs` → FAIL (`approvedFoldersFor` missing, no line in the brief).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Test files approve new folders; brief lists approved new folders"`

### Task 2: Spec, sources and constraints for implementers and reviewers (A3, A4)

**Risk:** high

**Files:**
- Modify: `checks/lib/plan.mjs`
- Modify: `checks/brief.mjs`
- Modify: `agents/implementer.md`
- Modify: `agents/reviewer.md`
- Modify: `skills/run/SKILL.md`
- Modify: `skills/plan/details/plan-format.md`
- Test: `tests/plan.test.mjs`
- Test: `tests/brief.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Consumes: `buildBrief` signature from Task 1.
- Produces: `parsePlan(text).sources: string[]` – from an optional header line `**Sources:** a, b` (outside code; backticks removed; split on `,`; trimmed; empty entries dropped); missing → `[]`.
- Produces: brief layout – line 2 stays `**Risk:** … · Plan goal: …`; a new line 3 `**Spec:** <plan.spec>` (omitted when `plan.spec` is empty); when `plan.sources` is not empty, a section `## Sources` after `## Global constraints` with one `- <path>` per source and the sentence `Read-only references for facts; read only what the task needs.`
- Produces: `writeBrief` also writes `<runDir>/constraints.md` = `plan.globalConstraints + '\n'` on every call.
- Produces: `agents/implementer.md` step 1 – the brief is the only source of requirements; the implementer may read the spec section the brief cites (only that section) and the files under `## Sources`.
- Produces: `agents/reviewer.md` inputs – `{{constraints}}` becomes "Global constraints file: `{{constraints}}`"; new inputs "Spec: `{{spec}}`" and "Sources: `{{sources}}` (list, or none)"; one process line: when the task states facts about other code or documents, check them against the spec and sources and report wrong facts as findings.
- Produces: `skills/run/SKILL.md` per-task step 5 – reviewer dispatch fills `{{constraints}}` with the run folder's `constraints.md` path, `{{spec}}` with the plan's spec path and `{{sources}}` with the plan's sources.
- Produces: `skills/plan/details/plan-format.md` header section documents `**Sources:**`.

- [ ] **Step 1: Write the failing tests** – append to `tests/plan.test.mjs`:

```js
test('Sources header is parsed into a list', () => {
  const text = '# P\n\n**Goal:** g\n\n**Spec:** `s.md`\n\n**Sources:** `a/README.md`, b/schema.json ,\n\n## Global Constraints\n\n- c\n';
  assert.deepEqual(parsePlan(text).sources, ['a/README.md', 'b/schema.json']);
  assert.deepEqual(parsePlan('# P\n\n**Goal:** g\n').sources, []);
});
```

append to `tests/brief.test.mjs`:

```js
test('brief names the spec and lists sources', () => {
  const withSources = PLAN.replace('## Global Constraints', '**Sources:** `x/README.md`, `y/schema.json`\n\n## Global Constraints');
  const b = buildBrief(parsePlan(withSources), 1, config, 'r');
  assert.match(b, /\n\*\*Spec:\*\* docs\/specs\/s\.md\n/);
  assert.match(b, /## Sources\n\n- x\/README\.md\n- y\/schema\.json\n\nRead-only references for facts; read only what the task needs\./);
  assert.doesNotMatch(buildBrief(parsePlan(PLAN), 1, config, 'r'), /## Sources/);
});

test('writeBrief writes constraints.md next to the brief', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  const brief = writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  assert.equal(fs.readFileSync(path.join(path.dirname(brief), 'constraints.md'), 'utf8'), '- Node >= 20\n');
});
```

- [ ] **Step 2: Run** – `node --test tests/plan.test.mjs tests/brief.test.mjs` → FAIL (`sources` undefined, no Spec line, no constraints file).
- [ ] **Step 3: Implement** as in Interfaces (code and the four text files).
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS (skill-lint word limits included); `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: briefs name spec and sources, constraints file for reviewers"`

### Task 3: Reset a task base (A5)

**Risk:** low

**Files:**
- Modify: `checks/brief.mjs`
- Modify: `bin/leanpowers.mjs`
- Modify: `skills/run/details/ledger.md`
- Test: `tests/brief.test.mjs`
- Test: `tests/cli.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `writeBrief(root, planPath, n, config, { resetBase = false } = {})` – with `resetBase` the base file is rewritten with the current HEAD; without it the base stays as before (written only on the first call).
- Produces: CLI `leanpowers brief --plan <p> --task <n> [--reset-base]`; usage text lists the switch.
- Produces: `ledger.md` – new line `Task <n>: base reset (<sha7>) — <why>` in the line table, and in "Resume"/gate notes: reset a base only after a plan correction and before the task has commits; log it together with a `Ruling:` line.

- [ ] **Step 1: Write the failing tests** – append to `tests/brief.test.mjs`:

```js
test('base is kept unless reset is requested', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'one');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  const brief = writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  const baseFile = path.join(path.dirname(brief), 'task-1-base.txt');
  const first = fs.readFileSync(baseFile, 'utf8');
  git('commit', '-q', '--allow-empty', '-m', 'two');
  writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  assert.equal(fs.readFileSync(baseFile, 'utf8'), first);
  writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS, { resetBase: true });
  assert.equal(fs.readFileSync(baseFile, 'utf8').trim(), git('rev-parse', 'HEAD').trim());
});
```

and append to `tests/cli.test.mjs` a test that `node bin/leanpowers.mjs` without arguments prints a usage text containing `--reset-base` (follow the existing usage test in that file).
- [ ] **Step 2: Run** – `node --test tests/brief.test.mjs tests/cli.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: brief --reset-base after plan corrections"`

### Task 4: Golden-file steps and missing-config hint (A6, A7)

**Risk:** low

**Files:**
- Modify: `skills/plan/details/plan-format.md`
- Modify: `skills/plan/SKILL.md`
- Modify: `checks/gates.mjs`
- Modify: `checks/check.mjs`
- Test: `tests/gates.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `runGates(config, root, { configFound = true } = {})` – when no test command is configured and `configFound` is false, the message is `no test command configured (no leanpowers.json found)`; otherwise unchanged. `runCheck` passes `configFound` = whether `<root>/leanpowers.json` exists.
- Produces: `plan-format.md` – a short section "Golden files": a test against a stored expected file has RED "module missing", then GREEN, then its own step "generate the expected file and review it", then PASS again. `plan/SKILL.md` step 5 mentions it in one sentence with a link.

- [ ] **Step 1: Write the failing test** – append to `tests/gates.test.mjs`:

```js
test('missing config is named when no test command is configured', () => {
  const cfg = { ...DEFAULTS, commands: { test: '', typecheck: '', lint: '' } };
  assert.deepEqual(runGates(cfg, process.cwd(), { configFound: false })[0].messages, ['no test command configured (no leanpowers.json found)']);
  assert.deepEqual(runGates(cfg, process.cwd())[0].messages, ['no test command configured']);
});
```

(import `DEFAULTS` from `../checks/lib/defaults.mjs` if the file does not yet.)
- [ ] **Step 2: Run** – `node --test tests/gates.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: name a missing leanpowers.json; golden-file steps in the plan format"`

### Task 5: No orchestrator stalls, branch rule, approval before delegation (B1–B3)

**Risk:** high

**Files:**
- Modify: `skills/run/SKILL.md`
- Modify: `skills/run/details/loops.md`
- Modify: `skills/run/details/ledger.md`
- Modify: `skills/staff/SKILL.md`
- Modify: `skills/start/SKILL.md`
- Modify: `skills/design/SKILL.md`
- Modify: `agents/orchestrator.md`
- Modify: `platforms/claude-code.md`
- Modify: `platforms/codex-cli.md`
- Modify: `platforms/gemini-cli.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces (texts, content per spec section 4):
  - `run/SKILL.md` and `loops.md`: dispatch subagents in the foreground and wait for their result; a subagent resumed by a message reports back with its own notification – wait for it, never poll, never end the turn while one of your subagents works.
  - `orchestrator.md`: the turn ends only with a final reply starting `Status: DONE` or `Status: NEEDS_USER`.
  - `staff/SKILL.md`: the re-dispatched orchestrator's prompt names the ledger's last line.
  - `ledger.md` branch guard step 2: a branch named in the plan's Global Constraints counts like a user instruction.
  - `start/SKILL.md`: add one sentence – approval comes before any code or subagent dispatch; delegation rules decide who builds, not whether the design is approved; only an explicit "implement directly" for this task skips it. Start text stays ≤ 150 tokens.
  - `design/SKILL.md` gate paragraph: same rule in one or two sentences.
  - Each `platforms/*.md`: one line under Actions or Orchestration on how a resumed subagent reports back on that platform and that the caller waits for it (Claude Code: result arrives as a task notification; Codex/Gemini: state "(unverified)" where not confirmed).
- Produces: `tests/skills-content.test.mjs` – assertions that `start/SKILL.md` contains `before any code or subagent dispatch`, `orchestrator.md` contains `Status: DONE` and `Status: NEEDS_USER` in its ending rule, and `run/SKILL.md` contains `never end the turn`.

- [ ] **Step 1: Write the failing assertions** in `tests/skills-content.test.mjs` as listed in Interfaces (follow the file's existing pattern of reading skill files).
- [ ] **Step 2: Run** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Edit the texts** as in Interfaces.
- [ ] **Step 4: Run** – `npm test` → PASS (skill-lint limits, start text ≤ 150 tokens); `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: wait instead of stalling, branch rule, approval before delegation"`

### Task 6: Ledger formats and update note (C1–C3)

**Risk:** low

**Files:**
- Modify: `skills/run/details/ledger.md`
- Modify: `skills/run/SKILL.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `ledger.md` line table rows `Final: minor (deferred): <one-liner>` and `Final: Ruling: <what> — <why> — <cost if wrong>`; a sentence in "Header": extra sections such as `## Notes` go between the header line and `## Tasks`; `## Metrics` stays last. `run/SKILL.md` End step 4 mentions final minors and rulings use these lines.
- Produces: one sentence in each README (in the install section): after a plugin update start a new session; running sessions keep the old skills and CLI path.
- Produces: `tests/skills-content.test.mjs` – assertions that `ledger.md` contains `Final: minor (deferred)` and `## Notes`.

- [ ] **Step 1: Write the failing assertions.**
- [ ] **Step 2: Run** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Edit** as in Interfaces.
- [ ] **Step 4: Run** – `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "docs: ledger lines for final minors and notes; new session after updates"`

### Task 7: Start text block in AGENTS.md (D1)

**Risk:** high

**Files:**
- Create: `checks/agents-md.mjs`
- Modify: `checks/start.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/agents-md.test.mjs`
- Test: `tests/cli.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `export function agentsMdText(pluginRoot: string, config: object): string` in `checks/start.mjs` – the start text without the line `Subagents ignore this text.` and without the CLI line; same active-command filtering as the normal start text.
- Produces: `export function updateAgentsMd(root: string, text: string): 'created' | 'updated' | 'unchanged'` in `checks/agents-md.mjs` – block `<!-- leanpowers:start -->\n<text>\n<!-- leanpowers:end -->`; no file → create it with the block and a trailing newline; no block → append `\n` + block + `\n` (one blank line before the block when the file does not end with a blank line); block present → replace only the text between the markers; identical result → `'unchanged'` and no write. More than one start or end marker, or only one of them → throw `Error('AGENTS.md: leanpowers block markers are broken')` without writing.
- Produces: CLI – `init --write` and `init --template <name>` call `updateAgentsMd` after writing and print `AGENTS.md: <result>`; new `init --agents-md` only updates the block and prints the same line; usage lists `--agents-md`.

- [ ] **Step 1: Write the failing tests** – create `tests/agents-md.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateAgentsMd } from '../checks/agents-md.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-agents-'));
const read = (root) => fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const BLOCK = (t) => `<!-- leanpowers:start -->\n${t}\n<!-- leanpowers:end -->`;

test('creates AGENTS.md with the block', () => {
  const root = tmp();
  assert.equal(updateAgentsMd(root, 'size rule'), 'created');
  assert.equal(read(root), `${BLOCK('size rule')}\n`);
});

test('appends the block and keeps existing text byte for byte', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project rules\n\nUse tabs.\n');
  assert.equal(updateAgentsMd(root, 'size rule'), 'updated');
  assert.equal(read(root), `# Project rules\n\nUse tabs.\n\n${BLOCK('size rule')}\n`);
});

test('replaces only the block content and reports unchanged runs', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), `before\n\n${BLOCK('old')}\n\nafter\n`);
  assert.equal(updateAgentsMd(root, 'new'), 'updated');
  assert.equal(read(root), `before\n\n${BLOCK('new')}\n\nafter\n`);
  assert.equal(updateAgentsMd(root, 'new'), 'unchanged');
});

test('broken markers throw and leave the file alone', () => {
  for (const content of ['<!-- leanpowers:start -->\nx\n', `${BLOCK('a')}\n${BLOCK('b')}\n`, 'x\n<!-- leanpowers:end -->\n']) {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), content);
    assert.throws(() => updateAgentsMd(root, 'new'), /AGENTS\.md: leanpowers block markers are broken/);
    assert.equal(read(root), content);
  }
});
```

and append to `tests/cli.test.mjs` a test that `init --agents-md` in a temp folder prints `AGENTS.md: created` and the file contains `<!-- leanpowers:start -->` and not `Subagents ignore this text.` (follow the existing CLI test helpers in that file).
- [ ] **Step 2: Run** – `node --test tests/agents-md.test.mjs tests/cli.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: init writes a leanpowers start-text block into AGENTS.md"`

### Task 8: Skills of other plugins via plugin:<name> (D2)

**Risk:** high

**Files:**
- Create: `checks/lib/plugins.mjs`
- Modify: `checks/skills-cmd.mjs`
- Modify: `checks/skill-lint.mjs`
- Modify: `checks/check.mjs`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/plugins.test.mjs`
- Test: `tests/skills-cmd.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: `export function resolvePluginSkillDir(name: string, { home = os.homedir() } = {}): string | null` – order and rules from spec section 6 D2 (Claude `installed_plugins.json` → Codex cache highest version → Gemini extensions); returns `<plugin>/skills` only if that folder exists; unreadable or invalid JSON counts as not found.
- Produces: `export function resolveSkillDirs(root: string, extraSkillDirs: string[], { home } = {}): { dirs: { dir: string, source: string }[], warnings: string[] }` – plain entries resolve against `root` (source `extra`); `plugin:<name>` entries via `resolvePluginSkillDir` (source `plugin:<name>`); not found → warning `extraSkillDirs: plugin <name> not found`.
- Produces: `listSkills` and `lintSkills` use `resolveSkillDirs`; warnings are printed by the `skills` command and appended as messages that do not fail `skill-lint` (they are listed after a green result line; follow how the CLI already prints config warnings: `lintSkills` returns them as `warnings` without changing `ok`, and `runCheck` in `checks/check.mjs` passes them to `formatResults` with the config warnings).
- Produces: README rows for `extraSkillDirs` mention `plugin:<name>` (English and German).

- [ ] **Step 1: Write the failing tests** – create `tests/plugins.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolvePluginSkillDir, resolveSkillDirs } from '../checks/lib/plugins.mjs';

const home = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-home-'));
const mk = (...p) => { fs.mkdirSync(path.join(...p), { recursive: true }); return path.join(...p); };

test('Claude Code: installed_plugins.json installPath', () => {
  const h = home();
  const install = mk(h, '.claude/plugins/cache/m/lido/0.1.0');
  mk(install, 'skills');
  mk(h, '.claude/plugins');
  fs.writeFileSync(path.join(h, '.claude/plugins/installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'lido@m': [{ scope: 'user', installPath: install }] } }));
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(install, 'skills'));
});

test('Codex: highest cached version wins', () => {
  const h = home();
  mk(h, '.codex/plugins/cache/m/lido/0.9.0/skills');
  mk(h, '.codex/plugins/cache/m/lido/0.10.1/skills');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(h, '.codex/plugins/cache/m/lido/0.10.1/skills'));
});

test('Gemini: extensions folder', () => {
  const h = home();
  mk(h, '.gemini/extensions/lido/skills');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(h, '.gemini/extensions/lido/skills'));
});

test('not found and broken JSON give null', () => {
  const h = home();
  mk(h, '.claude/plugins');
  fs.writeFileSync(path.join(h, '.claude/plugins/installed_plugins.json'), '{broken');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), null);
});

test('resolveSkillDirs mixes plain and plugin entries and warns', () => {
  const h = home();
  mk(h, '.gemini/extensions/lido/skills');
  const root = home();
  const r = resolveSkillDirs(root, ['skills-extra', 'plugin:lido', 'plugin:fehlt'], { home: h });
  assert.deepEqual(r.dirs, [
    { dir: path.resolve(root, 'skills-extra'), source: 'extra' },
    { dir: path.join(h, '.gemini/extensions/lido/skills'), source: 'plugin:lido' },
  ]);
  assert.deepEqual(r.warnings, ['extraSkillDirs: plugin fehlt not found']);
});
```

and append to `tests/skills-cmd.test.mjs` a test that `listSkills` lists a skill from a `plugin:<name>` entry with `source: 'plugin:<name>'` (use a temp home via the new `home` option threaded through, or `HOME` override as the file's existing tests do).
- [ ] **Step 2: Run** – `node --test tests/plugins.test.mjs tests/skills-cmd.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** – same command → PASS; `npm test` → PASS; `npm run build`.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: extraSkillDirs resolve plugin:<name> on all three platforms"`

### Task 9: Version 0.1.2 and changelog

**Risk:** low

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Modify: `.claude-plugin/**`
- Modify: `.agents/**`
- Modify: `dist/**`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: version `0.1.2` in `package.json` and every generated manifest; changelog section `## [0.1.2] - 2026-10-30` above `## [0.1.1]` with Added/Changed/Fixed bullets for packages A–D (one line each, plain); README status lines that name the current version say `0.1.2` (historic mentions unchanged).

- [ ] **Step 1: Implement** – set the version, run `npm run build`, update changelog and current-version mentions.
- [ ] **Step 2: Run** – `npm test` → PASS; `npm run build && git diff --exit-code -- dist .claude-plugin .agents` → no output after commit; `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- [ ] **Step 3: Commit** – `git add -A package.json CHANGELOG.md README.md docs dist .claude-plugin .agents && git commit -m "chore: release v0.1.2 notes and version"`
