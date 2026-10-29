import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listSkills, setSkills, toggle, nativeHint } from '../checks/skills-cmd.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-skills-'));

test('listSkills shows builtin skills with switches, start excluded', () => {
  const list = listSkills(repo, tmp(), DEFAULTS);
  const names = list.map((s) => s.name);
  assert.ok(!names.includes('start'));
  assert.ok(names.includes('design'));
  assert.equal(list.find((s) => s.name === 'worktrees').enabled, false);
  assert.equal(list.find((s) => s.name === 'design').enabled, true);
});

test('setSkills writes only skills and keeps other keys', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'npm test' } }));
  setSkills(root, { worktrees: true, debug: false });
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'));
  assert.deepEqual(cfg, { commands: { test: 'npm test' }, skills: { worktrees: true, debug: false } });
  assert.throws(() => setSkills(root, { nope: true }), /unknown skill: nope/);
});

test('toggle moves the cursor and flips the current item', () => {
  let s = { cursor: 0, items: [{ name: 'a', enabled: true }, { name: 'b', enabled: false }] };
  s = toggle(s, 'down');
  s = toggle(s, 'space');
  assert.deepEqual(s, { cursor: 1, items: [{ name: 'a', enabled: true }, { name: 'b', enabled: true }] });
  assert.equal(toggle(s, 'down').cursor, 1);
  assert.equal(toggle(toggle(s, 'up'), 'up').cursor, 0);
});

test('native hints name the platform mechanism', () => {
  assert.match(nativeHint('gemini', ['debug']), /\/skills disable debug/);
  assert.match(nativeHint('codex', ['debug']), /\[\[skills\.config\]\]/);
  assert.match(nativeHint('claude', ['debug']), /leanpowers\.json/);
});

test('CLI --set and --list round-trip', () => {
  const root = tmp();
  const bin = path.join(repo, 'bin/leanpowers.mjs');
  const env = { ...process.env, XDG_CONFIG_HOME: tmp() };
  assert.equal(spawnSync(process.execPath, [bin, 'skills', '--set', 'debug=off'], { cwd: root, env, encoding: 'utf8' }).status, 0);
  const out = spawnSync(process.execPath, [bin, 'skills', '--list'], { cwd: root, env, encoding: 'utf8' }).stdout;
  assert.match(out, /^\[ \] debug — /m);
  assert.match(out, /^\[x\] design — /m);
});
