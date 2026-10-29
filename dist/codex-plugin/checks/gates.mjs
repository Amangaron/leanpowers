import { spawnSync } from 'node:child_process';
import { compress } from './lib/output.mjs';

/** @typedef {import('./lib/output.mjs').CheckResult} CheckResult */

const RELEVANT = /error|fail|not ok|✖|assert|expected/i;
const FALLBACK_LINES = 20;
const SUMMARIZER_THRESHOLD = 60;
const MAX_BUFFER = 64 * 1024 * 1024;

const splitLines = (text) => text.split(/\r?\n/).filter((l) => l.trim() !== '');

/**
 * Run the configured test/typecheck/lint commands and return token-lean results.
 * @param {object} config
 * @param {string} root
 * @returns {CheckResult[]}
 */
export function runGates(config, root) {
  const results = [];
  for (const gate of ['test', 'typecheck', 'lint']) {
    const cmd = config.commands[gate];
    if (!cmd) {
      if (gate === 'test') {
        results.push({ name: 'gates:test', ok: false, messages: ['no test command configured'] });
      }
      continue;
    }
    const run = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: MAX_BUFFER });
    if (run.status === 0) {
      results.push({ name: `gates:${gate}`, ok: true, messages: [] });
      continue;
    }
    results.push({ name: `gates:${gate}`, ok: false, messages: failureMessages(run, config.summarizer) });
  }
  return results;
}

function failureMessages(run, summarizer) {
  const raw = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const lines = splitLines(raw);
  let relevant = lines.filter((l) => RELEVANT.test(l));
  if (relevant.length === 0) relevant = lines.slice(-FALLBACK_LINES);

  if (summarizer !== 'none' && relevant.length > SUMMARIZER_THRESHOLD) {
    const sum = spawnSync(summarizer, { shell: true, input: raw, encoding: 'utf8', maxBuffer: MAX_BUFFER });
    if (sum.status === 0) return compress(splitLines(sum.stdout ?? ''));
    return ['summarizer failed, showing compressed output', ...compress(relevant)];
  }
  return compress(relevant);
}
