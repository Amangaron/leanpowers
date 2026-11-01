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
