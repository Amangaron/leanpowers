import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter, countWords, estimateTokens, lintSkills } from '../checks/skill-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const words = (n) => Array.from({ length: n }, () => 'w').join(' ');
const skill = (name, body, desc = 'Use when testing.') => `---\nname: ${name}\ndescription: ${desc}\n---\n${body}\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-skill-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

test('parseFrontmatter and counting helpers', () => {
  assert.deepEqual(parseFrontmatter('---\nname: a\ndescription: b c\n---\nbody'), { data: { name: 'a', description: 'b c' }, body: 'body' });
  assert.equal(parseFrontmatter('no frontmatter'), null);
  assert.equal(countWords(' a  b\nc '), 3);
  assert.equal(estimateTokens(words(3)), 4);
});

test('parseFrontmatter normalizes CRLF line endings', () => {
  assert.deepEqual(parseFrontmatter('---\r\nname: a\r\ndescription: b c\r\n---\r\nbody\r\n'), { data: { name: 'a', description: 'b c' }, body: 'body\n' });
});

test('valid skills, agents and start text pass', () => {
  const root = project({
    'skills/plan/SKILL.md': skill('plan', 'See [details](details/x.md).'),
    'skills/plan/details/x.md': 'more',
    'skills/start/SKILL.md': skill('start', words(100)),
    'agents/implementer.md': skill('implementer', words(400)),
  });
  assert.deepEqual(lintSkills(root, DEFAULTS), { name: 'skill-lint', ok: true, messages: [] });
});

test('limits, names, descriptions and links are enforced', () => {
  const root = project({
    'skills/plan/SKILL.md': skill('wrong', words(601) + ' [x](details/missing.md)', words(61)),
    'skills/start/SKILL.md': skill('start', words(120)),
    'skills/bare/SKILL.md': 'no frontmatter',
    'agents/reviewer.md': skill('reviewer', words(401)),
  });
  const r = lintSkills(root, DEFAULTS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, [
    'agents/reviewer.md: 401 words (max 400)',
    'skills/bare/SKILL.md: missing frontmatter',
    'skills/plan/SKILL.md: name "wrong" must be "plan"',
    'skills/plan/SKILL.md: description 61 words (max 60)',
    'skills/plan/SKILL.md: 602 words (max 600)',
    'skills/plan/SKILL.md: broken link details/missing.md',
    'skills/start/SKILL.md: start text ~160 tokens (max 150)',
  ]);
});

test('extraSkillDirs are linted too', () => {
  const root = project({ 'extra/foo/SKILL.md': skill('foo', words(700)) });
  const r = lintSkills(root, { ...DEFAULTS, extraSkillDirs: ['extra'] });
  assert.deepEqual(r.messages, ['extra/foo/SKILL.md: 700 words (max 600)']);
});

test('no skills at all is ok', () => {
  assert.equal(lintSkills(project({}), DEFAULTS).ok, true);
});
