import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectMetrics, writeMetrics } from '../checks/metrics.mjs';

function runDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-metrics-'));
  fs.writeFileSync(path.join(d, 'task-1-brief.md'), 'a b c');
  fs.writeFileSync(path.join(d, 'task-2-brief.md'), 'a b');
  fs.writeFileSync(path.join(d, 'task-1-report.md'), 'x y z w');
  fs.writeFileSync(path.join(d, 'review-1-3.md'), 'r');
  fs.writeFileSync(path.join(d, 'progress.md'), '# Progress\n\nTask 1 done\n');
  return d;
}

test('collectMetrics counts files and words', () => {
  assert.deepEqual(collectMetrics(runDir()), { briefs: 2, reports: 1, reviews: 1, briefWords: 5, reportWords: 4, reviewWords: 1 });
});

test('writeMetrics appends once and replaces on rerun', () => {
  const d = runDir();
  writeMetrics(d);
  fs.writeFileSync(path.join(d, 'task-2-report.md'), 'one two');
  writeMetrics(d);
  const text = fs.readFileSync(path.join(d, 'progress.md'), 'utf8');
  assert.equal(text.match(/## Metrics/g).length, 1);
  assert.match(text, /^# Progress\n\nTask 1 done\n/);
  assert.match(text, /- subagent reports: 2 \(6 words\)/);
  assert.match(text, /- briefs: 2 \(5 words\)/);
  assert.match(text, /- reviews: 1 \(1 words\)/);
});

test('writeMetrics replaces only up to the next heading', () => {
  const d = runDir();
  fs.writeFileSync(path.join(d, 'progress.md'), '# Progress\n\n## Metrics\n\n- old\n\n## Notes\n\nkeep me\n');
  writeMetrics(d);
  const text = fs.readFileSync(path.join(d, 'progress.md'), 'utf8');
  assert.doesNotMatch(text, /- old/);
  assert.match(text, /- reviews: 1 \(1 words\)\n\n## Notes\n\nkeep me\n/);
});

test('writeMetrics creates progress.md if missing', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-metrics-'));
  writeMetrics(d);
  assert.match(fs.readFileSync(path.join(d, 'progress.md'), 'utf8'), /## Metrics/);
});
