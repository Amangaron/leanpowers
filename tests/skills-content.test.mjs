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
  assert.ok(read('skills/start/SKILL.md').includes('before any code or implementer dispatch'), 'start');
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

test('design names the size marker, the large criteria, the gates and the medium path', () => {
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('open your reply with the class in this exact form, in any language'), 'marker rule');
  assert.ok(design.includes('"Size: medium —'), 'marker example');
  assert.ok(design.includes('write no code, dispatch no implementer, scaffold nothing'), 'gate');
  assert.ok(design.includes('- **Large:** new feature or project, a new command or data field, several areas, or changed interfaces.'), 'large');
  assert.ok(design.includes('   This yes opens the spec, not the code: no implementer before an approved plan.'), 'step 4');
  assert.ok(design.includes('   Until the plan is approved, subagents may read, review or write the spec and plan, never code.'), 'subagents before plan');
  assert.ok(design.includes('up to three independent questions per message'), 'bundled questions');
  assert.ok(design.includes("configured paths win over other plugins' folders and temp folders"), 'own paths');
  assert.ok(design.includes('only approvals the user gave'), 'no claimed approvals');
  assert.ok(design.includes('Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.'), 'medium');
  assert.ok(design.includes('- "Design approved, one implementer will do" → that is medium; large needs spec and plan.'), 'red flag');
  const medium = read('skills/design/details/medium.md');
  assert.ok(medium.startsWith('# Medium path\n'), 'title');
  assert.ok(medium.includes('create and switch to `feat/<topic>`. A branch the user named wins.'), 'branch');
  assert.ok(medium.includes('in the form `<cli> check --brief <brief path>`'), 'check form');
  assert.ok(medium.includes('never store a command or path in a shell variable'), 'shell variable');
  assert.ok(medium.includes('Commit with `<type>: <topic>`, one commit.'), 'commit');
  assert.ok(medium.includes('list those folders as `Approved new folders: <folders>`.'), 'approved folders');
  assert.ok(medium.includes('run `leanpowers brief --file <brief path>`'), 'base');
  assert.ok(medium.includes('template `agents/implementer.md`'), 'template');
  assert.ok(medium.includes('run `leanpowers check --brief <brief path>` yourself'), 'check');
  assert.ok(medium.includes('invoke the `finish` skill, also when a commit failed'), 'finish');
  const startLarge = /^- Large: new feature, command or data field/m;
  assert.match(read('skills/start/SKILL.md'), startLarge, 'start and design share the large criteria');
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
  assert.ok(orchestrator.includes('- CLI: run every `leanpowers` command as `{{cli}}`; write commands and paths out, never in shell variables.'), 'cli line');
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
  assert.ok(ledger.includes('`Task <n>: implementer dispatched (<name>)`'), 'ledger line'); assert.ok(ledger.includes('`Task <n>: implementer id <id>`'), 'id line');
  assert.ok(ledger.includes('otherwise resume the implementer named by its `implementer id` line, else by its dispatched line; re-dispatch only when it cannot be resumed.'), 'resume rule');
  const loops = read('skills/run/details/loops.md');
  assert.ok(loops.includes('Never poll, and never end the turn while one of your subagents works. Never dispatch a second implementer for a task while the first may still be working.'), 'loops dispatch');
  assert.ok(loops.includes('never store it in a shell variable (`S="node …"; $S` fails in zsh, which does not split words).'), 'loops zsh');
});

test('finish blocks on uncommitted changes and the readmes name the medium check', () => {
  assert.ok(read('skills/finish/SKILL.md').includes('Uncommitted changes outside the run folder (the check warns about them) also block merge and pull request: list them and ask whether to commit them first.'));
  const en = read('docs/README.md');
  assert.ok(en.includes('| `check --brief <file>` |'), 'en check --brief');
  assert.ok(en.includes('| `brief --file <brief> [--reset-base]` |'), 'en brief --file');
  const de = read('docs/README.de.md');
  assert.ok(de.includes('| `check --brief <Datei>` |'), 'de check --brief');
  assert.ok(de.includes('| `brief --file <Brief> [--reset-base]` |'), 'de brief --file');
});

test('staff shows the staffing in every mode and names its own changes', () => {
  const staff = read('skills/staff/SKILL.md');
  assert.ok(staff.includes('3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:'), 'show');
  assert.ok(staff.includes('If you change a tier the staffer recommended, name each change and its reason in these lines.'), 'own changes');
  assert.ok(staff.includes("never a temp folder or another plugin's folder; creating it needs no question"), 'run folder');
  const auto = staff.slice(staff.indexOf('- **`auto`'));
  assert.ok(auto.indexOf('(none → `leanpowers`). Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim.') !== -1, 'platform line follows the dispatch');
});

test('finish runs without a feature branch or git write access and keeps the run report', () => {
  const finish = read('skills/finish/SKILL.md');
  assert.ok(finish.includes('If the work sits uncommitted on the base branch, create `feat/<topic>`'), 'uncommitted on base');
  assert.ok(finish.includes("offer only keep and push, and never rewrite the base branch's history"), 'committed on base');
  assert.ok(finish.includes('**Git read-only:**'), 'read-only');
  assert.ok(finish.includes('print the exact git commands for the user to run'), 'commands');
  assert.ok(finish.includes('only when `<paths.reports>/<plan-basename>.md` exists'), 'report before cleanup');
  const run = read('skills/run/SKILL.md');
  assert.ok(run.includes('then `leanpowers report --plan <plan>`, and commit the report.'), 'run end');
  const ledger = read('skills/run/details/ledger.md');
  assert.ok(ledger.indexOf('## Report') !== -1 && ledger.indexOf('## Report') < ledger.indexOf('## Metrics'), 'ledger report section');
  assert.ok(read('skills/plan/SKILL.md').includes('State only approvals the user gave.'), 'plan approvals');
});

test('every role writes shell commands and paths out', () => {
  for (const rel of ['agents/reviewer.md', 'agents/re-reviewer.md']) {
    assert.ok(read(rel).includes('- Write every shell command and path out in full; never store one in a shell variable.'), rel);
  }
  for (const p of ['claude-code', 'codex-cli', 'gemini-cli']) {
    const text = read(`platforms/${p}.md`);
    assert.ok(text.includes('\n## Shell\n\nWrite every shell command and path out in full; never store a command or path in a shell variable'), `${p}: shell`);
    assert.ok(text.indexOf('## Shell') < text.indexOf('## CLI'), `${p}: shell before CLI`);
    assert.ok(text.includes('Skills write `<plugin>` for the plugin folder: two levels above any leanpowers `SKILL.md`'), `${p}: plugin`);
  }
  assert.ok(read('platforms/codex-cli.md').includes('never pick a model name from a catalog or a model list'), 'codex model');
});

test('readmes name the report command and version 0.1.5', () => {
  const en = read('docs/README.md');
  assert.ok(en.includes('| `report --plan <file>` |'), 'en report');
  assert.ok(en.includes('Version 0.1.5.'), 'en version');
  const de = read('docs/README.de.md');
  assert.ok(de.includes('| `report --plan <Datei>` |'), 'de report');
  assert.ok(de.includes('Version 0.1.5.'), 'de version');
  assert.ok(read('README.md').includes('Current version: 0.1.5.'), 'root readme');
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.5\] - 2026-11-01$/m);
});
