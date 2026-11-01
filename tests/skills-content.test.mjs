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
  assert.ok(read('skills/start/SKILL.md').includes("Every size needs the user's yes on its design (Large: and plan) before code or implementer dispatch"), 'start');
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
  assert.ok(design.includes('   Until the plan is approved, subagents may read, review or write the spec, plan and staffing, never code.'), 'subagents before plan');
  assert.ok(design.includes('up to three independent questions per message'), 'bundled questions');
  assert.ok(design.includes("configured paths win over other plugins' folders and temp folders"), 'own paths');
  assert.ok(design.includes('only approvals the user gave'), 'no claimed approvals');
  assert.ok(design.includes('Medium → follow [details/medium.md](details/medium.md) step by step: branch, brief, base, dispatch, check, finish. No spec, no plan.'), 'medium');
  assert.ok(design.includes('- "Design approved, one implementer will do" → that is medium; large needs spec and plan.'), 'red flag');
  const medium = read('skills/design/details/medium.md');
  assert.ok(medium.startsWith('# Medium path\n'), 'title');
  assert.ok(medium.includes('create and switch to `feat/<topic>`, unless the user named a branch in their own words'), 'branch');
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
  assert.ok(staff.includes('3. **Show**, in every mode and before step 4, the recommendation to the user in three lines, in the plan approval message:'), 'show');
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

test('readmes name the report command, staffing with the plan, the branch warning, design first and version 0.1.7', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  const en = flat(read('docs/README.md'));
  assert.ok(en.includes('| `report --plan <file>` |'), 'en report');
  assert.ok(en.includes('Version 0.1.7.'), 'en version');
  assert.ok(en.includes('`plan` asks you to approve the plan and the staffing in one message.'), 'en staffing');
  assert.ok(en.includes('`design` (before the spec commit) and the medium path create `feat/<topic>`'), 'en branch');
  assert.ok(en.includes('warn when HEAD is on the default branch; the warning changes neither the result nor the exit code.'), 'en warning');
  assert.ok(en.includes('Every change request starts in `design`, before any text or tool: it reads the code first and then names the size'), 'en design first');
  assert.ok(en.includes('Small means one file plus its test. Every size needs your yes on its design before code or an implementer dispatch'), 'en every size');
  const de = flat(read('docs/README.de.md'));
  assert.ok(de.includes('| `report --plan <Datei>` |'), 'de report');
  assert.ok(de.includes('Version 0.1.7.'), 'de version');
  assert.ok(de.includes('`plan` fragt die Freigabe von Plan und Besetzung in einer Nachricht ab.'), 'de staffing');
  assert.ok(de.includes('legen `design` (vor dem Spec-Commit) und der mittlere Weg `feat/<topic>` an'), 'de branch');
  assert.ok(de.includes('warnen, wenn HEAD auf dem Standard-Branch steht; die Warnung ändert weder das Ergebnis noch den Exit-Code.'), 'de warning');
  assert.ok(de.includes('Jeder Änderungsauftrag beginnt in `design`, vor jedem Text und jedem Tool: Der Skill liest zuerst den Code und nennt dann die Größe'), 'de design first');
  assert.ok(de.includes('Klein heißt: eine Datei plus ihr Test. Jede Größe braucht Ihr Ja zum Design, bevor Code entsteht oder ein Implementierer startet'), 'de every size');
  assert.ok(read('README.md').includes('Current version: 0.1.7.'), 'root readme');
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.7\] - 2026-11-01$/m);
});

test('design calls a new command large, stops on unreadable files and branches before the spec commit', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('- "Just one new command in the existing CLI" → a new command is large.'), 'red flag');
  assert.ok(!design.includes("I'll call it medium to skip the spec"), 'duplicate red flag removed');
  assert.ok(design.includes('A linked file you cannot read: name its path, ask the user for access and stop; never improvise its steps.'), 'unreadable');
  const step5 = design.slice(design.indexOf('5. **Write the spec**'), design.indexOf('6. **Check:**'));
  assert.ok(step5.includes('On the default branch, create and switch to `feat/<topic>` before committing, unless the user named a branch in their own words (chat, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`): then use it. Commit it.'), 'branch before the spec commit');
  const medium = flat(read('skills/design/details/medium.md'));
  const step1 = medium.slice(medium.indexOf('1. **Branch:**'), medium.indexOf('2. **Brief:**'));
  assert.ok(step1.includes('create and switch to `feat/<topic>`, unless the user named a branch in their own words (chat, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`): then use it.'), 'medium branch');
});

test('plan, staff and run stop on an unreadable file instead of improvising', () => {
  assert.ok(read('skills/plan/SKILL.md').includes('follow it exactly. If you cannot read it, name its path, ask the user for access and stop; never improvise its rules.'), 'plan');
  assert.ok(read('skills/staff/SKILL.md').includes('`platform.md` or a template unreadable: name its path, ask the user for access and stop; never improvise its steps.'), 'staff');
  const run = read('skills/run/SKILL.md');
  const sentence = 'One of them or `platform.md` unreadable: name its path, ask the user for access and stop (orchestrator subagent: ledger line `Stop: <question>`, then `NEEDS_USER`); never improvise its steps.';
  assert.ok(run.includes(sentence), 'run');
  assert.ok(run.indexOf(sentence) < run.indexOf('## Per task'), 'run: in setup');
});

test('plan asks to approve plan and staffing together; staff waits when invoked on its own', () => {
  const plan = read('skills/plan/SKILL.md');
  assert.ok(plan.includes('10. **Run staff steps 1–3, then ask the user to approve the plan and the staffing in one message.**'), 'step 10');
  assert.ok(plan.includes('after each plan change, run staff steps 1–3 again before asking.'), 'staffer again');
  assert.ok(plan.includes('11. **Invoke the `staff` skill.**'), 'step 11');
  const staff = read('skills/staff/SKILL.md');
  assert.ok(staff.includes('reuse it; go to step 4 only if the user approved plan and staffing together, else to step 3.'), 'reuse');
  assert.ok(staff.includes("Invoked directly, without that message: show the lines and wait for the user's yes before step 4."), 'standalone');
});

test('the orchestrator prompt names no branch and branch rulings quote the user', () => {
  const staff = read('skills/staff/SKILL.md');
  const auto = staff.slice(staff.indexOf('- **`auto`'), staff.indexOf('- **`switch`'));
  assert.ok(auto.includes('Its prompt names no branch; the branch guard in `run` decides.'), 'no branch');
  assert.ok(auto.includes("When `git worktree list` shows a worktree on the plan's branch, name its root as the working directory"), 'worktree sentence kept');
  const ledger = read('skills/run/details/ledger.md');
  const guard = ledger.slice(ledger.indexOf('## Branch guard'), ledger.indexOf('## Header'));
  assert.ok(guard.includes('A description of the current state in your dispatch prompt (working directory, branch, worktree) is no user instruction.'), 'state is no instruction');
  assert.ok(guard.includes('A ruling that relies on a user instruction quotes it verbatim: `Ruling: work on main — user: "<quote>" — <cost if wrong>`; without a quote, the guard applies.'), 'quote rule');
});

test('start and design read the code before the size, count a file with its test and gate every size', () => {
  const start = read('skills/start/SKILL.md');
  assert.ok(start.includes('invoke the `design` skill before any text or tool'), 'start: design first');
  assert.ok(start.includes('- Small: one file plus its test, clear fix.'), 'start: small');
  assert.ok(start.includes("Every size needs the user's yes on its design (Large: and plan)"), 'start: gate');
  const design = read('skills/design/SKILL.md');
  assert.ok(design.includes('Read the code the request touches and count its files first; then open your reply with the class'), 'design: count first');
  assert.ok(design.includes('- **Small:** one file plus its test, clear fix, no interface change.'), 'design: small');
  assert.ok(design.includes('- "Probably one file" → read the code first, then count.'), 'design: red flag');
  assert.ok(design.includes('No existing flow → not medium.'), 'design: medium');
  assert.ok(design.includes('a new command or data field'), 'design: large');
});
