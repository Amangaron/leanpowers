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

test('changedFiles lists both paths of a rename', () => {
  const { root, git } = repo();
  const base = headSha(root);
  fs.mkdirSync(path.join(root, 'sub'));
  git('mv', 'src/a.ts', 'sub/new.ts');
  git('commit', '-qm', 'rename');
  assert.deepEqual(changedFiles(root, base), ['src/a.ts', 'sub/new.ts']);
});

test('changedFiles lists a committed deletion', () => {
  const { root, git } = repo();
  const base = headSha(root);
  git('rm', '-q', 'src/a.ts');
  git('commit', '-qm', 'delete');
  assert.deepEqual(changedFiles(root, base), ['src/a.ts']);
});

test('changedFiles and dirsAt are toplevel-relative when root is a subdirectory', () => {
  const { root } = repo();
  const base = headSha(root);
  fs.writeFileSync(path.join(root, 'top.txt'), 't');
  fs.writeFileSync(path.join(root, 'src/b.ts'), 'b');
  const sub = path.join(root, 'src');
  assert.deepEqual(changedFiles(sub, base), changedFiles(root, base));
  assert.deepEqual(changedFiles(sub, base), ['src/b.ts', 'top.txt']);
  assert.deepEqual([...dirsAt(sub, base)].sort(), ['src']);
  assert.equal(headSha(sub), headSha(root));
});
