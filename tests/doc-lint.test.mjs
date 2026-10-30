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

test('CRLF plan passes', () => {
  assert.deepEqual(lintPlan(GOOD_PLAN.replaceAll('\n', '\r\n')), []);
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

test('lintDocs skips files matched by docLint.ignore', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/old.md'), '# Old\n');
  fs.writeFileSync(path.join(root, 'docs/plans/new.md'), GOOD_PLAN);
  fs.writeFileSync(path.join(root, 'docs/specs/old-design.md'), '# T\n');
  const all = { ...DEFAULTS, docLint: { ignore: ['docs/plans/old.md', 'docs/specs/old-*.md'] } };
  assert.deepEqual(lintDocs(root, all), { name: 'doc-lint', ok: true, messages: [] });
  const some = { ...DEFAULTS, docLint: { ignore: ['docs/plans/old.md'] } };
  assert.deepEqual(lintDocs(root, some).messages, ['docs/specs/old-design.md: needs at least 2 sections (## ...)']);
});

test('lintDocs with an empty or missing ignore list lints every file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/b.md'), '# T\n');
  const expected = ['docs/specs/b.md: needs at least 2 sections (## ...)'];
  assert.deepEqual(lintDocs(root, DEFAULTS).messages, expected);
  const { docLint, ...withoutDocLint } = DEFAULTS;
  assert.deepEqual(lintDocs(root, withoutDocLint).messages, expected);
});
