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
