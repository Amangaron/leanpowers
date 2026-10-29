import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bin = fileURLToPath(new URL('../bin/leanpowers.mjs', import.meta.url));
const repoRoot = path.dirname(path.dirname(bin));
// An empty config home keeps the user's real config out of every spawn.
const emptyConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-xdg-'));
const spawn = (cwd, ...args) => spawnSync(process.execPath, [bin, ...args], {
  cwd,
  encoding: 'utf8',
  env: { ...process.env, XDG_CONFIG_HOME: emptyConfigHome },
});
const run = (...args) => spawn(repoRoot, ...args);

const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- c\n\n### Task 1: A\n\n**Risk:** low\n\n**Files:**\n- Create: \`src/a.ts\`\n`;

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node ok.mjs' } }));
  fs.writeFileSync(path.join(root, '.gitignore'), '.leanpowers/\n');
  git('add', '.'); git('commit', '-qm', 'init');
  return root;
}

test('unknown command prints usage and exits 2', () => {
  const r = run('nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: leanpowers <check\|brief\|metrics\|config\|start\|skills\|init>/);
});

test('usage lists every command with its flags', () => {
  const lines = run('nope').stderr.split('\n').map((l) => l.trim());
  for (const line of [
    'check [--all] [--plan <file> --task <n>]',
    'brief --plan <file> --task <n>',
    'metrics --plan <file>',
    'config',
    'start [--format plain|claude]',
    'skills [--list | --set <name>=on|off,... | --native claude|codex|gemini]',
    'init [--write | --template <name>]',
  ]) assert.ok(lines.includes(line), line);
});

test('config prints merged JSON', () => {
  const r = run('config');
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).paths.specs, 'docs/specs');
});

test('brief without --task is a usage error', () => {
  assert.equal(run('brief', '--plan', 'x.md').status, 2);
});

test('check with only --plan or only --task is a usage error', () => {
  for (const args of [['--plan', 'x.md'], ['--task', '1']]) {
    const r = run('check', ...args);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: leanpowers <check\|brief\|metrics\|config\|start\|skills\|init>/);
  }
});

test('--task must be a positive integer', () => {
  for (const bad of ['0', '01', '-1', 'x']) {
    assert.equal(run('check', '--plan', 'x.md', '--task', bad).status, 2, bad);
    assert.equal(run('brief', '--plan', 'x.md', '--task', bad).status, 2, bad);
  }
});

test('brief writes the brief file and prints its path', () => {
  const root = project();
  const r = spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '.leanpowers/runs/demo/task-1-brief.md');
  assert.ok(fs.existsSync(path.join(root, r.stdout.trim())));
});

test('brief with a missing plan prints one line and exits 1', () => {
  const root = project();
  const r = spawn(root, 'brief', '--plan', 'docs/plans/nope.md', '--task', '1');
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'plan not found: docs/plans/nope.md');
});

test('check reports an out-of-brief file and exits 1', () => {
  const root = project();
  assert.equal(spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1').status, 0);
  fs.writeFileSync(path.join(root, 'stray.txt'), 's');
  const r = spawn(root, 'check', '--plan', 'docs/plans/demo.md', '--task', '1');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /✖ scope/);
});

test('metrics prints a summary line', () => {
  const root = project();
  assert.equal(spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1').status, 0);
  const r = spawn(root, 'metrics', '--plan', 'docs/plans/demo.md');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^metrics: /);
});

test('init prints a proposal and the write hint without touching disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-init-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/a.ts'), '');
  const r = spawn(root, 'init');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"path": "src\/\*\*"/);
  assert.match(r.stdout, /run "leanpowers init --write" to save it/);
  assert.equal(fs.existsSync(path.join(root, 'leanpowers.json')), false);
});

test('init --write creates leanpowers.json once and never overwrites', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-init-'));
  assert.equal(spawn(root, 'init', '--write').status, 0);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'));
  assert.equal(saved.$schema, 'https://raw.githubusercontent.com/Amangaron/leanpowers/main/schema/leanpowers.schema.json');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), '{"keep":true}');
  const again = spawn(root, 'init', '--write');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /leanpowers\.json exists — not overwritten/);
  assert.equal(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'), '{"keep":true}');
});

test('init --template lists created files and reports unknown templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-init-'));
  const r = spawn(root, 'init', '--template', 'project-default');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /created docs\/specs\/\.gitkeep/);
  assert.equal(fs.existsSync(path.join(root, 'tests/.gitkeep')), true);
  const bad = spawn(root, 'init', '--template', 'nope');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown template: nope/);
  assert.equal(spawn(root, 'init', '--write', '--template', 'project-default').status, 2);
});

test('init --template reports skipped entries without a stack trace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cli-init-'));
  fs.writeFileSync(path.join(root, 'docs'), 'a file');
  const r = spawn(root, 'init', '--template', 'project-default');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /skipped docs \(blocked by existing file\)/);
  assert.match(r.stdout, /created src\/\.gitkeep/);
  assert.equal(r.stderr, '');
});
