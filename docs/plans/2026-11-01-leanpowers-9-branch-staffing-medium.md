# leanpowers Plan 9 – Medium path, staffing with the plan approval, feature branch (v0.1.6) Implementation Plan

**Goal:** Make the medium path follow `details/medium.md` step by step or stop, bring the staffing to the user together with the plan approval, and keep spec, plan, code and report on a feature branch the main session creates, with a default-branch warning from `brief` and the task check – released as 0.1.6.

**Spec:** `docs/specs/2026-11-01-leanpowers-0.1.6-design.md`

**Architecture:** Three read-only git helpers in `checks/lib/git.mjs` feed a default-branch warning into the task and brief forms of `check` and into `brief` (Task 1); text changes in `skills/` for `design` and the medium path (Task 2) and for `plan`, `staff`, `run` and the ledger (Task 3); then a release task (Task 4). Tasks 1 and 2 run in parallel on disjoint files, including their own generated `dist/` files. The test run with a real assistant (spec section 8) is not part of this plan; the main session runs it after the release task.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Work on branch `claude/busy-hermann-fcc04a` (already checked out); never push, never tag, never merge, never `git stash`.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)` after its commit.
- After changing anything the build copies (`skills/`, `agents/`, `checks/`, `bin/`, `platforms/`, `schema/`, `templates/`), run `npm run build`: the test `committed dist matches a fresh build` fails otherwise. Stage only the generated `dist/` files your task lists under **Files:**, by path.
- Skill and agent texts stay within the limits checked by `skill-lint` (skills ≤ 600 words, agents ≤ 400 words, description ≤ 60 words, start text ≤ 150 tokens); `agents/implementer.md` must not change.
- Skill, agent and platform texts are English; keep the existing style (short imperative sentences); never name platform tools in `skills/` or `agents/` (only in `platforms/`); never name another plugin or a fixed docs path in `skills/` or `agents/` (`tests/skills-content.test.mjs` rejects them).
- Write every shell command and path out in full in every call; never store a command or path in a shell variable (`S="node …"; $S` fails in zsh, which does not split words, and some harnesses block variables).
- Public repository: no names of private or customer projects in code, texts, tests, CHANGELOG or commit messages; describe the trigger only as "test run" or "test project".
- When a task cites a spec section, the implementer may read exactly that section of `docs/specs/2026-11-01-leanpowers-0.1.6-design.md` (German).
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.
- Spec, section 1 (verbatim): "Der Charakter bleibt: schlank, technikneutral, gleiche Regeln für Claude Code, Codex CLI und Gemini CLI, keine kostenpflichtigen KI-Läufe in Tests (Haupt-Spec Abschnitt 16)." (Lean, technology-neutral, the same rules for all three assistants, no paid AI runs in tests.)
- Spec, section 3 (verbatim): "Keine Lockerung der Größenregel." (The size rule bullets in `design` stay as they are.)
- Spec, section 3 (verbatim): "Keine Branch-Warnung in `check --all` oder im einfachen `check`: Nach jedem regulären Merge nach `main` gäbe es dort Fehlalarme." (No branch warning in `check --all` or the plain `check`.)
- Spec, section 3 (verbatim): "Keine Git-Schreibbefehle in der CLI; sie bleibt lesend." (The CLI runs no git write commands.)
- Spec, section 3 (verbatim): "`finish` bleibt unverändert." (`skills/finish/SKILL.md` must not change.)
- Spec, section 3 (verbatim): "`agents/staffer.md` und das Format von `besetzung.md` bleiben unverändert."
- Spec, section 4.4 (verbatim): "`agents/orchestrator.md` bleibt unverändert."
- Spec, section 3, non-goal (verbatim): "Höhere Wortgrenzen (Skills 600, Agent-Vorlagen 400)." (The word limits are not raised.)
- Spec, section 6.4 (verbatim): "Die Warnung scheitert nie; Exit-Code und stdout bleiben unverändert." (The warning never fails; exit code and stdout stay unchanged.)

---

### Task 1: Default-branch warning in `brief` and the task check (spec sections 6.4, 6.6 code tests)

**Risk:** high
**Parallel:** true

**Files:**
- Modify: `checks/lib/git.mjs`
- Modify: `checks/check.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/git.test.mjs`
- Test: `tests/check.test.mjs`
- Test: `tests/cli.test.mjs`
- Modify: `dist/claude-plugin/checks/lib/git.mjs`
- Modify: `dist/codex-plugin/checks/lib/git.mjs`
- Modify: `dist/gemini-extension/checks/lib/git.mjs`
- Modify: `dist/claude-plugin/checks/check.mjs`
- Modify: `dist/codex-plugin/checks/check.mjs`
- Modify: `dist/gemini-extension/checks/check.mjs`
- Modify: `dist/claude-plugin/bin/leanpowers.mjs`
- Modify: `dist/codex-plugin/bin/leanpowers.mjs`
- Modify: `dist/gemini-extension/bin/leanpowers.mjs`

**Why:** In the test run no session created a feature branch: spec, plan, code and report landed on `main`, and `finish` had nothing to merge. The skills now create the branch (Tasks 2 and 3); this task adds a deterministic reminder where a run starts (`brief`) and where a task is gated (task check). It stays a warning and never changes the result, because after a regular merge to `main` a hard failure would be a false alarm.

**Interfaces:**
- Produces in `checks/lib/git.mjs` (existing exports unchanged; JSDoc on each new export; none of them ever throws):
  - private `tryGit(root, args)`: `git(root, args).trim()`, or `null` when the call throws (git missing, no repository, missing folder, non-zero exit).
  - `export function currentBranch(root: string): string | null` – `tryGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])`; `null` or an empty result → `null` (detached HEAD, no git).
  - `export function defaultBranch(root: string): string | null` – `remotes` = `lines(tryGit(root, ['remote']) ?? '')`, ordered with `origin` first when present, then the others in listed order. For each remote `r`: `tryGit(root, ['symbolic-ref', '--quiet', `refs/remotes/${r}/HEAD`])` (full ref name, no `--short`); when the result starts with `refs/remotes/${r}/` and has text after that prefix, return that text (e.g. `trunk`). Without any remote HEAD: `main` when `tryGit(root, ['rev-parse', '--verify', '--quiet', 'refs/heads/main']) !== null`, else `master` by the same test, else `null`.
  - `export function defaultBranchWarning(root: string): string | null` – `null` when `currentBranch` is `null`, `defaultBranch` is `null` or the two differ; otherwise exactly `` `on default branch ${name}: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch` ``.
- Produces in `checks/check.mjs` `runCheck`: import `defaultBranchWarning`. Directly after `if (outside) warnings.push(outside);` and before `if (all) {`: when the task form runs (`brief === undefined && plan !== undefined && task !== undefined`) or the brief form runs (`brief !== undefined && plan === undefined && task === undefined`), push `defaultBranchWarning(root)` into `warnings` if it is not `null`. The plain `check`, `--all` without a task or brief, and incomplete or conflicting forms get no branch warning. Results and `ok` are unchanged.
- Produces in `bin/leanpowers.mjs`: import `defaultBranchWarning` from `../checks/lib/git.mjs`; a new `function warnBranch()` next to `warnOutside` that prints `` `warning: ${w}` `` to stderr when `defaultBranchWarning(root)` is not `null`. Call it directly after the `warnOutside(...)` call of `brief --file` and directly after the `warnOutside(...)` call of `brief --plan` (outside warning first, branch warning second). `metrics`, `report` and `check` do not call it. stdout and exit codes unchanged.

- [ ] **Step 1: Write the failing tests**

In `tests/git.test.mjs`, change the import line to:

```js
import { headSha, changedFiles, dirsAt, currentBranch, defaultBranch, defaultBranchWarning } from '../checks/lib/git.mjs';
```

and append:

```js
const WARNING = (name) => `on default branch ${name}: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch`;

function repoOn(branch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-branch-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init', '-q', '-b', branch);
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(root, 'a.txt'), 'a');
  git('add', '.');
  git('commit', '-qm', 'init');
  return { root, git };
}

test('main is the default branch without a remote; only main gets the warning', () => {
  const { root, git } = repoOn('main');
  assert.equal(currentBranch(root), 'main');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), WARNING('main'));
  git('checkout', '-q', '-b', 'feat/x');
  assert.equal(currentBranch(root), 'feat/x');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('master is the default branch when main does not exist; main wins when both exist', () => {
  const { root, git } = repoOn('master');
  assert.equal(defaultBranch(root), 'master');
  assert.equal(defaultBranchWarning(root), WARNING('master'));
  git('branch', 'main');
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('a remote HEAD names the default branch, origin first', () => {
  const { root, git } = repoOn('main');
  git('remote', 'add', 'a-remote', path.join(root, 'nowhere-a'));
  git('remote', 'add', 'origin', path.join(root, 'nowhere-o'));
  git('update-ref', 'refs/remotes/a-remote/alpha', 'HEAD');
  git('symbolic-ref', 'refs/remotes/a-remote/HEAD', 'refs/remotes/a-remote/alpha');
  git('update-ref', 'refs/remotes/origin/trunk', 'HEAD');
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  assert.equal(defaultBranch(root), 'trunk');
  assert.equal(defaultBranchWarning(root), null);
  git('checkout', '-q', '-b', 'trunk');
  assert.equal(defaultBranchWarning(root), WARNING('trunk'));
  git('symbolic-ref', '--delete', 'refs/remotes/origin/HEAD');
  assert.equal(defaultBranch(root), 'alpha');
  assert.equal(defaultBranchWarning(root), null);
  git('symbolic-ref', '--delete', 'refs/remotes/a-remote/HEAD');
  assert.equal(defaultBranch(root), 'main');
});

test('detached HEAD has no current branch and no warning', () => {
  const { root, git } = repoOn('main');
  git('checkout', '-q', '--detach');
  assert.equal(currentBranch(root), null);
  assert.equal(defaultBranch(root), 'main');
  assert.equal(defaultBranchWarning(root), null);
});

test('no determinable default branch, no git and a missing folder give null, never throw', () => {
  const { root } = repoOn('dev');
  assert.equal(currentBranch(root), 'dev');
  assert.equal(defaultBranch(root), null);
  assert.equal(defaultBranchWarning(root), null);
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-nogit-'));
  assert.equal(currentBranch(plain), null);
  assert.equal(defaultBranch(plain), null);
  assert.equal(defaultBranchWarning(plain), null);
  assert.equal(defaultBranchWarning(path.join(plain, 'missing')), null);
});
```

In `tests/check.test.mjs` and in `tests/cli.test.mjs`, inside `function project(...)` only (not the monorepo test, which has its own `git init`): change `git('init', '-q');` to `git('init', '-q', '-b', 'main');`, and add the line `  git('checkout', '-q', '-b', 'feat/test');` directly after `  git('add', '.'); git('commit', '-qm', 'init');`. This keeps every existing exact-output test on a feature branch, whatever git's own initial branch name is.

Append to `tests/check.test.mjs`:

```js
const BRANCH_WARNING = '⚠ on default branch main: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch';

test('the task and brief forms warn on the default branch, never on a feature branch or without a task or brief', () => {
  const root = project({ commands: { test: 'node ok.mjs' } });
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  medium(root);
  writeBaseFor(root, BRIEF);
  const { config } = loadConfig(root, { userConfigPath: NO_USER });
  writeBrief(root, 'docs/plans/demo.md', 1, config);
  fs.writeFileSync(path.join(root, 'src/a.ts'), 'a');
  const ok = '✔ leanpowers check: ok (gates:test, scope, structure)';
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, ok);
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text, ok);
  git('checkout', '-q', 'main');
  assert.equal(runCheck({ root, plan: 'docs/plans/demo.md', task: 1, userConfigPath: NO_USER }).text, `${ok}\n${BRANCH_WARNING}`);
  assert.equal(runCheck({ root, brief: BRIEF, userConfigPath: NO_USER }).text, `${ok}\n${BRANCH_WARNING}`);
  const all = runCheck({ root, all: true, userConfigPath: NO_USER });
  assert.equal(all.ok, true);
  assert.doesNotMatch(all.text, /default branch/);
  assert.equal(runCheck({ root, userConfigPath: NO_USER }).text, '✔ leanpowers check: ok (gates:test)');
});
```

Append to `tests/cli.test.mjs`:

```js
test('brief warns on stderr on the default branch; stdout and exit code stay', () => {
  const root = project();
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  const warning = 'warning: on default branch main: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch\n';
  git('checkout', '-q', 'main');
  const b = spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1');
  assert.equal(b.status, 0);
  assert.equal(b.stdout, '.leanpowers/runs/demo/task-1-brief.md\n');
  assert.equal(b.stderr, warning);
  const rel = '.leanpowers/runs/2026-01-01-fix/task-1-brief.md';
  fs.mkdirSync(path.join(root, '.leanpowers/runs/2026-01-01-fix'), { recursive: true });
  fs.writeFileSync(path.join(root, rel), '# Task 1 brief: fix\n');
  const f = spawn(root, 'brief', '--file', rel);
  assert.equal(f.status, 0);
  assert.equal(f.stdout, `${rel}\n`);
  assert.equal(f.stderr, warning);
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'plans/x.md'), PLAN);
  assert.equal(spawn(root, 'brief', '--plan', 'plans/x.md', '--task', '1').stderr,
    `warning: plan outside paths.plans (docs/plans): plans/x.md\n${warning}`);
  assert.equal(spawn(root, 'metrics', '--plan', 'docs/plans/demo.md').stderr, '');
  git('checkout', '-q', 'feat/test');
  assert.equal(spawn(root, 'brief', '--plan', 'docs/plans/demo.md', '--task', '1').stderr, '');
});
```

- [ ] **Step 2: Run them** – `node --test tests/git.test.mjs tests/check.test.mjs tests/cli.test.mjs` → FAIL (`currentBranch`, `defaultBranch`, `defaultBranchWarning` not exported; no branch warning in check and brief).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run them** – same command → PASS; `npm run build`; `npm test` → all PASS (Task 2 runs in parallel: scope or test findings on its files are expected, see the parallel dispatch text); `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add checks/lib/git.mjs checks/check.mjs bin/leanpowers.mjs tests/git.test.mjs tests/check.test.mjs tests/cli.test.mjs dist/claude-plugin/checks/lib/git.mjs dist/codex-plugin/checks/lib/git.mjs dist/gemini-extension/checks/lib/git.mjs dist/claude-plugin/checks/check.mjs dist/codex-plugin/checks/check.mjs dist/gemini-extension/checks/check.mjs dist/claude-plugin/bin/leanpowers.mjs dist/codex-plugin/bin/leanpowers.mjs dist/gemini-extension/bin/leanpowers.mjs` then `git commit -m "feat: warn on the default branch in brief and the task check"` (trailer as in Global Constraints).

### Task 2: `design` and the medium path (spec sections 4.1, 4.3, 4.4 design part, 5.3, 6.1)

**Risk:** high
**Parallel:** true

**Files:**
- Modify: `skills/design/SKILL.md`
- Modify: `skills/design/details/medium.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/claude-plugin/skills/design/SKILL.md`
- Modify: `dist/codex-plugin/skills/design/SKILL.md`
- Modify: `dist/gemini-extension/skills/design/SKILL.md`
- Modify: `dist/claude-plugin/skills/design/details/medium.md`
- Modify: `dist/codex-plugin/skills/design/details/medium.md`
- Modify: `dist/gemini-extension/skills/design/details/medium.md`

**Why:** In the test run `details/medium.md` could not be read and the model improvised a medium path without branch, brief, check or `finish`; it also named a new command and still chose medium; and no session created a feature branch. The medium line now names its steps, an unreadable linked file stops the session, a new red flag calls a new command large, the gate covers the staffing, and the main session leaves the default branch before the spec commit (large) or the brief (medium).

**Interfaces (exact texts):** each change replaces the first text with the second; every old text occurs exactly once. Nothing else in these files changes, and the size rule bullets (`- **Small:**`, `- **Medium:**`, `- **Large:**`) stay as they are.

`skills/design/SKILL.md` – the body goes from 599 to 599 words (counted with `countWords` from `checks/skill-lint.mjs` on the body after the frontmatter). Changes 1–5, 7, 8 and 11–15 are the cuts that pay for the new texts in changes 6, 9, 10 and 16; no rule is dropped:

1. Gate paragraph. Old:

```text
until the user has approved what you intend. This holds for every size and whatever delegation rules say: they decide who builds, not whether to approve.
```

New:

```text
until the user approves what you intend. This holds for every size; delegation rules decide who builds, not whether to approve.
```

2. Classify, marker example. Old:

```text
in any language, so the user can override it: "Size: medium — a bounded change to existing code, so a short design here, no spec."
```

New:

```text
in any language: "Size: medium — a bounded change to an existing flow."
```

3. Line after the size bullets. Old:

```text
If hidden complexity shows up later, stop, say so and step up; never step down. Each new request gets its own class and its own approval.
```

New:

```text
If hidden complexity shows up, stop, say so and step up; never step down. Each new request gets its own class and approval.
```

4. Section 2, first sentence. Old:

```text
Read the relevant code and ask only the questions that matter, as in Large step 2.
```

New:

```text
Read the relevant code; ask only questions that matter (Large step 2).
```

5. Section 2, end of the first paragraph (the red flag "I'll start while they read" keeps this rule). Old:

```text
**Stop and wait for an explicit yes.** Presenting and starting in the same message skips the gate.
```

New:

```text
**Stop and wait for an explicit yes.**
```

6. Section 2, medium line, plus the unreadable-file rule as its own paragraph. Old:

```text
Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.
```

New:

```text
Medium → follow [details/medium.md](details/medium.md) step by step: branch, brief, base, dispatch, check, finish. No spec, no plan.

A linked file you cannot read: name its path, ask the user for access and stop; never improvise its steps.
```

7. Large step 1. Old:

```text
If the request spans independent subsystems, say so first and help split it; each part gets its own design → plan → run cycle. Design the first part only.
```

New:

```text
If the request spans independent subsystems, help split it; each part gets its own design → plan → run cycle; design the first only.
```

8. Large step 4, first line. Old:

```text
(architecture, components, data flow, errors, testing), each sized to its complexity, and get approval after each. Prefer small units with one purpose and clear interfaces;
```

New:

```text
(architecture, components, data flow, errors, testing) and get approval after each. Prefer small single-purpose units with clear interfaces;
```

9. Large step 4, gate line (spec 5.3). Old:

```text
   Until the plan is approved, subagents may read, review or write the spec and plan, never code.
```

New:

```text
   Until the plan is approved, subagents may read, review or write the spec, plan and staffing, never code.
```

10. Large step 5, branch before the spec commit (spec 6.1). Old:

```text
no placeholders, and only approvals the user gave. Commit it.
```

New:

```text
no placeholders, and only approvals the user gave. On the default branch, create and switch to `feat/<topic>` before committing, unless the user named a branch in their own words (chat, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`): then use it. Commit it.
```

11. Large step 6. Old:

```text
Then read the spec once for contradictions and requirements that allow two readings; fix them inline.
```

New:

```text
Then reread the spec and fix contradictions and ambiguities inline.
```

12. Large step 7. Old:

```text
Apply requested changes and repeat step 6 until they approve.
```

New:

```text
Apply changes and repeat step 6 until they approve.
```

13. Visual mockups. Old:

```text
and a question is genuinely visual:
```

New:

```text
and a question is visual:
```

14. Red flags, first line. Old:

```text
- "Too simple to need a design" → then the design is two sentences; the approval still applies.
```

New:

```text
- "Too simple to need a design" → then it is two sentences, still approved first.
```

15. Red flags: delete the whole line below (it repeats "Unsure → take the larger class"), including its line break:

```text
- "I'll call it medium to skip the spec" → that doubt means large.
```

16. Red flags, new last line (spec 4.1). Old:

```text
- "Design approved, one implementer will do" → that is medium; large needs spec and plan.
```

New:

```text
- "Design approved, one implementer will do" → that is medium; large needs spec and plan.
- "Just one new command in the existing CLI" → a new command is large.
```

`skills/design/details/medium.md` – step 1 (spec 4.3, 6.1). Old:

```text
1. **Branch:** if HEAD is on the repository's default branch (the remote's HEAD branch, else `main` or `master`),
   create and switch to `feat/<topic>`. A branch the user named wins.
```

New:

```text
1. **Branch:** if HEAD is on the repository's default branch (the remote's HEAD branch, else `main` or `master`),
   create and switch to `feat/<topic>`, unless the user named a branch in their own words (chat, `CLAUDE.md`,
   `AGENTS.md`, `GEMINI.md`): then use it.
```

- [ ] **Step 1: Write the failing tests**

In `tests/skills-content.test.mjs`, test `design names the size marker, the large criteria, the gates and the medium path`, replace these three assertions:
- `'   Until the plan is approved, subagents may read, review or write the spec and plan, never code.'` → `'   Until the plan is approved, subagents may read, review or write the spec, plan and staffing, never code.'`
- `'Medium → follow [details/medium.md](details/medium.md) step by step. No spec, no plan.'` → `'Medium → follow [details/medium.md](details/medium.md) step by step: branch, brief, base, dispatch, check, finish. No spec, no plan.'`
- `` 'create and switch to `feat/<topic>`. A branch the user named wins.' `` → `` 'create and switch to `feat/<topic>`, unless the user named a branch in their own words' ``

and append:

```js
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
```

- [ ] **Step 2: Run them** – `node --test tests/skills-content.test.mjs` → FAIL (old texts).
- [ ] **Step 3: Implement** the exact texts above.
- [ ] **Step 4: Run them** – same command → PASS (the skill-lint test there enforces ≤ 600 words); `npm run build`; `npm test` → all PASS (Task 1 runs in parallel: scope or test findings on its files are expected); `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add skills/design/SKILL.md skills/design/details/medium.md tests/skills-content.test.mjs dist/claude-plugin/skills/design/SKILL.md dist/codex-plugin/skills/design/SKILL.md dist/gemini-extension/skills/design/SKILL.md dist/claude-plugin/skills/design/details/medium.md dist/codex-plugin/skills/design/details/medium.md dist/gemini-extension/skills/design/details/medium.md` then `git commit -m "feat: medium path names its steps, unreadable files stop, branch before the spec commit"` (trailer as in Global Constraints).

### Task 3: `plan`, `staff`, `run` and the ledger (spec sections 4.2, 4.4 run part, 5.1, 5.2, 6.2, 6.3)

**Risk:** high

**Files:**
- Modify: `skills/plan/SKILL.md`
- Modify: `skills/staff/SKILL.md`
- Modify: `skills/run/SKILL.md`
- Modify: `skills/run/details/ledger.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Why:** Runs after Task 2 (both change `tests/skills-content.test.mjs`). In the test run the main session dispatched the orchestrator without showing the staffing; its prompt described "branch main", which the orchestrator read as a user instruction, and a ruling claimed the user had named `main`. The staffing now comes with the plan approval, the orchestrator prompt names no branch, a branch ruling must quote the user, and `plan`, `staff` and `run` stop on an unreadable file instead of improvising.

**Interfaces (exact texts):** each change replaces the first text with the second; every old text occurs exactly once. Nothing else in these files changes.

`skills/plan/SKILL.md` – body 457 → 498 words.

1. Step 7 (spec 4.2). Old:

```text
read [details/plan-format.md](details/plan-format.md) before writing the plan and follow it exactly.
```

New:

```text
read [details/plan-format.md](details/plan-format.md) before writing the plan and follow it exactly. If you cannot read it, name its path, ask the user for access and stop; never improvise its rules.
```

2. Step 10 (spec 5.1); step 11 `11. **Invoke the `staff` skill.**` stays unchanged. Old:

```text
10. **Ask the user to approve the plan.** Apply changes and repeat steps 8–9 until they do.
```

New:

```text
10. **Run staff steps 1–3, then ask the user to approve the plan and the staffing in one message.** Apply changes and repeat steps 8–9 until they do; after each plan change, run staff steps 1–3 again before asking.
```

`skills/staff/SKILL.md` – body 531 → 595 words.

3. Intro, after the platform sentence (spec 4.2). Old:

```text
read `platform.md` in the plugin folder.
```

New:

```text
read `platform.md` in the plugin folder. `platform.md` or a template unreadable: name its path, ask the user for access and stop; never improvise its steps.
```

4. Step 1, reuse (spec 5.2). Old:

```text
If it already holds `besetzung.md` and the plan has not changed since, reuse it and go to step 4.
```

New:

```text
If it already holds `besetzung.md` and the plan has not changed since, reuse it; go to step 4 only if the user approved plan and staffing together, else to step 3.
```

5. Step 3, first line (spec 5.2). Old:

```text
3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:
```

New:

```text
3. **Show**, in every mode and before step 4, the recommendation to the user in three lines, in the plan approval message:
```

6. Step 3, end (spec 5.2). Old:

```text
Write every change, yours or the user's, into `besetzung.md`.
```

New:

```text
Write every change, yours or the user's, into `besetzung.md`. Invoked directly, without that message: show the lines and wait for the user's yes before step 4.
```

7. Step 4, `auto` bullet (spec 6.3); the worktree sentence that follows stays. Old:

```text
Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim. When
```

New:

```text
Add the "Wait for a subagent" line of `platform.md` to its prompt verbatim. Its prompt names no branch; the branch guard in `run` decides. When
```

`skills/run/SKILL.md` – body 600 → 600 words. Change 8 adds the rule; changes 9–15 are the cuts that pay for it (each rule they touch stays in `details/loops.md` or `details/ledger.md`, which `run` reads in Setup step 1). The sentence `How to dispatch, model tiers and nesting on this platform: read `platform.md` in the plugin folder.` and the phrase `never end the turn` stay verbatim.

8. Setup step 1 (spec 4.2). Old:

```text
Read [details/ledger.md](details/ledger.md) and [details/loops.md](details/loops.md) now.
```

New:

```text
Read [details/ledger.md](details/ledger.md) and [details/loops.md](details/loops.md) now. One of them or `platform.md` unreadable: name its path, ask the user for access and stop (orchestrator subagent: ledger line `Stop: <question>`, then `NEEDS_USER`); never improvise its steps.
```

9. Setup step 2. Old:

```text
Ledger exists → resume from it and the git log, not memory; never redo completed tasks.
```

New:

```text
Ledger exists → resume from it and the git log; never redo completed tasks.
```

10. Per task step 1. Old:

```text
; it records the base and prints the brief path.
```

New:

```text
; it prints the brief path.
```

11. Per task step 2. Old:

```text
**Implement:** dispatch a subagent at the task's implementer tier
```

New:

```text
**Implement:** dispatch at the task's implementer tier
```

12. Per task step 5. Old:

```text
dispatch a subagent at the reviewer tier
```

New:

```text
dispatch at the reviewer tier
```

13. Per task step 6. Old:

```text
Critical or Important → review fix rounds per loops.md, then rule on each open finding.
```

New:

```text
Critical or Important → fix rounds and rulings per loops.md.
```

14. Paragraph after "Rulings, not stalls". Old:

```text
Dispatch subagents in the foreground and wait for each result, resumed ones too; never poll, never end the turn while one works. Dispatches carry file paths, never pasted history, diffs or reports; worktree and CLI rules: loops.md.
```

New:

```text
Dispatch in the foreground and wait; never poll, never end the turn while a subagent works. Dispatches carry file paths, never pasted history, diffs or reports.
```

15. End step 5. Old:

```text
Show the user every `Ruling:` line in order with its cost if wrong, plus open minors.
```

New:

```text
Show the user every `Ruling:` line with its cost if wrong, plus open minors.
```

`skills/run/details/ledger.md` – a details file; `skill-lint` does not limit it.

16. Branch guard, step 2 (spec 6.2). Old:

```text
a branch named in the plan's Global Constraints, the default branch included, counts like a user instruction.
```

New:

```text
a branch named in the plan's Global Constraints, the default branch included, counts like a user instruction. A description of the current state in your dispatch prompt (working directory, branch, worktree) is no user instruction. A ruling that relies on a user instruction quotes it verbatim: `Ruling: work on main — user: "<quote>" — <cost if wrong>`; without a quote, the guard applies.
```

- [ ] **Step 1: Write the failing tests**

In `tests/skills-content.test.mjs`, test `staff shows the staffing in every mode and names its own changes`, replace `'3. **Show**, in every mode and before step 4, the recommendation to the user in three lines:'` with `'3. **Show**, in every mode and before step 4, the recommendation to the user in three lines, in the plan approval message:'`, and append:

```js
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
```

- [ ] **Step 2: Run them** – `node --test tests/skills-content.test.mjs` → FAIL (old texts).
- [ ] **Step 3: Implement** the exact texts above.
- [ ] **Step 4: Run them** – same command → PASS (skill-lint inside enforces ≤ 600 words); `npm run build`; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok.
- [ ] **Step 5: Commit** – `git add skills/plan/SKILL.md skills/staff/SKILL.md skills/run/SKILL.md skills/run/details/ledger.md tests/skills-content.test.mjs dist` then `git commit -m "feat: staffing approved with the plan, quoted branch rulings, unreadable files stop"` (trailer as in Global Constraints).

### Task 4: Release 0.1.6 (spec section 7)

**Risk:** low

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/skills-content.test.mjs`
- Modify: `dist/**`

**Why:** Ship the changes as 0.1.6 with notes users can act on. The root `README.md` and the version test carry the version too, so they belong to this task.

**Interfaces (exact texts):**
- `package.json`: `"version": "0.1.6"`. `npm run build` regenerates the manifests and `package.json` files under `dist/`.
- `CHANGELOG.md`: insert this section directly above `## [0.1.5] - 2026-11-01`, followed by one blank line:

```markdown
## [0.1.6] - 2026-11-01

These changes follow from a test run of 0.1.5 in a test project.

### Added

- `brief --plan`, `brief --file`, `check --plan … --task …` and `check --brief …` warn when HEAD is on the default branch (a remote's HEAD branch, else `main` or `master`); the warning never changes the result or the exit code.

### Changed

- `plan` runs the first three `staff` steps and asks the user to approve the plan and the staffing in one message; after a plan change the staffer runs again. `staff` invoked on its own shows the staffing and waits for a yes.
- `design` creates `feat/<topic>` before the spec commit, and the medium path before its brief, unless the user named a branch in their own words.
- The ledger's branch guard treats a description of the current state in a dispatch prompt as no user instruction; a ruling that relies on a user instruction quotes it. The orchestrator prompt names no branch.
- `design`, `plan`, `staff` and `run` stop and ask for access when a file they rely on cannot be read, instead of improvising its steps.
- The medium line in `design` names its steps; a new red flag says that a new command is large.
```

- `README.md`: `Current version: 0.1.5.` → `Current version: 0.1.6.`; `Version 0.1.5. The authors` → `Version 0.1.6. The authors`.
- `docs/README.md`: `Version 0.1.5.` → `Version 0.1.6.`; after the paragraph that ends `Configured `paths` win over the folders of other plugins.` add one blank line and this paragraph:

```text
`plan` asks you to approve the plan and the staffing in one message. The main session works on a
feature branch: on the default branch, `design` (before the spec commit) and the medium path create
`feat/<topic>`, unless you named a branch yourself. `brief` and the task check (`check --plan`,
`check --brief`) warn when HEAD is on the default branch; the warning changes neither the result
nor the exit code.
```

- `docs/README.de.md`: `Version 0.1.5.` → `Version 0.1.6.`; after the paragraph that ends `haben Vorrang vor den Ordnern anderer Plugins.` add one blank line and this paragraph:

```text
`plan` fragt die Freigabe von Plan und Besetzung in einer Nachricht ab. Das Hauptfenster arbeitet
auf einem Feature-Branch: Steht HEAD auf dem Standard-Branch, legen `design` (vor dem Spec-Commit)
und der mittlere Weg `feat/<topic>` an, außer Sie haben selbst einen Branch genannt. `brief` und
der Task-Check (`check --plan`, `check --brief`) warnen, wenn HEAD auf dem Standard-Branch steht;
die Warnung ändert weder das Ergebnis noch den Exit-Code.
```

- [ ] **Step 1: Write the failing test** – in `tests/skills-content.test.mjs`, replace the whole test `readmes name the report command and version 0.1.5` with:

```js
test('readmes name the report command, staffing with the plan, the branch warning and version 0.1.6', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  const en = flat(read('docs/README.md'));
  assert.ok(en.includes('| `report --plan <file>` |'), 'en report');
  assert.ok(en.includes('Version 0.1.6.'), 'en version');
  assert.ok(en.includes('`plan` asks you to approve the plan and the staffing in one message.'), 'en staffing');
  assert.ok(en.includes('`design` (before the spec commit) and the medium path create `feat/<topic>`'), 'en branch');
  assert.ok(en.includes('warn when HEAD is on the default branch; the warning changes neither the result nor the exit code.'), 'en warning');
  const de = flat(read('docs/README.de.md'));
  assert.ok(de.includes('| `report --plan <Datei>` |'), 'de report');
  assert.ok(de.includes('Version 0.1.6.'), 'de version');
  assert.ok(de.includes('`plan` fragt die Freigabe von Plan und Besetzung in einer Nachricht ab.'), 'de staffing');
  assert.ok(de.includes('legen `design` (vor dem Spec-Commit) und der mittlere Weg `feat/<topic>` an'), 'de branch');
  assert.ok(de.includes('warnen, wenn HEAD auf dem Standard-Branch steht; die Warnung ändert weder das Ergebnis noch den Exit-Code.'), 'de warning');
  assert.ok(read('README.md').includes('Current version: 0.1.6.'), 'root readme');
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.6\] - 2026-11-01$/m);
});
```

- [ ] **Step 2: Run it** – `node --test tests/skills-content.test.mjs` → FAIL.
- [ ] **Step 3: Implement** as in Interfaces; `npm run build`.
- [ ] **Step 4: Run it** – same command → PASS; `npm test` → all PASS; `node bin/leanpowers.mjs check --all` → ok; `grep -n "0\.1\.5" README.md docs/README.md docs/README.de.md package.json` prints nothing (history lines in `CHANGELOG.md` stay).
- [ ] **Step 5: Commit** – `git add package.json CHANGELOG.md README.md docs/README.md docs/README.de.md tests/skills-content.test.mjs dist` then `git commit -m "chore: release v0.1.6 notes and version"` (trailer as in Global Constraints). No tag, no push, no merge.
