# leanpowers Plan 3 – Pakete, Befehle, init und echte Läufe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the leanpowers sources into installable packages for Claude Code, Codex and Gemini CLI, add the CLI commands `start`, `skills` and `init` with a default project template, make the CLI reachable from subagent briefs, and verify the Claude Code package with real headless runs.

**Architecture:** A zero-dependency build script (`build/build.mjs`) copies the shared runtime (bin, checks, schema, templates, skills, agent prompts) into `dist/<platform>/` and adds per-platform manifests, start-text injection and command files. Agent templates ship as prompt files under `prompts/` so no platform registers them as always-loaded agents. Generated `dist/` is committed (marketplaces point at it) and a test fails when it is stale.

**Tech Stack:** Node >= 20 ESM, `node:test`; Claude Code (`claude -p --plugin-dir`), Codex CLI (bundled in ChatGPT.app), Gemini CLI (built from docs, unverified).

**Spec:** `docs/specs/2026-10-29-leanpowers-design.md` (sections 4, 6, 9, 10.2, 10.3, 13, 15 A1–A3). Platform facts: `docs/research/2026-10-29-plattform-fakten.md` and `platforms/*.md`. This is plan 3 of 4.

## Global Constraints

- Node >= 20, ES modules (`.mjs`), zero dependencies; tests via `npm test`; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- English identifiers, CLI output and commit messages; paths reported with forward slashes.
- CLI commands never overwrite an existing user file; they create missing files only, or print what they would write.
- leanpowers never edits an assistant's own configuration (`~/.claude`, `~/.codex`, `~/.gemini`, their settings files); for native skill switches it prints the exact instruction for the user.
- Agent templates are never registered as platform agents (spec A2); in `dist/` they live in `prompts/`, and the build rewrites the skills' references from `agents/<name>.md` to `prompts/<name>.md`. Exception: Gemini gets three generated tier agents `lp-small`, `lp-medium`, `lp-large` (description ≤ 15 words each).
- Always-loaded text per platform stays ≤ 150 estimated tokens for the start text (Claude hook output, Gemini `GEMINI.md`).
- Plugin name `leanpowers`, version from `package.json`, author `Dominic Shin`, repository `https://github.com/Amangaron/leanpowers`, license `MIT`.
- Anything not verified by a real run stays marked `(unverified)` in `platforms/*.md` and in the README's platform table.
- Real assistant runs use the cheapest model, at most 3 turns and (Claude) `--max-budget-usd 0.25` per run; they never install anything into the user's assistant configuration.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit. Never push, never `git stash`.

---

### Task 1: `leanpowers start` and a resolvable CLI in briefs

**Risk:** high

**Files:**
- Create: `checks/start.mjs`
- Modify: `checks/brief.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/start.test.mjs`
- Test: `tests/brief.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` (`checks/skill-lint.mjs`), `loadConfig`
- Produces:
  - `COMMANDS = ['design','plan','staff','run','debug','finish','check','skills','init']`; `COMMAND_SKILL = { design:'design', plan:'plan', staff:'staff', run:'run', debug:'debug', finish:'finish' }` (check/skills/init are CLI commands and always active)
  - `startText(pluginRoot: string, config: object): string` — body of `skills/start/SKILL.md` with its `Commands:` line replaced by `Commands: <active commands joined ", ">.`
  - `cliCommand(): string` — `process.env.LEANPOWERS_CLI` if set, else `node "<absolute path of bin/leanpowers.mjs>"` (posix slashes)
  - CLI `leanpowers start [--format plain|claude]`; `claude` prints `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<text>"}}`
  - brief `## When done` now reads ``Run `<cliCommand()> check --plan <plan> --task <n>`. …`` (rest unchanged)

- [ ] **Step 1: Write the failing tests**

`tests/start.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startText, cliCommand, COMMANDS } from '../checks/start.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { estimateTokens } from '../checks/skill-lint.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('start text lists all commands by default and stays small', () => {
  const t = startText(repo, DEFAULTS);
  assert.match(t, /^Commands: design, plan, staff, run, debug, finish, check, skills, init\.$/m);
  assert.doesNotMatch(t, /^---/m);
  assert.ok(estimateTokens(t) <= 150);
});

test('disabled skills drop their command, CLI commands stay', () => {
  const t = startText(repo, { ...DEFAULTS, skills: { ...DEFAULTS.skills, staff: false, debug: false } });
  assert.match(t, /^Commands: design, plan, run, finish, check, skills, init\.$/m);
});

test('cliCommand prefers LEANPOWERS_CLI, else node with absolute bin path', () => {
  const old = process.env.LEANPOWERS_CLI;
  process.env.LEANPOWERS_CLI = 'lp';
  assert.equal(cliCommand(), 'lp');
  delete process.env.LEANPOWERS_CLI;
  assert.match(cliCommand(), /^node ".*\/bin\/leanpowers\.mjs"$/);
  if (old !== undefined) process.env.LEANPOWERS_CLI = old;
  assert.equal(COMMANDS.length, 9);
});

test('CLI start prints plain text or Claude hook JSON', () => {
  const bin = path.join(repo, 'bin/leanpowers.mjs');
  const plain = spawnSync(process.execPath, [bin, 'start'], { cwd: repo, encoding: 'utf8' });
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /^Commands: /m);
  const json = spawnSync(process.execPath, [bin, 'start', '--format', 'claude'], { cwd: repo, encoding: 'utf8' });
  const out = JSON.parse(json.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /^Commands: /m);
});
```

Append to `tests/brief.test.mjs`:
```js
test('brief names a resolvable CLI command', () => {
  const b = buildBrief(parsePlan(PLAN), 1, config, '.leanpowers/runs/demo', 'docs/plans/demo.md');
  assert.match(b, /Run `(node ".*\/bin\/leanpowers\.mjs"|[^`]+) check --plan docs\/plans\/demo\.md --task 1`/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` → the new tests FAIL (module `checks/start.mjs` missing; brief still says `leanpowers check`).

- [ ] **Step 3: Implement**

- `checks/start.mjs`: as in Interfaces. A command is active when its skill switch is not `false` in `config.skills` (CLI commands always). `pluginRoot` is the folder containing `skills/`. Read the start body via `parseFrontmatter`, trim it.
- `checks/brief.mjs`: use `cliCommand()` in `## When done`; keep every other line as it is.
- `bin/leanpowers.mjs`: add `start` (`--format plain|claude`, default plain; plugin root = the folder above `bin/`; config from `loadConfig(cwd)`); update the usage line to `usage: leanpowers <check|brief|metrics|config|start|skills|init> …` (later tasks add skills/init).
- Fix any existing test that asserted the literal `leanpowers check` in the brief so it accepts `cliCommand()`.

- [ ] **Step 4: Run tests and self-check** — `npm test` all PASS; `node bin/leanpowers.mjs check --all` → the one-line ok.

- [ ] **Step 5: Commit**

```bash
git add checks/start.mjs checks/brief.mjs bin/leanpowers.mjs tests/start.test.mjs tests/brief.test.mjs
git commit -m "feat: start command and resolvable CLI in briefs"
```

---

### Task 2: `leanpowers skills` — list, set, interactive, native hints

**Risk:** low

**Files:**
- Create: `checks/skills-cmd.mjs`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/skills-cmd.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter`, `loadConfig`
- Produces:
  - `listSkills(pluginRoot, root, config): { name: string, enabled: boolean, source: 'builtin'|'extra', description: string }[]` sorted by name; `start` is excluded (not switchable)
  - `setSkills(root, changes: Record<string, boolean>): string` — reads `<root>/leanpowers.json` (or `{}` if missing), sets `skills.<name>`, writes it back with 2-space JSON + newline, keeps all other keys; returns the file path; unknown skill names throw `unknown skill: <name>`
  - `toggle(state: {cursor:number, items:{name:string, enabled:boolean}[]}, key: 'up'|'down'|'space'): state` — pure
  - `nativeHint(platform: 'claude'|'codex'|'gemini', disabled: string[]): string`
  - CLI: `skills --list` (one line per skill: `[x] name — description` / `[ ] …`), `skills --set name=on|off[,name=on|off]`, `skills --native <platform>`, and with no flags on a TTY an interactive checklist (↑/↓ move, space toggles, enter saves, q/esc cancels); with no flags and no TTY it behaves like `--list`.

- [ ] **Step 1: Write the failing tests**

`tests/skills-cmd.test.mjs`:
```js
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
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → new tests FAIL (module missing).

- [ ] **Step 3: Implement** — as in Interfaces. Skill names come from `<pluginRoot>/skills/*/SKILL.md` plus every `config.extraSkillDirs` entry (relative to root); a skill is enabled unless `config.skills[name] === false` (`worktrees` defaults to false via DEFAULTS). The interactive mode uses raw stdin, redraws the list after each key, and calls `setSkills` once on enter. `nativeHint`: claude → "Claude Code has no per-skill switch for plugin skills; leanpowers.json already disables: <names>"; codex → one `[[skills.config]]` block per name with `path = "<plugin>/skills/<name>/SKILL.md"` and `enabled = false`, to paste into `~/.codex/config.toml`; gemini → one `/skills disable <name>` line per name.

- [ ] **Step 4: Run tests and self-check**, then **Step 5: Commit**

```bash
git add checks/skills-cmd.mjs bin/leanpowers.mjs tests/skills-cmd.test.mjs
git commit -m "feat: skills command with checklist, set/list and native hints"
```

---

### Task 3: `leanpowers init` and the default project template

**Risk:** high

**Files:**
- Create: `checks/init.mjs`
- Create: `templates/project-default/leanpowers.json`
- Create: `templates/project-default/docs/specs/.gitkeep`
- Create: `templates/project-default/docs/plans/.gitkeep`
- Create: `templates/project-default/docs/reports/.gitkeep`
- Create: `templates/project-default/src/.gitkeep`
- Create: `templates/project-default/tests/.gitkeep`
- Modify: `bin/leanpowers.mjs`
- Test: `tests/init.test.mjs`

**Interfaces:**
- Consumes: `validate` + schema, `DEFAULTS`
- Produces:
  - `scanProject(root): { commands: {test,typecheck,lint}, structure: { newFolders: 'ask', rules: {path, allow}[] } }` — commands from `package.json` scripts (`test` → `npm test`, `typecheck` → `npm run typecheck`, `lint` → `npm run lint`) else `Makefile` targets `test`/`lint` (`make test`), else empty; rules: for each top-level directory (excluding dot-folders, `node_modules`, `dist`, `build`, `vendor`, the run folder) that contains files, `{ path: '<dir>/**', allow: [<'*.ext' for each extension found, sorted>] }`
  - `proposeConfig(root): object` — `{ $schema, commands, structure }` valid against the schema
  - `applyTemplate(pluginRoot, name, root): string[]` — copies `templates/<name>/` into root, creating only missing files; returns the created paths (posix, relative)
  - CLI: `init` prints the proposed config and the hint `run "leanpowers init --write" to save it`; `init --write` writes `leanpowers.json` only if it does not exist (else exit 1 with `leanpowers.json exists — not overwritten`); `init --template <name>` applies the template and prints the created files.

- [ ] **Step 1: Write the failing tests**

`tests/init.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject, proposeConfig, applyTemplate } from '../checks/init.mjs';
import { validate } from '../checks/lib/config.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = JSON.parse(fs.readFileSync(path.join(repo, 'schema/leanpowers.schema.json'), 'utf8'));
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-init-'));
  for (const [rel, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), c);
  }
  return root;
}

test('scan finds npm scripts and per-folder file types', () => {
  const root = project({
    'package.json': JSON.stringify({ scripts: { test: 'node --test', typecheck: 'tsc' } }),
    'src/a.ts': '', 'src/b.tsx': '', 'src/deep/c.ts': '',
    'tests/a.test.ts': '', 'node_modules/x/y.js': '', '.git/HEAD': '',
  });
  const s = scanProject(root);
  assert.deepEqual(s.commands, { test: 'npm test', typecheck: 'npm run typecheck', lint: '' });
  assert.deepEqual(s.structure.rules, [
    { path: 'src/**', allow: ['*.ts', '*.tsx'] },
    { path: 'tests/**', allow: ['*.ts'] },
  ]);
});

test('Makefile targets are used without package.json', () => {
  const root = project({ Makefile: 'test:\n\tgo test ./...\nlint:\n\tgolangci-lint run\n' });
  assert.deepEqual(scanProject(root).commands, { test: 'make test', typecheck: '', lint: 'make lint' });
});

test('proposed config is schema-valid', () => {
  const root = project({ 'src/a.js': '' });
  assert.deepEqual(validate(proposeConfig(root), schema), []);
});

test('template creates missing files only', () => {
  const root = project({ 'leanpowers.json': '{"keep":true}' });
  const created = applyTemplate(repo, 'project-default', root);
  assert.ok(created.includes('docs/specs/.gitkeep'));
  assert.ok(!created.includes('leanpowers.json'));
  assert.equal(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'), '{"keep":true}');
});
```

- [ ] **Step 2: Run to verify it fails**, **Step 3: Implement** (as in Interfaces; `templates/project-default/leanpowers.json` = DEFAULTS values with `$schema` and `commands.test: ""`), **Step 4: Run tests and self-check**, **Step 5: Commit**

```bash
git add checks/init.mjs templates/project-default bin/leanpowers.mjs tests/init.test.mjs
git commit -m "feat: init command with project scan and default template"
```

---

### Task 4: Build script and Claude Code package

**Risk:** high

**Files:**
- Create: `build/build.mjs`
- Create: `build/claude.mjs`
- Create: `.claude-plugin/marketplace.json`
- Modify: `package.json`
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `startText` (Task 1), source folders `skills/`, `agents/`, `bin/`, `checks/`, `schema/`, `templates/`, files `package.json`, `LICENSE`, `NOTICE`
- Produces:
  - `build(repoRoot, outRoot = <repo>/dist, platforms = ['claude','codex','gemini']): string[]` (written files, posix, relative to outRoot); platforms not yet implemented are skipped silently until Tasks 5–6
  - `copyRuntime(repoRoot, outDir)`: copies the shared runtime; `agents/*.md` → `prompts/*.md`; in every copied `skills/**/*.md` replaces `agents/` path references with `prompts/` (only the substring `` `agents/`` and `(agents/`)
  - Claude package `dist/claude-plugin/`: `.claude-plugin/plugin.json` `{ name, version, description, author: { name }, repository, license }`; `hooks/hooks.json` with a `SessionStart` hook (matcher `startup|clear|compact`) running `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" start --format claude`; `commands/<cmd>.md` for the 9 commands — skill commands say `Invoke the leanpowers <skill> skill. $ARGUMENTS`, CLI commands say `Run \`node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" <cmd> $ARGUMENTS\` and show the output.` (for `skills`: use `--list`, then ask the user which to change and apply with `--set`)
  - `npm run build` → `node build/build.mjs`
  - `.claude-plugin/marketplace.json` at repo root: `{ "name": "leanpowers-marketplace", "owner": { "name": "Dominic Shin" }, "plugins": [ { "name": "leanpowers", "source": "./dist/claude-plugin", "description": "<package description>" } ] }`

- [ ] **Step 1: Write the failing test**

`tests/build.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build/build.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-build-'));
build(repo, out);
const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(out, rel));

test('claude package has manifest, hook, commands and runtime', () => {
  const pj = JSON.parse(read('claude-plugin/.claude-plugin/plugin.json'));
  assert.equal(pj.name, 'leanpowers');
  assert.equal(pj.version, JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version);
  const hooks = JSON.parse(read('claude-plugin/hooks/hooks.json'));
  assert.match(JSON.stringify(hooks), /bin\/leanpowers\.mjs\\?" start --format claude/);
  for (const c of ['design', 'plan', 'staff', 'run', 'debug', 'finish', 'check', 'skills', 'init']) {
    assert.ok(exists(`claude-plugin/commands/${c}.md`), c);
  }
  assert.ok(exists('claude-plugin/bin/leanpowers.mjs'));
  assert.ok(exists('claude-plugin/skills/run/SKILL.md'));
});

test('agent templates ship as prompts, never as agents', () => {
  assert.ok(!exists('claude-plugin/agents'));
  assert.ok(exists('claude-plugin/prompts/implementer.md'));
  const run = read('claude-plugin/skills/run/SKILL.md');
  assert.doesNotMatch(run, /`agents\//);
});

test('marketplace points at the claude package', () => {
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(m.plugins[0].name, 'leanpowers');
  assert.equal(m.plugins[0].source, './dist/claude-plugin');
});
```

- [ ] **Step 2: Run to verify it fails**, **Step 3: Implement** (as in Interfaces; the build first removes the target platform folder, then writes it; file writes use `\n` line endings), **Step 4: Run `npm run build`, `npm test`, self-check**, **Step 5: Commit** (including the generated `dist/claude-plugin`)

```bash
git add build .claude-plugin package.json tests/build.test.mjs dist/claude-plugin
git commit -m "feat: build script and Claude Code package"
```

---

### Task 5: Codex package

**Risk:** low

**Files:**
- Create: `build/codex.mjs`
- Create: `.agents/plugins/marketplace.json`
- Modify: `build/build.mjs`
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `copyRuntime` (Task 4)
- Produces: `dist/codex-plugin/` with `.codex-plugin/plugin.json` `{ name, version, description, author: { name }, repository, license, skills: "./skills/", interface: { displayName: "leanpowers" } }` — no `hooks` key value other than `{}` (no session hook on Codex: hooks need user trust and block the public directory, spec research note); runtime + skills + prompts as in Task 4; `.agents/plugins/marketplace.json` at repo root with the same shape as the Claude marketplace but `source: "./dist/codex-plugin"`.

- [ ] **Step 1: Append the failing test** to `tests/build.test.mjs`:
```js
test('codex package has manifest with skills and no session hook', () => {
  const pj = JSON.parse(read('codex-plugin/.codex-plugin/plugin.json'));
  assert.equal(pj.name, 'leanpowers');
  assert.equal(pj.skills, './skills/');
  assert.deepEqual(pj.hooks ?? {}, {});
  assert.ok(exists('codex-plugin/skills/design/SKILL.md'));
  assert.ok(exists('codex-plugin/prompts/reviewer.md'));
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(m.plugins[0].source, './dist/codex-plugin');
});
```
- [ ] **Step 2–5:** verify fail, implement, `npm run build` + `npm test` + self-check, commit (including `dist/codex-plugin`):

```bash
git add build .agents tests/build.test.mjs dist/codex-plugin
git commit -m "feat: Codex package"
```

---

### Task 6: Gemini CLI package (built from docs, unverified)

**Risk:** low

**Files:**
- Create: `build/gemini.mjs`
- Modify: `build/build.mjs`
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `copyRuntime`, `startText`, `DEFAULTS`
- Produces: `dist/gemini-extension/` with `gemini-extension.json` `{ name, version, description, contextFileName: "GEMINI.md" }`; `GEMINI.md` = `startText(repo, DEFAULTS)` (≤150 est. tokens, sent with every request); `commands/leanpowers/<cmd>.toml` for the 9 commands (`description` + `prompt`; skill commands: `Invoke the leanpowers <skill> skill. {{args}}`; CLI commands: `Run \`node "${extensionPath}/bin/leanpowers.mjs" <cmd> {{args}}\` and show the output.`); `agents/lp-small.md`, `lp-medium.md`, `lp-large.md` with frontmatter `name`, `description` (≤15 words: `leanpowers worker at tier <tier>; the prompt carries its template.`), `kind: local`, `model: inherit` (unverified: tier → model mapping is applied by the user's `models.*` once verified); runtime + skills + prompts.

- [ ] **Step 1: Append the failing test** to `tests/build.test.mjs`:
```js
import { estimateTokens } from '../checks/skill-lint.mjs';

test('gemini extension has manifest, small context file, toml commands and tier agents', () => {
  const ext = JSON.parse(read('gemini-extension/gemini-extension.json'));
  assert.equal(ext.contextFileName, 'GEMINI.md');
  assert.ok(estimateTokens(read('gemini-extension/GEMINI.md')) <= 150);
  assert.match(read('gemini-extension/commands/leanpowers/plan.toml'), /prompt\s*=/);
  for (const t of ['small', 'medium', 'large']) {
    assert.match(read(`gemini-extension/agents/lp-${t}.md`), new RegExp(`name: lp-${t}`));
  }
  assert.ok(!exists('gemini-extension/agents/implementer.md'));
});
```
(Move the import to the top of the file.)
- [ ] **Step 2–5:** verify fail, implement, `npm run build` + `npm test` + self-check, commit (including `dist/gemini-extension`):

```bash
git add build tests/build.test.mjs dist/gemini-extension
git commit -m "feat: Gemini CLI extension (unverified)"
```

---

### Task 7: Stale-dist guard and install documentation

**Risk:** low

**Files:**
- Create: `docs/README.md`
- Create: `docs/README.de.md`
- Create: `README.md`
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `build(repoRoot, outRoot)`
- Produces: a test that builds into a temp folder and compares every file with the committed `dist/` (message on mismatch: `dist/ is stale — run npm run build`); READMEs.

- [ ] **Step 1: Append the failing-if-stale test** to `tests/build.test.mjs`:
```js
test('committed dist matches a fresh build', () => {
  const list = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]);
  const fresh = list(out).sort();
  assert.deepEqual(list(path.join(repo, 'dist')).sort(), fresh, 'dist/ is stale — run npm run build');
  for (const rel of fresh) {
    assert.equal(fs.readFileSync(path.join(repo, 'dist', rel), 'utf8'), read(rel), `dist/ is stale — run npm run build (${rel})`);
  }
});
```
- [ ] **Step 2: Write the READMEs**
  - `README.md` (root, ≤ 60 lines, English): what leanpowers is, the token comparison (≈515 vs ≈1,030 always-loaded tokens, measured after plan 2), install commands per platform, link to `docs/README.md` and `docs/README.de.md`, credit to Superpowers (MIT).
  - `docs/README.md` (English) and `docs/README.de.md` (German, same content): install per platform —
    - Claude Code: `claude plugin marketplace add Amangaron/leanpowers`, then `claude plugin install leanpowers@leanpowers-marketplace`
    - Codex: `codex plugin marketplace add Amangaron/leanpowers`, then `codex plugin add leanpowers@leanpowers-marketplace` (unverified)
    - Gemini CLI: local install `gemini extensions link <clone>/dist/gemini-extension` (unverified; GitHub install layout is decided in plan 4)
  - Also: commands table, `leanpowers.json` keys (from the schema), how to switch skills (`leanpowers skills`), `leanpowers init`, platform status table (verified / unverified per platform).
- [ ] **Step 3: Run `npm run build`, `npm test`, self-check; Step 4: Commit**

```bash
git add README.md docs/README.md docs/README.de.md tests/build.test.mjs dist
git commit -m "docs: install guides; test: stale dist guard"
```

---

### Task 8: Real-run verification (Claude Code automated, Codex script)

**Risk:** high

**Files:**
- Create: `scripts/verify-claude.mjs`
- Create: `scripts/verify-codex.sh`
- Create: `docs/research/2026-10-29-verifikation.md`
- Modify: `platforms/claude.md`
- Modify: `platforms/codex.md`

**Interfaces:**
- Consumes: `dist/claude-plugin`, `dist/codex-plugin`
- Produces: a verification record; `(unverified)` markers removed only for claims a run confirmed

- [ ] **Step 1: Write `scripts/verify-claude.mjs`** (Node, no deps). It runs, in a temporary git repo created by the script, with `claude` from PATH:
  1. `claude -p "Reply with the exact line that starts with 'Commands:' from your session context, nothing else." --plugin-dir <repo>/dist/claude-plugin --model haiku --max-turns 1 --max-budget-usd 0.25 --output-format json` → PASS if the result contains `Commands: design, plan`.
  2. Same flags with prompt `Run /leanpowers:check and reply only with its output.` and `--max-turns 3` → PASS if the result contains `leanpowers check:` (the temp repo has no test command, so the expected line is the red "no test command configured" failure — that is still a PASS for wiring).
  3. Records cost and token usage from the JSON (`total_cost_usd`, and `usage`/`modelUsage` if present) per run.
  It prints one line per check (`PASS|FAIL <name> <detail>`) and exits non-zero on any FAIL.
- [ ] **Step 2: Run it** — `node scripts/verify-claude.mjs`. Expected: two PASS lines. On FAIL, fix the package (build code, then `npm run build`) and re-run; at most 3 attempts, then report BLOCKED with the output.
- [ ] **Step 3: Write `scripts/verify-codex.sh`** for the user to run manually (it is never run by an agent, because it would change the user's Codex configuration). It: locates `codex` (PATH, else `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`); prints the two install commands for a local marketplace (`codex plugin marketplace add <repo>` and `codex plugin add leanpowers@leanpowers-marketplace`) and asks for confirmation before running them; then runs `codex exec --json --skip-git-repo-check "Use the leanpowers check skill or run its command and reply with the output."` in a temp dir and prints whether `leanpowers check:` appears; finally prints how to remove the plugin again.
- [ ] **Step 4: Record results** in `docs/research/2026-10-29-verifikation.md` (German): date, versions (`claude --version`), each check with PASS/FAIL and measured cost/tokens; what remains unverified (Codex until the user runs the script, Gemini entirely). In `platforms/claude.md` remove `(unverified)` only from claims the runs confirmed (plugin root variable in the CLI section, session-start injection); leave `platforms/codex.md` unchanged except a line pointing to `scripts/verify-codex.sh`.
- [ ] **Step 5: Run `npm test` and self-check, then commit**

```bash
git add scripts docs/research/2026-10-29-verifikation.md platforms
git commit -m "test: real-run verification for Claude Code; Codex verify script"
```
