import fs from 'node:fs';
import path from 'node:path';
import { countWords } from './skill-lint.mjs';

function tally(runDir, names, pattern) {
  const files = names.filter((f) => pattern.test(f));
  const words = files.reduce((sum, f) => sum + countWords(fs.readFileSync(path.join(runDir, f), 'utf8')), 0);
  return { count: files.length, words };
}

/** Count briefs, reports and reviews in a run dir and sum their word counts. */
export function collectMetrics(runDir) {
  const names = fs.readdirSync(runDir);
  const briefs = tally(runDir, names, /^task-.*-brief\.md$/);
  const reports = tally(runDir, names, /^task-.*-report\.md$/);
  const reviews = tally(runDir, names, /^review-.*\.md$/);
  return {
    briefs: briefs.count,
    reports: reports.count,
    reviews: reviews.count,
    briefWords: briefs.words,
    reportWords: reports.words,
    reviewWords: reviews.words,
  };
}

/** Replace or append the `## Metrics` section in progress.md; returns the metrics. */
export function writeMetrics(runDir) {
  const m = collectMetrics(runDir);
  const section = [
    '## Metrics',
    '',
    `- briefs: ${m.briefs} (${m.briefWords} words)`,
    `- subagent reports: ${m.reports} (${m.reportWords} words)`,
    `- reviews: ${m.reviews} (${m.reviewWords} words)`,
  ].join('\n');

  const file = path.join(runDir, 'progress.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '# Progress\n';
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trimEnd() === '## Metrics');
  let out;
  if (start === -1) {
    out = `${text.replace(/\n+$/, '')}\n\n${section}\n`;
  } else {
    let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    if (end === -1) end = lines.length;
    const tail = lines.slice(end).join('\n');
    out = `${lines.slice(0, start).join('\n')}\n${section}\n${tail ? `\n${tail}` : ''}`;
  }
  fs.writeFileSync(file, out);
  return m;
}
