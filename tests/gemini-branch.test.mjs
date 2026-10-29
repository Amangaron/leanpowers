import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareGeminiBranch } from '../scripts/gemini-branch.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function makeRepo({ commitDist = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-gembranch-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'T');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'source.md'), 'source\n');
  fs.mkdirSync(path.join(root, 'dist', 'gemini-extension', 'commands'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'gemini-extension', 'gemini-extension.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'dist', 'gemini-extension', 'commands', 'a.toml'), 'a = 1\n');
  git(root, 'add', commitDist ? '.' : 'skills');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

test('branch root is the built extension; current branch, index and tree untouched', () => {
  const root = makeRepo();
  const head = git(root, 'rev-parse', 'HEAD');
  const r = prepareGeminiBranch(root);
  assert.equal(r.branch, 'gemini-extension');
  assert.equal(r.commit, git(root, 'rev-parse', 'gemini-extension'));
  assert.deepEqual(git(root, 'ls-tree', '-r', '--name-only', 'gemini-extension').split('\n'),
    ['commands/a.toml', 'gemini-extension.json']);
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.equal(git(root, 'rev-parse', 'HEAD'), head);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(git(root, 'log', '-1', '--format=%s', 'gemini-extension'),
    `release: gemini-extension from ${git(root, 'rev-parse', '--short', 'HEAD')}`);
  assert.equal(git(root, 'rev-list', '--count', 'gemini-extension'), '1');
});

test('a second run adds exactly one commit whose parent is the first', () => {
  const root = makeRepo();
  const first = prepareGeminiBranch(root).commit;
  fs.writeFileSync(path.join(root, 'dist', 'gemini-extension', 'new.txt'), 'n\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'dist change');
  const second = prepareGeminiBranch(root).commit;
  assert.notEqual(second, first);
  assert.equal(git(root, 'rev-parse', `${second}^`), first);
  assert.equal(git(root, 'rev-list', '--count', 'gemini-extension'), '2');
  assert.match(git(root, 'ls-tree', '-r', '--name-only', 'gemini-extension'), /^new\.txt$/m);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('a run with an unchanged tree still adds one commit (one per run)', () => {
  const root = makeRepo();
  const first = prepareGeminiBranch(root).commit;
  const second = prepareGeminiBranch(root).commit;
  assert.equal(git(root, 'rev-parse', `${second}^`), first);
});

test('refuses when dist/gemini-extension is not in HEAD', () => {
  const root = makeRepo({ commitDist: false });
  assert.throws(() => prepareGeminiBranch(root), /dist\/gemini-extension is not committed/);
  assert.equal(git(root, 'branch', '--list', 'gemini-extension'), '');
});

test('refuses when dist/gemini-extension has uncommitted changes', () => {
  const root = makeRepo();
  fs.appendFileSync(path.join(root, 'dist', 'gemini-extension', 'gemini-extension.json'), 'x\n');
  assert.throws(() => prepareGeminiBranch(root), /uncommitted changes/);
  assert.equal(git(root, 'branch', '--list', 'gemini-extension'), '');
});

test('refuses when the target branch is the checked-out branch', () => {
  const root = makeRepo();
  assert.throws(() => prepareGeminiBranch(root, { branch: 'main' }), /checked-out/);
});

test('refuses when the branch is checked out in a linked worktree', () => {
  const root = makeRepo();
  prepareGeminiBranch(root);
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-gemwt-')) + '/wt';
  git(root, 'worktree', 'add', '-q', wt, 'gemini-extension');
  const before = git(root, 'rev-parse', 'gemini-extension');
  assert.throws(() => prepareGeminiBranch(root), /checked-out/);
  assert.equal(git(root, 'rev-parse', 'gemini-extension'), before);
  assert.equal(git(wt, 'status', '--porcelain'), '');
});

test('refuses to add to an existing branch that is not a gemini extension', () => {
  const root = makeRepo();
  git(root, 'branch', 'gemini-extension', 'main');
  const before = git(root, 'rev-parse', 'gemini-extension');
  assert.throws(() => prepareGeminiBranch(root), /no gemini-extension\.json/);
  assert.equal(git(root, 'rev-parse', 'gemini-extension'), before);
});
