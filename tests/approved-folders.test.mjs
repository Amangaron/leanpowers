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
