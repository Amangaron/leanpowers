# leanpowers Plan 7 – Second pilot fixes (v0.1.4) Implementation Plan

**Goal:** Fix what the second pilot found: name the size marker and the plan gate for large, scope/structure checks on the medium path via `brief --file`/`check --brief`, no orchestrator stalls, commit-and-finish at the end, written-out CLI commands – released as 0.1.4.

**Spec:** `docs/specs/2026-11-01-leanpowers-0.1.4-design.md`

**Architecture:** Small, local changes in `checks/` (pure functions and the check runner, unit-tested), CLI wiring in `bin/leanpowers.mjs`, one string in `build/gemini.mjs`, text changes in `skills/`, `agents/` and `platforms/`, docs, then a release task. Runtime behaviour of existing commands stays the same unless a task says otherwise.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Work on branch `claude/leanpowers-0-1-4-e357de` (already checked out); never push, never tag, never merge, never `git stash`.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` after its commit.
- After changing anything the build copies (`skills/`, `agents/`, `checks/`, `bin/`, `platforms/`, `schema/`, `templates/`), run `npm run build` and commit the regenerated `dist/`; generated `dist/**` is exempt from scope and structure findings.
- Skill and agent texts stay within the limits checked by `skill-lint` (skills ≤ 600 words, agents ≤ 400 words, description ≤ 60 words, start text ≤ 150 tokens); `skills/run/SKILL.md` and `agents/implementer.md` must not change.
- Skill, agent and platform texts are English; keep the existing style (short imperative sentences); never name platform tools in `skills/` or `agents/` (only in `platforms/`).
- Write every shell command out in full in every call; never store a command in a shell variable (`S="node …"; $S` fails in zsh, which does not split words).
- Public repository: no names of private or customer projects in code, texts, tests, CHANGELOG or commit messages.
- When a task cites a spec section, the implementer may read exactly that section of `docs/specs/2026-11-01-leanpowers-0.1.4-design.md`.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.

---

### Task 1: `brief --file` and `check --brief` (spec section 6, points 1–3 and the usage lines of point 7)

**Risk:** high

**Files:**
- Modify: `checks/brief.mjs`
- Modify: `checks/check.mjs`
- Modify: `checks/scope.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/brief.test.mjs`
- Test: `tests/check.test.mjs`
- Test: `tests/cli.test.mjs`
- Test: `tests/scope-structure.test.mjs`
- Modify: `dist/**`

**Why:** The medium path writes a task brief by hand and today only runs the test gates, so nothing checks scope or new folders there. Two new CLI forms close that gap: `brief --file` records the base commit for a hand-written brief, `check --brief` runs the same scope and structure checks as the plan form `check --plan <p> --task <n>`.

**Interfaces:**
- Produces in `checks/brief.mjs`: `export function writeBaseFor(root: string, briefPath: string, { resetBase = false } = {}): string`.
  - `briefPath` is absolute or root-relative; resolve it with `path.resolve(root, briefPath)`; `rel` = `toPosix(path.relative(root, abs))`.
  - Checked in this order: the basename must match `/^task-(\d+)-brief\.md$/`, else `throw new Error('brief --file needs a task-<n>-brief.md')` (the text `<n>` is literal); then the file must exist, else `` throw new Error(`brief not found: ${rel}`) ``.
  - Writes `task-<n>-base.txt` (content `headSha(root)` + `\n`) in the brief's folder, unless that file exists and `resetBase` is false. Writes nothing else (no `.gitignore`, no folder).
  - Returns the absolute brief path.
- Produces in `checks/brief.mjs`: `export function parseBriefFile(text: string): { allowed: string[], approvedFolders: string[] }`.
  - Normalize `\r\n` to `\n` first.
  - `allowed`: every line `- <path>` (regex `/^- (.*)$/`) after the line `## Allowed files` up to the next line starting with `## `; backticks removed, trimmed, empty entries dropped.
  - `approvedFolders`: the rest of the line after the first `Approved new folders:` anywhere in the text, split on `,`, backticks removed, trimmed, empty entries dropped; `[]` when the text has no such line.
  - A brief written by `buildBrief` parses to its allowed files and its `Approved new folders:` list.
- Produces in `checks/scope.mjs`: `checkScope(changed, allowed, ignore)` – for the changed file exactly `leanpowers.json` (root-relative, the project's own config) the message is `not in brief: leanpowers.json (project configuration: change it only with the user's yes)`; every other message stays `not in brief: <file>`. Applies to both check forms.
- Produces in `checks/check.mjs`:
  - `function scopeAndStructure(root, config, { base, allowed, approvedFolders }): CheckResult[]` (not exported) – the shared tail of today's `taskChecks`: `changed = changedFiles(root, base)`, then `` checkScope(changed, allowed, [`${toPosix(config.paths.runs)}/**`]) `` and `checkStructure({ changed: changed.filter((f) => fs.existsSync(path.join(root, f))), rules: config.structure.rules, newFolders: config.structure.newFolders, existingDirs: dirsAt(root, base), approvedFolders })`. `taskChecks` calls it with `allowed = taskDef.files.map((f) => f.path)` and `approvedFolders = approvedFoldersFor(taskDef.files)`; its behaviour and messages stay unchanged.
  - `function briefChecks(root, config, briefPath): CheckResult[]` (not exported) – checked in this order, each failure a single result `{ name: 'scope', ok: false, messages: [<msg>] }` with `rel` = root-relative posix brief path: brief file missing → `brief not found: <rel>`; basename not `task-<n>-brief.md` → `check --brief needs a task-<n>-brief.md`; `task-<n>-base.txt` missing next to the brief → `no base for <rel>, run: leanpowers brief --file <rel>` (never create the base here). Otherwise read the base (trimmed), `parseBriefFile` the brief and return `scopeAndStructure(root, config, { base, allowed, approvedFolders })`.
  - `runCheck({ root, plan, task, brief, all = false, userConfigPath })`: when `brief` is set together with `plan` or `task`, push `{ name: 'scope', ok: false, messages: ['check takes --brief or --plan with --task, not both'] }` and run neither form; `brief` alone pushes `briefChecks(...)`; the plan form and its `check needs both --plan and --task` message stay as they are; `brief` combines with `all` (doc-lint and skill-lint follow the scope and structure results). Update the JSDoc of `runCheck`.
- Produces in `bin/leanpowers.mjs`:
  - `parseArgs` gains the option `check = false`: with it, `--brief <file>` sets `opts.brief` (missing value → usage). With the existing `brief` option, `--file <file>` sets `opts.file` (missing value → usage). Any other use of `--brief` or `--file` is a usage error, as unknown flags are today.
  - `check`: `parseArgs(rest, { check: true })`; `--brief` together with `--plan` or `--task` → `usage()` (exit 2); then the existing plan/task pairing rule; pass `brief` to `runCheck`.
  - `brief`: with `--file`, `--plan` or `--task` → `usage()`; else call `writeBaseFor(root, file, { resetBase })` and print `toPosix(path.relative(root, <returned path>))`. An error whose message starts with `brief not found: ` or equals `brief --file needs a task-<n>-brief.md` prints the message to stderr and exits 1; other errors are rethrown. Without `--file` the existing `--plan`/`--task` path is unchanged.
  - Usage lines become exactly `  check [--all] [--plan <file> --task <n> | --brief <file>]` and `  brief (--plan <file> --task <n> | --file <brief>) [--reset-base]`; all other usage lines stay.

- [ ] **Step 1: Write the failing tests**

In `tests/brief.test.mjs`, change the import line `import { buildBrief, runDirFor, writeBrief } from '../checks/brief.mjs';` to `import { buildBrief, runDirFor, writeBrief, writeBaseFor, parseBriefFile } from '../checks/brief.mjs';` and append:

```js
test('writeBaseFor records the base next to a hand-written brief', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'one');
  const dir = path.join(root, '.leanpowers/runs/2026-01-01-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'task-1-brief.md'), '# Task 1 brief: A\n');
  const rel = '.leanpowers/runs/2026-01-01-demo/task-1-brief.md';
  assert.equal(writeBaseFor(root, rel), path.join(dir, 'task-1-brief.md'));
  const baseFile = path.join(dir, 'task-1-base.txt');
  const first = fs.readFileSync(baseFile, 'utf8');
  assert.equal(first, `${git('rev-parse', 'HEAD').trim()}\n`);
  git('commit', '-q', '--allow-empty', '-m', 'two');
  writeBaseFor(root, path.join(dir, 'task-1-brief.md'));
  assert.equal(fs.readFileSync(baseFile, 'utf8'), first);
  writeBaseFor(root, rel, { resetBase: true });
  assert.equal(fs.readFileSync(baseFile, 'utf8').trim(), git('rev-parse', 'HEAD').trim());
});

test('writeBaseFor rejects other file names and missing briefs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  fs.writeFileSync(path.join(root, 'notes.md'), 'n');
  assert.throws(() => writeBaseFor(root, 'notes.md'), { message: 'brief --file needs a task-<n>-brief.md' });
  assert.throws(() => writeBaseFor(root, 'r/task-2-brief.md'), { message: 'brief not found: r/task-2-brief.md' });
  assert.equal(fs.existsSync(path.join(root, 'r')), false);
});

test('parseBriefFile reads allowed files and approved folders', () => {
  const text = '# Task 1 brief: A\r\n\r\n## Allowed files\r\n\r\n- `src/a.ts`\r\n-  tests/a.test.ts \r\n- \r\nnot a path\r\n\r\n## Structure rules\r\n\r\n- src/** → allow *.ts\r\nNew folders: ask\r\nApproved new folders: `extra`, lib/x ,\r\n';
  assert.deepEqual(parseBriefFile(text), { allowed: ['src/a.ts', 'tests/a.test.ts'], approvedFolders: ['extra', 'lib/x'] });
  assert.deepEqual(parseBriefFile('## Allowed files\n\n- a.md\n'), { allowed: ['a.md'], approvedFolders: [] });
  const generated = buildBrief(parsePlan(PLAN), 1, config, 'r', 'p.md', () => false);
  assert.deepEqual(parseBriefFile(generated), {
    allowed: ['src/components/Button.tsx', 'tests/button.test.ts'],
    approvedFolders: ['src/components', 'tests'],
  });
});
```

In `tests/check.test.mjs`, change the import line `import { writeBrief } from '../checks/brief.mjs';` to `import { writeBrief, writeBaseFor } from '../checks/brief.mjs';` and append:

```js
const BRIEF_DIR = '.leanpowers/runs/2026-01-01-demo';
const BRIEF = `${BRIEF_DIR}/task-1-brief.md`;

function medium(root, { allowed = ['src/a.ts'], extra = '' } = {}) {
  fs.mkdirSync(path.join(root, BRIEF_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, BRIEF),
    `# Task 1 brief: A\n\n## Allowed files\n\n${allowed.map((p) => `- \`${p}\``).join('\n')}\n\n## Structure rules\n\nNew folders: ask\n${extra}\n## Task\n\nt\n`);
}

test('brief mode checks scope and structure against a hand-written brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  writeBaseFor(root, BRIEF);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  const bad = runCheck({ root, brief: BRIEF, userConfigPath: NO_USER });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /✖ scope\n  not in brief: extra\/b\.ts/);
  assert.match(bad.text, /✖ structure\n  new folder needs approval: extra/);
});

test('approved new folders in a hand-written brief make structure green', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root, { allowed: ['src/a.ts', 'extra/b.ts'], extra: 'Approved new folders: extra\n' });
  writeBaseFor(root, BRIEF);
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
});

test('a changed leanpowers.json is named as project configuration in both check forms', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  writeBaseFor(root, BRIEF);
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node ok.mjs' }, review: { batch: 2 } }));
  const line = "  not in brief: leanpowers.json (project configuration: change it only with the user's yes)";
  for (const opts of [{ brief: BRIEF }, { plan: 'docs/plans/demo.md', task: 1 }]) {
    const r = runCheck({ root, ...opts, userConfigPath: NO_USER });
    assert.equal(r.ok, false);
    assert.ok(r.text.split('\n').includes(line), r.text);
  }
});

test('brief mode without a base is red with the brief --file hint and creates nothing', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  const r = runCheck({ root, brief: BRIEF, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /✖ scope\n  no base for \.leanpowers\/runs\/2026-01-01-demo\/task-1-brief\.md, run: leanpowers brief --file \.leanpowers\/runs\/2026-01-01-demo\/task-1-brief\.md$/);
  assert.equal(fs.existsSync(path.join(root, BRIEF_DIR, 'task-1-base.txt')), false);
});

test('brief mode names a missing brief and a wrong file name', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const missing = runCheck({ root, brief: 'notes/task-1-brief.md', userConfigPath: NO_USER });
  assert.equal(missing.ok, false);
  assert.match(missing.text, /✖ scope\n  brief not found: notes\/task-1-brief\.md$/);
  fs.writeFileSync(path.join(root, 'notes.md'), 'n');
  const wrong = runCheck({ root, brief: 'notes.md', userConfigPath: NO_USER });
  assert.equal(wrong.ok, false);
  assert.match(wrong.text, /✖ scope\n  check --brief needs a task-<n>-brief\.md$/);
});

test('brief mode excludes the plan form and combines with --all', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  medium(root);
  writeBaseFor(root, BRIEF);
  for (const opts of [{ plan: 'docs/plans/demo.md', task: 1 }, { task: 1 }, { plan: 'docs/plans/demo.md' }]) {
    const r = runCheck({ root, brief: BRIEF, ...opts, userConfigPath: NO_USER });
    assert.equal(r.ok, false);
    assert.match(r.text, /✖ scope\n  check takes --brief or --plan with --task, not both$/);
    assert.doesNotMatch(r.text, /structure/);
  }
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  git('add', '.'); git('commit', '-qm', 'work');
  assert.equal(runCheck({ root, brief: BRIEF, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure, doc-lint, skill-lint)');
});
```

In `tests/scope-structure.test.mjs`, append:

```js
test('scope names leanpowers.json as the project configuration', () => {
  assert.deepEqual(checkScope(['leanpowers.json', 'pkg/leanpowers.json'], []).messages, [
    "not in brief: leanpowers.json (project configuration: change it only with the user's yes)",
    'not in brief: pkg/leanpowers.json',
  ]);
  assert.equal(checkScope(['leanpowers.json'], ['leanpowers.json']).ok, true);
});
```

In `tests/cli.test.mjs`, in the test `usage lists every command with its flags`, replace the two lines `'check [--all] [--plan <file> --task <n>]',` and `'brief --plan <file> --task <n> [--reset-base]',` with `'check [--all] [--plan <file> --task <n> | --brief <file>]',` and `'brief (--plan <file> --task <n> | --file <brief>) [--reset-base]',`, then append:

```js
test('check --brief and brief --file exclude the plan form', () => {
  for (const args of [
    ['check', '--brief', 'x.md', '--plan', 'y.md', '--task', '1'],
    ['check', '--brief', 'x.md', '--task', '1'],
    ['check', '--brief'],
    ['check', '--file', 'x.md'],
    ['brief', '--file', 'x.md', '--plan', 'y.md', '--task', '1'],
    ['brief', '--file', 'x.md', '--plan', 'y.md'],
    ['brief', '--file', 'x.md', '--task', '1'],
    ['brief', '--file'],
    ['brief', '--brief', 'x.md'],
  ]) assert.equal(run(...args).status, 2, args.join(' '));
});

test('brief --file records the base for a hand-written brief and check --brief uses it', () => {
  const root = project();
  const rel = '.leanpowers/runs/2026-01-01-fix/task-1-brief.md';
  fs.mkdirSync(path.join(root, '.leanpowers/runs/2026-01-01-fix'), { recursive: true });
  fs.writeFileSync(path.join(root, rel), '# Task 1 brief: fix\n\n## Allowed files\n\n- `src/a.ts`\n');
  const r = spawn(root, 'brief', '--file', rel);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), rel);
  assert.match(fs.readFileSync(path.join(root, '.leanpowers/runs/2026-01-01-fix/task-1-base.txt'), 'utf8'), /^[0-9a-f]{40}\n$/);
  fs.writeFileSync(path.join(root, 'stray.txt'), 's');
  const c = spawn(root, 'check', '--brief', rel);
  assert.equal(c.status, 1);
  assert.match(c.stdout, /✖ scope\n  not in brief: stray\.txt/);
});

test('brief --file with a wrong name or a missing brief prints one line and exits 1', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'notes.md'), 'n');
  const wrong = spawn(root, 'brief', '--file', 'notes.md');
  assert.equal(wrong.status, 1);
  assert.equal(wrong.stderr.trim(), 'brief --file needs a task-<n>-brief.md');
  const missing = spawn(root, 'brief', '--file', 'runs/task-1-brief.md');
  assert.equal(missing.status, 1);
  assert.equal(missing.stderr.trim(), 'brief not found: runs/task-1-brief.md');
});
```

- [ ] **Step 2: Run them** – `node --test tests/brief.test.mjs tests/check.test.mjs tests/scope-structure.test.mjs tests/cli.test.mjs` → FAIL (`writeBaseFor` and `parseBriefFile` are not exported, `brief` is ignored by `runCheck`, old scope message, old usage lines).
- [ ] **Step 3: Implement** as in Interfaces. Keep every existing message, export and behaviour of the plan form unchanged.
- [ ] **Step 4: Run them** – `node --test tests/brief.test.mjs tests/check.test.mjs tests/scope-structure.test.mjs tests/cli.test.mjs` → PASS; then `npm run build`; then `npm test` → PASS.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: brief --file and check --brief for hand-written medium briefs"` (trailer as in Global Constraints).
- [ ] **Step 6: Confirm** – `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.

### Task 2: Uncommitted-changes warning and the written-out When-done sentence (spec sections 8 and 9)

**Risk:** low

**Files:**
- Modify: `checks/check.mjs`
- Modify: `checks/brief.mjs`
- Test: `tests/check.test.mjs`
- Test: `tests/brief.test.mjs`
- Modify: `dist/**`

**Why:** In the pilot, work was left uncommitted, and subagents stored the long CLI command in a shell variable, which fails in zsh. `check --all` now warns about uncommitted files, and the generated brief says to write the command out.

**Interfaces:**
- Consumes: `changedFiles(root: string, base: string): string[]` from `checks/lib/git.mjs` (diff against `base` plus untracked files, honouring `.gitignore`; root-relative posix, sorted); `matchesAny(file, patterns)` and `toPosix(p)` from `checks/lib/glob.mjs`; `formatResults(results, warnings)` from `checks/lib/output.mjs` prints each warning as `⚠ <warning>` after the result lines and never changes `ok`.
- Produces in `checks/check.mjs`: an internal `function uncommittedWarning(root, config): string | null` – `changedFiles(root, 'HEAD')` inside `try`/`catch` (a git failure such as no repository or no HEAD → `null`, nothing thrown, nothing printed); drop paths matching `${toPosix(config.paths.runs)}/**`; none left → `null`; else `uncommitted changes: <n> files (<the first up to 3 paths joined by ", ">)`.
- Produces: `runCheck` calls it only when `all` is true, after the skill-lint warnings, and pushes a non-null result onto `warnings`. The warning never makes the result fail; without `--all` there is never such a warning.
- Produces in `checks/brief.mjs` `buildBrief`: the `## When done` section text becomes exactly (with `<cli>` = `cliCommand()`, `<planRel>`, `<n>` and `<reportPath>` as today):

```text
Run `<cli> check --plan <planRel> --task <n>`, written out in every call (never stored in a shell variable). Write your report (max 150 words) to `<reportPath>`: what changed, test result, open questions.
```

- [ ] **Step 1: Write the failing tests**

In `tests/check.test.mjs`, append:

```js
test('--all warns about uncommitted files outside the run folder and stays ok', () => {
  const root = project({ commands: { test: 'node ok.mjs' }, paths: { runs: 'runs' } });
  fs.mkdirSync(path.join(root, 'runs/demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runs/demo/progress.md'), 'p');
  assert.equal(runCheck({ root, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
  fs.writeFileSync(path.join(root, 'x.txt'), 'x');
  const one = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(one.ok, true);
  assert.equal(one.text, '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)\n⚠ uncommitted changes: 1 files (x.txt)');
  assert.equal(runCheck({ root, userConfigPath: NO_USER }).text, '✔ leanpowers check: ok (gates:test)');
});

test('the uncommitted warning names at most three paths and counts modified files', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  for (const f of ['a.txt', 'b.txt', 'c.txt']) fs.writeFileSync(path.join(root, f), f);
  fs.writeFileSync(path.join(root, 'src/.keep'), 'changed');
  const r = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(r.ok, true);
  assert.match(r.text, /\n⚠ uncommitted changes: 4 files \(a\.txt, b\.txt, c\.txt\)$/);
});

test('--all outside a git repository gives no uncommitted warning', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-nogit-'));
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node ok.mjs' } }));
  assert.equal(runCheck({ root, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
});
```

In `tests/brief.test.mjs`, replace the test `brief names the plan path in the check command` with:

```js
test('brief names the plan path in the check command', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, 'r', 'docs/plans/demo.md');
  assert.match(b, /Run `(node ".*\/bin\/leanpowers\.mjs"|[^`]+) check --plan docs\/plans\/demo\.md --task 1`, written out in every call \(never stored in a shell variable\)\. Write your report/);
  const d = buildBrief(parsePlan(PLAN), 1, config, 'r');
  assert.match(d, /--plan the plan --task 1/);
});
```

replace the test `brief names exactly the resolvable CLI command` with:

```js
test('brief names exactly the resolvable CLI command', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, '.leanpowers/runs/demo', 'docs/plans/demo.md');
  assert.ok(b.includes(`Run \`${cliCommand()} check --plan docs/plans/demo.md --task 1\`, written out in every call`));
  assert.doesNotMatch(b, /Run `leanpowers check/);
});
```

and append:

```js
test('brief tells the implementer never to store the command in a shell variable', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, 'r', 'p.md');
  const whenDone = b.slice(b.indexOf('## When done'));
  assert.ok(whenDone.includes('(never stored in a shell variable)'), whenDone);
});
```

- [ ] **Step 2: Run them** – `node --test tests/check.test.mjs tests/brief.test.mjs` → FAIL (no warning line, old When-done sentence).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run them** – `node --test tests/check.test.mjs tests/brief.test.mjs` → PASS; then `npm run build`; then `npm test` → PASS.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: check --all warns about uncommitted changes; briefs say to write the command out"` (trailer as in Global Constraints).
- [ ] **Step 6: Confirm** – `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` with no `⚠` line.

### Task 3: Size-rule texts (spec sections 4, 5, 6 points 4–6, 8 first two bullets, 10)

**Risk:** high

**Files:**
- Modify: `skills/start/SKILL.md`
- Modify: `skills/design/SKILL.md`
- Modify: `skills/verify/SKILL.md`
- Create: `skills/design/details/medium.md`
- Modify: `build/gemini.mjs`
- Test: `tests/start.test.mjs`
- Test: `tests/skills-content.test.mjs`
- Test: `tests/build.test.mjs`
- Modify: `dist/**`

**Why:** In the pilot the AI named "large", got the design approved and then skipped spec and plan; it also paraphrased the size class instead of naming it. The texts now demand a fixed `Size:` marker, a plan approval for large, and a medium brief that the CLI can check.

**Interfaces:**
- Consumes (already in the CLI): `leanpowers brief --file <brief>` records `task-<n>-base.txt` next to a hand-written `task-<n>-brief.md`; `leanpowers check --brief <brief>` checks scope and structure against its `## Allowed files` lines `- <path>` and its line `Approved new folders: <list>`.
- Produces `skills/start/SKILL.md` – keep the frontmatter (lines 1–4) unchanged; the body after the closing `---` becomes exactly (100 words, about 134 tokens):

```text
Subagents ignore this text.

leanpowers workflow by size (unclear → larger), named first as `Size: small|medium|large`:
- Small (one file, clear fix): do it, `leanpowers check`.
- Medium (bounded change in existing code): `design` in chat, one subagent, `leanpowers check`, `finish`.
- Large (new feature or project, several areas, interfaces): `design` (spec), `plan`, `staff`, `run`, `finish`.

Commands: design, plan, staff, run, debug, finish, check, skills, init.

User instructions win, but Medium needs design approval and Large plan approval before any code or subagent dispatch, delegation rules included; only "implement directly" for this task skips it. Answer in the user's language.
```

- Produces `skills/design/SKILL.md` (ends at 593 words; four edits, nothing else changes):
  1. §1: replace the sentence `Apply the size rule and say the class aloud before your first question, so the user can override it: "This looks medium — a bounded change to existing code — so a short design here, no spec."` with:

```text
Apply the size rule; open your reply with the class in this exact form, in any language, so the user can override it: "Size: medium — a bounded change to existing code, so a short design here, no spec."
```

  2. §2: replace the whole paragraph that starts with `After approval: small → implement` (one line, ends with `No spec, no plan.`) with:

```text
After approval: small → implement, then run `leanpowers check`. Medium → write the brief as [details/medium.md](details/medium.md) says and run `leanpowers brief --file <brief>` to record its base. Dispatch a subagent at tier medium with template `agents/implementer.md`, `{{brief}}` that file and `{{report}}` the report path. Handle its status as `run` does (per task, step 3), run `leanpowers check --brief <brief>` yourself, then invoke the `finish` skill. No spec, no plan.
```

  3. §3: directly after the line of step 4 (`4. **Present the design in sections** …(YAGNI).`) insert one line indented by three spaces, so it belongs to step 4 and the numbering continues:

```text
   This yes opens the spec, not the code: no implementer before an approved plan.
```

  4. `## Red flags`: append as the last bullet:

```text
- "Design approved, one implementer will do" → that is medium; large needs spec and plan.
```

- Produces `skills/design/details/medium.md` (new; the folder `skills/design/details/` already exists; no frontmatter, no word limit), content exactly:

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

- Produces `skills/verify/SKILL.md` (two edits under `## Evidence`):
  1. Replace `` - Run `leanpowers check`, which runs the configured gates (tests, doc-lint, skill-lint). It is the deterministic judge; your own confidence is not. `` with:

```text
- Run `leanpowers check`, which runs the configured gates (tests, typecheck, lint); `--all` adds doc-lint and skill-lint. It is the deterministic judge; your own confidence is not.
```

  2. Directly after the bullet that starts with `- Inside a run, use the task form`, insert the bullet:

```text
- For a medium task, use `leanpowers check --brief <brief>`.
```

- Produces `build/gemini.mjs`: the Gemini context file `GEMINI.md` is the start text plus a CLI line and must stay ≤ 150 tokens (`estimateTokens` = ⌈words × 4/3⌉, so ≤ 112 words). With the new 100-word start text the current 19-word CLI line gives 119 words (159 tokens). Add `const CONTEXT_FALLBACK = 'unexpanded: the folder holding gemini-extension.json';` next to `FALLBACK` and build `GEMINI.md` with `` startText(repoRoot, DEFAULTS, `${CLI} (${CONTEXT_FALLBACK})`) ``. Its last line becomes `CLI: run leanpowers as node "${extensionPath}/bin/leanpowers.mjs" (unexpanded: the folder holding gemini-extension.json).` (11 words, 148 tokens in total). `FALLBACK` and the TOML command prompts stay unchanged.

- [ ] **Step 1: Write the failing tests**

In `tests/start.test.mjs`, append:

```js
test('start text names the size marker, the plan gate for large and finish for medium', () => {
  const t = startText(repo, DEFAULTS, 'leanpowers');
  assert.ok(t.includes('leanpowers workflow by size (unclear → larger), named first as `Size: small|medium|large`:'));
  assert.ok(t.includes('Large plan approval before any code or subagent dispatch'));
  assert.match(t, /^- Medium \(bounded change in existing code\): `design` in chat, one subagent, `leanpowers check`, `finish`\.$/m);
  assert.match(t, /^- Large \(new feature or project, several areas, interfaces\): `design` \(spec\), `plan`, `staff`, `run`, `finish`\.$/m);
  assert.doesNotMatch(t, /explicit requests/);
  assert.ok(estimateTokens(t) <= 150);
});
```

In `tests/skills-content.test.mjs`, in the test `subagents without a generated brief get the resolved CLI`, replace the two lines

```js
  const design = read('skills/design/SKILL.md');
  assert.match(design, /`## When done`: run the `check` command as the `CLI:` line names it/);
```

with

```js
  assert.match(read('skills/design/details/medium.md'), /`## When done`: run the `check` command as the `CLI:` line names it/);
```

and append:

```js
test('design names the size marker, the plan gate and the medium brief check', () => {
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('open your reply with the class in this exact form, in any language'), 'marker rule');
  assert.ok(design.includes('"Size: medium —'), 'marker example');
  assert.ok(design.includes('   This yes opens the spec, not the code: no implementer before an approved plan.'), 'step 4');
  assert.ok(design.includes('- "Design approved, one implementer will do" → that is medium; large needs spec and plan.'), 'red flag');
  assert.ok(design.includes('write the brief as [details/medium.md](details/medium.md) says and run `leanpowers brief --file <brief>`'), 'medium brief');
  assert.ok(design.includes('run `leanpowers check --brief <brief>` yourself, then invoke the `finish` skill. No spec, no plan.'), 'check --brief and finish');
  const medium = read('skills/design/details/medium.md');
  assert.ok(medium.startsWith('# Medium brief\n'), 'title');
  assert.ok(medium.includes('in the form `<cli> check --brief <brief path>`'), 'check form');
  assert.ok(medium.includes('never store\n  it in a shell variable'), 'shell variable');
  assert.ok(medium.includes('Commit with `<type>: <topic>`, one commit.'), 'commit');
  assert.ok(medium.includes('list those folders\n  as `Approved new folders: <folders>`.'), 'approved folders');
  assert.ok(medium.includes('Then run `leanpowers brief --file <brief path>`'), 'base');
});

test('verify names what check and check --all run, and the medium check', () => {
  const verify = read('skills/verify/SKILL.md');
  assert.ok(verify.includes('which runs the configured gates (tests, typecheck, lint); `--all` adds doc-lint and skill-lint.'));
  assert.ok(verify.includes('- For a medium task, use `leanpowers check --brief <brief>`.'));
});
```

In `tests/build.test.mjs`, in the test `gemini start text names the extension folder fallback and stays small`, replace the line

```js
  assert.match(text, /^CLI: run leanpowers as node "\$\{extensionPath\}\/bin\/leanpowers\.mjs" \(if `\$\{extensionPath\}` is not expanded, the extension folder is the one containing gemini-extension\.json\)\.$/m);
```

with

```js
  assert.match(text, /^CLI: run leanpowers as node "\$\{extensionPath\}\/bin\/leanpowers\.mjs" \(unexpanded: the folder holding gemini-extension\.json\)\.$/m);
  assert.match(text, /named first as `Size: small\|medium\|large`/);
```

(keep the token assertion and the TOML loop of that test unchanged).

- [ ] **Step 2: Run them** – `node --test tests/start.test.mjs tests/skills-content.test.mjs tests/build.test.mjs` → FAIL (old start text, no `medium.md`, old Gemini CLI line; `committed dist matches a fresh build` may also fail once the sources change – that is expected until the build).
- [ ] **Step 3: Implement** the texts and the `build/gemini.mjs` change exactly as in Interfaces.
- [ ] **Step 4: Run them** – `npm run build`; then `node --test tests/start.test.mjs tests/skills-content.test.mjs tests/build.test.mjs` → PASS; then `npm test` → PASS; then `node bin/leanpowers.mjs check --all` → no `skill-lint` finding (design at most 600 words, start text at most 150 tokens, the link to `details/medium.md` resolves).
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: size marker, plan gate for large, checked medium brief"` (trailer as in Global Constraints).
- [ ] **Step 6: Confirm** – `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.

### Task 4: Orchestration texts (spec section 7 and the orchestrator/loops bullets of section 9)

**Risk:** high

**Files:**
- Modify: `agents/orchestrator.md`
- Modify: `skills/staff/SKILL.md`
- Modify: `skills/run/details/loops.md`
- Modify: `skills/run/details/ledger.md`
- Modify: `platforms/claude-code.md`
- Modify: `platforms/codex-cli.md`
- Modify: `platforms/gemini-cli.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Why:** In the pilot the orchestrator subagent ended its turn with "Waiting for the implementer…"; a fresh orchestrator then started a second implementer for the same task. The turn rule moves to the top of the template, `staff` resumes the stalled orchestrator before starting a fresh one, and the ledger records each implementer dispatch.

**Interfaces:**
- Produces `agents/orchestrator.md` – must end at exactly 400 words (the limit); six edits, nothing else changes:
  1. Between the first paragraph (`You run a plan to completion for the user. You decide and delegate; you write no production code.`) and `## Inputs`, insert this section (with one blank line before and after):

```markdown
## Turn rule

Dispatch every implementer and reviewer in the foreground, never in the background. If a dispatched or resumed agent's result arrives asynchronously anyway, wait for it, never poll; never end your turn while any subagent of yours is still working. Your turn ends only with a final reply whose first line is `Status: DONE` or `Status: NEEDS_USER`. Never dispatch a second implementer for a task while the first may still be working.
```

  2. Inputs: replace `` - CLI: run every `leanpowers` command as `{{cli}}`. `` with:

```text
- CLI: run every `leanpowers` command as `{{cli}}`, written out, never from a shell variable.
```

  3. Process step 3: replace `` 3. Decide ambiguities, plan conflicts and review findings left at the round cap by ruling. Log each one as `Ruling: <what> — <why> — <cost if wrong>`. Never stop for a question you are allowed to rule on. Never rule through a red deterministic gate. `` with:

```text
3. Rule on ambiguities, plan conflicts and findings left at the round cap; log `Ruling: <what> — <why> — <cost if wrong>`. Never stop for what you may rule on; never rule through a red deterministic gate.
```

  4. Process step 4: replace the start `` 4. Stop only for the reasons in `run`: an irreversible, destructive or security-sensitive action, a side effect outside the repo (push, publish, merge), a plan so broken that every path is a guess, or a gate still red after escalation. Write `Stop: <question>` to the ledger, then return: `` with `` 4. Stop only for the four reasons in `run`. Write `Stop: <question>` to the ledger, then return: `` (the three sub-bullets below it stay).
  5. Process step 5: delete its last sentence `` A fresh orchestrator finding an unanswered `Stop:` line returns the same question. `` and the space before it, so the step ends with `and continue from the ledger.`
  6. `## Hard rules`: delete the first bullet (`` - Wait for every subagent in the foreground, resumed ones too; never poll. Your turn ends only with a final reply whose first line is `Status: DONE` or `Status: NEEDS_USER`. ``); the other three bullets stay.
- Produces `skills/staff/SKILL.md` step 4, `auto` bullet (ends at 496 words): replace the sentence `If it ends with neither, dispatch a fresh one once with the same inputs, its prompt naming the ledger's last line; the ledger lets it resume.` with the text below; the sentences before it and the following sentence `If that one also ends with neither, tell the user, …` stay.

```text
Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim. If it ends with neither, resume the same orchestrator once: "Your turn ended without a status line. Wait for your running subagents, then continue; the turn rule applies." Its subagents may still be working and report to it. Only if it cannot be resumed or ends with neither again, dispatch a fresh one with the same inputs, its prompt naming the ledger's last line; the ledger lets it resume.
```

- Produces `skills/run/details/ledger.md`:
  1. In the `## Lines` table, directly after the row `` | Task base reset | `Task <n>: base reset (<sha7>) — <why>` | ``, insert the row:

```text
| Implementer dispatched, written before each implementer dispatch | `Task <n>: implementer dispatched (<agent name or id>)` |
```

  2. In `## Resume`, replace the bullet `` - `task-<n>-base.txt` exists but no line → the task started: look for its commits since that base and for its report file. Work present → gate it; otherwise resume or re-dispatch the implementer. `` with:

```text
- `implementer dispatched`, or `task-<n>-base.txt` exists but no line → the task started: look for its commits since that base and for its report file. Work present → gate it; otherwise, if a dispatched line names an implementer, resume that one; re-dispatch only when it cannot be resumed.
```

- Produces `skills/run/details/loops.md` under `## Dispatches and the CLI`:
  1. Append to the first bullet (after `never end the turn while one of your subagents works.`) one space and the sentence `Never dispatch a second implementer for a task while the first may still be working.`
  2. Append to the third bullet (after `` Briefs from `leanpowers brief` already do. ``) one space and the sentence below; `…` is the single character U+2026.

```text
Write the command out in every call; never store it in a shell variable (`S="node …"; $S` fails in zsh, which does not split words).
```

- Produces `platforms/claude-code.md`: replace the table row `| Wait for a subagent | Dispatch in the foreground. A resumed agent's result arrives as a task notification: wait for it; never poll or end the turn before it arrives. |` with:

```text
| Wait for a subagent | Dispatch in the foreground: never set `run_in_background`. A resumed agent's result arrives as a task notification: wait for it; never poll or end the turn before it arrives. |
```

- Produces `platforms/codex-cli.md`: replace the row `| Wait for a subagent | Wait for the agent's result before continuing; how a resumed agent reports back is (unverified). Never poll or end the turn while it works. |` with:

```text
| Wait for a subagent | Wait for the agent's result before continuing; how a resumed agent reports back is (unverified). Never poll or end the turn while it works. Never dispatch a second agent for a task while the first may still be working. |
```

- Produces `platforms/gemini-cli.md`: replace the row `` | Wait for a subagent | `invoke_agent` returns the result when the agent finishes (unverified); wait for it and never end the turn before. | `` with:

```text
| Wait for a subagent | `invoke_agent` returns the result when the agent finishes (unverified); wait for it and never end the turn before. Never dispatch a second agent for a task while the first may still be working. |
```

- [ ] **Step 1: Write the failing test** – append to `tests/skills-content.test.mjs`:

```js
test('orchestrator turn rule, resume before re-dispatch, one implementer per task', () => {
  const orchestrator = read('agents/orchestrator.md');
  const turn = orchestrator.indexOf('## Turn rule');
  assert.ok(turn > 0 && turn < orchestrator.indexOf('## Inputs'), 'turn rule before inputs');
  assert.ok(orchestrator.includes('Dispatch every implementer and reviewer in the foreground, never in the background.'), 'foreground');
  assert.ok(orchestrator.includes('Never dispatch a second implementer for a task while the first may still be working.'), 'second implementer');
  assert.ok(orchestrator.includes('- CLI: run every `leanpowers` command as `{{cli}}`, written out, never from a shell variable.'), 'cli line');
  assert.ok(orchestrator.includes('4. Stop only for the four reasons in `run`. Write `Stop: <question>` to the ledger, then return:'), 'stop reasons');
  assert.ok(!orchestrator.includes('- Wait for every subagent in the foreground'), 'old hard rule removed');
  const staff = read('skills/staff/SKILL.md');
  assert.ok(staff.includes('Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim.'), 'platform line');
  assert.ok(staff.includes('resume the same orchestrator once'), 'resume once');
  assert.ok(staff.includes('Only if it cannot be resumed or ends with neither again, dispatch a fresh one with the same inputs'), 'fresh only after');
  assert.ok(read('platforms/claude-code.md').includes('Dispatch in the foreground: never set `run_in_background`.'), 'claude');
  for (const p of ['codex-cli', 'gemini-cli']) {
    assert.ok(read(`platforms/${p}.md`).includes('Never dispatch a second agent for a task while the first may still be working.'), p);
  }
  const ledger = read('skills/run/details/ledger.md');
  assert.ok(ledger.includes('`Task <n>: implementer dispatched (<agent name or id>)`'), 'ledger line');
  assert.ok(ledger.includes('if a dispatched line names an implementer, resume that one; re-dispatch only when it cannot be resumed.'), 'resume rule');
  const loops = read('skills/run/details/loops.md');
  assert.ok(loops.includes('Never poll, and never end the turn while one of your subagents works. Never dispatch a second implementer for a task while the first may still be working.'), 'loops dispatch');
  assert.ok(loops.includes('never store it in a shell variable (`S="node …"; $S` fails in zsh, which does not split words).'), 'loops zsh');
});
```

- [ ] **Step 2: Run it** – `node --test tests/skills-content.test.mjs` → FAIL (new sentences missing).
- [ ] **Step 3: Edit the texts** exactly as in Interfaces.
- [ ] **Step 4: Run it** – `npm run build`; then `node --test tests/skills-content.test.mjs` → PASS (this file also runs skill-lint: the orchestrator must not exceed 400 words); then `npm test` → PASS.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: orchestrator turn rule, resume before re-dispatch, one implementer per task"` (trailer as in Global Constraints).
- [ ] **Step 6: Confirm** – `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.

### Task 5: Finish text and docs (spec section 8 finish bullet, section 6 point 7 docs)

**Risk:** low

**Files:**
- Modify: `skills/finish/SKILL.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Why:** In the pilot finished work stayed uncommitted. `check --all` now warns about uncommitted changes outside the run folder; `finish` must treat them as a block. The command tables must list the two new CLI forms.

**Interfaces:**
- Consumes (already in the CLI): `leanpowers check --all` prints `⚠ uncommitted changes: <n> files (<up to 3 paths>)` when files outside the run folder are uncommitted; `leanpowers check --brief <file>` checks scope and structure against a hand-written `task-<n>-brief.md`; `leanpowers brief --file <brief> [--reset-base]` records that brief's base commit and prints its path.
- Produces `skills/finish/SKILL.md` §1 (`## 1. Verify`, ends at 510 words): append one space and this sentence to the end of the paragraph (after `The user may still explicitly choose to keep the branch or to discard it.`):

```text
Uncommitted changes outside the run folder (the check warns about them) also block merge and pull request: list them and ask whether to commit them first.
```

- Produces `docs/README.md`, table under `## Commands`: directly after the row ``| `brief --plan <file> --task <n>` | Write the brief for one plan task and print its path. |`` insert:

```text
| `check --brief <file>` | Also check scope and structure against a hand-written medium brief (base from `brief --file`). |
| `brief --file <brief> [--reset-base]` | Record the base commit for a hand-written `task-<n>-brief.md` and print its path. |
```

- Produces `docs/README.de.md`, table under `## Befehle`: directly after the row ``| `brief --plan <Datei> --task <n>` | Schreibt den Brief für eine Plan-Aufgabe und gibt den Pfad aus. |`` insert:

```text
| `check --brief <Datei>` | Prüft zusätzlich Scope und Struktur gegen einen von Hand geschriebenen mittleren Brief (Basis aus `brief --file`). |
| `brief --file <Brief> [--reset-base]` | Hält den Basis-Commit für einen von Hand geschriebenen `task-<n>-brief.md` fest und gibt seinen Pfad aus. |
```

- [ ] **Step 1: Write the failing test** – append to `tests/skills-content.test.mjs`:

```js
test('finish blocks on uncommitted changes and the readmes name the medium check', () => {
  assert.ok(read('skills/finish/SKILL.md').includes('Uncommitted changes outside the run folder (the check warns about them) also block merge and pull request: list them and ask whether to commit them first.'));
  const en = read('docs/README.md');
  assert.ok(en.includes('| `check --brief <file>` |'), 'en check --brief');
  assert.ok(en.includes('| `brief --file <brief> [--reset-base]` |'), 'en brief --file');
  const de = read('docs/README.de.md');
  assert.ok(de.includes('| `check --brief <Datei>` |'), 'de check --brief');
  assert.ok(de.includes('| `brief --file <Brief> [--reset-base]` |'), 'de brief --file');
});
```

- [ ] **Step 2: Run it** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Edit** the three files exactly as in Interfaces.
- [ ] **Step 4: Run it** – `npm run build`; then `node --test tests/skills-content.test.mjs` → PASS; then `npm test` → PASS.
- [ ] **Step 5: Commit** – `git add -A && git commit -m "docs: finish blocks on uncommitted changes; readmes list check --brief and brief --file"` (trailer as in Global Constraints).
- [ ] **Step 6: Confirm** – `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.

### Task 6: Version 0.1.4 and changelog (spec section 11)

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

**Why:** Release the second pilot's fixes as 0.1.4. The `gemini-extension` branch, the tag, the push, CI on the remote and publishing are not part of this plan: they happen in `finish` after the maintainer's yes.

**Interfaces:**
- Consumes: Tasks 1–5 (all committed).
- Produces: `"version": "0.1.4"` in `package.json`; `npm run build` writes it into every generated manifest (`dist/claude-plugin/.claude-plugin/plugin.json`, `dist/codex-plugin/.codex-plugin/plugin.json`, `dist/gemini-extension/gemini-extension.json`, each `dist/*/package.json`) and regenerates `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
- Produces `CHANGELOG.md`: the heading `## [Unreleased]` becomes `## [0.1.4] - 2026-11-01` (no new empty `## [Unreleased]` heading – the 0.1.3 release had none either). Under it, in this order: `### Added`, then `### Changed` (the new bullets first, then the existing Docs bullet about the Gemini CLI install, unchanged), then `### Fixed`. The new bullets, one plain line each:

```markdown
### Added

- `brief --file <brief>` records the base commit for a hand-written medium brief; `check --brief <brief>` checks its scope and structure (combines with `--all`).
- `check --all` warns about uncommitted changes outside the run folder.
- `skills/design/details/medium.md`: the medium brief form with commit message and `check --brief`.

### Changed

- Start text and `design`: the reply opens with `Size: small|medium|large`; large needs plan approval before any code or subagent dispatch; medium ends with `finish`.
- Scope names a changed `leanpowers.json` as the user's project configuration.
- The orchestrator template starts with a turn rule; `staff` resumes a stalled orchestrator once before dispatching a fresh one; the ledger logs each implementer dispatch.
- Briefs, the orchestrator and the run loops say to write the CLI command out in every call, never in a shell variable.
- `finish` blocks merge and pull request while uncommitted changes remain.
- The Gemini context file uses a shorter CLI fallback note, so the start text stays within 150 tokens.

### Fixed

- `verify` no longer says that plain `leanpowers check` runs doc-lint and skill-lint (only `--all` does).
```

- Produces current-version mentions: `README.md` line `… Current version: 0.1.3.` → `Current version: 0.1.4.`; the status lines `Version 0.1.3. The authors made no paid test runs …` in `README.md` and `docs/README.md` and `Version 0.1.3. Die Autoren haben …` in `docs/README.de.md` → `Version 0.1.4.`. Historic mentions stay unchanged, in particular the confirmed install lines (`gemini extensions list` shows leanpowers 0.1.3 with 12 skills) and every `0.1.0`/`0.1.1` mention.

- [ ] **Step 1: Implement** – set the version in `package.json`, run `npm run build`, update `CHANGELOG.md` and the current-version mentions as in Interfaces.
- [ ] **Step 2: Run** – `npm test` → PASS; `grep -rn "0\.1\.3" package.json dist --include=*.json` → no output; `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` plus the expected `⚠ uncommitted changes: …` line while the release files are not yet committed.
- [ ] **Step 3: Commit** – `git add -A && git commit -m "chore: release v0.1.4 notes and version"` (trailer as in Global Constraints).
- [ ] **Step 4: Confirm** – `npm run build && git diff --exit-code -- dist .claude-plugin .agents` → no output; `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` with no `⚠` line.
