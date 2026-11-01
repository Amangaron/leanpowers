import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { headSha, changedFiles, dirsAt, currentBranch, defaultBranch, defaultBranchWarning } from '../checks/lib/git.mjs';

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

const WARNING = (name) => `on default branch ${name}: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch`;

function repoOn(branch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-branch-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q', '-b', branch);
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(root, 'a.txt'), 'a');
  git('add', '.');
  git('commit', '-qm', 'init');
  return { root, git };
}

test('main is the default branch without a remote; only main gets the warning', () => {
  const { root, git } = repoOn('main');
  assert.equal(currentBranch(root), 'main');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), WARNING('main'));
  git('checkout', '-q', '-b', 'feat/x');
  assert.equal(currentBranch(root), 'feat/x');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('master is the default branch when main does not exist; main wins when both exist', () => {
  const { root, git } = repoOn('master');
  assert.equal(defaultBranch(root), 'master');
  assert.equal(defaultBranchWarning(root), WARNING('master'));
  git('branch', 'main');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('a remote HEAD names the default branch, origin first', () => {
  const { root, git } = repoOn('main');
  git('remote', 'add', 'a-remote', path.join(root, 'nowhere-a'));
  git('remote', 'add', 'origin', path.join(root, 'nowhere-o'));
  git('update-ref', 'refs/remotes/a-remote/alpha', 'HEAD');
  git('symbolic-ref', 'refs/remotes/a-remote/HEAD', 'refs/remotes/a-remote/alpha');
  git('update-ref', 'refs/remotes/origin/trunk', 'HEAD');
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  assert.equal(defaultBranch(root), 'trunk');
  assert.equal(defaultBranchWarning(root), null);
  git('checkout', '-q', '-b', 'trunk');
  assert.equal(defaultBranchWarning(root), WARNING('trunk'));
  git('symbolic-ref', '--delete', 'refs/remotes/origin/HEAD');
  assert.equal(defaultBranch(root), 'alpha');
  assert.equal(defaultBranchWarning(root), null);
  git('symbolic-ref', '--delete', 'refs/remotes/a-remote/HEAD');
  assert.equal(defaultBranch(root), 'main');
});

test('detached HEAD has no current branch and no warning', () => {
  const { root, git } = repoOn('main');
  git('checkout', '-q', '--detach');
  assert.equal(currentBranch(root), null);
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('no determinable default branch, no git and a missing folder give null, never throw', () => {
  const { root } = repoOn('dev');
  assert.equal(currentBranch(root), 'dev');
  assert.equal(defaultBranch(root), null);
  assert.equal(defaultBranchWarning(root), null);
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-nogit-'));
  assert.equal(currentBranch(plain), null);
  assert.equal(defaultBranch(plain), null);
  assert.equal(defaultBranchWarning(plain), null);
  assert.equal(defaultBranchWarning(path.join(plain, 'missing')), null);
});
