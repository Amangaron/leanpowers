import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePlan } from '../checks/lib/plan.mjs';
import { buildBrief, runDirFor, writeBrief, writeBaseFor, parseBriefFile } from '../checks/brief.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { cliCommand } from '../checks/start.mjs';

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
  assert.match(b, /Run `(node ".*\/bin\/leanpowers\.mjs"|[^`]+) check --plan docs\/plans\/demo\.md --task 1`\./);
  const d = buildBrief(parsePlan(PLAN), 1, config, 'r');
  assert.match(d, /--plan the plan --task 1/);
});

test('unknown task number throws', () => {
  assert.throws(() => buildBrief(parsePlan(PLAN), 9, config, 'r'), /Task 9 not found/);
});

test('writeBrief writes brief and base sha into a self-ignoring run dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
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
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
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
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
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

test('brief names exactly the resolvable CLI command', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, '.leanpowers/runs/demo', 'docs/plans/demo.md');
  assert.ok(b.includes(`Run \`${cliCommand()} check --plan docs/plans/demo.md --task 1\``));
  assert.doesNotMatch(b, /Run `leanpowers check/);
});

test('brief uses LEANPOWERS_CLI when set', () => {
  const old = process.env.LEANPOWERS_CLI;
  process.env.LEANPOWERS_CLI = 'lp';
  try {
    const b = buildBrief(parsePlan(PLAN), 1, config, 'r', 'docs/plans/demo.md');
    assert.ok(b.includes('Run `lp check --plan docs/plans/demo.md --task 1`'));
  } finally {
    if (old === undefined) delete process.env.LEANPOWERS_CLI;
    else process.env.LEANPOWERS_CLI = old;
  }
});

test('brief lists approved new folders that do not exist yet', () => {
  const plan = parsePlan(PLAN);
  const none = buildBrief(plan, 1, config, 'r', 'p.md', () => true);
  assert.doesNotMatch(none, /Approved new folders/);
  const fresh = buildBrief(plan, 1, config, 'r', 'p.md', (d) => d === 'src/components');
  assert.match(fresh, /New folders: ask\nApproved new folders: tests\n/);
  const both = buildBrief(plan, 1, config, 'r', 'p.md', () => false);
  assert.match(both, /Approved new folders: src\/components, tests\n/);
});

test('brief names the spec and lists sources', () => {
  const withSources = PLAN.replace('## Global Constraints', '**Sources:** `x/README.md`, `y/schema.json`\n\n## Global Constraints');
  const b = buildBrief(parsePlan(withSources), 1, config, 'r');
  assert.match(b, /\n\*\*Spec:\*\* docs\/specs\/s\.md\n/);
  assert.match(b, /## Sources\n\n- x\/README\.md\n- y\/schema\.json\n\nRead-only references for facts; read only what the task needs\./);
  assert.doesNotMatch(buildBrief(parsePlan(PLAN), 1, config, 'r'), /## Sources/);
});

test('writeBrief writes constraints.md next to the brief', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  const brief = writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  assert.equal(fs.readFileSync(path.join(path.dirname(brief), 'constraints.md'), 'utf8'), '- Node >= 20\n');
});

test('base is kept unless reset is requested', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'one');
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  const brief = writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  const baseFile = path.join(path.dirname(brief), 'task-1-base.txt');
  const first = fs.readFileSync(baseFile, 'utf8');
  git('commit', '-q', '--allow-empty', '-m', 'two');
  writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS);
  assert.equal(fs.readFileSync(baseFile, 'utf8'), first);
  writeBrief(root, 'docs/plans/demo.md', 1, DEFAULTS, { resetBase: true });
  assert.equal(fs.readFileSync(baseFile, 'utf8').trim(), git('rev-parse', 'HEAD').trim());
});

test('writeBaseFor records the base next to a hand-written brief', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'one');
  const dir = path.join(root, '.leanpowers/runs/2026-01-01-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'task-1-brief.md'), '# Task 1 brief: A\n');
  const rel = '.leanpowers/runs/2026-01-01-demo/task-1-brief.md';
  assert.equal(writeBaseFor(root, rel), path.join(dir, 'task-1-brief.md'));
  const baseFile = path.join(dir, 'task-1-base.txt');
  const first = fs.readFileSync(baseFile, 'utf8');
  assert.equal(first, `${git('rev-parse', 'HEAD').trim()}\n`);
  git('commit', '-q', '--allow-empty', '-m', 'two');
  writeBaseFor(root, path.join(dir, 'task-1-brief.md'));
  assert.equal(fs.readFileSync(baseFile, 'utf8'), first);
  writeBaseFor(root, rel, { resetBase: true });
  assert.equal(fs.readFileSync(baseFile, 'utf8').trim(), git('rev-parse', 'HEAD').trim());
});

test('writeBaseFor rejects other file names and missing briefs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-brief-'));
  fs.writeFileSync(path.join(root, 'notes.md'), 'n');
  assert.throws(() => writeBaseFor(root, 'notes.md'), { message: 'brief --file needs a task-<n>-brief.md' });
  assert.throws(() => writeBaseFor(root, 'r/task-2-brief.md'), { message: 'brief not found: r/task-2-brief.md' });
  assert.equal(fs.existsSync(path.join(root, 'r')), false);
});

test('parseBriefFile reads allowed files and approved folders', () => {
  const text = '# Task 1 brief: A\r\n\r\n## Allowed files\r\n\r\n- `src/a.ts`\r\n-  tests/a.test.ts \r\n- \r\nnot a path\r\n\r\n## Structure rules\r\n\r\n- src/** → allow *.ts\r\nNew folders: ask\r\nApproved new folders: `extra`, lib/x ,\r\n';
  assert.deepEqual(parseBriefFile(text), { allowed: ['src/a.ts', 'tests/a.test.ts'], approvedFolders: ['extra', 'lib/x'] });
  assert.deepEqual(parseBriefFile('## Allowed files\n\n- a.md\n'), { allowed: ['a.md'], approvedFolders: [] });
  const generated = buildBrief(parsePlan(PLAN), 1, config, 'r', 'p.md', () => false);
  assert.deepEqual(parseBriefFile(generated), {
    allowed: ['src/components/Button.tsx', 'tests/button.test.ts'],
    approvedFolders: ['src/components', 'tests'],
  });
});
