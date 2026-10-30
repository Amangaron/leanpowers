import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listSkills, setSkills, toggle, nativeHint, tokenizeKeys } from '../checks/skills-cmd.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

// Keep the machine's real user config out of every in-process load and every spawn.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-xdg-'));

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

const bin = path.join(repo, 'bin/leanpowers.mjs');
const cli = (cwd, ...args) => spawnSync(process.execPath, [bin, ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, XDG_CONFIG_HOME: tmp() },
});

test('setSkills rejects a malformed leanpowers.json and leaves it untouched', () => {
  const cases = [
    ['{bad', /leanpowers\.json: invalid JSON \(/],
    ['null', /leanpowers\.json: expected an object/],
    ['[]', /leanpowers\.json: expected an object/],
    ['{"skills":"x"}', /leanpowers\.json: skills must be an object/],
  ];
  for (const [text, message] of cases) {
    const root = tmp();
    const file = path.join(root, 'leanpowers.json');
    fs.writeFileSync(file, text);
    assert.throws(() => setSkills(root, { debug: false }), message);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
    const r = cli(root, 'skills', '--set', 'debug=off');
    assert.equal(r.status, 1);
    assert.match(r.stderr, message);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
  }
});

function projectWithExtraSkill(config) {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'ex/foo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ex/foo/SKILL.md'), '---\nname: foo\ndescription: Extra foo skill.\n---\nBody\n');
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify(config));
  return root;
}

test('an extra skill stays switchable when leanpowers.json fails the schema', () => {
  const root = projectWithExtraSkill({ extraSkillDirs: ['ex'], zzz: 1 });
  const r = cli(root, 'skills', '--set', 'foo=off');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /warning: leanpowers\.json: zzz: unknown property/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8')).skills.foo, false);
});

test('tokenizeKeys handles arrows, SS3, batched keys, unknown sequences and a lone ESC', () => {
  assert.deepEqual(tokenizeKeys('\x1b[A'), ['up']);
  assert.deepEqual(tokenizeKeys('\x1bOB'), ['down']);
  assert.deepEqual(tokenizeKeys(' \x1b[B \r'), ['space', 'down', 'space', 'enter']);
  assert.deepEqual(tokenizeKeys('\x1b[1;5C\x1b[3~\x1bx'), []);
  assert.deepEqual(tokenizeKeys('\x1b'), ['cancel']);
  assert.deepEqual(tokenizeKeys('q'), ['cancel']);
  assert.deepEqual(tokenizeKeys('\x03'), ['cancel']);
});

test('codex hint uses the real SKILL.md path of an extra skill', () => {
  const root = projectWithExtraSkill({ extraSkillDirs: ['ex'], skills: { foo: false } });
  const list = listSkills(repo, root, { ...DEFAULTS, extraSkillDirs: ['ex'], skills: { foo: false } });
  const foo = list.find((s) => s.name === 'foo');
  assert.equal(foo.source, 'extra');
  const hint = nativeHint('codex', [foo]);
  assert.ok(hint.includes(`path = "${path.join(root, 'ex/foo/SKILL.md').split(path.sep).join('/')}"`), hint);
});
