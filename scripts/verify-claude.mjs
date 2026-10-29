#!/usr/bin/env node
// Real-run verification of dist/claude-plugin with headless Claude Code.
// Session-only (--plugin-dir): nothing is installed into the user's configuration.
// Usage: node scripts/verify-claude.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The real CLI output line; a model that merely quotes skill text does not produce it inside a tool result.
const CHECK_LINE = /(✔|✖) leanpowers check: (ok \(|\d+ failed)/;

/** All text of a message content: a string, or blocks with `text`/nested `content`. */
function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(textOf).join('\n');
  if (content && typeof content === 'object') return [content.text, content.content].map(textOf).join('\n');
  return '';
}

const blocks = (events, type) => events.filter((e) => e.type === type)
  .flatMap((e) => (Array.isArray(e.message?.content) ? e.message.content
    : typeof e.message?.content === 'string' ? [{ type: 'text', text: e.message.content }] : []));

/**
 * check-command evidence: a Bash tool_use whose command contains leanpowers.mjs, and the tool_result
 * paired with it by id holds the real CLI output line. Returns { status, detail }.
 */
export function checkCommandEvidence(events) {
  const calls = blocks(events, 'assistant')
    .filter((c) => c.type === 'tool_use' && c.name === 'Bash' && String(c.input?.command ?? '').includes('leanpowers.mjs'));
  const results = new Map(blocks(events, 'user').filter((c) => c.type === 'tool_result')
    .map((c) => [c.tool_use_id, textOf(c.content)]));
  if (!calls.length) return { status: 'FAIL', detail: 'no Bash call running leanpowers.mjs' };
  for (const call of calls) {
    const out = results.get(call.id);
    if (out !== undefined && CHECK_LINE.test(out)) {
      return { status: 'PASS', detail: `command=${JSON.stringify(call.input.command)} output=${JSON.stringify(out.match(CHECK_LINE)[0])}` };
    }
  }
  const answered = calls.filter((c) => results.has(c.id));
  if (!answered.length) {
    return { status: 'UNCLEAR', detail: `Bash call ran leanpowers.mjs but no tool_result event came back (turn or budget limit?): ${JSON.stringify(calls[0].input.command)}` };
  }
  return { status: 'FAIL', detail: `no paired tool_result holds the check line; first output=${JSON.stringify(results.get(answered[0].id).slice(0, 160))}` };
}

/**
 * plugin-root-var evidence: the expanded slash-command text (a user event, not a tool result) holds the
 * absolute plugin bin path while the source commands/check.md holds `${CLAUDE_PLUGIN_ROOT}`. A Bash command
 * naming the path proves nothing, since the model may have found the path elsewhere. Returns { status, detail }.
 */
export function pluginRootEvidence(events, { binPaths, source }) {
  if (!source.includes('${CLAUDE_PLUGIN_ROOT}')) return { status: 'FAIL', detail: 'commands/check.md does not use ${CLAUDE_PLUGIN_ROOT}' };
  const texts = blocks(events, 'user').filter((c) => c.type !== 'tool_result').map(textOf);
  const literal = texts.find((t) => t.includes('${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs'));
  if (literal) return { status: 'FAIL', detail: `expanded command still holds the variable: ${JSON.stringify(literal.slice(0, 160))}` };
  const expanded = texts.find((t) => binPaths.some((p) => t.includes(p)));
  if (expanded) return { status: 'PASS', detail: `expanded command=${JSON.stringify(expanded.slice(0, 200))}` };
  return { status: 'UNCLEAR', detail: 'no expanded command text with the plugin bin path in the stream (a Bash path alone is no proof)' };
}

function main() {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pluginDir = join(repo, 'dist', 'claude-plugin');

  // Pre-check: is claude runnable at all? Otherwise every check is UNCLEAR, not FAIL.
  const ver = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (ver.error || ver.status !== 0) {
    console.log(`UNCLEAR claude-cli cannot run \`claude --version\`: ${ver.error?.message ?? ver.stderr}`);
    process.exit(2);
  }
  console.log(`claude ${ver.stdout.trim()}`);
  console.log('note: --bare is not used (it skips plugin hooks and OAuth), so other installed plugins stay visible');
  // Note: --bare is deliberately not used. It skips plugin hooks (session-start could not be tested)
  // and reads only ANTHROPIC_API_KEY (no OAuth). Other installed plugins therefore stay visible.
  const work = mkdtempSync(join(tmpdir(), 'leanpowers-verify-'));
  spawnSync('git', ['init', '-q'], { cwd: work });

  const samePath = (a, b) => {
    try { return realpathSync(a) === realpathSync(b); } catch { return false; }
  };

  let failed = false;
  let unclear = false;
  let totalCost = 0;
  const report = (status, name, detail) => {
    if (status === 'FAIL') failed = true;
    if (status === 'UNCLEAR') unclear = true;
    console.log(`${status} ${name} ${detail}`);
  };

  function run(label, prompt, maxTurns, extra = [], env = {}) {
    const args = ['-p', prompt, '--plugin-dir', pluginDir, '--model', 'haiku',
      '--max-turns', String(maxTurns), '--max-budget-usd', '0.25',
      '--output-format', 'stream-json', '--verbose', ...extra];
    const res = spawnSync('claude', args, { cwd: work, encoding: 'utf8', timeout: 180000, env: { ...process.env, ...env } });
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
    // Spawn error, timeout, or exit without a result event (other than auth) cannot say anything about the package.
    const spawnFailed = Boolean(res.error) || res.status === null || !result.type;
    const authFailed = result.is_error === true && /authenticat|OAuth|log ?in/i.test(text);
    const why = authFailed ? 'not logged in: run `claude` and `/login`, then re-run'
      : spawnFailed ? 'claude did not run to completion: spawn error, timeout or no result event' : '';
    return { events, init, result, text, usage, why, stderr: res.stderr ?? '' };
  }

  // 1. Session-start injection (hook output reaches the model).
  const r1 = run('start', "Reply with the exact line that starts with 'Commands:' from your session context, nothing else.", 1);
  report(r1.why ? 'UNCLEAR' : r1.text.includes('Commands: design, plan') ? 'PASS' : 'FAIL', 'session-start',
    `${r1.usage} result=${JSON.stringify(r1.text.slice(0, 120))}${r1.why ? ` (${r1.why})` : ''}`);

  // Plugin wiring from the init event of run 1 (no model turn needed). The CLI's init event has no
  // plugin_errors field in 2.1.289, so loading is inferred from the plugin list and the namespaced entries.
  const plugins = r1.init.plugins ?? [];
  const mine = plugins.find((p) => p.name === 'leanpowers');
  const commands = (r1.init.slash_commands ?? []).filter((n) => n.startsWith('leanpowers:'));
  const skills = (r1.init.skills ?? []).filter((n) => n.startsWith('leanpowers:'));
  const has = (n) => commands.includes(`leanpowers:${n}`) || skills.includes(`leanpowers:${n}`);
  const both = commands.filter((n) => skills.includes(n));
  if (!r1.init.type) {
    report('UNCLEAR', 'coexist', `no init event; stderr=${r1.stderr.slice(0, 120)}`);
  } else {
    const ok = Boolean(mine) && samePath(mine.path, pluginDir) && has('check') && has('plan');
    report(ok ? 'PASS' : 'FAIL', 'coexist',
      `plugin=${mine ? `${mine.name}@${mine.version ?? '?'} ${mine.path}` : 'missing'} plugin_errors field=` +
      `${'plugin_errors' in r1.init ? JSON.stringify(r1.init.plugin_errors) : 'absent'} slashEntries=${commands.length}` +
      ` skills=${skills.length} check=${has('check')} plan=${has('plan')} commandAndSkill=${both.join(',') || 'none'}`);
  }

  // 2. Command wiring: the prompt is the bare slash command (any extra text would become $ARGUMENTS).
  // LEANPOWERS_CLI=leanpowers keeps the bin path out of the start text, so the path can only come from
  // the expanded commands/check.md.
  const r2 = run('check', '/leanpowers:check', 3, ['--allowedTools', 'Bash(node:*)'], { LEANPOWERS_CLI: 'leanpowers' });
  const c2 = r2.why ? { status: 'UNCLEAR', detail: `(${r2.why})` } : checkCommandEvidence(r2.events);
  report(c2.status, 'check-command', `${r2.usage} ${c2.detail} result=${JSON.stringify(r2.text.slice(0, 160))}`);

  // 3. ${CLAUDE_PLUGIN_ROOT} substitution inside commands/check.md, seen in the expanded command text.
  const bin = join(pluginDir, 'bin', 'leanpowers.mjs');
  const binPaths = [...new Set([bin, (() => { try { return realpathSync(bin); } catch { return bin; } })()])];
  const r3 = r2.why ? { status: 'UNCLEAR', detail: `no model run (${r2.why})` }
    : pluginRootEvidence(r2.events, { binPaths, source: readFileSync(join(pluginDir, 'commands', 'check.md'), 'utf8') });
  report(r3.status, 'plugin-root-var', r3.detail);

  console.log(`total cost: $${totalCost.toFixed(4)} (raw streams in ${work})`);
  process.exit(failed ? 1 : unclear ? 2 : 0);
}

// Run only when started as a script; tests import the evidence functions without a model run.
const isMain = () => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
};
if (process.argv[1] && isMain()) main();
