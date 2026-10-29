import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePlan } from '../checks/lib/plan.mjs';
import { buildBrief, runDirFor, writeBrief } from '../checks/brief.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const PLAN = `# Demo\n\n**Goal:** g\n\n**Spec:** \`docs/specs/s.md\`\n\n## Global Constraints\n\n- Node >= 20\n\n---\n\n### Task 1: Button\n\n**Risk:** high\n\n**Files:**\n- Create: \`src/components/Button.tsx\`\n- Test: \`tests/button.test.ts\`\n\n- [ ] **Step 1: do**\n\n### Task 2: Other\n\n**Risk:** low\n\n**Files:**\n- Create: \`lib/x.ts\`\n`;
const config = { ...DEFAULTS, structure: { newFolders: 'ask', rules: [
  { path: 'src/components/**', allow: ['*.tsx'] },
  { path: 'lib/**', allow: ['*.ts'] },
] } };

test('brief contains only what the implementer needs', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, '.leanpowers/runs/demo');
  assert.match(b, /^# Task 1 brief: Button/);
  assert.match(b, /\*\*Risk:\*\* high/);
  assert.match(b, /## Allowed files\n\n- src\/components\/Button\.tsx\n- tests\/button\.test\.ts/);
  assert.match(b, /## Global constraints\n\n- Node >= 20/);
  assert.match(b, /- src\/components\/\*\* → allow \*\.tsx/);
  assert.doesNotMatch(b, /lib\/\*\*/);
  assert.match(b, /New folders: ask/);
  assert.match(b, /- \[ \] \*\*Step 1: do\*\*/);
  assert.doesNotMatch(b, /Task 2/);
  assert.match(b, /Write your report \(max 150 words\) to `\.leanpowers\/runs\/demo\/task-1-report\.md`/);
});

test('brief names the plan path in the check command', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, 'r', 'docs/plans/demo.md');
  assert.match(b, /Run `leanpowers check --plan docs\/plans\/demo\.md --task 1`\./);
  const d = buildBrief(parsePlan(PLAN), 1, config, 'r');
  assert.match(d, /--plan the plan --task 1/);
});

test('unknown task number throws', () => {
  assert.throws(() => buildBrief(parsePlan(PLAN), 9, config, 'r'), /Task 9 not found/);
});

test('writeBrief writes brief and base sha into a self-ignoring run dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/2026-01-01-demo.md'), PLAN);
  git('add', '.'); git('commit', '-qm', 'init');
  const briefPath = writeBrief(root, 'docs/plans/2026-01-01-demo.md', 1, config);
  const runDir = runDirFor(root, config, 'docs/plans/2026-01-01-demo.md');
  assert.equal(briefPath, path.join(runDir, 'task-1-brief.md'));
  assert.equal(runDir, path.join(root, '.leanpowers/runs/2026-01-01-demo'));
  assert.equal(fs.readFileSync(path.join(runDir, '.gitignore'), 'utf8'), '*\n');
  assert.match(fs.readFileSync(path.join(runDir, 'task-1-base.txt'), 'utf8').trim(), /^[0-9a-f]{40}$/);
  const brief = fs.readFileSync(briefPath, 'utf8');
  assert.match(brief, /Task 1 brief: Button/);
  assert.match(brief, /--plan docs\/plans\/2026-01-01-demo\.md --task 1/);
  assert.match(brief, /`\.leanpowers\/runs\/2026-01-01-demo\/task-1-report\.md`/);
});

test('writeBrief accepts an absolute plan path and names it root-relative', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  const abs = path.join(root, 'docs/plans/2026-01-01-demo.md');
  fs.writeFileSync(abs, PLAN);
  git('add', '.'); git('commit', '-qm', 'init');
  const briefPath = writeBrief(root, abs, 1, config);
  assert.equal(briefPath, path.join(root, '.leanpowers/runs/2026-01-01-demo/task-1-brief.md'));
  assert.match(fs.readFileSync(briefPath, 'utf8'), /--plan docs\/plans\/2026-01-01-demo\.md --task 1/);
});

test('writeBrief on a missing plan throws a plan-not-found error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  assert.throws(() => writeBrief(root, 'docs/plans/nope.md', 1, config), /plan not found: docs\/plans\/nope\.md/);
  assert.equal(fs.existsSync(path.join(root, '.leanpowers')), false);
});

test('writeBrief keeps an existing base sha when re-run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/p.md'), PLAN);
  git('add', '.'); git('commit', '-qm', 'init');
  const first = git('rev-parse', 'HEAD');
  const briefPath = writeBrief(root, 'docs/plans/p.md', 1, config);
  fs.writeFileSync(path.join(root, 'x.txt'), 'x');
  git('add', '.'); git('commit', '-qm', 'next');
  writeBrief(root, 'docs/plans/p.md', 1, config);
  assert.equal(fs.readFileSync(path.join(path.dirname(briefPath), 'task-1-base.txt'), 'utf8').trim(), first);
});
