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
  assert.match(read('skills/design/details/medium.md'), /`## When done`: run the `check` command as the `CLI:` line names it/);
  assert.match(read('skills/run/details/loops.md'), /inside an orchestrator, run `leanpowers brief`, `check` and `metrics` as `\{\{cli\}\}`/);
});

test('staff and run point at the shipped platform map', () => {
  const sentence = 'How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.';
  for (const rel of ['skills/staff/SKILL.md', 'skills/run/SKILL.md']) assert.ok(read(rel).includes(sentence), rel);
});

test('orchestration waits instead of stalling and approval comes before delegation', () => {
  assert.ok(read('skills/start/SKILL.md').includes('before any code or subagent dispatch'), 'start');
  assert.match(read('agents/orchestrator.md'), /turn ends only with a final reply whose first line is `Status: DONE` or `Status: NEEDS_USER`/);
  assert.ok(read('skills/run/SKILL.md').includes('never end the turn'), 'run');
});

test('ledger formats cover final minors, final rulings and extra sections; run points at them', () => {
  const ledger = read('skills/run/details/ledger.md');
  assert.ok(ledger.includes('Final: minor (deferred)'), 'final minor line');
  assert.ok(ledger.includes('Final: Ruling:'), 'final ruling line');
  assert.ok(ledger.includes('## Notes'), 'extra sections');
  assert.ok(read('skills/run/SKILL.md').includes('Final: minor (deferred)'), 'run End step 4');
});

test('readmes tell users to start a new session after a plugin update', () => {
  for (const rel of ['README.md', 'docs/README.md']) assert.match(read(rel), /start a new session/, rel);
  assert.match(read('docs/README.de.md'), /neue Sitzung/);
});

test('design names the size marker, the plan gate and the medium brief check', () => {
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('open your reply with the class in this exact form, in any language'), 'marker rule');
  assert.ok(design.includes('"Size: medium —'), 'marker example');
  assert.ok(design.includes('   This yes opens the spec, not the code: no implementer before an approved plan.'), 'step 4');
  assert.ok(design.includes('- "Design approved, one implementer will do" → that is medium; large needs spec and plan.'), 'red flag');
  assert.ok(design.includes('write the brief as [details/medium.md](details/medium.md) says and run `leanpowers brief --file <brief>`'), 'medium brief');
  assert.ok(design.includes('run `leanpowers check --brief <brief>` yourself, then invoke the `finish` skill. No spec, no plan.'), 'check --brief and finish');
  const medium = read('skills/design/details/medium.md');
  assert.ok(medium.startsWith('# Medium brief\n'), 'title');
  assert.ok(medium.includes('in the form `<cli> check --brief <brief path>`'), 'check form');
  assert.ok(medium.includes('never store\n  it in a shell variable'), 'shell variable');
  assert.ok(medium.includes('Commit with `<type>: <topic>`, one commit.'), 'commit');
  assert.ok(medium.includes('list those folders\n  as `Approved new folders: <folders>`.'), 'approved folders');
  assert.ok(medium.includes('Then run `leanpowers brief --file <brief path>`'), 'base');
});

test('verify names what check and check --all run, and the medium check', () => {
  const verify = read('skills/verify/SKILL.md');
  assert.ok(verify.includes('which runs the configured gates (tests, typecheck, lint); `--all` adds doc-lint and skill-lint.'));
  assert.ok(verify.includes('- For a medium task, use `leanpowers check --brief <brief>`.'));
});

test('orchestrator turn rule, resume before re-dispatch, one implementer per task', () => {
  const orchestrator = read('agents/orchestrator.md');
  const turn = orchestrator.indexOf('## Turn rule');
  assert.ok(turn > 0 && turn < orchestrator.indexOf('## Inputs'), 'turn rule before inputs');
  assert.ok(orchestrator.includes('Dispatch every implementer and reviewer in the foreground, never in the background.'), 'foreground');
  assert.ok(orchestrator.includes('Never dispatch a second implementer for a task while the first may still be working.'), 'second implementer');
  assert.ok(orchestrator.includes('- CLI: run every `leanpowers` command as `{{cli}}`, written out, never from a shell variable.'), 'cli line');
  assert.ok(orchestrator.includes('4. Stop only for the four reasons in `run`. Write `Stop: <question>` to the ledger, then return:'), 'stop reasons');
  assert.ok(!orchestrator.includes('- Wait for every subagent in the foreground'), 'old hard rule removed');
  const staff = read('skills/staff/SKILL.md');
  assert.ok(staff.includes('Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim.'), 'platform line');
  assert.ok(staff.includes('resume the same orchestrator once'), 'resume once');
  assert.ok(staff.includes('Only if it cannot be resumed or ends with neither again, dispatch a fresh one with the same inputs'), 'fresh only after');
  assert.ok(read('platforms/claude-code.md').includes('Dispatch in the foreground: never set `run_in_background`.'), 'claude');
  for (const p of ['codex-cli', 'gemini-cli']) {
    assert.ok(read(`platforms/${p}.md`).includes('Never dispatch a second agent for a task while the first may still be working.'), p);
  }
  const ledger = read('skills/run/details/ledger.md');
  assert.ok(ledger.includes('`Task <n>: implementer dispatched (<agent name or id>)`'), 'ledger line');
  assert.ok(ledger.includes('if a dispatched line names an implementer, resume that one; re-dispatch only when it cannot be resumed.'), 'resume rule');
  const loops = read('skills/run/details/loops.md');
  assert.ok(loops.includes('Never poll, and never end the turn while one of your subagents works. Never dispatch a second implementer for a task while the first may still be working.'), 'loops dispatch');
  assert.ok(loops.includes('never store it in a shell variable (`S="node …"; $S` fails in zsh, which does not split words).'), 'loops zsh');
});
