#!/usr/bin/env node
// Real-run verification of dist/claude-plugin with headless Claude Code.
// Session-only (--plugin-dir): nothing is installed into the user's configuration.
// Usage: node scripts/verify-claude.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(repo, 'dist', 'claude-plugin');
const work = mkdtempSync(join(tmpdir(), 'leanpowers-verify-'));
spawnSync('git', ['init', '-q'], { cwd: work });

let failed = false;
let unclear = false;
let totalCost = 0;
const report = (status, name, detail) => {
  if (status === 'FAIL') failed = true;
  if (status === 'UNCLEAR') unclear = true;
  console.log(`${status} ${name} ${detail}`);
};

function run(label, prompt, maxTurns, extra = []) {
  const args = ['-p', prompt, '--plugin-dir', pluginDir, '--model', 'haiku',
    '--max-turns', String(maxTurns), '--max-budget-usd', '0.25',
    '--output-format', 'stream-json', '--verbose', ...extra];
  const res = spawnSync('claude', args, { cwd: work, encoding: 'utf8', timeout: 180000 });
  writeFileSync(join(work, `${label}.jsonl`), res.stdout ?? '');
  const events = (res.stdout ?? '').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? {};
  const result = events.find((e) => e.type === 'result') ?? {};
  const cost = typeof result.total_cost_usd === 'number' ? result.total_cost_usd : 0;
  totalCost += cost;
  const u = result.usage ?? {};
  const usage = `cost=$${cost.toFixed(4)} in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'}` +
    ` cacheRead=${u.cache_read_input_tokens ?? '?'} cacheWrite=${u.cache_creation_input_tokens ?? '?'}` +
    ` models=${Object.keys(result.modelUsage ?? {}).join('+') || '?'}`;
  const text = String(result.result ?? '');
  const authFailed = result.is_error === true && /authenticat|OAuth|log ?in/i.test(text);
  return { events, init, result, text, usage, authFailed, stderr: res.stderr ?? '' };
}

// 1. Session-start injection (hook output reaches the model).
const r1 = run('start', "Reply with the exact line that starts with 'Commands:' from your session context, nothing else.", 1);
report(r1.authFailed ? 'UNCLEAR' : r1.text.includes('Commands: design, plan') ? 'PASS' : 'FAIL', 'session-start',
  `${r1.usage} result=${JSON.stringify(r1.text.slice(0, 120))}${r1.authFailed ? ' (not logged in: run `claude` and `/login`, then re-run)' : ''}`);

// Plugin wiring from the init event of run 1: no load errors, command and skills coexist.
const errors = r1.init.plugin_errors ?? [];
const plugins = (r1.init.plugins ?? []).map((p) => p.name ?? p);
const names = [...(r1.init.slash_commands ?? []), ...(r1.init.skills ?? [])];
const both = (r1.init.slash_commands ?? []).filter((n) => (r1.init.skills ?? []).includes(n));
const has = (n) => names.some((x) => x === n || x === `leanpowers:${n}`);
if (!r1.init.type) {
  report('UNCLEAR', 'coexist', `no init event; stderr=${r1.stderr.slice(0, 120)}`);
} else {
  const ok = plugins.includes('leanpowers') && errors.length === 0 && has('check') && has('plan');
  report(ok ? 'PASS' : 'FAIL', 'coexist',
    `plugins=${plugins.join(',')} errors=${JSON.stringify(errors)} check=${has('check')} plan=${has('plan')}` +
    ` commandAndSkill=${both.filter((n) => n.startsWith('leanpowers:')).join(',')}`);
}

// 2. Command wiring: /leanpowers:check runs the bundled CLI.
const r2 = run('check', 'Run /leanpowers:check and reply only with its output.', 3, ['--allowedTools', 'Bash(node:*)']);
report(r2.authFailed ? 'UNCLEAR' : r2.text.includes('leanpowers check:') ? 'PASS' : 'FAIL', 'check-command',
  `${r2.usage} result=${JSON.stringify(r2.text.slice(0, 160))}`);

// 3. ${CLAUDE_PLUGIN_ROOT} substitution inside commands/*.md: inspect the Bash call the model made.
const bashCalls = r2.events.filter((e) => e.type === 'assistant')
  .flatMap((e) => e.message?.content ?? [])
  .filter((c) => c.type === 'tool_use' && c.name === 'Bash')
  .map((c) => String(c.input?.command ?? ''));
if (bashCalls.length === 0) {
  report('UNCLEAR', 'plugin-root-var', r2.authFailed ? 'no model run (not logged in)' : 'the model made no Bash call');
} else {
  const cmd = bashCalls[0];
  const literal = cmd.includes('${CLAUDE_PLUGIN_ROOT}') || cmd.includes('$CLAUDE_PLUGIN_ROOT');
  const resolved = cmd.includes(pluginDir);
  report(resolved && !literal ? 'PASS' : literal ? 'FAIL' : 'UNCLEAR', 'plugin-root-var', `command=${JSON.stringify(cmd)}`);
}

console.log(`total cost: $${totalCost.toFixed(4)} (raw streams in ${work})`);
process.exit(failed ? 1 : unclear ? 2 : 0);
