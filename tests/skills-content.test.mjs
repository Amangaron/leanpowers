import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, countWords } from '../checks/skill-lint.mjs';
import { lintSkills } from '../checks/skill-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { PLATFORM_MAP } from '../build/build.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TOOL_NAMES = ['TodoWrite', 'AskUserQuestion', 'spawn_agent', 'invoke_agent', 'write_todos', 'activate_skill', 'Task tool', 'Agent tool', 'Skill tool'];
const HARD_PATHS = ['docs/superpowers', '.superpowers/', 'docs/specs/', 'docs/plans/', 'superpowers:'];

const ls = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readdirSync(path.join(root, rel)) : []);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n?/g, '\n');
const skillNames = () => ls('skills').filter((d) => fs.existsSync(path.join(root, 'skills', d, 'SKILL.md')));
const contentFiles = () => [
  ...skillNames().map((d) => `skills/${d}/SKILL.md`),
  ...skillNames().flatMap((d) => ls(`skills/${d}/details`).filter((f) => f.endsWith('.md')).map((f) => `skills/${d}/details/${f}`)),
  ...ls('agents').filter((f) => f.endsWith('.md')).map((f) => `agents/${f}`),
];

test('skills and agents never name platform tools or hard-coded paths', () => {
  for (const rel of contentFiles()) {
    const text = read(rel);
    for (const bad of [...TOOL_NAMES, ...HARD_PATHS]) {
      assert.ok(!text.includes(bad), `${rel}: contains "${bad}"`);
    }
  }
});

test('every skill except start begins with its switch line', () => {
  for (const name of skillNames().filter((n) => n !== 'start')) {
    const { body } = parseFrontmatter(read(`skills/${name}/SKILL.md`));
    const first = body.split('\n').find((l) => l.trim() !== '');
    assert.equal(first, `If \`skills.${name}\` is false in leanpowers.json, say "leanpowers: ${name} is disabled" and stop.`, name);
  }
});

test('descriptions start with "Use when"', () => {
  for (const rel of contentFiles().filter((r) => !r.includes('/details/'))) {
    const fm = parseFrontmatter(read(rel));
    assert.ok(fm && fm.data.description.startsWith('Use when'), rel);
  }
});

test('platform maps exist, stay small and have the fixed sections', () => {
  for (const p of ['claude', 'codex', 'gemini']) {
    const text = read(`platforms/${PLATFORM_MAP[p]}.md`);
    assert.ok(countWords(text) <= 500, `${p}: ${countWords(text)} words`);
    for (const h of ['## Actions', '## Model tiers', '## Orchestration', '## CLI']) {
      assert.ok(text.includes(`\n${h}\n`), `${p}: missing ${h}`);
    }
  }
});

const SKILLS = ['start', 'design', 'plan', 'staff', 'run', 'review', 'tdd', 'debug', 'verify', 'worktrees', 'finish', 'write-skill'];
const AGENTS = ['implementer', 'reviewer', 're-reviewer', 'staffer', 'orchestrator'];

test('the full skill and agent set exists and passes skill-lint', () => {
  assert.deepEqual(skillNames().sort(), [...SKILLS].sort());
  assert.deepEqual(ls('agents').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort(), [...AGENTS].sort());
  assert.deepEqual(lintSkills(root, DEFAULTS).messages, []);
});

test('subagents without a generated brief get the resolved CLI', () => {
  const orchestrator = read('agents/orchestrator.md');
  assert.match(orchestrator, /run every `leanpowers` command as `\{\{cli\}\}`/);
  assert.match(read('skills/staff/SKILL.md'), /`\{\{cli\}\}` the command from the `CLI:` line/);
  const design = read('skills/design/SKILL.md');
  assert.match(design, /`## When done`: run the `check` command as the `CLI:` line names it/);
  assert.match(read('skills/run/details/loops.md'), /inside an orchestrator, run `leanpowers brief`, `check` and `metrics` as `\{\{cli\}\}`/);
});

test('staff and run point at the shipped platform map', () => {
  const sentence = 'How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.';
  for (const rel of ['skills/staff/SKILL.md', 'skills/run/SKILL.md']) assert.ok(read(rel).includes(sentence), rel);
});

test('orchestration waits instead of stalling and approval comes before delegation', () => {
  assert.ok(read('skills/start/SKILL.md').includes('before any code or subagent dispatch'), 'start');
  assert.match(read('agents/orchestrator.md'), /turn ends only with a final reply starting `Status: DONE` or `Status: NEEDS_USER`/);
  assert.ok(read('skills/run/SKILL.md').includes('never end the turn'), 'run');
});
