import fs from 'node:fs';
import path from 'node:path';
import { toPosix } from './lib/glob.mjs';

function selected(line) {
  return line.includes('Ruling:')
    || line.includes('minor (deferred)')
    || line.includes(' parked — ')
    || line.startsWith('Stop:')
    || line.startsWith('Final:');
}

/**
 * Build the run report from ledger text: the run header, every ruling, deferred
 * minor, parked item, stop and final line in ledger order, then the metrics section.
 * @param {string} ledgerText content of progress.md
 * @param {string} planRel plan path relative to the project root, posix
 * @param {string} name plan name without `.md`
 * @returns {string} report text ending with one newline
 */
export function buildReport(ledgerText, planRel, name) {
  const lines = ledgerText.replace(/\r\n/g, '\n').split('\n');
  const metricsAt = lines.findIndex((l) => l.trimEnd() === '## Metrics');
  const considered = metricsAt === -1 ? lines : lines.slice(0, metricsAt);
  const header = considered.find((l) => l.startsWith('Run base:'));
  const picked = considered.filter(selected);
  const out = [`# Run report — ${name}`, '', `Plan: ${planRel}`];
  if (header !== undefined) out.push(header);
  out.push('', '## Rulings and open points', '', ...(picked.length ? picked : ['none']));
  if (metricsAt >= 0) out.push('', lines.slice(metricsAt).join('\n').trimEnd());
  return `${out.join('\n')}\n`;
}

/**
 * Write the run report for a plan into `paths.reports`, overwriting an existing one.
 * Never creates the run folder; throws `no ledger for …` when the ledger is missing.
 * @param {string} root project root
 * @param {object} config merged leanpowers config
 * @param {string} planPath plan path, absolute or relative to the root
 * @returns {string} absolute path of the written report
 */
export function writeReport(root, config, planPath) {
  const planRel = toPosix(path.relative(root, path.resolve(root, planPath)));
  const name = path.basename(planRel, '.md');
  const ledger = path.join(root, config.paths.runs, name, 'progress.md');
  if (!fs.existsSync(ledger)) {
    throw new Error(`no ledger for ${planRel}: ${toPosix(path.relative(root, ledger))}`);
  }
  const file = path.join(root, config.paths.reports, `${name}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildReport(fs.readFileSync(ledger, 'utf8'), planRel, name));
  return file;
}
