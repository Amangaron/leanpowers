import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bin = fileURLToPath(new URL('../bin/leanpowers.mjs', import.meta.url));
const repoRoot = path.dirname(path.dirname(bin));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { cwd: repoRoot, encoding: 'utf8' });

test('unknown command prints usage and exits 2', () => {
  const r = run('nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: leanpowers <check\|brief\|metrics\|config>/);
});

test('config prints merged JSON', () => {
  const r = run('config');
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).paths.specs, 'docs/specs');
});

test('brief without --task is a usage error', () => {
  assert.equal(run('brief', '--plan', 'x.md').status, 2);
});

test('check with only --plan or only --task is a usage error', () => {
  for (const args of [['--plan', 'x.md'], ['--task', '1']]) {
    const r = run('check', ...args);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: leanpowers <check\|brief\|metrics\|config>/);
  }
});
