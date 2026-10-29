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
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
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

test('changedFiles and dirsAt are relative to root when root is a subdirectory', () => {
  const { root, git } = repo();
  fs.mkdirSync(path.join(root, 'pkg/lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'pkg/lib/x.ts'), 'x');
  git('add', '.');
  git('commit', '-qm', 'pkg');
  const pkg = path.join(root, 'pkg');
  const base = headSha(pkg);
  fs.writeFileSync(path.join(root, 'top.txt'), 't');
  fs.writeFileSync(path.join(root, 'src/b.ts'), 'b');
  fs.writeFileSync(path.join(pkg, 'lib/y.ts'), 'y');
  fs.writeFileSync(path.join(pkg, 'z.ts'), 'z');
  fs.writeFileSync(path.join(pkg, 'lib/x.ts'), 'changed');
  assert.deepEqual(changedFiles(pkg, base), ['lib/x.ts', 'lib/y.ts', 'z.ts']);
  assert.deepEqual([...dirsAt(pkg, base)].sort(), ['lib']);
  assert.equal(headSha(pkg), headSha(root));
});
