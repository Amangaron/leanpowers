import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runCheck } from '../checks/check.mjs';
import { writeBrief, writeBaseFor } from '../checks/brief.mjs';
import { loadConfig } from '../checks/lib/config.mjs';

const NO_USER = path.join(os.tmpdir(), 'lp-none', 'config.json');
const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- c\n\n### Task 1: A\n\n**Risk:** low\n\n**Files:**\n- Create: \`src/a.ts\`\n`;

function project(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-check-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/.keep'), '');
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, '.gitignore'), '.leanpowers/\n');
  git('add', '.'); git('commit', '-qm', 'init');
  git('checkout', '-q', '-b', 'feat/test');
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
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'for (let i = 0; i < 40; i++) console.log("error " + i); process.exitCode = 1');
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
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
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

const BRIEF_DIR = '.leanpowers/runs/2026-01-01-demo';
const BRIEF = `${BRIEF_DIR}/task-1-brief.md`;

function medium(root, { allowed = ['src/a.ts'], extra = '' } = {}) {
  fs.mkdirSync(path.join(root, BRIEF_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, BRIEF),
    `# Task 1 brief: A\n\n## Allowed files\n\n${allowed.map((p) => `- \`${p}\``).join('\n')}\n\n## Structure rules\n\nNew folders: ask\n${extra}\n## Task\n\nt\n`);
}

test('brief mode checks scope and structure against a hand-written brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  writeBaseFor(root, BRIEF);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  const bad = runCheck({ root, brief: BRIEF, userConfigPath: NO_USER });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /✖ scope\n  not in brief: extra\/b\.ts/);
  assert.match(bad.text, /✖ structure\n  new folder needs approval: extra/);
});

test('approved new folders in a hand-written brief make structure green', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root, { allowed: ['src/a.ts', 'extra/b.ts'], extra: 'Approved new folders: extra\n' });
  writeBaseFor(root, BRIEF);
  fs.mkdirSync(path.join(root, 'extra'));
  fs.writeFileSync(path.join(root, 'extra/b.ts'), 'b');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
});

test('a changed leanpowers.json is named as project configuration in both check forms', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  writeBaseFor(root, BRIEF);
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node ok.mjs' }, review: { batch: 2 } }));
  const line = "  not in brief: leanpowers.json (project configuration: change it only with the user's yes)";
  for (const opts of [{ brief: BRIEF }, { plan: 'docs/plans/demo.md', task: 1 }]) {
    const r = runCheck({ root, ...opts, userConfigPath: NO_USER });
    assert.equal(r.ok, false);
    assert.ok(r.text.split('\n').includes(line), r.text);
  }
});

test('brief mode without a base is red with the brief --file hint and creates nothing', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root);
  const r = runCheck({ root, brief: BRIEF, userConfigPath: NO_USER });
  assert.equal(r.ok, false);
  assert.match(r.text, /✖ scope\n  no base for \.leanpowers\/runs\/2026-01-01-demo\/task-1-brief\.md, run: leanpowers brief --file \.leanpowers\/runs\/2026-01-01-demo\/task-1-brief\.md$/);
  assert.equal(fs.existsSync(path.join(root, BRIEF_DIR, 'task-1-base.txt')), false);
});

test('brief mode names a missing brief and a wrong file name', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const missing = runCheck({ root, brief: 'notes/task-1-brief.md', userConfigPath: NO_USER });
  assert.equal(missing.ok, false);
  assert.match(missing.text, /✖ scope\n  brief not found: notes\/task-1-brief\.md$/);
  fs.writeFileSync(path.join(root, 'notes.md'), 'n');
  const wrong = runCheck({ root, brief: 'notes.md', userConfigPath: NO_USER });
  assert.equal(wrong.ok, false);
  assert.match(wrong.text, /✖ scope\n  check --brief needs a task-<n>-brief\.md$/);
});

test('brief mode excludes the plan form and combines with --all', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  medium(root);
  writeBaseFor(root, BRIEF);
  for (const opts of [{ plan: 'docs/plans/demo.md', task: 1 }, { task: 1 }, { plan: 'docs/plans/demo.md' }]) {
    const r = runCheck({ root, brief: BRIEF, ...opts, userConfigPath: NO_USER });
    assert.equal(r.ok, false);
    assert.match(r.text, /✖ scope\n  check takes --brief or --plan with --task, not both$/);
    assert.doesNotMatch(r.text, /structure/);
  }
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  git('add', '.'); git('commit', '-qm', 'work');
  assert.equal(runCheck({ root, brief: BRIEF, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure, doc-lint, skill-lint)');
});

test('--all warns about uncommitted files outside the run folder and stays ok', () => {
  const root = project({ commands: { test: 'node ok.mjs' }, paths: { runs: 'runs' } });
  fs.mkdirSync(path.join(root, 'runs/demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runs/demo/progress.md'), 'p');
  assert.equal(runCheck({ root, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
  fs.writeFileSync(path.join(root, 'x.txt'), 'x');
  const one = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(one.ok, true);
  assert.equal(one.text, '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)\n⚠ uncommitted changes: 1 file (x.txt)');
  assert.equal(runCheck({ root, userConfigPath: NO_USER }).text, '✔ leanpowers check: ok (gates:test)');
});

test('the uncommitted warning names at most three paths and counts modified files', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  for (const f of ['a.txt', 'b.txt', 'c.txt']) fs.writeFileSync(path.join(root, f), f);
  fs.writeFileSync(path.join(root, 'src/.keep'), 'changed');
  const r = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(r.ok, true);
  assert.match(r.text, /\n⚠ uncommitted changes: 4 files \(a\.txt, b\.txt, c\.txt\)$/);
});

test('--all outside a git repository gives no uncommitted warning', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-nogit-'));
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'process.exit(0)');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node ok.mjs' } }));
  assert.equal(runCheck({ root, all: true, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)');
});

test('own folders created under a brief count as approved', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root, { allowed: ['docs/specs/s.md'] });
  writeBaseFor(root, BRIEF);
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/s.md'), '# S\n\n## A\n\n## B\n');
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)');
});

test('an unapproved new folder under a brief names the approval line', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  medium(root, { allowed: ['marke/a.ts'] });
  writeBaseFor(root, BRIEF);
  fs.mkdirSync(path.join(root, 'marke'));
  fs.writeFileSync(path.join(root, 'marke/a.ts'), 'a');
  assert.match(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text,
    /^  new folder needs approval: marke \(if the user approved it, add `Approved new folders: marke` to the brief\)$/m);
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.mkdirSync(path.join(root, 'neu'));
  fs.writeFileSync(path.join(root, 'neu/b.ts'), 'b');
  assert.match(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text,
    /^  new folder needs approval: neu$/m);
});

test('a plan or brief outside its configured folder gives a warning', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'plans/other.md'), PLAN);
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'plan'], { cwd: root });
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'plans/other.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  assert.equal(runCheck({ root, plan: 'plans/other.md', task: 1, userConfigPath: NO_USER }).text,
    '✔ leanpowers check: ok (gates:test, scope, structure)\n⚠ plan outside paths.plans (docs/plans): plans/other.md');
  assert.doesNotMatch(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, /outside/);
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(path.join(root, 'notes/task-1-brief.md'), '# Task 1 brief: A\n\n## Allowed files\n\n- `src/a.ts`\n');
  writeBaseFor(root, 'notes/task-1-brief.md');
  assert.match(runCheck({ root, brief: 'notes/task-1-brief.md', userConfigPath: NO_USER }).text,
    /\n⚠ brief outside paths\.runs \(\.leanpowers\/runs\): notes\/task-1-brief\.md$/);
});

test('a missing plan file outside paths.plans gives no outside warning', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const r = runCheck({ root, plan: 'plans/missing.md', task: 1, userConfigPath: NO_USER });
  assert.doesNotMatch(r.text, /⚠ plan outside/);
});

const BRANCH_WARNING = '⚠ on default branch main: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch';

test('the task and brief forms warn on the default branch, never on a feature branch or without a task or brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  medium(root);
  writeBaseFor(root, BRIEF);
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  const ok = '✔ leanpowers check: ok (gates:test, scope, structure)';
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, ok);
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text, ok);
  git('checkout', '-q', 'main');
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, `${ok}\n${BRANCH_WARNING}`);
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text, `${ok}\n${BRANCH_WARNING}`);
  const all = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(all.ok, true);
  assert.doesNotMatch(all.text, /default branch/);
  assert.equal(runCheck({ root, userConfigPath: NO_USER }).text, '✔ leanpowers check: ok (gates:test)');
});
