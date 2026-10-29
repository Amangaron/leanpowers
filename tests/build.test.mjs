import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build/build.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-build-'));
build(repo, out);
const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(out, rel));

test('claude package has manifest, hook, commands and runtime', () => {
  const pj = JSON.parse(read('claude-plugin/.claude-plugin/plugin.json'));
  assert.equal(pj.name, 'leanpowers');
  assert.equal(pj.version, JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version);
  const hooks = JSON.parse(read('claude-plugin/hooks/hooks.json'));
  assert.match(JSON.stringify(hooks), /bin\/leanpowers\.mjs\\?" start --format claude/);
  for (const c of ['design', 'plan', 'staff', 'run', 'debug', 'finish', 'check', 'skills', 'init']) {
    assert.ok(exists(`claude-plugin/commands/${c}.md`), c);
  }
  assert.ok(exists('claude-plugin/bin/leanpowers.mjs'));
  assert.ok(exists('claude-plugin/skills/run/SKILL.md'));
});

test('agent templates ship as prompts, never as agents', () => {
  assert.ok(!exists('claude-plugin/agents'));
  assert.ok(exists('claude-plugin/prompts/implementer.md'));
  const run = read('claude-plugin/skills/run/SKILL.md');
  assert.doesNotMatch(run, /`agents\//);
});

test('marketplace points at the claude package', () => {
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(m.plugins[0].name, 'leanpowers');
  assert.equal(m.plugins[0].source, './dist/claude-plugin');
});
