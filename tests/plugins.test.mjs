import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePluginSkillDir, resolveSkillDirs } from '../checks/lib/plugins.mjs';
import { lintSkills } from '../checks/skill-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const home = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-home-'));
const mk = (...p) => { fs.mkdirSync(path.join(...p), { recursive: true }); return path.join(...p); };

test('Claude Code: installed_plugins.json installPath', () => {
  const h = home();
  const install = mk(h, '.claude/plugins/cache/m/lido/0.1.0');
  mk(install, 'skills');
  mk(h, '.claude/plugins');
  fs.writeFileSync(path.join(h, '.claude/plugins/installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'lido@m': [{ scope: 'user', installPath: install }] } }));
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(install, 'skills'));
});

test('Codex: highest cached version wins', () => {
  const h = home();
  mk(h, '.codex/plugins/cache/m/lido/0.9.0/skills');
  mk(h, '.codex/plugins/cache/m/lido/0.10.1/skills');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(h, '.codex/plugins/cache/m/lido/0.10.1/skills'));
});

test('Gemini: extensions folder', () => {
  const h = home();
  mk(h, '.gemini/extensions/lido/skills');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), path.join(h, '.gemini/extensions/lido/skills'));
});

test('not found and broken JSON give null', () => {
  const h = home();
  mk(h, '.claude/plugins');
  fs.writeFileSync(path.join(h, '.claude/plugins/installed_plugins.json'), '{broken');
  assert.equal(resolvePluginSkillDir('lido', { home: h }), null);
});

test('resolveSkillDirs mixes plain and plugin entries and warns', () => {
  const h = home();
  mk(h, '.gemini/extensions/lido/skills');
  const root = home();
  const r = resolveSkillDirs(root, ['skills-extra', 'plugin:lido', 'plugin:fehlt'], { home: h });
  assert.deepEqual(r.dirs, [
    { dir: path.resolve(root, 'skills-extra'), source: 'extra' },
    { dir: path.join(h, '.gemini/extensions/lido/skills'), source: 'plugin:lido' },
  ]);
  assert.deepEqual(r.warnings, ['extraSkillDirs: plugin fehlt not found']);
});

test('lintSkills lints plugin skills and returns not-found warnings without failing', () => {
  const h = home();
  const dir = mk(h, '.gemini/extensions/lido/skills/foo');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: foo\ndescription: Foo.\n---\n${'w '.repeat(700)}\n`);
  const root = home();
  const r = lintSkills(root, { ...DEFAULTS, extraSkillDirs: ['plugin:lido'] }, { home: h });
  assert.deepEqual(r.messages, ['plugin:lido/foo/SKILL.md: 700 words (max 600)']);
  const missing = lintSkills(root, { ...DEFAULTS, extraSkillDirs: ['plugin:fehlt'] }, { home: h });
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.warnings, ['extraSkillDirs: plugin fehlt not found']);
});

test('check --all lists a missing plugin as a warning after the green line', () => {
  const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const root = home();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'node -e ""' }, extraSkillDirs: ['plugin:fehlt'] }));
  const r = spawnSync(process.execPath, [path.join(repo, 'bin/leanpowers.mjs'), 'check', '--all'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home(), USERPROFILE: home(), XDG_CONFIG_HOME: home() },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), '✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)\n⚠ extraSkillDirs: plugin fehlt not found');
});
