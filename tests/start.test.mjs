import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startText, agentsMdText, cliCommand, COMMANDS } from '../checks/start.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { estimateTokens } from '../checks/skill-lint.mjs';

// Keep the machine's real user config out of the spawned CLI.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-xdg-'));

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('start text lists all commands by default and stays small', () => {
  const t = startText(repo, DEFAULTS);
  assert.match(t, /^Commands: design, plan, staff, run, debug, finish, check, skills, init\.$/m);
  assert.doesNotMatch(t, /^---/m);
  assert.ok(estimateTokens(t) <= 150);
});

test('disabled skills drop their command, CLI commands stay', () => {
  const t = startText(repo, { ...DEFAULTS, skills: { ...DEFAULTS.skills, staff: false, debug: false } });
  assert.match(t, /^Commands: design, plan, run, finish, check, skills, init\.$/m);
});

test('cliCommand prefers LEANPOWERS_CLI, else node with absolute bin path', () => {
  const old = process.env.LEANPOWERS_CLI;
  process.env.LEANPOWERS_CLI = 'lp';
  assert.equal(cliCommand(), 'lp');
  delete process.env.LEANPOWERS_CLI;
  assert.match(cliCommand(), /^node ".*\/bin\/leanpowers\.mjs"$/);
  if (old !== undefined) process.env.LEANPOWERS_CLI = old;
  assert.equal(COMMANDS.length, 9);
});

test('CLI start prints plain text or Claude hook JSON', () => {
  const bin = path.join(repo, 'bin/leanpowers.mjs');
  const plain = spawnSync(process.execPath, [bin, 'start'], { cwd: repo, encoding: 'utf8' });
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /^Commands: /m);
  const json = spawnSync(process.execPath, [bin, 'start', '--format', 'claude'], { cwd: repo, encoding: 'utf8' });
  const out = JSON.parse(json.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /^Commands: /m);
});

test('start text tells how to run the CLI unless it is on PATH', () => {
  const saved = process.env.LEANPOWERS_CLI;
  delete process.env.LEANPOWERS_CLI;
  try {
    const plain = startText(repo, DEFAULTS, 'leanpowers');
    assert.doesNotMatch(plain, /^CLI:/m);
    const t = startText(repo, DEFAULTS);
    assert.match(t.trimEnd().split('\n').at(-1), /^CLI: run leanpowers as node ".*\/bin\/leanpowers\.mjs"\.$/);
    assert.ok(estimateTokens(t) <= 150);
    assert.equal(startText(repo, DEFAULTS, 'lp').trimEnd().split('\n').at(-1), 'CLI: run leanpowers as lp.');
  } finally {
    if (saved !== undefined) process.env.LEANPOWERS_CLI = saved;
  }
});

test('start text invokes design before any text or tool, names the sizes and a gate for every size', () => {
  const t = startText(repo, DEFAULTS, 'leanpowers');
  assert.ok(t.includes('leanpowers: on a change request, invoke the `design` skill before any text or tool; after reading the code it opens with `Size: small|medium|large` (unclear → larger):'));
  assert.match(t, /^- Small: one file plus its test, clear fix\.$/m);
  assert.match(t, /^- Medium: bounded change to an existing flow\.$/m);
  assert.match(t, /^- Large: new feature, command or data field, several areas, or interfaces\.$/m);
  assert.ok(t.includes(`Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch, delegation rules included; only "implement directly" for this task skips it.`));
  assert.doesNotMatch(t, /before answering any change request|Open with `Size|User instructions win|subagent dispatch/);
  assert.ok(estimateTokens(t) <= 150);
  assert.ok(estimateTokens(agentsMdText(repo, DEFAULTS)) <= 150);
});
