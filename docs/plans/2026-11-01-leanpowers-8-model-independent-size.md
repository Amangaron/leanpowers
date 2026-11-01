# leanpowers Plan 8 – Model-independent size rule, finish without gaps (v0.1.5) Implementation Plan

**Goal:** Make the large path work on every model (start text invokes `design` first, one size rule), make `finish` always run and keep the run outcome in a committed report, enforce the own paths, tidy orchestration and templates – released as 0.1.5.

**Spec:** `docs/specs/2026-11-01-leanpowers-0.1.5-design.md`

**Architecture:** One new pure module with a CLI command (`checks/report.mjs`, `report --plan`), one new helper (`checks/lib/paths.mjs`) used by the check runner and the CLI, small changes to `structure`, `check`, `brief`, `init` and the build, then text changes in `skills/`, `agents/` and `platforms/`, then a release task. The test run with a real assistant (spec section 10) is not part of this plan; the main session runs it after the release task.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Work on branch `claude/leanpowers-0-1-5-71cdf7` (already checked out); never push, never tag, never merge, never `git stash`.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` after its commit.
- After changing anything the build copies (`skills/`, `agents/`, `checks/`, `bin/`, `platforms/`, `schema/`, `templates/`) or the build itself (`build/`), run `npm run build` and commit the regenerated `dist/`; generated `dist/**` is exempt from scope and structure findings.
- Skill and agent texts stay within the limits checked by `skill-lint` (skills ≤ 600 words, agents ≤ 400 words, description ≤ 60 words, start text ≤ 150 tokens); `agents/implementer.md` must not change.
- Skill, agent and platform texts are English; keep the existing style (short imperative sentences); never name platform tools in `skills/` or `agents/` (only in `platforms/`); never name another plugin or a fixed docs path in `skills/` or `agents/` (`tests/skills-content.test.mjs` rejects them).
- Write every shell command and path out in full in every call; never store a command or path in a shell variable (`S="node …"; $S` fails in zsh, which does not split words, and some harnesses block variables).
- Public repository: no names of private or customer projects in code, texts, tests, CHANGELOG or commit messages; describe the pilot only as "second pilot" or "test project".
- When a task cites a spec section, the implementer may read exactly that section of `docs/specs/2026-11-01-leanpowers-0.1.5-design.md`.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.

---

### Task 1: `report` command (spec section 6.1, code part)

**Risk:** high

**Files:**
- Create: `checks/report.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/report.test.mjs`
- Test: `tests/cli.test.mjs`
- Modify: `dist/**`

**Why:** `finish` deletes the run folder with the ledger, so rulings and open minors were lost after a merge. `report` copies them, deterministically, into a committed file under `paths.reports`.

**Interfaces:**
- Produces in `checks/report.mjs`: `export function buildReport(ledgerText: string, planRel: string, name: string): string`.
  - Normalize `\r\n` to `\n`; split into lines.
  - `metricsAt` = index of the first line whose `trimEnd()` is `## Metrics`, else -1. Lines considered for selection are those before `metricsAt` (all lines when -1).
  - `header` = the first considered line that starts with `Run base:`, or none.
  - Selected lines, in ledger order, each once: a considered line that includes `Ruling:`, includes `minor (deferred)`, includes ` parked — `, starts with `Stop:` or starts with `Final:`. Lines are copied verbatim (no trimming beyond the newline split).
  - Output: `# Run report — <name>`, blank, `Plan: <planRel>`, the header line if any, blank, `## Rulings and open points`, blank, the selected lines (or the single line `none`). If `metricsAt` ≥ 0: blank, then the lines from `metricsAt` to the end joined with `\n` and `trimEnd()`-ed. The result ends with exactly one `\n`.
- Produces in `checks/report.mjs`: `export function writeReport(root: string, config: object, planPath: string): string`.
  - `planRel` = `toPosix(path.relative(root, path.resolve(root, planPath)))`; `name` = plan basename without `.md`.
  - Ledger = `path.join(root, config.paths.runs, name, 'progress.md')`; never create the run folder (do not call `runDirFor`). Missing → `` throw new Error(`no ledger for ${planRel}: ${ledgerRel}`) `` with `ledgerRel` root-relative posix; create nothing.
  - Writes `buildReport(...)` to `path.join(root, config.paths.reports, `${name}.md`)`, creating the folder recursively, overwriting an existing file. Returns that absolute path.
- Produces in `bin/leanpowers.mjs`: command `report`: `const { plan } = parseArgs(rest); if (!plan) usage();` load the config like `metrics` does, print `toPosix(path.relative(root, writeReport(root, config, plan)))`. An error whose message starts with `no ledger for ` prints the message to stderr and exits 1; others are rethrown. Usage: first line becomes `usage: leanpowers <check|brief|metrics|report|config|start|skills|init> [options]`; add the line `  report --plan <file>` directly after `  metrics --plan <file>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/report.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReport, writeReport } from '../checks/report.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const LEDGER = [
  '# leanpowers ledger — plan: docs/plans/demo.md',
  '',
  'Run base: abc1234 · Base branch: main · Branch: feat/demo · Worktree: none',
  '',
  '## Tasks',
  'Ruling: branch feat/demo — HEAD was on main — none',
  'Task 1: implementer dispatched (-)',
  'Task 1: implementer id a1',
  'Task 1: gated (commits abc1234..bcd2345)',
  'Task 1: minor (deferred): rename helper',
  'Task 2: parked — slow loop — Ruling: fine for ten items — rewrite later',
  'Stop: CSV or JSON?',
  'Ruling: CSV — user decided — redo the export',
  'Task 2: complete (commits bcd2345..cde3456, 1 parked)',
  'Final: review APPROVED, no fix wave',
  'Final: minor (deferred): typo in README',
  'Final: ✔ leanpowers check: ok (gates:test)',
  '',
  '## Metrics',
  '',
  '- briefs: 2 (10 words)',
  '- subagent reports: 2 (8 words)',
  '- reviews: 1 (3 words)',
  '',
].join('\n');

const EXPECTED = [
  '# Run report — demo',
  '',
  'Plan: docs/plans/demo.md',
  'Run base: abc1234 · Base branch: main · Branch: feat/demo · Worktree: none',
  '',
  '## Rulings and open points',
  '',
  'Ruling: branch feat/demo — HEAD was on main — none',
  'Task 1: minor (deferred): rename helper',
  'Task 2: parked — slow loop — Ruling: fine for ten items — rewrite later',
  'Stop: CSV or JSON?',
  'Ruling: CSV — user decided — redo the export',
  'Final: review APPROVED, no fix wave',
  'Final: minor (deferred): typo in README',
  'Final: ✔ leanpowers check: ok (gates:test)',
  '',
  '## Metrics',
  '',
  '- briefs: 2 (10 words)',
  '- subagent reports: 2 (8 words)',
  '- reviews: 1 (3 words)',
  '',
].join('\n');

test('buildReport keeps header, rulings, open points, final lines and metrics in ledger order', () => {
  assert.equal(buildReport(LEDGER, 'docs/plans/demo.md', 'demo'), EXPECTED);
  assert.equal(buildReport(LEDGER.replace(/\n/g, '\r\n'), 'docs/plans/demo.md', 'demo'), EXPECTED);
});

test('buildReport says none without matching lines and leaves out missing parts', () => {
  const ledger = '# leanpowers ledger — plan: p.md\n\n## Tasks\nTask 1: complete (commits a..b, review clean)\n';
  assert.equal(buildReport(ledger, 'p.md', 'p'), '# Run report — p\n\nPlan: p.md\n\n## Rulings and open points\n\nnone\n');
});

function project(ledger) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-report-'));
  if (ledger !== undefined) {
    fs.mkdirSync(path.join(root, '.leanpowers/runs/demo'), { recursive: true });
    fs.writeFileSync(path.join(root, '.leanpowers/runs/demo/progress.md'), ledger);
  }
  return root;
}

test('writeReport writes into paths.reports and overwrites on rerun', () => {
  const root = project(LEDGER);
  const file = writeReport(root, DEFAULTS, 'docs/plans/demo.md');
  assert.equal(file, path.join(root, 'docs/reports/demo.md'));
  assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED);
  fs.writeFileSync(file, 'old');
  writeReport(root, DEFAULTS, path.join(root, 'docs/plans/demo.md'));
  assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED);
});

test('writeReport without a ledger throws and creates nothing', () => {
  const root = project();
  assert.throws(() => writeReport(root, DEFAULTS, 'docs/plans/demo.md'),
    { message: 'no ledger for docs/plans/demo.md: .leanpowers/runs/demo/progress.md' });
  assert.equal(fs.existsSync(path.join(root, '.leanpowers')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
});
```

In `tests/cli.test.mjs`, change the regex in `unknown command prints usage and exits 2` to `/usage: leanpowers <check\|brief\|metrics\|report\|config\|start\|skills\|init>/` and append:

```js
test('report writes the run report and prints its path', () => {
  const root = project();
  fs.mkdirSync(path.join(root, '.leanpowers/runs/demo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.leanpowers/runs/demo/progress.md'), '# leanpowers ledger — plan: docs/plans/demo.md\n\n## Tasks\nRuling: a — b — c\n');
  const r = spawn(root, 'report', '--plan', 'docs/plans/demo.md');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'docs/reports/demo.md\n');
  assert.match(fs.readFileSync(path.join(root, 'docs/reports/demo.md'), 'utf8'), /^Ruling: a — b — c$/m);
});

test('report without a ledger exits 1; without --plan it prints usage', () => {
  const root = project();
  const r = spawn(root, 'report', '--plan', 'docs/plans/demo.md');
  assert.equal(r.status, 1);
  assert.equal(r.stderr, 'no ledger for docs/plans/demo.md: .leanpowers/runs/demo/progress.md\n');
  const u = spawn(root, 'report');
  assert.equal(u.status, 2);
  assert.match(u.stderr, /^  report --plan <file>$/m);
});
```

- [ ] **Step 2: Run them** – `node --test tests/report.test.mjs tests/cli.test.mjs` → FAIL (module not found; unknown command `report`).
- [ ] **Step 3: Implement** `checks/report.mjs` and the `report` command as in Interfaces; JSDoc on both exports.
- [ ] **Step 4: Run them** – same command → PASS; `npm run build`; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add checks/report.mjs bin/leanpowers.mjs tests/report.test.mjs tests/cli.test.mjs dist` then `git commit -m "feat: report command keeps rulings and open minors in paths.reports"` (trailer as in Global Constraints).

### Task 2: Own paths in checks, init and CLI; brief name helper; plural (spec sections 5.2, 8 points 1–2)

**Risk:** high

**Files:**
- Create: `checks/lib/paths.mjs`
- Modify: `checks/structure.mjs`
- Modify: `checks/check.mjs`
- Modify: `checks/brief.mjs`
- Modify: `checks/init.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/paths.test.mjs`
- Test: `tests/scope-structure.test.mjs`
- Test: `tests/check.test.mjs`
- Test: `tests/brief.test.mjs`
- Test: `tests/init.test.mjs`
- Test: `tests/cli.test.mjs`
- Modify: `dist/**`

**Why:** In the pilot the assistant avoided creating `docs/specs` and `.leanpowers/runs` after being told off for new folders, and put run files under `/tmp`; plans landed in another plugin's folder unnoticed. The configured folders are approved by configuration, and the CLI warns where a plan or brief path is passed that lies outside them.

**Interfaces:**
- Produces in `checks/lib/paths.mjs`:
  - `export function ownFolders(config): string[]` – `[paths.specs, paths.plans, paths.reports, paths.runs]` in this order, each `toPosix(p).replace(/^\.\//, '').replace(/\/+$/, '')`.
  - `export function insideFolder(root: string, file: string, folder: string): boolean` – `rel` = `toPosix(path.relative(root, path.resolve(root, file)))`, `f` = folder normalized as above; true when `rel === f` or `rel.startsWith(`${f}/`)`.
  - `export function outsideWarning(root, config, file, kind: 'plan' | 'brief'): string | null` – `key` = `plans` for `plan`, `runs` for `brief`; `null` when `insideFolder(root, file, config.paths[key])`, else `` `${kind} outside paths.${key} (${<normalized folder>}): ${rel}` ``.
- Produces in `checks/structure.mjs`: `checkStructure({ changed, rules, newFolders, existingDirs, approvedFolders = [], ownFolders = [] })` – a fresh folder `dir` is skipped (no message, in `ask` and `deny`) when some `o` of `ownFolders` satisfies `o === dir || o.startsWith(`${dir}/`) || dir.startsWith(`${o}/`)`. Everything else unchanged.
- Produces in `checks/check.mjs`:
  - `scopeAndStructure` passes `ownFolders: ownFolders(config)` to `checkStructure`.
  - `runCheck`: when the plan form runs (`plan` and `task` set, no `brief`), push `outsideWarning(root, config, plan, 'plan')` into the warnings if not null; when the brief form runs, push `outsideWarning(root, config, brief, 'brief')`. These warnings come after the config errors and before the `--all` warnings.
  - `briefChecks` uses `briefTaskNumber` from `brief.mjs` (its message `check --brief needs a task-<n>-brief.md` stays).
  - `uncommittedWarning`: `` `uncommitted changes: ${n} ${n === 1 ? 'file' : 'files'} (…)` ``.
- Produces in `checks/brief.mjs`: `export const BRIEF_NAME_ERROR = 'brief --file needs a task-<n>-brief.md';` and `export function briefTaskNumber(file: string): number | null` (basename matches `/^task-(\d+)-brief\.md$/` → `Number(m[1])`, else `null`). `writeBaseFor` uses both instead of its own regex and string.
- Produces in `checks/init.mjs`: `proposeConfig(root)` returns `{ $schema, paths: { ...DEFAULTS.paths }, commands, structure }` in this key order (import `DEFAULTS` from `./lib/defaults.mjs`).
- Produces in `bin/leanpowers.mjs`:
  - `brief --file`: compare the error message with `BRIEF_NAME_ERROR` instead of the literal string.
  - After a successful `brief --plan`, `brief --file` and `metrics --plan`, print `warning: <outsideWarning(...)>` to stderr when it is not null (`plan` for `--plan`, `brief` for `--file`); stdout and exit code unchanged.

- [ ] **Step 1: Write the failing tests**

Create `tests/paths.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { ownFolders, insideFolder, outsideWarning } from '../checks/lib/paths.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const root = path.join(os.tmpdir(), 'lp-paths-root');

test('ownFolders lists the four configured paths in posix form', () => {
  assert.deepEqual(ownFolders(DEFAULTS), ['docs/specs', 'docs/plans', 'docs/reports', '.leanpowers/runs']);
  assert.deepEqual(ownFolders({ paths: { specs: './a/specs/', plans: 'b/plans', reports: 'r', runs: 'x/' } }), ['a/specs', 'b/plans', 'r', 'x']);
});

test('insideFolder accepts relative and absolute files below the folder only', () => {
  assert.equal(insideFolder(root, 'docs/plans/p.md', 'docs/plans'), true);
  assert.equal(insideFolder(root, path.join(root, 'docs/plans/sub/p.md'), 'docs/plans'), true);
  assert.equal(insideFolder(root, 'docs/plansx/p.md', 'docs/plans'), false);
  assert.equal(insideFolder(root, 'plans/p.md', './docs/plans/'), false);
  assert.equal(insideFolder(root, '../docs/plans/p.md', 'docs/plans'), false);
});

test('outsideWarning names the kind, the configured folder and the file', () => {
  assert.equal(outsideWarning(root, DEFAULTS, 'docs/plans/p.md', 'plan'), null);
  assert.equal(outsideWarning(root, DEFAULTS, 'docs/other/plans/p.md', 'plan'), 'plan outside paths.plans (docs/plans): docs/other/plans/p.md');
  assert.equal(outsideWarning(root, DEFAULTS, '.leanpowers/runs/d/task-1-brief.md', 'brief'), null);
  assert.equal(outsideWarning(root, DEFAULTS, path.join(root, 'tmp/task-1-brief.md'), 'brief'), 'brief outside paths.runs (.leanpowers/runs): tmp/task-1-brief.md');
});
```

Append to `tests/scope-structure.test.mjs`:

```js
test('structure: own folders, their parents and children are never new, in ask and deny', () => {
  const own = ['docs/specs', 'docs/plans', 'docs/reports', '.leanpowers/runs'];
  const changed = ['docs/specs/s.md', '.leanpowers/runs/p/x.md', 'docs/neu/x.md'];
  for (const newFolders of ['ask', 'deny']) {
    const r = checkStructure({ changed, rules: [], newFolders, existingDirs: new Set(), ownFolders: own });
    assert.deepEqual(r.messages, [newFolders === 'ask' ? 'new folder needs approval: docs/neu' : 'new folder not allowed: docs/neu'], newFolders);
  }
});
```

In `tests/check.test.mjs`, change the expected text in `--all warns about uncommitted files outside the run folder and stays ok` from `uncommitted changes: 1 files (x.txt)` to `uncommitted changes: 1 file (x.txt)` and append:

```js
test('own folders created under a brief count as approved', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root, { allowed: ['docs/specs/s.md'] });
  writeBaseFor(root, BRIEF);
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/s.md'), '# S\n\n## A\n\n## B\n');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
});

test('a plan or brief outside its configured folder gives a warning', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'plans/other.md'), PLAN);
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'plan'], { cwd: root });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'plans/other.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, plan: 'plans/other.md', task: 1, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)\n⚠ plan outside paths.plans (docs/plans): plans/other.md');
  assert.doesNotMatch(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, /outside/);
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(path.join(root, 'notes/task-1-brief.md'), '# Task 1 brief: A\n\n## Allowed files\n\n- `src/a.ts`\n');
  writeBaseFor(root, 'notes/task-1-brief.md');
  assert.match(runCheck({ root, brief: 'notes/task-1-brief.md', userConfigPath: NO_USER }).text,
    /\n⚠ brief outside paths\.runs \(\.leanpowers\/runs\): notes\/task-1-brief\.md$/);
});
```

In `tests/brief.test.mjs`, add `briefTaskNumber, BRIEF_NAME_ERROR` to the import from `../checks/brief.mjs` and append:

```js
test('briefTaskNumber reads the task number from a brief file name', () => {
  assert.equal(briefTaskNumber('r/task-12-brief.md'), 12);
  assert.equal(briefTaskNumber(path.join(os.tmpdir(), 'task-1-brief.md')), 1);
  assert.equal(briefTaskNumber('task-final-brief.md'), null);
  assert.equal(briefTaskNumber('notes.md'), null);
  assert.equal(BRIEF_NAME_ERROR, 'brief --file needs a task-<n>-brief.md');
});
```

Append to `tests/init.test.mjs`:

```js
test('proposeConfig writes the default paths explicitly, right after $schema', () => {
  const c = proposeConfig(fs.mkdtempSync(path.join(os.tmpdir(), 'lp-init-paths-')));
  assert.deepEqual(Object.keys(c), ['$schema', 'paths', 'commands', 'structure']);
  assert.deepEqual(c.paths, { specs: 'docs/specs', plans: 'docs/plans', reports: 'docs/reports', runs: '.leanpowers/runs' });
});
```

Append to `tests/cli.test.mjs`:

```js
test('brief and metrics warn on stderr when the plan is outside paths.plans', () => {
  const root = project();
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'plans/x.md'), PLAN);
  const b = spawn(root, 'brief', '--plan', 'plans/x.md', '--task', '1');
  assert.equal(b.status, 0);
  assert.equal(b.stderr, 'warning: plan outside paths.plans (docs/plans): plans/x.md\n');
  const m = spawn(root, 'metrics', '--plan', 'plans/x.md');
  assert.equal(m.status, 0);
  assert.equal(m.stderr, 'warning: plan outside paths.plans (docs/plans): plans/x.md\n');
  assert.equal(spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1').stderr, '');
});

test('brief --file warns on stderr when the brief is outside paths.runs', () => {
  const root = project();
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(path.join(root, 'notes/task-1-brief.md'), '# Task 1 brief: A\n');
  const r = spawn(root, 'brief', '--file', 'notes/task-1-brief.md');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'notes/task-1-brief.md\n');
  assert.equal(r.stderr, 'warning: brief outside paths.runs (.leanpowers/runs): notes/task-1-brief.md\n');
});
```

If an existing test compares the whole `init` proposal, extend its expectation by the `paths` key; change nothing else in existing tests.

- [ ] **Step 2: Run them** – `node --test tests/paths.test.mjs tests/scope-structure.test.mjs tests/check.test.mjs tests/brief.test.mjs tests/init.test.mjs tests/cli.test.mjs` → FAIL (module not found, missing warnings, `1 files`, missing exports, missing `paths`).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run them** – same command → PASS; `npm run build`; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add checks bin tests dist` then `git commit -m "feat: own paths count as approved folders; plan and brief path warnings; init writes paths"` (trailer as in Global Constraints).

### Task 3: Template paths in the build, Gemini fallback, shell sentence in briefs (spec sections 7.3, 4.2, 7.4 last point)

**Risk:** low

**Files:**
- Modify: `build/runtime.mjs`
- Modify: `build/gemini.mjs`
- Modify: `checks/brief.mjs`
- Test: `tests/build.test.mjs`
- Test: `tests/brief.test.mjs`
- Modify: `dist/**`

**Why:** Models resolved `prompts/x.md` against the skill folder and failed; `<plugin>/prompts/x.md` is unambiguous once each platform map defines `<plugin>` (Task 5). The Gemini context file needs two more tokens for the new start text (Task 4). Implementers used shell variables for paths too, so the brief sentence covers commands and paths.

**Interfaces:**
- `build/runtime.mjs` `copyRuntime`: in copied `skills/**/*.md`, replace `` `agents/ `` with `` `<plugin>/prompts/ `` (was `` `prompts/ ``); `(agents/` still becomes `(prompts/`. Update the JSDoc.
- `build/gemini.mjs`: `CONTEXT_FALLBACK = 'else: folder of gemini-extension.json'`.
- `checks/brief.mjs` `buildBrief`, `## When done`: `` Run `<cli> check --plan <planRel> --task <n>`, written out in every call. Write every shell command and path out in full; never store a command or path in a shell variable. Write your report (max 150 words) to `<reportPath>`: what changed, test result, open questions. ``

- [ ] **Step 1: Write the failing tests**

In `tests/build.test.mjs`, test `agent templates ship as prompts, never as agents`, append inside the test body:

```js
  for (const pkg of ['claude-plugin', 'codex-plugin', 'gemini-extension']) {
    for (const rel of ['skills/run/SKILL.md', 'skills/staff/SKILL.md', 'skills/design/SKILL.md', 'skills/review/SKILL.md', 'skills/run/details/loops.md']) {
      const text = read(`${pkg}/${rel}`);
      assert.doesNotMatch(text, /`(agents|prompts)\//, `${pkg}/${rel}`);
    }
  }
  assert.ok(run.includes('template `<plugin>/prompts/implementer.md`'));
```

In the same file, test `gemini start text names the extension folder fallback and stays small`, replace the CLI-line regex with:

```js
  assert.match(text, /^CLI: run leanpowers as node "\$\{extensionPath\}\/bin\/leanpowers\.mjs" \(else: folder of gemini-extension\.json\)\.$/m);
```

In `tests/brief.test.mjs`, change the regex at the test that matches `written out in every call \(never stored in a shell variable\)\. Write your report` to:

```js
  assert.match(b, /Run `(node ".*\/bin\/leanpowers\.mjs"|[^`]+) check --plan docs\/plans\/demo\.md --task 1`, written out in every call\. Write every shell command and path out in full; never store a command or path in a shell variable\. Write your report/);
```

and in `brief tells the implementer never to store the command in a shell variable` replace `whenDone.includes('(never stored in a shell variable)')` with `whenDone.includes('never store a command or path in a shell variable.')`.

- [ ] **Step 2: Run them** – `npm run build && node --test tests/build.test.mjs tests/brief.test.mjs` → FAIL (old rewrite, old fallback, old sentence).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run them** – `npm run build && node --test tests/build.test.mjs tests/brief.test.mjs` → PASS; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add build checks/brief.mjs tests/build.test.mjs tests/brief.test.mjs dist` then `git commit -m "fix: unambiguous template paths, shorter Gemini fallback, briefs forbid shell variables for paths"` (trailer as in Global Constraints).

### Task 4: Start text, `design` and the medium path (spec sections 4, 5.1 design part, 6.2 first point, 6.3 last sentence)

**Risk:** high

**Files:**
- Modify: `skills/start/SKILL.md`
- Modify: `skills/design/SKILL.md`
- Modify: `skills/design/details/medium.md`
- Test: `tests/start.test.mjs`
- Test: `tests/skills-content.test.mjs`
- Test: `tests/build.test.mjs`
- Modify: `dist/**`

**Why:** A smaller model never invoked `design` and followed only the start text, whose size rule was softer than the skill's. The start text now demands the skill first and carries the same large criteria; the medium path gets a feature branch and always ends in `finish`.

**Interfaces (exact texts):**
- `skills/start/SKILL.md` body (frontmatter unchanged) is exactly the text block of spec section 4.1.
- `skills/design/SKILL.md`:
  - Gate sentence: `**Gate:** write no code, dispatch no implementer, scaffold nothing and invoke no implementation skill until the user has approved what you intend.` (rest of the paragraph unchanged).
  - Classify, Large bullet: `- **Large:** new feature or project, a new command or data field, several areas, or changed interfaces.`
  - Section 2, first sentence: `Read the relevant code and ask only the questions that matter, as in Large step 2.`
  - Section 2, the whole paragraph that starts `After approval:` becomes: `After approval: small → implement, then run `leanpowers check`. Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.`
  - Section 3 step 2: `2. **Ask** up to three independent questions per message, each multiple choice with your recommendation first; a question others depend on goes alone. Go on until purpose, constraints and success criteria are clear.`
  - Section 3 step 4: directly after the line `   This yes opens the spec, not the code: no implementer before an approved plan.` add the line `   Until the plan is approved, subagents may read, review or write the spec and plan, never code.`
  - Section 3 step 5: `5. **Write the spec** to `paths.specs` as `YYYY-MM-DD-<topic>-design.md` (configured paths win over other plugins' folders and temp folders; creating them needs no question): a `# ` title, at least two `## ` sections, no placeholders, and only approvals the user gave. Commit it.`
  - Everything else unchanged. The body must stay ≤ 600 words (count with `countWords` from `checks/skill-lint.mjs`); if it does not, shorten wording elsewhere in the file without dropping a rule, and say what you shortened in your report.
- `skills/design/details/medium.md` is exactly:

````markdown
# Medium path

After the user approved the design, in this order:

1. **Branch:** if HEAD is on the repository's default branch (the remote's HEAD branch, else `main` or `master`),
   create and switch to `feat/<topic>`. A branch the user named wins.
2. **Brief:** write `<paths.runs>/YYYY-MM-DD-<topic>/task-1-brief.md`. Configured paths win over other plugins'
   folders and temp folders; creating them needs no question. A new run folder gets a `.gitignore` containing `*`.
   - `## Allowed files`: one `- <path>` line per file, tests included. `leanpowers.json` is the user's
     configuration: list it only when the user asked for that change.
   - `## Global constraints`: the user's project rules.
   - `## Structure rules`: the `structure.rules` that match the allowed files, then
     `New folders: <structure.newFolders>`. With `ask`, a folder that does not exist yet needs the user's yes in the
     approved design; list those folders as `Approved new folders: <folders>`.
   - `## Task`: the approved design.
   - `## When done`: run the `check` command as the `CLI:` line names it, with absolute paths (none →
     `leanpowers check`), in the form `<cli> check --brief <brief path>`. Write every shell command and path out in
     full; never store a command or path in a shell variable. Commit with `<type>: <topic>`, one commit. Write the
     report to `task-1-report.md` in the same folder.
3. **Base:** run `leanpowers brief --file <brief path>`; it records the base commit the check compares against.
4. **Dispatch** a subagent at tier medium with template `agents/implementer.md`, `{{brief}}` the brief path and
   `{{report}}` the report path. Handle its status as `run` does (per task, step 3).
5. **Check:** run `leanpowers check --brief <brief path>` yourself. Red → resume the same implementer with the output.
6. **Finish:** invoke the `finish` skill, also when a commit failed (for example because git is read-only).
````

- [ ] **Step 1: Write the failing tests**

In `tests/start.test.mjs`, replace the test `start text names the size marker, the plan gate for large and finish for medium` with:

```js
test('start text invokes design first, names the size marker, the large criteria and the plan gate', () => {
  const t = startText(repo, DEFAULTS, 'leanpowers');
  assert.ok(t.includes('leanpowers: before answering any change request, invoke the `design` skill; it holds the size rule and the gates.'));
  assert.ok(t.includes('Open with `Size: small|medium|large` (unclear → larger):'));
  assert.match(t, /^- Large: new feature, command or data field, several areas, or interfaces\.$/m);
  assert.match(t, /^- Medium: bounded change to a flow that already exists\.$/m);
  assert.ok(t.includes('Medium needs design approval and Large plan approval before any code or implementer dispatch'));
  assert.doesNotMatch(t, /subagent dispatch/);
  assert.ok(estimateTokens(t) <= 150);
});
```

In `tests/skills-content.test.mjs`:
- in `orchestration waits instead of stalling and approval comes before delegation`, replace `'before any code or subagent dispatch'` with `'before any code or implementer dispatch'`;
- in `subagents without a generated brief get the resolved CLI`, replace the `medium.md` regex with `` /`## When done`: run the `check` command as the `CLI:` line names it/ `` (unchanged text, still required);
- replace the whole test `design names the size marker, the plan gate and the medium brief check` with:

```js
test('design names the size marker, the large criteria, the gates and the medium path', () => {
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('open your reply with the class in this exact form, in any language'), 'marker rule');
  assert.ok(design.includes('"Size: medium —'), 'marker example');
  assert.ok(design.includes('write no code, dispatch no implementer, scaffold nothing'), 'gate');
  assert.ok(design.includes('- **Large:** new feature or project, a new command or data field, several areas, or changed interfaces.'), 'large');
  assert.ok(design.includes('   This yes opens the spec, not the code: no implementer before an approved plan.'), 'step 4');
  assert.ok(design.includes('   Until the plan is approved, subagents may read, review or write the spec and plan, never code.'), 'subagents before plan');
  assert.ok(design.includes('up to three independent questions per message'), 'bundled questions');
  assert.ok(design.includes("configured paths win over other plugins' folders and temp folders"), 'own paths');
  assert.ok(design.includes('only approvals the user gave'), 'no claimed approvals');
  assert.ok(design.includes('Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.'), 'medium');
  assert.ok(design.includes('- "Design approved, one implementer will do" → that is medium; large needs spec and plan.'), 'red flag');
  const medium = read('skills/design/details/medium.md');
  assert.ok(medium.startsWith('# Medium path\n'), 'title');
  assert.ok(medium.includes('create and switch to `feat/<topic>`. A branch the user named wins.'), 'branch');
  assert.ok(medium.includes('in the form `<cli> check --brief <brief path>`'), 'check form');
  assert.ok(medium.includes('never store a command or path in a shell variable'), 'shell variable');
  assert.ok(medium.includes('Commit with `<type>: <topic>`, one commit.'), 'commit');
  assert.ok(medium.includes('list those folders as `Approved new folders: <folders>`.'), 'approved folders');
  assert.ok(medium.includes('run `leanpowers brief --file <brief path>`'), 'base');
  assert.ok(medium.includes('template `agents/implementer.md`'), 'template');
  assert.ok(medium.includes('run `leanpowers check --brief <brief path>` yourself'), 'check');
  assert.ok(medium.includes('invoke the `finish` skill, also when a commit failed'), 'finish');
  const startLarge = /^- Large: new feature, command or data field/m;
  assert.match(read('skills/start/SKILL.md'), startLarge, 'start and design share the large criteria');
});
```

In `tests/build.test.mjs`, test `gemini start text names the extension folder fallback and stays small`, replace `` assert.match(text, /named first as `Size: small\|medium\|large`/); `` with `` assert.match(text, /invoke the `design` skill/); ``.

- [ ] **Step 2: Run them** – `npm run build && node --test tests/start.test.mjs tests/skills-content.test.mjs tests/build.test.mjs` → FAIL (old texts).
- [ ] **Step 3: Implement** the exact texts above.
- [ ] **Step 4: Run them** – same command → PASS; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok (skill-lint enforces the budgets).
- [ ] **Step 5: Commit** – `git add skills tests dist` then `git commit -m "feat: start text invokes design first; one large rule; medium path with branch and finish"` (trailer as in Global Constraints).

### Task 5: Orchestration, finish and platform texts (spec sections 5.1 rest, 6.1 text part, 6.2 second point, 6.3, 7.1, 7.2, 7.3 platform part, 7.4, 7.5)

**Risk:** high

**Files:**
- Modify: `skills/staff/SKILL.md`
- Modify: `skills/run/SKILL.md`
- Modify: `skills/run/details/ledger.md`
- Modify: `skills/finish/SKILL.md`
- Modify: `skills/plan/SKILL.md`
- Modify: `agents/orchestrator.md`
- Modify: `agents/reviewer.md`
- Modify: `agents/re-reviewer.md`
- Modify: `platforms/claude-code.md`
- Modify: `platforms/codex-cli.md`
- Modify: `platforms/gemini-cli.md`
- Test: `tests/skills-content.test.mjs`
- Test: `tests/build.test.mjs`
- Modify: `dist/**`

**Why:** The staffing summary was skipped under `auto` and changed silently; templates were searched in the wrong folder; shell variables were blocked in every role; the ledger line promised an id it could not know; `finish` was skipped without git write access and deleted the run outcome.

**Interfaces (exact texts):**
- `skills/staff/SKILL.md`:
  - Step 1 starts: `1. **Run folder:** `<paths.runs>/<plan-basename>/`, never a temp folder or another plugin's folder; creating it needs no question.` followed by the rest of today's step 1 unchanged (`Create it if missing, …`).
  - Step 3 first line: `3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:` (the three bullets unchanged). Its last sentence becomes: `If you change a tier the staffer recommended, name each change and its reason in these lines. Write every change, yours or the user's, into `besetzung.md`.`
  - Step 4, `auto` bullet: move the sentence `Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim.` so that it directly follows `… with absolute paths (none → `leanpowers`).` and remove it from its old place.
- `skills/run/SKILL.md`:
  - Setup step 1: `1. Run folder `<paths.runs>/<plan-basename>/` (`staff` created it), ledger `progress.md`. Read [details/ledger.md](details/ledger.md) and [details/loops.md](details/loops.md) now.`
  - End step 4: `4. Append the `Final:` lines (`Final: minor (deferred)`, `Final: Ruling:`; ledger.md), run `leanpowers metrics --plan <plan>`, then `leanpowers report --plan <plan>`, and commit the report.`
  - Must stay ≤ 600 words (today 599): shorten wording elsewhere in `run` without dropping a rule (for example the intro's "narrate one line per step at most" may become "one line per step"), and list every shortening in your report. The sentence `How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.` and the phrase `never end the turn` stay verbatim.
- `skills/run/details/ledger.md`:
  - In the Lines table, replace the row `Implementer dispatched, …` with two rows:
    - `| Implementer dispatched, written before each implementer dispatch | `Task <n>: implementer dispatched (<name>)`, with the name the dispatch gives the agent where the platform takes one, else `-` |`
    - `| Implementer id, written as soon as the dispatch returns the agent's id | `Task <n>: implementer id <id>` |`
  - In Resume, the `implementer dispatched` bullet ends: `Work present → gate it; otherwise resume the implementer named by its `implementer id` line, else by its dispatched line; re-dispatch only when it cannot be resumed.`
  - New section `## Report` directly before `## Metrics`: `` `leanpowers report --plan <plan>` copies the header line, every `Ruling:`, `minor (deferred)`, `parked`, `Stop:` and `Final:` line and the `## Metrics` section into `<paths.reports>/<plan-basename>.md`. Run it after `metrics` and commit the file; `finish` removes the run folder only when it exists. ``
- `skills/finish/SKILL.md`:
  - Step 2, append: `If the work sits uncommitted on the base branch, create `feat/<topic>` and commit there (after the question from step 1) before the options. If it is already committed on the base branch, say so: there is nothing to merge; offer only keep and push, and never rewrite the base branch's history.`
  - New paragraph at the end of step 3 (after the four options): `**Git read-only:** if a git write fails because `.git` is not writable (sandbox, permissions), still offer the four options; for the chosen one, print the exact git commands for the user to run, say clearly that nothing is committed, and clean up nothing.`
  - Step 5, the run-folder bullet becomes: `- Remove the plan's run folder `<paths.runs>/<plan-basename>/` only when `<paths.reports>/<plan-basename>.md` exists (otherwise run `leanpowers report --plan <plan>` and commit it first) and the user has seen the final ruling lines and open minors. Skip this when there is no run folder.`
- `skills/plan/SKILL.md` step 7, first sentence becomes: `7. **Save** to `paths.plans` as `YYYY-MM-DD-<topic>.md` (configured paths win over other plugins' folders and temp folders; creating them needs no question); read [details/plan-format.md](details/plan-format.md) before writing the plan and follow it exactly.` and add after `Commit it.` the sentence ` State only approvals the user gave.` (inside the same step).
- `agents/orchestrator.md`, Inputs: the CLI line becomes `- CLI: run every `leanpowers` command as `{{cli}}`; write commands and paths out, never in shell variables.` The file must stay ≤ 400 words: shorten wording elsewhere without dropping a rule and list it in your report.
- `agents/reviewer.md` and `agents/re-reviewer.md`, `## Hard rules`, new last bullet: `- Write every shell command and path out in full; never store one in a shell variable.`
- `platforms/claude-code.md`, `platforms/codex-cli.md`, `platforms/gemini-cli.md`:
  - After the first paragraph (`Translates leanpowers' …`), add: ``Skills write `<plugin>` for the plugin folder: two levels above any leanpowers `SKILL.md` (here `<value>`).`` with `<value>` = `${CLAUDE_PLUGIN_ROOT}` (Claude Code), `the folder holding this platform.md` (Codex), `${extensionPath}` (Gemini).
  - New section `## Shell` directly before `## CLI`: `Write every shell command and path out in full; never store a command or path in a shell variable (zsh does not split words, and some harnesses block variables). This holds for the main session and every subagent.`
  - `platforms/codex-cli.md`, after the Model tiers table: `Set the tier through `reasoning_effort` only. Pass `model` only when `models.*` in `leanpowers.json` names one; never pick a model name from a catalog or a model list.`
  - Each platform map stays ≤ 500 words.

- [ ] **Step 1: Write the failing tests**

In `tests/skills-content.test.mjs`, test `orchestrator turn rule, resume before re-dispatch, one implementer per task`:
- replace the orchestrator `'cli line'` assertion with `assert.ok(orchestrator.includes('- CLI: run every `leanpowers` command as `{{cli}}`; write commands and paths out, never in shell variables.'), 'cli line');`
- replace the ledger `'ledger line'` assertion with `assert.ok(ledger.includes('`Task <n>: implementer dispatched (<name>)`'), 'ledger line'); assert.ok(ledger.includes('`Task <n>: implementer id <id>`'), 'id line');`
- replace the `'resume rule'` assertion with `assert.ok(ledger.includes('otherwise resume the implementer named by its `implementer id` line, else by its dispatched line; re-dispatch only when it cannot be resumed.'), 'resume rule');`

and append:

```js
test('staff shows the staffing in every mode and names its own changes', () => {
  const staff = read('skills/staff/SKILL.md');
  assert.ok(staff.includes('3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:'), 'show');
  assert.ok(staff.includes('If you change a tier the staffer recommended, name each change and its reason in these lines.'), 'own changes');
  assert.ok(staff.includes("never a temp folder or another plugin's folder; creating it needs no question"), 'run folder');
  const auto = staff.slice(staff.indexOf('- **`auto`'));
  assert.ok(auto.indexOf('(none → `leanpowers`). Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim.') !== -1, 'platform line follows the dispatch');
});

test('finish runs without a feature branch or git write access and keeps the run report', () => {
  const finish = read('skills/finish/SKILL.md');
  assert.ok(finish.includes('If the work sits uncommitted on the base branch, create `feat/<topic>`'), 'uncommitted on base');
  assert.ok(finish.includes("offer only keep and push, and never rewrite the base branch's history"), 'committed on base');
  assert.ok(finish.includes('**Git read-only:**'), 'read-only');
  assert.ok(finish.includes('print the exact git commands for the user to run'), 'commands');
  assert.ok(finish.includes('only when `<paths.reports>/<plan-basename>.md` exists'), 'report before cleanup');
  const run = read('skills/run/SKILL.md');
  assert.ok(run.includes('then `leanpowers report --plan <plan>`, and commit the report.'), 'run end');
  const ledger = read('skills/run/details/ledger.md');
  assert.ok(ledger.indexOf('## Report') !== -1 && ledger.indexOf('## Report') < ledger.indexOf('## Metrics'), 'ledger report section');
  assert.ok(read('skills/plan/SKILL.md').includes('State only approvals the user gave.'), 'plan approvals');
});

test('every role writes shell commands and paths out', () => {
  for (const rel of ['agents/reviewer.md', 'agents/re-reviewer.md']) {
    assert.ok(read(rel).includes('- Write every shell command and path out in full; never store one in a shell variable.'), rel);
  }
  for (const p of ['claude-code', 'codex-cli', 'gemini-cli']) {
    const text = read(`platforms/${p}.md`);
    assert.ok(text.includes('\n## Shell\n\nWrite every shell command and path out in full; never store a command or path in a shell variable'), `${p}: shell`);
    assert.ok(text.indexOf('## Shell') < text.indexOf('## CLI'), `${p}: shell before CLI`);
    assert.ok(text.includes('Skills write `<plugin>` for the plugin folder: two levels above any leanpowers `SKILL.md`'), `${p}: plugin`);
  }
  assert.ok(read('platforms/codex-cli.md').includes('never pick a model name from a catalog or a model list'), 'codex model');
});
```

In `tests/build.test.mjs`, test `every package ships its platform map as platform.md`, append inside the loop: `assert.ok(read(`${dir}/platform.md`).includes('`<plugin>`'), `${p}: defines <plugin>`);`

- [ ] **Step 2: Run them** – `npm run build && node --test tests/skills-content.test.mjs tests/build.test.mjs` → FAIL (old texts).
- [ ] **Step 3: Implement** the exact texts above within the word limits.
- [ ] **Step 4: Run them** – same command → PASS; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add skills agents platforms tests dist` then `git commit -m "feat: staffing always shown, finish without git write access, run report, shell rule for every role"` (trailer as in Global Constraints).

### Task 6: Release 0.1.5 (spec section 9)

**Risk:** low

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `.agents/plugins/marketplace.json`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Why:** Ship the changes as 0.1.5 with notes users can act on.

**Interfaces:**
- `package.json` `version` `0.1.5`; `npm run build` regenerates manifests and marketplaces (commit them if they change).
- `CHANGELOG.md`: new section `## [0.1.5] - 2026-11-01` above `## [0.1.4]`, with `### Added` (`report --plan`; plan and brief path warnings; `init` writes `paths`), `### Changed` (start text invokes `design` first and shares the large rule; large allows subagents for reading, reviewing and writing spec and plan before plan approval; up to three independent design questions per message; configured paths win and count as approved folders; medium path creates a feature branch and always ends in `finish`; `finish` handles work on the base branch and read-only git; `staff` always shows the staffing and names its own changes; template paths as `<plugin>/prompts/…`; the shell-variable rule covers commands and paths in every role; Codex tiers only via `reasoning_effort`; ledger logs the implementer name before and its id after dispatch) and `### Fixed` (`1 file` instead of `1 files`; one shared brief file-name check). Neutral wording: "second pilot", "test project"; no project names.
- `README.md`, `docs/README.md`, `docs/README.de.md`: every `0.1.4` version mention becomes `0.1.5`; the command table gets a row for `report --plan <file>` (English) / `report --plan <Datei>` (German) after the `metrics` row, describing that it writes rulings, open minors and final lines from the ledger to `paths.reports`; one sentence each that configured `paths` win over other plugins' folders and that `finish` also runs without git write access (prints the git commands). Check the files for the exact existing table format and follow it.

- [ ] **Step 1: Write the failing test** – append to `tests/skills-content.test.mjs`:

```js
test('readmes name the report command and version 0.1.5', () => {
  const en = read('docs/README.md');
  assert.ok(en.includes('| `report --plan <file>` |'), 'en report');
  assert.ok(en.includes('Version 0.1.5.'), 'en version');
  const de = read('docs/README.de.md');
  assert.ok(de.includes('| `report --plan <Datei>` |'), 'de report');
  assert.ok(de.includes('Version 0.1.5.'), 'de version');
  assert.ok(read('README.md').includes('Current version: 0.1.5.'), 'root readme');
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.5\] - 2026-11-01$/m);
});
```

- [ ] **Step 2: Run it** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces; `npm run build`.
- [ ] **Step 4: Run it** – same command → PASS; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok; `grep -rn "0\.1\.4" README.md docs/README.md docs/README.de.md package.json` shows no version mention left (history lines in CHANGELOG stay).
- [ ] **Step 5: Commit** – `git add package.json CHANGELOG.md README.md docs/README.md docs/README.de.md .claude-plugin .agents tests/skills-content.test.mjs dist` then `git commit -m "chore: release v0.1.5 notes and version"` (trailer as in Global Constraints).
