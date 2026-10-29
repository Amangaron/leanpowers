import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runCheck } from '../checks/check.mjs';
import { writeBrief } from '../checks/brief.mjs';
import { loadConfig } from '../checks/lib/config.mjs';

const NO_USER = path.join(os.tmpdir(), 'lp-none', 'config.json');
const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- c\n\n### Task 1: A\n\n**Risk:** low\n\n**Files:**\n- Create: \`src/a.ts\`\n`;

function project(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-check-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/.keep'), '');
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, '.gitignore'), '.leanpowers/\n');
  git('add', '.'); git('commit', '-qm', 'init');
  return root;
}

test('gates only: one line on success', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, userConfigPath: NO_USER });
  assert.deepEqual(r, { ok: true, text: '✔ leanpowers check: ok (gates:test)' });
});

test('task mode adds scope and structure against the brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  const bad = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /✖ scope\n  not in brief: extra\/b\.ts/);
  assert.match(bad.text, /✖ structure\n  new folder needs approval: extra/);
});

test('task mode without a brief is a clear failure', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /no brief for task 1, run: leanpowers brief --plan docs\/plans\/demo\.md --task 1/);
});

test('--all adds doc-lint and skill-lint', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(r.text, '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
});

test('invalid config is a warning, defaults are used', () => {
  const root = project({ review: { batch: 'x' } });
  const r = runCheck({ root, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /no test command configured/);
  assert.match(r.text, /⚠ leanpowers\.json: review\.batch: expected integer/);
});

test('deleted files count for scope but not for structure', () => {
  const root = project({ commands: { test: 'node ok.mjs' }, structure: { newFolders: 'ask', rules: [{ path: 'src/**', allow: ['*.ts'] }] } });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.rmSync(path.join(root, 'src/.keep'));
  const r = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.match(r.text, /✖ scope\n  not in brief: src\/\.keep/);
  assert.doesNotMatch(r.text, /✖ structure/);
});

test('failing check output is capped at 20 lines plus a rest marker', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'for (let i = 0; i < 40; i++) console.log("error " + i); process.exit(1)');
  const lines = runCheck({ root, userConfigPath: NO_USER }).text.split('\n');
  assert.equal(lines.filter((l) => l.startsWith('  error ')).length, 20);
  assert.ok(lines.includes('  … 20 more'));
});

test('non-gate results are capped at 20 lines plus a rest marker', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  for (let i = 0; i < 25; i++) fs.writeFileSync(path.join(root, `src/f${String(i).padStart(2, '0')}.ts`), 'x');
  const text = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text;
  assert.equal(text.split('\n').filter((l) => l.startsWith('  not in brief: ')).length, 20);
  assert.match(text, /✖ scope[\s\S]*  … 5 more/);
});

test('task check with only a plan or only a task fails instead of passing', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  for (const opts of [{ plan: 'docs/plans/demo.md' }, { task: 1 }]) {
    const r = runCheck({ root, ...opts, userConfigPath: NO_USER });
    assert.equal(r.ok, false);
    assert.match(r.text, /✖ scope\n  check needs both --plan and --task/);
    assert.doesNotMatch(r.text, /structure/);
  }
});

test('paths are root-relative when the project sits in a monorepo subdirectory', () => {
  const mono = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-mono-'));
  const git = (...a) => execFileSync('git', a, { cwd: mono, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  const root = path.join(mono, 'pkg');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/.keep'), '');
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({
    commands: { test: 'node ok.mjs' },
    structure: { newFolders: 'deny', rules: [{ path: 'src/**', allow: ['*.ts'] }] },
  }));
  fs.writeFileSync(path.join(root, '.gitignore'), '.leanpowers/\n');
  git('add', '.'); git('commit', '-qm', 'init');
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  fs.mkdirSync(path.join(root, 'src/newdir'));
  fs.writeFileSync(path.join(root, 'src/newdir/b.js'), 'b');
  fs.writeFileSync(path.join(mono, 'outside.txt'), 'o');
  const r = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /✖ scope\n  not in brief: src\/newdir\/b\.js/);
  assert.doesNotMatch(r.text, /pkg\//);
  assert.doesNotMatch(r.text, /outside\.txt/);
  assert.doesNotMatch(r.text, /not in brief: src\/a\.ts/);
  assert.match(r.text, /src\/newdir\/b\.js: not allowed by rule src\/\*\*/);
  assert.match(r.text, /new folder not allowed: src\/newdir/);
});

test('an absolute --plan path works for check', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  const abs = path.join(root, 'docs/plans/demo.md');
  writeBrief(root, abs, 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, plan: abs, task: 1, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
});

test('a missing plan is a one-line failure without a run directory', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, plan: 'docs/plans/nope.md', task: 1, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /✖ scope\n  plan not found: docs\/plans\/nope\.md$/);
  assert.equal(fs.existsSync(path.join(root, '.leanpowers/runs/nope')), false);
});

test('re-running brief keeps the original task base', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'extra.txt'), 'e');
  git('add', '.'); git('commit', '-qm', 'work');
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  const r = runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER });
  assert.match(r.text, /✖ scope\n  not in brief: extra\.txt/);
});
