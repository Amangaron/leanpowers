# leanpowers Plan 2 – Skills, Subagent-Vorlagen, Plattform-Zuordnung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the lean, platform-neutral leanpowers skills (12), subagent templates (5) and platform maps (3), harden skill-lint for them, and add the `orchestration` config key.

**Architecture:** Skills are English Markdown files that describe actions, never tool names; `platforms/<name>.md` maps actions to each assistant's tools, model tiers and CLI invocation. Deterministic tests enforce the content rules (no tool names, no hard-coded paths, switch line, size limits) so neutrality cannot drift. Plan 3 will package these files per platform.

**Tech Stack:** Markdown with YAML-style frontmatter; Node >= 20 ESM tests (`node:test`); the Plan 1 CLI (`leanpowers check`, `brief`, `metrics`).

**Spec:** `docs/specs/2026-10-29-leanpowers-design.md` (sections 5, 6, 7, 9, 10). Platform facts: `docs/research/2026-10-29-plattform-fakten.md`. This is plan 2 of 4.

## Global Constraints

- Skills, agents and platform maps are written in English; answers to users stay in the user's language (say so in `start`).
- Skill files: `skills/<name>/SKILL.md`, frontmatter `name` equals the folder name, `description` starts with `Use when` and has at most 60 words, body at most 600 words. `skills/start/SKILL.md` body at most 150 estimated tokens.
- Agent templates: `agents/<name>.md`, frontmatter `name` equals the file basename, `description` starts with `Use when`, body at most 400 words.
- Platform maps: `platforms/{claude,codex,gemini}.md`, at most 500 words each, sections `## Actions`, `## Model tiers`, `## Orchestration`, `## CLI`.
- Longer material goes to `skills/<name>/details/*.md` and is linked from SKILL.md; details are read only when needed.
- Every skill except `start` begins its body with exactly this line (with its own name): `If \`skills.<name>\` is false in leanpowers.json, say "leanpowers: <name> is disabled" and stop.`
- Skills and agents never contain platform tool names (`TodoWrite`, `AskUserQuestion`, `spawn_agent`, `invoke_agent`, `write_todos`, `activate_skill`, `Task tool`, `Agent tool`, `Skill tool`) or hard-coded paths (`docs/superpowers`, `.superpowers/`, `docs/specs/`, `docs/plans/`, `superpowers:`). They refer to locations as `paths.specs`, `paths.plans`, `paths.reports`, `paths.runs` and to the run folder as `<paths.runs>/<plan-basename>/`.
- Actions used in skills: "dispatch a subagent at tier small|medium|large with template `agents/<name>.md`", "ask the user", "track tasks", "run `leanpowers check …`", "run `leanpowers brief …`", "run `leanpowers metrics …`", "invoke the `<name>` skill".
- Reviewer subagents write their report to `<run folder>/review-<task or range>.md` (metrics counts `review-*.md`).
- User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, direct requests) always win over skills.
- Source material: Superpowers 6.3.0 at `/Users/shindominic/.claude/plugins/cache/superpowers-marketplace/superpowers/6.3.0/skills/` (MIT, Jesse Vincent). Condense; never copy more than short phrases.
- Every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing exactly `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit. Never push, never `git stash`.

---

### Task 1: skill-lint hardening and `orchestration` config key

**Risk:** low

**Files:**
- Modify: `checks/skill-lint.mjs`
- Modify: `schema/leanpowers.schema.json`
- Modify: `checks/lib/defaults.mjs`
- Modify: `templates/leanpowers.json`
- Test: `tests/skill-lint.test.mjs`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Consumes: `stripCode(text)` from `checks/lib/plan.mjs`
- Produces: `parseFrontmatter` supports folded/literal block values (`>`, `>-`, `|`, `|-`) by joining the following indented lines with single spaces; `DEFAULTS.orchestration === 'auto'`; schema property `orchestration` enum `auto`, `switch`, `recommend`.

- [ ] **Step 1: Add the failing tests**

Append to `tests/skill-lint.test.mjs`:
```js
test('block descriptions are joined and counted', () => {
  assert.deepEqual(
    parseFrontmatter('---\nname: a\ndescription: >\n  one two\n  three\n---\nb'),
    { data: { name: 'a', description: 'one two three' }, body: 'b' },
  );
  const root = project({ 'skills/a/SKILL.md': `---\nname: a\ndescription: >-\n  ${words(30)}\n  ${words(31)}\n---\nbody\n` });
  assert.deepEqual(lintSkills(root, DEFAULTS).messages, ['skills/a/SKILL.md: description 61 words (max 60)']);
});

test('links inside code are not checked', () => {
  const body = 'Example:\n```\n[x](missing.md)\n```\nand `[y](gone.md)`';
  const root = project({ 'skills/a/SKILL.md': skill('a', body) });
  assert.equal(lintSkills(root, DEFAULTS).ok, true);
});

test('symlinked skill directories are linted', () => {
  const root = project({});
  const real = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-real-'));
  fs.writeFileSync(path.join(real, 'SKILL.md'), skill('linked', words(700)));
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  fs.symlinkSync(real, path.join(root, 'skills/linked'), 'junction');
  assert.deepEqual(lintSkills(root, DEFAULTS).messages, ['skills/linked/SKILL.md: 700 words (max 600)']);
});
```

Append to `tests/config.test.mjs`:
```js
test('orchestration defaults to auto and is validated', () => {
  assert.equal(DEFAULTS.orchestration, 'auto');
  assert.ok(validate({ orchestration: 'sometimes' }, schema).includes('orchestration: must be one of auto, switch, recommend'));
  assert.deepEqual(validate({ orchestration: 'switch' }, schema), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the four new tests FAIL (description read as `>`, broken-link message for fenced/inline links, symlinked dir skipped, `orchestration` undefined).

- [ ] **Step 3: Implement**

- `parseFrontmatter`: when a value is exactly `>`, `>-`, `|` or `|-`, collect the following lines that start with whitespace, trim each, join with one space.
- Link check: scan `stripCode(body)` instead of `body`.
- Directory listing for `skills/*`, `extraSkillDirs/*`: treat an entry as a directory if `fs.statSync(full).isDirectory()` (follows symlinks and junctions).
- Schema: add `"orchestration": { "type": "string", "enum": ["auto", "switch", "recommend"] }`. DEFAULTS and template: `orchestration: 'auto'`.

- [ ] **Step 4: Run tests and self-check**

Run: `npm test` → all PASS. Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 5: Commit**

```bash
git add checks/skill-lint.mjs schema/leanpowers.schema.json checks/lib/defaults.mjs templates/leanpowers.json tests/skill-lint.test.mjs tests/config.test.mjs
git commit -m "feat: skill-lint block descriptions, code-aware links, symlinks; orchestration key"
```

---

### Task 2: Content rules test and platform maps

**Risk:** high

**Files:**
- Create: `tests/skills-content.test.mjs`
- Create: `platforms/claude.md`
- Create: `platforms/codex.md`
- Create: `platforms/gemini.md`

**Interfaces:**
- Consumes: `parseFrontmatter`, `countWords` from `checks/skill-lint.mjs`
- Produces: the content contract every later task must satisfy; platform maps that Plan 3's build reads (section names are fixed).

- [ ] **Step 1: Write the test**

`tests/skills-content.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, countWords } from '../checks/skill-lint.mjs';

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
    const text = read(`platforms/${p}.md`);
    assert.ok(countWords(text) <= 500, `${p}: ${countWords(text)} words`);
    for (const h of ['## Actions', '## Model tiers', '## Orchestration', '## CLI']) {
      assert.ok(text.includes(`\n${h}\n`), `${p}: missing ${h}`);
    }
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL only in "platform maps exist…" (ENOENT); the other three pass vacuously (no skills yet).

- [ ] **Step 3: Write the three platform maps**

Use `docs/research/2026-10-29-plattform-fakten.md` as the source of truth; mark anything it calls unverified with `(unverified)`. Each file: one-line intro, then:

- `## Actions` — a table `Action | <platform> mechanism` covering: dispatch a subagent at a tier with a template; resume a subagent with a message; ask the user; track tasks; invoke a skill; read a file only when needed.
  - claude: subagent dispatch with explicit `model` alias per call, template text as prompt; resume via message to the agent; skills via the skill mechanism.
  - codex: `spawn_agent` with `model` and `reasoning_effort`, `fork_turns: "none"`; `send_message`/`followup_task`; skills via `$leanpowers-<name>`.
  - gemini: `invoke_agent` with `agent_name` `lp-small|lp-medium|lp-large` (one agent file per tier, Plan 3 generates them); no resume — re-dispatch with the report file path.
- `## Model tiers` — mapping of `small|medium|large` and `models.*` override (`auto` = this table): claude `haiku|sonnet|opus`; codex: `models.*` if set, otherwise default subagent model with `reasoning_effort` `low|medium|high`; gemini: the `model` field of `lp-<tier>` agent files.
- `## Orchestration` — claude: `auto` supported (orchestrator subagent may dispatch implementers/reviewers; depth orchestrator → worker); codex: `auto` supported; gemini: no nesting, `auto` behaves as `switch` (`/model set <name>`).
- `## CLI` — how to run the checks: claude `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" <args>`; codex `node "$PLUGIN_ROOT/bin/leanpowers.mjs" <args>` (unverified for skills; fallback: path of the installed plugin); gemini `node "${extensionPath}/bin/leanpowers.mjs" <args>`. Also how a skill is disabled natively on that platform (from the research note).

- [ ] **Step 4: Run tests and self-check**

Run: `npm test` → all PASS. Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 5: Commit**

```bash
git add tests/skills-content.test.mjs platforms
git commit -m "feat: content rules test and platform maps"
```

---

### Task 3: Entry skills `start`, `design`, `plan`

**Risk:** high

**Files:**
- Create: `skills/start/SKILL.md`
- Create: `skills/design/SKILL.md`
- Create: `skills/design/details/visual-companion.md`
- Create: `skills/plan/SKILL.md`
- Create: `skills/plan/details/plan-format.md`

**Interfaces:**
- Consumes: plan format parsed by `checks/lib/plan.mjs` (Plan 1); `leanpowers check --all`
- Produces: the size rule and command names used by every other skill; the plan format contract written for humans.

- [ ] **Step 1: Read sources**

Read `skills/using-superpowers/SKILL.md`, `skills/brainstorming/SKILL.md`, `skills/writing-plans/SKILL.md` from the Superpowers source folder (Global Constraints), and spec sections 6 and 10.

- [ ] **Step 2: Write `skills/start/SKILL.md`** (≤150 estimated tokens, no switch line)

Frontmatter description: `Use when a session starts - explains when leanpowers workflows apply and lists its commands.` Body content, nothing else:
- Size rule in three lines: small (one file, clear fix) → do it, then run `leanpowers check`; medium (bounded change in existing code) → short design in chat, approval, one subagent; large (new feature or project, several areas, interfaces) → `design` → `plan` → `staff` → `run` → `finish`. Unclear size → next larger.
- Commands: design, plan, staff, run, debug, finish, check, skills, init.
- User instructions and explicit requests always win; answer in the user's language.
- Subagents ignore this text.

- [ ] **Step 3: Write `skills/design/SKILL.md`**

Condensed brainstorming. Must keep: classify by the size rule and say the class aloud; hard gate — no implementation before the user approves; medium → short design in chat, then stop for approval; large → explore context, questions one at a time (prefer multiple choice), 2–3 approaches with a recommendation, design in sections with approval each, YAGNI, decompose too-large projects; write the spec to `paths.specs` as `YYYY-MM-DD-<topic>-design.md`; replace the manual self-review by `leanpowers check --all` (doc-lint) plus a quick scan for contradictions and ambiguity; ask the user to review the spec; then invoke the `plan` skill. Visual mockups only when `skills."design.visualCompanion"` is true → link `details/visual-companion.md`.

`details/visual-companion.md` (≤300 words): offer mockups only when a question is genuinely visual, as a separate message; produce a single self-contained HTML file in the run folder and ask the user to open it; one question per screen; no server.

- [ ] **Step 4: Write `skills/plan/SKILL.md` and `details/plan-format.md`**

SKILL.md must keep: scope check (one plan per independent subsystem); map files first; right-size tasks (smallest unit with its own test cycle and review value); every task gets `risk: low|high` (high = shared contract, security, data loss, cross-module) and optional `parallel: true` only when its files are disjoint from all other parallel tasks; tests are written in full, implementation as exact interfaces and rules unless trivial (token rule); no placeholders; save to `paths.plans` as `YYYY-MM-DD-<topic>.md`; run `leanpowers check --all` (doc-lint) and fix findings; self-review spec coverage and name consistency; ask the user to approve; then invoke `staff`.

`details/plan-format.md`: the exact format the parser expects — header lines `**Goal:**`, `**Spec:**`, section `## Global Constraints` (ends at next `## `, `---`, or first task), task heading `### Task <n>: <title>`, lines `**Risk:** low|high`, optional `**Parallel:** true`, `**Files:**` list items `- Create|Modify|Test: \`path\`` (`:<lines>` suffix allowed on Modify); a task body ends at the next task heading or `## ` line. Include one minimal complete example plan (fenced).

- [ ] **Step 5: Run tests and self-check**

Run: `npm test` → all PASS (content rules now apply to these files). Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 6: Commit**

```bash
git add skills/start skills/design skills/plan
git commit -m "feat: start, design and plan skills"
```

---

### Task 4: Worker templates and quality skills `review`, `tdd`, `verify`

**Risk:** low

**Files:**
- Create: `agents/implementer.md`
- Create: `agents/reviewer.md`
- Create: `agents/re-reviewer.md`
- Create: `skills/review/SKILL.md`
- Create: `skills/tdd/SKILL.md`
- Create: `skills/verify/SKILL.md`

**Interfaces:**
- Consumes: brief layout from `checks/brief.mjs` (sections Allowed files, Global constraints, Structure rules, Task, When done)
- Produces: template placeholders used by `run` (Task 5): `{{brief}}`, `{{report}}`, `{{diff}}`, `{{constraints}}`, `{{findings}}`, `{{review}}` (review output path).

- [ ] **Step 1: Read sources**

Superpowers `subagent-driven-development/implementer-prompt.md`, `task-reviewer-prompt.md`, `re-review-prompt.md`, `requesting-code-review/`, `receiving-code-review/`, `test-driven-development/`, `verification-before-completion/`.

- [ ] **Step 2: Write the three agent templates** (≤400 words each)

- `implementer.md`: read `{{brief}}` first (it is the only requirements source; never read the whole plan); work test-first; touch only allowed files; run the `When done` command; write the report (max 150 words: what changed, test result, open questions) to `{{report}}`; never dispatch subagents; status contract `DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED` + commits + one-line test summary; on resume with findings: fix, re-run covering tests, append a fix note to the report.
- `reviewer.md`: inputs `{{brief}}`, `{{report}}`, `{{diff}}`, `{{constraints}}`; read the diff once; do not trust the report; do not re-run the suite (gates already ran); verdicts: spec compliance (missing/extra/misunderstood) and quality; severities Critical/Important/Minor with file:line; write the review to `{{review}}`; return only verdicts and findings; never dispatch subagents; read-only.
- `re-reviewer.md`: inputs `{{findings}}`, `{{diff}}` (fix range), `{{report}}`; verdict each finding ADDRESSED / NOT ADDRESSED; flag new breakage in the fix diff only; write to `{{review}}`.

- [ ] **Step 3: Write `review`, `tdd`, `verify` skills**

- `review`: requesting (when: high-risk task, batch of low-risk tasks, before merge; how: diff file via git range, constraints verbatim, `agents/reviewer.md` at tier medium, large for final review) and receiving (verify each finding against the code before acting, push back with evidence, no performative agreement, Minor findings go to the run ledger).
- `tdd`: no production code without a failing test first; red → verify red for the right reason → minimal green → refactor; delete code written before its test; exceptions only with the user's consent.
- `verify`: no completion claim without fresh evidence; the evidence is `leanpowers check` (plus `--plan/--task` inside a run); report the exact output line; never say "should pass".

- [ ] **Step 4: Run tests and self-check**

Run: `npm test` → all PASS. Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 5: Commit**

```bash
git add agents/implementer.md agents/reviewer.md agents/re-reviewer.md skills/review skills/tdd skills/verify
git commit -m "feat: worker templates and review, tdd, verify skills"
```

---

### Task 5: Orchestration — `staff`, `run`, staffer and orchestrator templates

**Risk:** high

**Files:**
- Create: `agents/staffer.md`
- Create: `agents/orchestrator.md`
- Create: `skills/staff/SKILL.md`
- Create: `skills/run/SKILL.md`
- Create: `skills/run/details/ledger.md`

**Interfaces:**
- Consumes: Task 4 templates and placeholders; CLI `leanpowers brief --plan <p> --task <n>`, `leanpowers check --plan <p> --task <n>`, `leanpowers check --all`, `leanpowers metrics --plan <p>`; config keys `review.batch`, `review.maxFixRounds`, `models.*`, `orchestration`
- Produces: run folder files `besetzung.md`, `progress.md`, `task-<n>-brief.md`, `task-<n>-report.md`, `review-*.md`; orchestrator status `NEEDS_USER`.

- [ ] **Step 1: Read sources**

Spec section 7 (all of it), Superpowers `subagent-driven-development/SKILL.md`, `dispatching-parallel-agents/SKILL.md`, `executing-plans/SKILL.md`.

- [ ] **Step 2: Write `agents/staffer.md`** (≤400 words)

Input: plan path. Read the plan only (not the code). Output `besetzung.md` (max 200 words) to the given path: recommended orchestrator tier with one-sentence reason (size, risk mix, cross-module work); per task one line `Task <n>: implementer <tier>, reviewer <tier>` (rule of thumb: complete code in plan → small; prose rules, 1–2 files → medium; multi-file judgment → large; reviewers at least medium; final review large). Return only the file path.

- [ ] **Step 3: Write `skills/staff/SKILL.md`**

Dispatch `agents/staffer.md` at tier small; show the recommendation to the user in three lines; then by `orchestration`: `auto` and the platform supports nested subagents → dispatch `agents/orchestrator.md` at the chosen tier with the plan path and run folder, relay any `NEEDS_USER` question to the user and resume the orchestrator with the answer, report its final summary; `switch` (or `auto` on a platform without nesting) → ask the user to switch the session model, then invoke `run`; `recommend` → invoke `run` with the current model. The per-task tiers in `besetzung.md` apply in all modes.

- [ ] **Step 4: Write `agents/orchestrator.md`** (≤400 words)

You execute the plan by following the `run` skill exactly; you may dispatch implementers and reviewers (they never dispatch further); decide ambiguities by ruling and log them; stop only for the four reasons in `run` — then return `NEEDS_USER` with one precise question and the ledger path; on completion return at most 15 lines: tasks done, rulings (each with cost if wrong), open minors, final check line, metrics line.

- [ ] **Step 5: Write `skills/run/SKILL.md` and `details/ledger.md`**

SKILL.md (≤600 words) must keep:
- Setup: run folder `<paths.runs>/<plan-basename>/`; ledger `progress.md` first line names the plan; on resume trust the ledger and git log, never redo completed tasks.
- Per task: `leanpowers brief`; dispatch `agents/implementer.md` at the tier from `besetzung.md` with brief and report paths plus only interfaces/rulings from earlier tasks; run `leanpowers check --plan --task` yourself (gate); red gate → back to the same implementer.
- Review by risk: `high` → reviewer now; `low` → collect and review every `review.batch` tasks in one diff; reviewer output `review-<n>.md` or `review-<a>-<b>.md`.
- Fixes: at most `review.maxFixRounds` rounds (resume implementer → re-review); then rule on each open finding; Minor findings go to the ledger.
- Parallel: tasks marked parallel may run at the same time only if their files are disjoint; otherwise one implementer at a time.
- Rulings, not stalls: decide and log `Ruling: <what> — <why> — <cost if wrong>`; stop only for an irreversible/destructive action, a security-sensitive action, a side effect outside the repo (push, publish, merge), or a plan so broken every path is a guess.
- Never paste history into dispatches; hand over files.
- Fallback without subagents: same loop in this session, same gates.
- End: final review at tier large over the whole range, one fix wave, `leanpowers check --all`, `leanpowers metrics`, list all rulings to the user, then invoke `finish`.

`details/ledger.md`: exact ledger line formats (task complete, fix round r/max, minor deferred, ruling, metrics section written by the CLI).

- [ ] **Step 6: Run tests and self-check**

Run: `npm test` → all PASS. Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 7: Commit**

```bash
git add agents/staffer.md agents/orchestrator.md skills/staff skills/run
git commit -m "feat: staff and run skills with staffer and orchestrator templates"
```

---

### Task 6: Remaining skills `debug`, `worktrees`, `finish`, `write-skill`

**Risk:** low

**Files:**
- Create: `skills/debug/SKILL.md`
- Create: `skills/worktrees/SKILL.md`
- Create: `skills/finish/SKILL.md`
- Create: `skills/write-skill/SKILL.md`
- Create: `skills/write-skill/details/testing-skills.md`

**Interfaces:**
- Consumes: Global Constraints content rules; `extraSkillDirs` config key
- Produces: nothing consumed by code

- [ ] **Step 1: Read sources**

Superpowers `systematic-debugging/`, `using-git-worktrees/`, `finishing-a-development-branch/`, `writing-skills/` (SKILL.md and `testing-skills-with-subagents.md`).

- [ ] **Step 2: Write the skills**

- `debug`: four phases — investigate root cause (read errors, reproduce, recent changes, trace data flow), compare with working patterns, one hypothesis at a time with a minimal test, fix at the root with a failing test first; after 3 failed fixes stop and question the architecture with the user.
- `worktrees`: off by default (switch line handles it); when on: use an existing `.worktrees/` or `worktrees/` folder, else `.worktrees/`; make sure it is git-ignored; install dependencies; run `leanpowers check` as baseline before work.
- `finish`: run `leanpowers check --all`; offer exactly four options — merge locally, push and open a PR, keep the branch, discard (discard needs typed confirmation); never push or merge without the user's choice; after merge remove the worktree (if any) and the plan's run folder.
- `write-skill`: leanpowers skill format (frontmatter rules, ≤600 words, details for depth, actions not tools, switch line, no hard-coded paths); place project skills in a folder listed in `extraSkillDirs`; validate with `leanpowers check --all`; test a skill by giving a subagent a realistic pressure scenario with and without the skill (details link).
- `details/testing-skills.md` (≤400 words): RED (baseline without skill, record failures) → GREEN (write the skill against those failures) → REFACTOR (close loopholes found in re-runs).

- [ ] **Step 3: Run tests and self-check**

Run: `npm test` → all PASS. Run: `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 4: Commit**

```bash
git add skills/debug skills/worktrees skills/finish skills/write-skill
git commit -m "feat: debug, worktrees, finish and write-skill skills"
```

---

### Task 7: Completeness, attribution and self-check

**Risk:** low

**Files:**
- Modify: `tests/skills-content.test.mjs`
- Modify: `NOTICE`

**Interfaces:**
- Consumes: all files from Tasks 2–6; `lintSkills` from `checks/skill-lint.mjs`; `DEFAULTS`
- Produces: a guard that the full set exists

- [ ] **Step 1: Add the completeness test**

Append to `tests/skills-content.test.mjs`:
```js
import { lintSkills } from '../checks/skill-lint.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const SKILLS = ['start', 'design', 'plan', 'staff', 'run', 'review', 'tdd', 'debug', 'verify', 'worktrees', 'finish', 'write-skill'];
const AGENTS = ['implementer', 'reviewer', 're-reviewer', 'staffer', 'orchestrator'];

test('the full skill and agent set exists and passes skill-lint', () => {
  assert.deepEqual(skillNames().sort(), [...SKILLS].sort());
  assert.deepEqual(ls('agents').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort(), [...AGENTS].sort());
  assert.deepEqual(lintSkills(root, DEFAULTS).messages, []);
});
```
(Move the two imports to the top of the file with the others.)

- [ ] **Step 2: Run tests**

Run: `npm test` → all PASS.

- [ ] **Step 3: Update `NOTICE`**

Append a line listing the adapted skills: `Adapted from Superpowers skills: design (brainstorming), plan (writing-plans), run (subagent-driven-development, dispatching-parallel-agents, executing-plans), review (requesting/receiving-code-review), tdd, debug (systematic-debugging), verify (verification-before-completion), worktrees (using-git-worktrees), finish (finishing-a-development-branch), write-skill (writing-skills), and the implementer/reviewer/re-reviewer templates.` Replace the sentence "Adapted parts are marked in the file headers." with "Adapted parts are listed below."

- [ ] **Step 4: Self-check**

Run: `node bin/leanpowers.mjs check --all`
Expected: `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`

- [ ] **Step 5: Commit**

```bash
git add tests/skills-content.test.mjs NOTICE
git commit -m "test: completeness guard for skills and agents; NOTICE attribution"
```
