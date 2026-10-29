import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject, proposeConfig, applyTemplate } from '../checks/init.mjs';
import { validate } from '../checks/lib/config.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = JSON.parse(fs.readFileSync(path.join(repo, 'schema/leanpowers.schema.json'), 'utf8'));
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-init-'));
  for (const [rel, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), c);
  }
  return root;
}

test('scan finds npm scripts and per-folder file types', () => {
  const root = project({
    'package.json': JSON.stringify({ scripts: { test: 'node --test', typecheck: 'tsc' } }),
    'src/a.ts': '', 'src/b.tsx': '', 'src/deep/c.ts': '',
    'tests/a.test.ts': '', 'node_modules/x/y.js': '', '.git/HEAD': '',
  });
  const s = scanProject(root);
  assert.deepEqual(s.commands, { test: 'npm test', typecheck: 'npm run typecheck', lint: '' });
  assert.deepEqual(s.structure.rules, [
    { path: 'src/**', allow: ['*.ts', '*.tsx'] },
    { path: 'tests/**', allow: ['*.ts'] },
  ]);
});

test('Makefile targets are used without package.json', () => {
  const root = project({ Makefile: 'test:\n\tgo test ./...\nlint:\n\tgolangci-lint run\n' });
  assert.deepEqual(scanProject(root).commands, { test: 'make test', typecheck: '', lint: 'make lint' });
});

test('proposed config is schema-valid', () => {
  const root = project({ 'src/a.js': '' });
  assert.deepEqual(validate(proposeConfig(root), schema), []);
});

test('template creates missing files only', () => {
  const root = project({ 'leanpowers.json': '{"keep":true}' });
  const created = applyTemplate(repo, 'project-default', root);
  assert.ok(created.includes('docs/specs/.gitkeep'));
  assert.ok(!created.includes('leanpowers.json'));
  assert.equal(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'), '{"keep":true}');
});

test('scan skips the configured run folder, build folders and symlinks out of the project', () => {
  const outside = project({ 'secret/x.py': '' });
  const root = project({
    'leanpowers.json': JSON.stringify({ paths: { runs: 'runs/out' } }),
    'runs/out/r.json': '', 'dist/a.js': '', 'build/a.js': '', 'vendor/a.go': '',
    'src/a.js': '', 'src/node_modules/m/i.ts': '', 'docs/readme.md': '', 'empty/.gitkeep': '',
  });
  fs.symlinkSync(path.join(outside, 'secret'), path.join(root, 'linked'));
  fs.symlinkSync(path.join(outside, 'secret'), path.join(root, 'src/linked'));
  assert.deepEqual(scanProject(root).structure.rules, [
    { path: 'docs/**', allow: ['*.md'] },
    { path: 'src/**', allow: ['*.js'] },
  ]);
});

test('placeholder npm test script is ignored; Makefile fills the gap', () => {
  const root = project({
    'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    Makefile: 'test:\n\ttrue\n',
  });
  assert.equal(scanProject(root).commands.test, 'make test');
});

test('template rejects unknown names and path tricks', () => {
  const root = project({});
  assert.throws(() => applyTemplate(repo, 'nope', root), /unknown template: nope/);
  assert.throws(() => applyTemplate(repo, '../tests', root), /unknown template/);
});

test('template does not follow a symlinked directory out of the project', () => {
  const outside = project({});
  const root = project({});
  fs.symlinkSync(outside, path.join(root, 'docs'));
  const skipped = [];
  const created = applyTemplate(repo, 'project-default', root, skipped);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.ok(!created.some((f) => f.startsWith('docs/')));
  assert.ok(created.includes('src/.gitkeep'));
  assert.deepEqual(skipped, ['docs (symlink, not followed)']);
});

test('template skips a directory blocked by a file or dangling symlink and continues', () => {
  const root = project({ docs: 'a file' });
  fs.symlinkSync(path.join(root, 'nowhere'), path.join(root, 'src'));
  const skipped = [];
  const created = applyTemplate(repo, 'project-default', root, skipped);
  assert.deepEqual(skipped, ['docs (blocked by existing file)', 'src (blocked by existing file)']);
  assert.ok(created.includes('tests/.gitkeep'));
  assert.equal(fs.readFileSync(path.join(root, 'docs'), 'utf8'), 'a file');
});

test('template skips a file blocking a nested directory', () => {
  const root = project({ 'docs/specs': 'a file' });
  const skipped = [];
  const created = applyTemplate(repo, 'project-default', root, skipped);
  assert.deepEqual(skipped, ['docs/specs (blocked by existing file)']);
  assert.ok(created.includes('docs/plans/.gitkeep'));
});

test('scan skips unreadable subdirectories', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const root = project({ 'src/a.js': '', 'locked/b.py': '', 'src/private/c.rb': '' });
  fs.chmodSync(path.join(root, 'locked'), 0);
  fs.chmodSync(path.join(root, 'src/private'), 0);
  try {
    assert.deepEqual(scanProject(root).structure.rules, [{ path: 'src/**', allow: ['*.js'] }]);
  } finally {
    fs.chmodSync(path.join(root, 'locked'), 0o755);
    fs.chmodSync(path.join(root, 'src/private'), 0o755);
  }
});

test('Makefile variable assignments are not targets', () => {
  const root = project({ Makefile: 'test := foo\nlint ::= bar\nlint:\n\ttrue\n' });
  assert.deepEqual(scanProject(root).commands, { test: '', typecheck: '', lint: 'make lint' });
});
