import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReport, writeReport } from '../checks/report.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const LEDGER = [
  '# leanpowers ledger — plan: docs/plans/demo.md',
  '',
  'Run base: abc1234 · Base branch: main · Branch: feat/demo · Worktree: none',
  '',
  '## Tasks',
  'Ruling: branch feat/demo — HEAD was on main — none',
  'Task 1: implementer dispatched (-)',
  'Task 1: implementer id a1',
  'Task 1: gated (commits abc1234..bcd2345)',
  'Task 1: minor (deferred): rename helper',
  'Task 2: parked — slow loop — Ruling: fine for ten items — rewrite later',
  'Stop: CSV or JSON?',
  'Ruling: CSV — user decided — redo the export',
  'Task 2: complete (commits bcd2345..cde3456, 1 parked)',
  'Final: review APPROVED, no fix wave',
  'Final: minor (deferred): typo in README',
  'Final: ✔ leanpowers check: ok (gates:test)',
  '',
  '## Metrics',
  '',
  '- briefs: 2 (10 words)',
  '- subagent reports: 2 (8 words)',
  '- reviews: 1 (3 words)',
  '',
].join('\n');

const EXPECTED = [
  '# Run report — demo',
  '',
  'Plan: docs/plans/demo.md',
  'Run base: abc1234 · Base branch: main · Branch: feat/demo · Worktree: none',
  '',
  '## Rulings and open points',
  '',
  'Ruling: branch feat/demo — HEAD was on main — none',
  'Task 1: minor (deferred): rename helper',
  'Task 2: parked — slow loop — Ruling: fine for ten items — rewrite later',
  'Stop: CSV or JSON?',
  'Ruling: CSV — user decided — redo the export',
  'Final: review APPROVED, no fix wave',
  'Final: minor (deferred): typo in README',
  'Final: ✔ leanpowers check: ok (gates:test)',
  '',
  '## Metrics',
  '',
  '- briefs: 2 (10 words)',
  '- subagent reports: 2 (8 words)',
  '- reviews: 1 (3 words)',
  '',
].join('\n');

test('buildReport keeps header, rulings, open points, final lines and metrics in ledger order', () => {
  assert.equal(buildReport(LEDGER, 'docs/plans/demo.md', 'demo'), EXPECTED);
  assert.equal(buildReport(LEDGER.replace(/\n/g, '\r\n'), 'docs/plans/demo.md', 'demo'), EXPECTED);
});

test('buildReport says none without matching lines and leaves out missing parts', () => {
  const ledger = '# leanpowers ledger — plan: p.md\n\n## Tasks\nTask 1: complete (commits a..b, review clean)\n';
  assert.equal(buildReport(ledger, 'p.md', 'p'), '# Run report — p\n\nPlan: p.md\n\n## Rulings and open points\n\nnone\n');
});

function project(ledger) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-report-'));
  if (ledger !== undefined) {
    fs.mkdirSync(path.join(root, '.leanpowers/runs/demo'), { recursive: true });
    fs.writeFileSync(path.join(root, '.leanpowers/runs/demo/progress.md'), ledger);
  }
  return root;
}

test('writeReport writes into paths.reports and overwrites on rerun', () => {
  const root = project(LEDGER);
  const file = writeReport(root, DEFAULTS, 'docs/plans/demo.md');
  assert.equal(file, path.join(root, 'docs/reports/demo.md'));
  assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED);
  fs.writeFileSync(file, 'old');
  writeReport(root, DEFAULTS, path.join(root, 'docs/plans/demo.md'));
  assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED);
});

test('writeReport without a ledger throws and creates nothing', () => {
  const root = project();
  assert.throws(() => writeReport(root, DEFAULTS, 'docs/plans/demo.md'),
    { message: 'no ledger for docs/plans/demo.md: .leanpowers/runs/demo/progress.md' });
  assert.equal(fs.existsSync(path.join(root, '.leanpowers')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
});
