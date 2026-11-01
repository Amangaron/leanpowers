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

test('scope names leanpowers.json as the project configuration', () => {
  assert.deepEqual(checkScope(['leanpowers.json', 'pkg/leanpowers.json'], []).messages, [
    "not in brief: leanpowers.json (project configuration: change it only with the user's yes)",
    'not in brief: pkg/leanpowers.json',
  ]);
  assert.equal(checkScope(['leanpowers.json'], ['leanpowers.json']).ok, true);
});

test('structure: own folders, their parents and children are never new, in ask and deny', () => {
  const own = ['docs/specs', 'docs/plans', 'docs/reports', '.leanpowers/runs'];
  const changed = ['docs/specs/s.md', '.leanpowers/runs/p/x.md', 'docs/neu/x.md'];
  for (const newFolders of ['ask', 'deny']) {
    const r = checkStructure({ changed, rules: [], newFolders, existingDirs: new Set(), ownFolders: own });
    assert.deepEqual(r.messages, [newFolders === 'ask' ? 'new folder needs approval: docs/neu' : 'new folder not allowed: docs/neu'], newFolders);
  }
});
