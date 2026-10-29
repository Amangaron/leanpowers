import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startText, cliCommand, COMMANDS } from '../checks/start.mjs';
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
