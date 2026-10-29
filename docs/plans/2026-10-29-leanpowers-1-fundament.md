# leanpowers Plan 1 – Fundament (Konfig + Prüf-Skripte) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI-independent foundation of leanpowers: config file + JSON schema + loader, and the `leanpowers` CLI with the deterministic checks `gates`, `scope`, `structure`, `doc-lint`, `skill-lint`, `config`, plus `brief` and `metrics`.

**Architecture:** Plain Node ESM modules under `checks/`, one responsibility per file, pure functions where possible (I/O at the edges). A single CLI entry `bin/leanpowers.mjs` dispatches subcommands. Output is token-lean: one line on success, at most 20 deduplicated lines per failing check.

**Tech Stack:** Node >= 20, ES modules (`.mjs`), `node:test` + `node:assert/strict`, `node:child_process`, git CLI. No npm dependencies.

**Spec:** `docs/specs/2026-10-29-leanpowers-design.md` (sections 4, 7.3, 7.4, 8, 9, 10, 12). This is plan 1 of 4: 2 = skills/agents/platform maps, 3 = build/packages/commands/init/templates, 4 = scenario tests/pilot/release.

**Plan style note:** Tests are given in full and are the behavioural contract. Implementation steps give exact signatures and rules instead of full code; the implementer writes the code to satisfy the tests.

## Global Constraints

- Node >= 20, ES modules with `.mjs` extension, zero runtime and zero dev dependencies (`package.json` has no `dependencies`/`devDependencies`).
- Tests: `node --test` via `npm test`; every task ends with `npm test` green.
- Identifiers, code comments, CLI output and commit messages in English.
- Cross-platform (macOS, Windows, Linux): build paths with `node:path`, report paths with forward slashes (`p.split(path.sep).join('/')`).
- Success output of `leanpowers check` is exactly one line (plus optional config warning lines); failing checks list at most 20 deduplicated message lines each.
- Config file name `leanpowers.json` in project root; user config `~/.config/leanpowers/config.json` (or `$XDG_CONFIG_HOME/leanpowers/config.json`); project wins.
- Default paths: specs `docs/specs`, plans `docs/plans`, reports `docs/reports`, runs `.leanpowers/runs`.
- Every run directory contains a `.gitignore` with the single line `*`.
- Commits: conventional prefix (`feat:`, `test:`, `chore:`, `docs:`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never `git stash`.

## Shared types (used across tasks)

```js
/** @typedef {{ name: string, ok: boolean, messages: string[] }} CheckResult */
```

---

### Task 1: Project scaffold, glob matching, output compression

**Risk:** low

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `checks/lib/glob.mjs`
- Create: `checks/lib/output.mjs`
- Test: `tests/glob.test.mjs`
- Test: `tests/output.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `globToRegExp(glob: string): RegExp`
  - `matchesAny(path: string, globs: string[]): boolean`
  - `toPosix(p: string): string`
  - `compress(lines: string[], max = 20): string[]`
  - `formatResults(results: CheckResult[], warnings: string[] = []): { ok: boolean, text: string }`

- [ ] **Step 1: Create scaffold files**

`package.json`:
```json
{
  "name": "leanpowers",
  "version": "0.0.1",
  "description": "Lean, cross-assistant workflow plugin: design, plan, subagent execution, deterministic checks.",
  "type": "module",
  "license": "MIT",
  "bin": { "leanpowers": "bin/leanpowers.mjs" },
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test tests/" }
}
```

`.gitignore`:
```
node_modules/
.leanpowers/
.DS_Store
```

`LICENSE`: standard MIT license text, `Copyright (c) 2026 Dominic Shin`.

`NOTICE`:
```
leanpowers uses ideas, workflow structure and adapted text from Superpowers
(https://github.com/obra/superpowers), Copyright (c) 2025 Jesse Vincent,
licensed under the MIT License. Adapted parts are marked in the file headers.
```

- [ ] **Step 2: Write the failing tests**

`tests/glob.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAny, toPosix } from '../checks/lib/glob.mjs';

test('* matches within one segment only', () => {
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/x/a.ts'));
});

test('** matches across segments, **/ also matches zero segments', () => {
  assert.ok(globToRegExp('src/**').test('src/a/b/c.tsx'));
  assert.ok(globToRegExp('**/*.ts').test('a.ts'));
  assert.ok(globToRegExp('**/*.ts').test('x/y/a.ts'));
  assert.ok(!globToRegExp('**/*.ts').test('x/y/a.tsx'));
});

test('? matches one non-slash char and dots are literal', () => {
  assert.ok(globToRegExp('a?.md').test('ab.md'));
  assert.ok(!globToRegExp('a?.md').test('a/.md'));
  assert.ok(!globToRegExp('a.md').test('aXmd'));
});

test('exact paths match only themselves', () => {
  assert.ok(globToRegExp('docs/specs/x.md').test('docs/specs/x.md'));
  assert.ok(!globToRegExp('docs/specs/x.md').test('docs/specs/x.md.bak'));
});

test('matchesAny and toPosix', () => {
  assert.equal(matchesAny('src/a.ts', ['lib/**', 'src/*.ts']), true);
  assert.equal(matchesAny('src/a.ts', []), false);
  assert.equal(toPosix(['a', 'b', 'c'].join(process.platform === 'win32' ? '\\' : '/')), 'a/b/c');
});
```

`tests/output.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compress, formatResults } from '../checks/lib/output.mjs';

test('compress trims, drops empty lines and dedupes in order', () => {
  assert.deepEqual(compress(['  a ', '', 'b', 'a', '   ', 'c']), ['a', 'b', 'c']);
});

test('compress caps at max and reports the rest', () => {
  const lines = Array.from({ length: 25 }, (_, i) => `line ${i}`);
  const out = compress(lines, 20);
  assert.equal(out.length, 21);
  assert.equal(out[20], '… 5 more');
});

test('formatResults: all ok gives exactly one line', () => {
  const r = formatResults([
    { name: 'gates:test', ok: true, messages: [] },
    { name: 'scope', ok: true, messages: [] },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.text, '✔ leanpowers check: ok (gates:test, scope)');
});

test('formatResults: failures list name and indented messages only for failed checks', () => {
  const r = formatResults([
    { name: 'gates:test', ok: false, messages: ['1 failing'] },
    { name: 'scope', ok: true, messages: ['ignored'] },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.text, '✖ leanpowers check: 1 failed\n✖ gates:test\n  1 failing');
});

test('formatResults: warnings are prefixed and placed after the status line', () => {
  const r = formatResults([{ name: 'scope', ok: true, messages: [] }], ['config: bad']);
  assert.equal(r.text, '✔ leanpowers check: ok (scope)\n⚠ config: bad');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules `checks/lib/glob.mjs` and `checks/lib/output.mjs` not found.

- [ ] **Step 4: Implement**

`checks/lib/glob.mjs`:
- `globToRegExp(glob)`: escape regex special chars except `*` and `?`; translate in this order: `**/` → `(?:.*/)?`, remaining `**` → `.*`, `*` → `[^/]*`, `?` → `[^/]`; anchor with `^…$`.
- `matchesAny(path, globs)`: true if any glob matches `toPosix(path)`.
- `toPosix(p)`: replace every `\` with `/`.

`checks/lib/output.mjs`:
- `compress(lines, max = 20)`: trim each line, drop empty, dedupe keeping first occurrence; if more than `max` remain, keep the first `max` and append `… N more`.
- `formatResults(results, warnings = [])`: if every result is ok → first line `✔ leanpowers check: ok (<names joined by ", ">)`; else first line `✖ leanpowers check: <count> failed`, then for each failed result `✖ <name>` followed by its messages each prefixed with two spaces. Then each warning as `⚠ <warning>`. Lines joined with `\n`. Returns `{ ok, text }`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests in both files).

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore LICENSE NOTICE checks/lib tests
git commit -m "feat: project scaffold, glob matching and output compression

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Config schema, defaults, loader and validator

**Risk:** high

**Files:**
- Create: `schema/leanpowers.schema.json`
- Create: `checks/lib/defaults.mjs`
- Create: `checks/lib/config.mjs`
- Create: `templates/leanpowers.json`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DEFAULTS` (frozen object, shape below)
  - `validate(value: unknown, schema: object, at = ''): string[]` — messages `"<path>: <problem>"`
  - `deepMerge(base: object, override: object): object` — objects merge recursively, arrays and scalars replace
  - `defaultUserConfigPath(): string`
  - `loadConfig(root: string, opts?: { userConfigPath?: string }): { config: object, errors: string[] }`

- [ ] **Step 1: Write the failing test**

`tests/config.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { validate, deepMerge, loadConfig } from '../checks/lib/config.mjs';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/leanpowers.schema.json', import.meta.url)));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cfg-'));
const NO_USER = { userConfigPath: path.join(os.tmpdir(), 'lp-does-not-exist', 'config.json') };

test('defaults are valid against the schema', () => {
  assert.deepEqual(validate(DEFAULTS, schema), []);
});

test('defaults have the spec values', () => {
  assert.deepEqual(DEFAULTS.paths, { specs: 'docs/specs', plans: 'docs/plans', reports: 'docs/reports', runs: '.leanpowers/runs' });
  assert.deepEqual(DEFAULTS.review, { batch: 3, maxFixRounds: 2 });
  assert.equal(DEFAULTS.skills.worktrees, false);
  assert.equal(DEFAULTS.structure.newFolders, 'ask');
  assert.equal(DEFAULTS.summarizer, 'none');
});

test('template config is valid', () => {
  const tpl = JSON.parse(fs.readFileSync(new URL('../templates/leanpowers.json', import.meta.url)));
  assert.deepEqual(validate(tpl, schema), []);
});

test('validate reports path and problem', () => {
  const errs = validate({ review: { batch: 'three' }, structure: { newFolders: 'maybe' }, bogus: 1 }, schema);
  assert.ok(errs.includes('review.batch: expected integer'));
  assert.ok(errs.includes('structure.newFolders: must be one of ask, allow, deny'));
  assert.ok(errs.includes('bogus: unknown property'));
});

test('validate checks array items and minimum', () => {
  const errs = validate({ structure: { rules: [{ path: 'src/**' }] }, review: { batch: 0 } }, schema);
  assert.ok(errs.includes('structure.rules[0].allow: required'));
  assert.ok(errs.includes('review.batch: must be >= 1'));
});

test('deepMerge merges objects and replaces arrays', () => {
  assert.deepEqual(
    deepMerge({ a: { x: 1, y: 2 }, l: [1, 2] }, { a: { y: 3 }, l: [9] }),
    { a: { x: 1, y: 3 }, l: [9] },
  );
});

test('loadConfig without files returns defaults and no errors', () => {
  const { config, errors } = loadConfig(tmp(), NO_USER);
  assert.deepEqual(config, DEFAULTS);
  assert.deepEqual(errors, []);
});

test('project config overrides user config, which overrides defaults', () => {
  const root = tmp();
  const userPath = path.join(tmp(), 'config.json');
  fs.writeFileSync(userPath, JSON.stringify({ commands: { test: 'user-test', lint: 'user-lint' } }));
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'npm test' } }));
  const { config, errors } = loadConfig(root, { userConfigPath: userPath });
  assert.deepEqual(errors, []);
  assert.equal(config.commands.test, 'npm test');
  assert.equal(config.commands.lint, 'user-lint');
  assert.equal(config.paths.specs, 'docs/specs');
});

test('invalid project file is reported and ignored', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ review: { batch: 'x' }, commands: { test: 'npm test' } }));
  const { config, errors } = loadConfig(root, NO_USER);
  assert.deepEqual(errors, ['leanpowers.json: review.batch: expected integer']);
  assert.equal(config.commands.test, '');
});

test('broken JSON is reported and ignored', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), '{ nope');
  const { config, errors } = loadConfig(root, NO_USER);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^leanpowers\.json: invalid JSON/);
  assert.deepEqual(config, DEFAULTS);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, modules and schema file not found.

- [ ] **Step 3: Write schema, defaults and template**

`schema/leanpowers.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "leanpowers configuration",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "skills": {
      "type": "object",
      "description": "Skill switches. Key = skill name or skill.option, value = enabled.",
      "additionalProperties": { "type": "boolean" }
    },
    "extraSkillDirs": { "type": "array", "items": { "type": "string" } },
    "paths": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "specs": { "type": "string" },
        "plans": { "type": "string" },
        "reports": { "type": "string" },
        "runs": { "type": "string" }
      }
    },
    "commands": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "test": { "type": "string" },
        "typecheck": { "type": "string" },
        "lint": { "type": "string" }
      }
    },
    "structure": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "newFolders": { "type": "string", "enum": ["ask", "allow", "deny"] },
        "rules": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["path", "allow"],
            "properties": {
              "path": { "type": "string" },
              "allow": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    },
    "review": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "batch": { "type": "integer", "minimum": 1 },
        "maxFixRounds": { "type": "integer", "minimum": 0 }
      }
    },
    "models": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "small": { "type": "string" },
        "medium": { "type": "string" },
        "large": { "type": "string" }
      }
    },
    "summarizer": { "type": "string" }
  }
}
```

`checks/lib/defaults.mjs`: export `DEFAULTS` = deep-frozen object:
```js
{
  skills: { worktrees: false, 'design.visualCompanion': false },
  extraSkillDirs: [],
  paths: { specs: 'docs/specs', plans: 'docs/plans', reports: 'docs/reports', runs: '.leanpowers/runs' },
  commands: { test: '', typecheck: '', lint: '' },
  structure: { newFolders: 'ask', rules: [] },
  review: { batch: 3, maxFixRounds: 2 },
  models: { small: 'auto', medium: 'auto', large: 'auto' },
  summarizer: 'none',
}
```

`templates/leanpowers.json`: same values as `DEFAULTS`, plus `"$schema": "./node_modules/leanpowers/schema/leanpowers.schema.json"`, `commands.test: "npm test"` and one example rule `{ "path": "src/components/**", "allow": ["*.tsx", "*.ts"] }`.

- [ ] **Step 4: Implement `checks/lib/config.mjs`**

- `validate(value, schema, at = '')` supports exactly: `type` (`object`, `array`, `string`, `integer`, `number`, `boolean`), `properties`, `additionalProperties` (`false` or a schema), `required`, `enum`, `items`, `minimum`. Message formats (path segments joined with `.`, array index as `[i]`, top level uses the property name alone):
  - `<path>: expected <type>` (stop checking this node after a type error)
  - `<path>: must be one of <enum joined by ", ">`
  - `<path>: must be >= <minimum>`
  - `<path>: required` (path = parent path + missing key)
  - `<path>: unknown property`
- `deepMerge(base, override)`: returns a new object; plain objects merge recursively; arrays and scalars from `override` replace.
- `defaultUserConfigPath()`: `$XDG_CONFIG_HOME/leanpowers/config.json` if set, else `~/.config/leanpowers/config.json`.
- `loadConfig(root, { userConfigPath = defaultUserConfigPath() } = {})`: for user file then `<root>/leanpowers.json`: skip if missing; on JSON parse error push `<label>: invalid JSON (<message>)` and skip; validate against the schema (read once relative to the module via `new URL('../../schema/leanpowers.schema.json', import.meta.url)`); if errors, push each as `<label>: <error>` and skip the file; otherwise merge. Label = `leanpowers.json` for the project file, `user config` for the user file. Start from a structured clone of `DEFAULTS`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add schema checks/lib/defaults.mjs checks/lib/config.mjs templates/leanpowers.json tests/config.test.mjs
git commit -m "feat: config schema, defaults and loader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Plan parser and doc-lint

**Risk:** high

**Files:**
- Create: `checks/lib/plan.mjs`
- Create: `checks/doc-lint.mjs`
- Test: `tests/plan.test.mjs`
- Test: `tests/doc-lint.test.mjs`

**Interfaces:**
- Consumes: `CheckResult` shape
- Produces:
  - `stripCode(text: string): string` — removes fenced code blocks and inline code spans, keeps line count
  - `parsePlan(text: string): { goal: string, spec: string, globalConstraints: string, tasks: Task[] }`
  - `Task = { n: number, title: string, risk: 'low'|'high'|null, parallel: boolean, files: { kind: 'Create'|'Modify'|'Test', path: string }[], body: string }`
  - `lintSpec(text: string): string[]`, `lintPlan(text: string): string[]`
  - `lintDocs(root: string, config: object): CheckResult` (name `doc-lint`)

Plan format contract (used by plan 2 skills too): task heading `### Task <n>: <title>`; inside the task a line `**Risk:** low|high`, optional `**Parallel:** true`, a `**Files:**` list with items `- Create|Modify|Test: \`<path>\`` (a `:<lines>` suffix on Modify paths is stripped). Header lines `**Goal:** …` and `**Spec:** …`. Section `## Global Constraints` runs until the next `## ` or `---` line.

- [ ] **Step 1: Write the failing tests**

`tests/plan.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, stripCode } from '../checks/lib/plan.mjs';

const PLAN = `# Demo Plan

**Goal:** Build a demo.

**Spec:** \`docs/specs/demo.md\`

## Global Constraints

- Node >= 20
- No deps

---

### Task 1: First thing

**Risk:** low

**Files:**
- Create: \`src/a.mjs\`
- Test: \`tests/a.test.mjs\`

- [ ] **Step 1: Do it**

\`\`\`js
// ### Task 99: not a task inside code
\`\`\`

### Task 2: Second thing

**Risk:** high
**Parallel:** true

**Files:**
- Modify: \`src/b.mjs:10-20\`
`;

test('parsePlan reads header, constraints and tasks', () => {
  const p = parsePlan(PLAN);
  assert.equal(p.goal, 'Build a demo.');
  assert.equal(p.spec, 'docs/specs/demo.md');
  assert.equal(p.globalConstraints, '- Node >= 20\n- No deps');
  assert.equal(p.tasks.length, 2);
  assert.deepEqual(p.tasks[0].files, [
    { kind: 'Create', path: 'src/a.mjs' },
    { kind: 'Test', path: 'tests/a.test.mjs' },
  ]);
  assert.equal(p.tasks[0].risk, 'low');
  assert.equal(p.tasks[0].parallel, false);
  assert.equal(p.tasks[1].risk, 'high');
  assert.equal(p.tasks[1].parallel, true);
  assert.deepEqual(p.tasks[1].files, [{ kind: 'Modify', path: 'src/b.mjs' }]);
});

test('task body runs from heading to next task heading and keeps code', () => {
  const p = parsePlan(PLAN);
  assert.match(p.tasks[0].body, /^### Task 1: First thing/);
  assert.match(p.tasks[0].body, /not a task inside code/);
  assert.doesNotMatch(p.tasks[0].body, /Task 2/);
});

test('stripCode removes fences and inline code but keeps line count', () => {
  const t = 'a `x` b\n```\ncode\n```\nc';
  const s = stripCode(t);
  assert.equal(s.split('\n').length, 5);
  assert.doesNotMatch(s, /x|code/);
  assert.match(s, /c$/);
});
```

`tests/doc-lint.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintSpec, lintPlan, lintDocs } from '../checks/doc-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const GOOD_PLAN = `# P\n\n**Goal:** g\n\n**Spec:** \`s.md\`\n\n## Global Constraints\n\n- c\n\n### Task 1: T\n\n**Risk:** low\n\n**Files:**\n- Create: \`a.mjs\`\n`;

test('spec needs a title and at least two sections', () => {
  assert.deepEqual(lintSpec('# T\n## A\n## B\n'), []);
  assert.deepEqual(lintSpec('## A\n## B\n'), ['missing title (# ...)']);
  assert.deepEqual(lintSpec('# T\n## A\n'), ['needs at least 2 sections (## ...)']);
});

test('placeholder words are flagged with line numbers, code is ignored', () => {
  const errs = lintSpec('# T\n## A\nwe will TBD this\n## B\n`TODO` in code is fine\n```\nTODO\n```\nreally ???\n');
  assert.deepEqual(errs, ['line 3: placeholder "TBD"', 'line 9: placeholder "???"']);
});

test('good plan passes', () => {
  assert.deepEqual(lintPlan(GOOD_PLAN), []);
});

test('plan header and task fields are required', () => {
  const errs = lintPlan('# P\n\n### Task 1: T\n\nno fields\n');
  assert.deepEqual(errs, [
    'missing **Goal:**',
    'missing **Spec:**',
    'missing ## Global Constraints',
    'Task 1: missing **Risk:** low|high',
    'Task 1: no files listed',
  ]);
});

test('plan without tasks is flagged', () => {
  assert.ok(lintPlan('# P\n**Goal:** g\n**Spec:** s\n## Global Constraints\n- c\n').includes('no tasks (### Task N: ...)'));
});

test('lintDocs scans configured spec and plan folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/a.md'), '# T\n## A\n## B\n');
  fs.writeFileSync(path.join(root, 'docs/plans/p.md'), GOOD_PLAN);
  assert.deepEqual(lintDocs(root, DEFAULTS), { name: 'doc-lint', ok: true, messages: [] });
  fs.writeFileSync(path.join(root, 'docs/specs/b.md'), '# T\n');
  const r = lintDocs(root, DEFAULTS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, ['docs/specs/b.md: needs at least 2 sections (## ...)']);
});

test('lintDocs is ok when folders do not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  assert.equal(lintDocs(root, DEFAULTS).ok, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `checks/lib/plan.mjs`**

- `stripCode(text)`: replace every line inside a fenced block (lines from a line starting with three backticks to the next such line, inclusive) with an empty line; then replace inline spans matching a single-backtick pair on one line with nothing.
- `parsePlan(text)`: detect task headings with `/^### Task (\d+):\s*(.+)$/` only on lines that are outside fences (use `stripCode` output line-by-line to decide, but take bodies from the original text). `goal`/`spec` from the first `**Goal:**` / `**Spec:**` line (strip backticks, trim). `globalConstraints`: lines after `## Global Constraints` up to the next line starting with `## ` or equal to `---`, trimmed. For each task: `risk` from `/^\*\*Risk:\*\*\s*(low|high)\b/m` else `null`; `parallel` true iff `/^\*\*Parallel:\*\*\s*true\b/m`; files from lines `/^- (Create|Modify|Test): `([^`]+)`/` with a trailing `:<digits>(-<digits>)?` removed. Only lines outside fences count for risk/parallel/files.

- [ ] **Step 4: Implement `checks/doc-lint.mjs`**

- Placeholder scan on `stripCode(text)`, line by line, in order, words `TBD`, `TODO` (word boundaries) and the literal `???`; message `line <n>: placeholder "<word>"` (first hit per line).
- `lintSpec(text)`: `missing title (# ...)` if no line starts with `# `; `needs at least 2 sections (## ...)` if fewer than 2 lines start with `## `; then placeholder messages.
- `lintPlan(text)`: in this order: `missing **Goal:**`, `missing **Spec:**`, `missing ## Global Constraints`, `no tasks (### Task N: ...)`, per task `Task <n>: missing **Risk:** low|high` and `Task <n>: no files listed`; then placeholder messages.
- `lintDocs(root, config)`: for every `*.md` directly in `config.paths.specs` (lintSpec) and `config.paths.plans` (lintPlan), sorted by name, prefix messages with the posix relative path + `: `. Missing folders are skipped. Returns `{ name: 'doc-lint', ok: messages.length === 0, messages }`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add checks/lib/plan.mjs checks/doc-lint.mjs tests/plan.test.mjs tests/doc-lint.test.mjs
git commit -m "feat: plan parser and doc-lint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Git helpers, scope check and structure check

**Risk:** high

**Files:**
- Create: `checks/lib/git.mjs`
- Create: `checks/scope.mjs`
- Create: `checks/structure.mjs`
- Test: `tests/git.test.mjs`
- Test: `tests/scope-structure.test.mjs`

**Interfaces:**
- Consumes: `matchesAny`, `globToRegExp`, `toPosix` (Task 1)
- Produces:
  - `headSha(root: string): string`
  - `changedFiles(root: string, base: string): string[]` — sorted, posix, committed + uncommitted changes since `base` plus untracked files (respecting `.gitignore`)
  - `dirsAt(root: string, ref: string): Set<string>` — all tracked directories at `ref`, posix
  - `checkScope(changed: string[], allowed: string[], ignore?: string[]): CheckResult` (name `scope`)
  - `checkStructure(opts: { changed: string[], rules: {path:string, allow:string[]}[], newFolders: 'ask'|'allow'|'deny', existingDirs: Set<string>, approvedFolders?: string[] }): CheckResult` (name `structure`)

- [ ] **Step 1: Write the failing tests**

`tests/git.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { headSha, changedFiles, dirsAt } from '../checks/lib/git.mjs';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-git-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  fs.writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
  git('add', '.');
  git('commit', '-qm', 'init');
  return { root, git };
}

test('headSha returns a 40-char sha', () => {
  const { root } = repo();
  assert.match(headSha(root), /^[0-9a-f]{40}$/);
});

test('changedFiles includes committed, modified and untracked, not ignored', () => {
  const { root, git } = repo();
  const base = headSha(root);
  fs.writeFileSync(path.join(root, 'src/b.ts'), 'b');
  git('add', '.');
  git('commit', '-qm', 'b');
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'changed');
  fs.mkdirSync(path.join(root, 'new/deep'), { recursive: true });
  fs.writeFileSync(path.join(root, 'new/deep/c.ts'), 'c');
  fs.mkdirSync(path.join(root, 'ignored'));
  fs.writeFileSync(path.join(root, 'ignored/x.ts'), 'x');
  assert.deepEqual(changedFiles(root, base), ['new/deep/c.ts', 'src/a.ts', 'src/b.ts']);
});

test('dirsAt lists tracked directories', () => {
  const { root } = repo();
  assert.deepEqual([...dirsAt(root, headSha(root))].sort(), ['src']);
});
```

`tests/scope-structure.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkScope } from '../checks/scope.mjs';
import { checkStructure } from '../checks/structure.mjs';

test('scope ok when all changes are allowed', () => {
  assert.deepEqual(checkScope(['src/a.ts', 'tests/a.test.ts'], ['src/a.ts', 'tests/**']), { name: 'scope', ok: true, messages: [] });
});

test('scope lists files outside the brief', () => {
  const r = checkScope(['src/a.ts', 'README.md', 'pkg.json'], ['src/a.ts']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, ['not in brief: README.md', 'not in brief: pkg.json']);
});

test('scope ignores configured paths', () => {
  assert.equal(checkScope(['.leanpowers/runs/x/task-1-report.md'], [], ['.leanpowers/**']).ok, true);
});

const rules = [{ path: 'src/components/**', allow: ['*.tsx', '*.ts'] }];
const existingDirs = new Set(['src', 'src/components']);

test('structure: allowed file types pass', () => {
  const r = checkStructure({ changed: ['src/components/Button.tsx'], rules, newFolders: 'ask', existingDirs });
  assert.deepEqual(r, { name: 'structure', ok: true, messages: [] });
});

test('structure: disallowed file type under a rule fails', () => {
  const r = checkStructure({ changed: ['src/components/Button.css'], rules, newFolders: 'allow', existingDirs });
  assert.deepEqual(r.messages, ['src/components/Button.css: not allowed by rule src/components/** (allow: *.tsx, *.ts)']);
});

test('structure: new folder with ask fails unless approved', () => {
  const changed = ['src/hooks/deep/useX.ts'];
  const r = checkStructure({ changed, rules: [], newFolders: 'ask', existingDirs });
  assert.deepEqual(r.messages, ['new folder needs approval: src/hooks', 'new folder needs approval: src/hooks/deep']);
  const ok = checkStructure({ changed, rules: [], newFolders: 'ask', existingDirs, approvedFolders: ['src/hooks/deep'] });
  assert.equal(ok.ok, true);
});

test('structure: deny and allow policies', () => {
  const changed = ['lib/x.ts'];
  assert.deepEqual(
    checkStructure({ changed, rules: [], newFolders: 'deny', existingDirs, approvedFolders: ['lib'] }).messages,
    ['new folder not allowed: lib'],
  );
  assert.equal(checkStructure({ changed, rules: [], newFolders: 'allow', existingDirs }).ok, true);
});

test('structure: files in the root create no folder', () => {
  assert.equal(checkStructure({ changed: ['README.md'], rules: [], newFolders: 'deny', existingDirs }).ok, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `checks/lib/git.mjs`**

Use `execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })`.
- `headSha`: `git rev-parse HEAD`.
- `changedFiles`: union of `git diff --name-only <base>` and `git ls-files --others --exclude-standard`; split lines, drop empty, posix, dedupe, sort.
- `dirsAt`: `git ls-tree -r -d --name-only <ref>` → Set.

- [ ] **Step 4: Implement `checks/scope.mjs` and `checks/structure.mjs`**

- `checkScope(changed, allowed, ignore = [])`: for each changed file not matching `ignore` and not matching `allowed` → `not in brief: <file>` (input order).
- `checkStructure({ changed, rules, newFolders, existingDirs, approvedFolders = [] })`:
  1. Rule check per file: for every rule whose `path` glob matches the file, the basename must match one of `allow`; else `<file>: not allowed by rule <path> (allow: <allow joined ", ">)`.
  2. New folder check: collect every ancestor directory of every changed file (e.g. `a/b/c.ts` → `a`, `a/b`) that is not in `existingDirs`; dedupe, sort. Policy `allow` → nothing. `deny` → `new folder not allowed: <dir>` for each. `ask` → `new folder needs approval: <dir>` for each dir that is not in `approvedFolders` and not an ancestor of an approved folder.
  3. Rule messages first, then folder messages.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add checks/lib/git.mjs checks/scope.mjs checks/structure.mjs tests/git.test.mjs tests/scope-structure.test.mjs
git commit -m "feat: git helpers, scope and structure checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gates with output compression and optional summarizer

**Risk:** low

**Files:**
- Create: `checks/gates.mjs`
- Test: `tests/gates.test.mjs`

**Interfaces:**
- Consumes: `compress` (Task 1)
- Produces: `runGates(config: object, root: string): CheckResult[]` — names `gates:test`, `gates:typecheck`, `gates:lint`

- [ ] **Step 1: Write the failing test**

`tests/gates.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGates } from '../checks/gates.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-gates-'));
const script = (name, body) => {
  const p = path.join(root, name);
  fs.writeFileSync(p, body);
  return `node "${p}"`;
};
const cfg = (commands, extra = {}) => ({ ...DEFAULTS, ...extra, commands: { ...DEFAULTS.commands, ...commands } });

test('missing test command is a failure, empty typecheck/lint are skipped', () => {
  assert.deepEqual(runGates(cfg({}), root), [
    { name: 'gates:test', ok: false, messages: ['no test command configured'] },
  ]);
});

test('passing commands are ok with no messages', () => {
  const ok = script('ok.mjs', 'console.log("all good")');
  assert.deepEqual(runGates(cfg({ test: ok, lint: ok }), root), [
    { name: 'gates:test', ok: true, messages: [] },
    { name: 'gates:lint', ok: true, messages: [] },
  ]);
});

test('failing command keeps only relevant, deduplicated lines', () => {
  const bad = script('bad.mjs', `
    console.log('setup noise');
    console.log('not ok 1 - adds numbers');
    console.error('AssertionError: expected 3');
    console.error('AssertionError: expected 3');
    process.exit(1);`);
  const [r] = runGates(cfg({ test: bad }), root);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, ['not ok 1 - adds numbers', 'AssertionError: expected 3']);
});

test('failure without matching lines falls back to the last lines', () => {
  const bad = script('quiet.mjs', 'console.log("something odd"); process.exit(2);');
  const [r] = runGates(cfg({ test: bad }), root);
  assert.deepEqual(r.messages, ['something odd']);
});

test('summarizer is used only for long relevant output', () => {
  const long = script('long.mjs', 'for (let i = 0; i < 80; i++) console.log("error " + i); process.exit(1);');
  const sum = script('sum.mjs', 'process.stdin.resume(); process.stdin.on("end", () => console.log("SUMMARY: 80 errors"));');
  const [withSum] = runGates(cfg({ test: long }, { summarizer: sum }), root);
  assert.deepEqual(withSum.messages, ['SUMMARY: 80 errors']);
  const [without] = runGates(cfg({ test: long }), root);
  assert.equal(without.messages.length, 21);
});

test('failing summarizer falls back to compression with a note', () => {
  const long = script('long2.mjs', 'for (let i = 0; i < 80; i++) console.log("error " + i); process.exit(1);');
  const broken = script('broken.mjs', 'process.exit(3);');
  const [r] = runGates(cfg({ test: long }, { summarizer: broken }), root);
  assert.equal(r.messages[0], 'summarizer failed, showing compressed output');
  assert.equal(r.messages[1], 'error 0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `checks/gates.mjs`**

- For `test`, `typecheck`, `lint` in that order: empty `test` → `{ ok:false, messages:['no test command configured'] }`; empty `typecheck`/`lint` → no result.
- Run with `spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })`. `ok = status === 0`; ok → `messages: []`.
- On failure: `raw` = stdout + `\n` + stderr; `lines` = non-empty lines; `relevant` = lines matching `/error|fail|not ok|✖|assert|expected/i`; if none, `relevant` = last 20 lines.
- If `config.summarizer !== 'none'` and `relevant.length > 60`: run the summarizer with `spawnSync(config.summarizer, { shell: true, input: raw, encoding: 'utf8' })`; status 0 → `messages = compress(stdout lines)`; otherwise `messages = ['summarizer failed, showing compressed output', ...compress(relevant)]`.
- Else `messages = compress(relevant)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add checks/gates.mjs tests/gates.test.mjs
git commit -m "feat: gates with compressed output and optional summarizer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: skill-lint

**Risk:** low

**Files:**
- Create: `checks/skill-lint.mjs`
- Test: `tests/skill-lint.test.mjs`

**Interfaces:**
- Consumes: `CheckResult` shape
- Produces:
  - `parseFrontmatter(text: string): { data: Record<string,string>, body: string } | null`
  - `countWords(text: string): number`
  - `estimateTokens(text: string): number` — `Math.ceil(countWords(text) * 4 / 3)`
  - `lintSkillFile(file: string, opts: { name: string, maxWords: number }): string[]`
  - `lintSkills(root: string, config: object): CheckResult` (name `skill-lint`)

Limits from the spec: `skills/<name>/SKILL.md` body ≤ 600 words; `agents/<name>.md` body ≤ 400 words; `skills/start/SKILL.md` body ≤ 150 estimated tokens; frontmatter `description` ≤ 60 words.

- [ ] **Step 1: Write the failing test**

`tests/skill-lint.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter, countWords, estimateTokens, lintSkills } from '../checks/skill-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const words = (n) => Array.from({ length: n }, () => 'w').join(' ');
const skill = (name, body, desc = 'Use when testing.') => `---\nname: ${name}\ndescription: ${desc}\n---\n${body}\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-skill-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

test('parseFrontmatter and counting helpers', () => {
  assert.deepEqual(parseFrontmatter('---\nname: a\ndescription: b c\n---\nbody'), { data: { name: 'a', description: 'b c' }, body: 'body' });
  assert.equal(parseFrontmatter('no frontmatter'), null);
  assert.equal(countWords(' a  b\nc '), 3);
  assert.equal(estimateTokens(words(3)), 4);
});

test('valid skills, agents and start text pass', () => {
  const root = project({
    'skills/plan/SKILL.md': skill('plan', 'See [details](details/x.md).'),
    'skills/plan/details/x.md': 'more',
    'skills/start/SKILL.md': skill('start', words(100)),
    'agents/implementer.md': skill('implementer', words(400)),
  });
  assert.deepEqual(lintSkills(root, DEFAULTS), { name: 'skill-lint', ok: true, messages: [] });
});

test('limits, names, descriptions and links are enforced', () => {
  const root = project({
    'skills/plan/SKILL.md': skill('wrong', words(601) + ' [x](details/missing.md)', words(61)),
    'skills/start/SKILL.md': skill('start', words(120)),
    'skills/bare/SKILL.md': 'no frontmatter',
    'agents/reviewer.md': skill('reviewer', words(401)),
  });
  const r = lintSkills(root, DEFAULTS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, [
    'agents/reviewer.md: 401 words (max 400)',
    'skills/bare/SKILL.md: missing frontmatter',
    'skills/plan/SKILL.md: name "wrong" must be "plan"',
    'skills/plan/SKILL.md: description 61 words (max 60)',
    'skills/plan/SKILL.md: 602 words (max 600)',
    'skills/plan/SKILL.md: broken link details/missing.md',
    'skills/start/SKILL.md: start text ~160 tokens (max 150)',
  ]);
});

test('extraSkillDirs are linted too', () => {
  const root = project({ 'extra/foo/SKILL.md': skill('foo', words(700)) });
  const r = lintSkills(root, { ...DEFAULTS, extraSkillDirs: ['extra'] });
  assert.deepEqual(r.messages, ['extra/foo/SKILL.md: 700 words (max 600)']);
});

test('no skills at all is ok', () => {
  assert.equal(lintSkills(project({}), DEFAULTS).ok, true);
});
```

Note on the expected counts: `words(601) + ' [x](details/missing.md)'` is 602 words (the link counts as one word). Implement `countWords` as a whitespace-split count of the body.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `checks/skill-lint.mjs`**

- `parseFrontmatter(text)`: text must start with `---\n`; frontmatter ends at the next line equal to `---`; each line `key: value` (split at the first `: `); `body` = rest after the closing line, trimmed of a single leading newline. Return `null` if no frontmatter.
- `lintSkillFile(file, { name, maxWords })`, messages in this order: `missing frontmatter` (then stop), `name "<x>" must be "<name>"`, `description missing` or `description <n> words (max 60)`, `<n> words (max <maxWords>)` for the body, `broken link <target>` for each markdown link `](target)` whose target is not `http(s):` / `#…` and does not exist relative to the file.
- `lintSkills(root, config)`: files = `skills/*/SKILL.md` (max 600), every `<dir>/*/SKILL.md` for each `config.extraSkillDirs` entry (max 600), `agents/*.md` (max 400, name = file basename without `.md`). For `skills/start/SKILL.md` additionally `start text ~<estimateTokens(body)> tokens (max 150)` when above 150. Prefix messages with the posix path relative to `root` + `: `; sort all messages by path (stable within a file). Missing folders are skipped.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add checks/skill-lint.mjs tests/skill-lint.test.mjs
git commit -m "feat: skill-lint with word and token limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Task briefs and run metrics

**Risk:** low

**Files:**
- Create: `checks/brief.mjs`
- Create: `checks/metrics.mjs`
- Test: `tests/brief.test.mjs`
- Test: `tests/metrics.test.mjs`

**Interfaces:**
- Consumes: `parsePlan` (Task 3), `headSha` (Task 4), `matchesAny`/`globToRegExp` (Task 1), `countWords` (Task 6)
- Produces:
  - `runDirFor(root: string, config: object, planPath: string): string` — `<root>/<paths.runs>/<plan basename without .md>`, created with a `.gitignore` containing `*`
  - `buildBrief(plan: ParsedPlan, n: number, config: object, runDirRel: string): string`
  - `writeBrief(root: string, planPath: string, n: number, config: object): string` — writes `task-<n>-brief.md` and `task-<n>-base.txt` (HEAD sha), returns brief path
  - `collectMetrics(runDir: string): { briefs: number, reports: number, reviews: number, briefWords: number, reportWords: number, reviewWords: number }`
  - `writeMetrics(runDir: string): object` — replaces or appends the `## Metrics` section in `progress.md`, returns the metrics

- [ ] **Step 1: Write the failing tests**

`tests/brief.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePlan } from '../checks/lib/plan.mjs';
import { buildBrief, runDirFor, writeBrief } from '../checks/brief.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- Node >= 20\n\n---\n\n### Task 1: Button\n\n**Risk:** high\n\n**Files:**\n- Create: \`src/components/Button.tsx\`\n- Test: \`tests/button.test.ts\`\n\n- [ ] **Step 1: do**\n\n### Task 2: Other\n\n**Risk:** low\n\n**Files:**\n- Create: \`lib/x.ts\`\n`;
const config = { ...DEFAULTS, structure: { newFolders: 'ask', rules: [
  { path: 'src/components/**', allow: ['*.tsx'] },
  { path: 'lib/**', allow: ['*.ts'] },
] } };

test('brief contains only what the implementer needs', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, '.leanpowers/runs/demo');
  assert.match(b, /^# Task 1 brief: Button/);
  assert.match(b, /\*\*Risk:\*\* high/);
  assert.match(b, /## Allowed files\n\n- src\/components\/Button\.tsx\n- tests\/button\.test\.ts/);
  assert.match(b, /## Global constraints\n\n- Node >= 20/);
  assert.match(b, /- src\/components\/\*\* → allow \*\.tsx/);
  assert.doesNotMatch(b, /lib\/\*\*/);
  assert.match(b, /New folders: ask/);
  assert.match(b, /- \[ \] \*\*Step 1: do\*\*/);
  assert.doesNotMatch(b, /Task 2/);
  assert.match(b, /Write your report \(max 150 words\) to `\.leanpowers\/runs\/demo\/task-1-report\.md`/);
});

test('unknown task number throws', () => {
  assert.throws(() => buildBrief(parsePlan(PLAN), 9, config, 'r'), /Task 9 not found/);
});

test('writeBrief writes brief and base sha into a self-ignoring run dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/2026-01-01-demo.md'), PLAN);
  git('add', '.'); git('commit', '-qm', 'init');
  const briefPath = writeBrief(root, 'docs/plans/2026-01-01-demo.md', 1, config);
  const runDir = runDirFor(root, config, 'docs/plans/2026-01-01-demo.md');
  assert.equal(briefPath, path.join(runDir, 'task-1-brief.md'));
  assert.equal(runDir, path.join(root, '.leanpowers/runs/2026-01-01-demo'));
  assert.equal(fs.readFileSync(path.join(runDir, '.gitignore'), 'utf8'), '*\n');
  assert.match(fs.readFileSync(path.join(runDir, 'task-1-base.txt'), 'utf8').trim(), /^[0-9a-f]{40}$/);
  assert.match(fs.readFileSync(briefPath, 'utf8'), /Task 1 brief: Button/);
});
```

`tests/metrics.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectMetrics, writeMetrics } from '../checks/metrics.mjs';

function runDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-metrics-'));
  fs.writeFileSync(path.join(d, 'task-1-brief.md'), 'a b c');
  fs.writeFileSync(path.join(d, 'task-2-brief.md'), 'a b');
  fs.writeFileSync(path.join(d, 'task-1-report.md'), 'x y z w');
  fs.writeFileSync(path.join(d, 'review-1-3.md'), 'r');
  fs.writeFileSync(path.join(d, 'progress.md'), '# Progress\n\nTask 1 done\n');
  return d;
}

test('collectMetrics counts files and words', () => {
  assert.deepEqual(collectMetrics(runDir()), { briefs: 2, reports: 1, reviews: 1, briefWords: 5, reportWords: 4, reviewWords: 1 });
});

test('writeMetrics appends once and replaces on rerun', () => {
  const d = runDir();
  writeMetrics(d);
  fs.writeFileSync(path.join(d, 'task-2-report.md'), 'one two');
  writeMetrics(d);
  const text = fs.readFileSync(path.join(d, 'progress.md'), 'utf8');
  assert.equal(text.match(/## Metrics/g).length, 1);
  assert.match(text, /^# Progress\n\nTask 1 done\n/);
  assert.match(text, /- subagent reports: 2 \(6 words\)/);
  assert.match(text, /- briefs: 2 \(5 words\)/);
  assert.match(text, /- reviews: 1 \(1 words\)/);
});

test('writeMetrics creates progress.md if missing', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-metrics-'));
  writeMetrics(d);
  assert.match(fs.readFileSync(path.join(d, 'progress.md'), 'utf8'), /## Metrics/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `checks/brief.mjs`**

- `runDirFor`: path as described; `mkdirSync(recursive)`; write `.gitignore` with `*\n` if missing.
- `buildBrief(plan, n, config, runDirRel)`: throw `Error('Task <n> not found')` if missing. Output, sections separated by one blank line:
  ```
  # Task <n> brief: <title>

  **Risk:** <risk> · Plan goal: <plan.goal>

  ## Allowed files

  - <path>            (one line per task file, in plan order)

  ## Global constraints

  <plan.globalConstraints>

  ## Structure rules

  - <rule.path> → allow <allow joined ", ">   (only rules whose path glob matches at least one allowed file)
  New folders: <config.structure.newFolders>

  ## Task

  <task.body without its first heading line, trimmed>

  ## When done

  Run `leanpowers check --plan <plan path> --task <n>`. Write your report (max 150 words) to `<runDirRel>/task-<n>-report.md`: what changed, test result, open questions.
  ```
  The plan path in the last section comes from an optional 5th parameter `planRel` (default `the plan`); `writeBrief` passes it.
- `writeBrief(root, planPath, n, config)`: read and parse plan (relative to `root`), compute run dir, write brief and `task-<n>-base.txt` (`headSha(root)` + `\n`), return brief path.

- [ ] **Step 4: Implement `checks/metrics.mjs`**

- `collectMetrics(runDir)`: files `task-*-brief.md`, `task-*-report.md`, `review-*.md`; counts and summed `countWords`.
- `writeMetrics(runDir)`: section text
  ```
  ## Metrics

  - briefs: <briefs> (<briefWords> words)
  - subagent reports: <reports> (<reportWords> words)
  - reviews: <reviews> (<reviewWords> words)
  ```
  If `progress.md` contains `## Metrics`, replace from that heading to the next `## ` heading or end of file; else append after one blank line. Create the file with `# Progress\n` if missing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add checks/brief.mjs checks/metrics.mjs tests/brief.test.mjs tests/metrics.test.mjs
git commit -m "feat: task briefs and run metrics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `check` orchestration, CLI and self-check

**Risk:** high

**Files:**
- Create: `checks/check.mjs`
- Create: `bin/leanpowers.mjs`
- Create: `leanpowers.json`
- Test: `tests/check.test.mjs`
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `loadConfig` (2), `lintDocs` (3), `changedFiles`, `dirsAt`, `checkScope`, `checkStructure` (4), `runGates` (5), `lintSkills` (6), `runDirFor`, `writeBrief`, `writeMetrics` (7), `parsePlan` (3), `formatResults` (1)
- Produces:
  - `runCheck(opts: { root: string, plan?: string, task?: number, all?: boolean, userConfigPath?: string }): { ok: boolean, text: string }`
  - CLI `leanpowers <command>`: `check [--all] [--plan <file> --task <n>]`, `brief --plan <file> --task <n>`, `metrics --plan <file>`, `config`; exit code 0 on success, 1 on failure, 2 on usage error

- [ ] **Step 1: Write the failing tests**

`tests/check.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runCheck } from '../checks/check.mjs';
import { writeBrief } from '../checks/brief.mjs';
import { loadConfig } from '../checks/lib/config.mjs';

const NO_USER = path.join(os.tmpdir(), 'lp-none', 'config.json');
const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- c\n\n### Task 1: A\n\n**Risk:** low\n\n**Files:**\n- Create: \`src/a.ts\`\n`;

function project(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-check-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/.keep'), '');
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, '.gitignore'), '.leanpowers/\n');
  git('add', '.'); git('commit', '-qm', 'init');
  return root;
}

test('gates only: one line on success', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, userConfigPath: NO_USER });
  assert.deepEqual(r, { ok: true, text: '✔ leanpowers check: ok (gates:test)' });
});

test('task mode adds scope and structure against the brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  const bad = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /✖ scope\n  not in brief: extra\/b\.ts/);
  assert.match(bad.text, /✖ structure\n  new folder needs approval: extra/);
});

test('task mode without a brief is a clear failure', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /no brief for task 1, run: leanpowers brief --plan docs\/plans\/demo\.md --task 1/);
});

test('--all adds doc-lint and skill-lint', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(r.text, '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
});

test('invalid config is a warning, defaults are used', () => {
  const root = project({ review: { batch: 'x' } });
  const r = runCheck({ root, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /no test command configured/);
  assert.match(r.text, /⚠ leanpowers\.json: review\.batch: expected integer/);
});
```

`tests/cli.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bin = fileURLToPath(new URL('../bin/leanpowers.mjs', import.meta.url));
const repoRoot = path.dirname(path.dirname(bin));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { cwd: repoRoot, encoding: 'utf8' });

test('unknown command prints usage and exits 2', () => {
  const r = run('nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: leanpowers <check\|brief\|metrics\|config>/);
});

test('config prints merged JSON', () => {
  const r = run('config');
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).paths.specs, 'docs/specs');
});

test('brief without --task is a usage error', () => {
  assert.equal(run('brief', '--plan', 'x.md').status, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `checks/check.mjs`**

`runCheck({ root, plan, task, all, userConfigPath })`:
1. `{ config, errors } = loadConfig(root, { userConfigPath })` — `errors` become warnings.
2. `results = runGates(config, root)`.
3. If `plan` and `task`: run dir via `runDirFor`; if `task-<n>-base.txt` is missing → push `{ name: 'scope', ok: false, messages: ['no brief for task <n>, run: leanpowers brief --plan <plan> --task <n>'] }` and skip structure. Else `base` from that file; `changed = changedFiles(root, base)`; `allowed` = task file paths from `parsePlan`; push `checkScope(changed, allowed, [config.paths.runs + '/**'])`; push `checkStructure({ changed, rules: config.structure.rules, newFolders: config.structure.newFolders, existingDirs: dirsAt(root, base), approvedFolders: <dirnames of the task's Create paths> })`.
4. If `all`: push `lintDocs(root, config)` and `lintSkills(root, config)`.
5. Return `formatResults(results, errors)`.

- [ ] **Step 4: Implement `bin/leanpowers.mjs`**

- Shebang `#!/usr/bin/env node`. Minimal argv parser: `--all` flag, `--plan <v>`, `--task <int>`.
- `check` → print `runCheck({ root: process.cwd(), ... }).text`, exit 0/1.
- `brief` → requires `--plan` and `--task` (else usage, exit 2); load config; print the brief path relative to cwd (posix); exit 0.
- `metrics` → requires `--plan`; `writeMetrics(runDirFor(...))`; print one line `metrics: <briefs> briefs, <reports> reports, <reviews> reviews`.
- `config` → print `JSON.stringify(config, null, 2)`; print each error to stderr; exit 0.
- Anything else → stderr `usage: leanpowers <check|brief|metrics|config> [--all] [--plan <file>] [--task <n>]`, exit 2.

- [ ] **Step 5: Add the repository's own config**

`leanpowers.json` in the repo root:
```json
{
  "$schema": "./schema/leanpowers.schema.json",
  "commands": { "test": "npm test" },
  "structure": {
    "newFolders": "ask",
    "rules": [
      { "path": "checks/**", "allow": ["*.mjs"] },
      { "path": "tests/**", "allow": ["*.mjs"] },
      { "path": "schema/**", "allow": ["*.json"] }
    ]
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Self-check on this repository**

Run: `node bin/leanpowers.mjs check --all`
Expected: exactly one line `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`. If doc-lint flags the spec or this plan, fix the document (not the linter), unless the linter contradicts the spec.

- [ ] **Step 8: Commit**

```bash
git add checks/check.mjs bin/leanpowers.mjs leanpowers.json tests/check.test.mjs tests/cli.test.mjs
git commit -m "feat: check orchestration and leanpowers CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Note: `tests/check.test.mjs` only uses temporary projects, so `npm test` never calls itself recursively.
