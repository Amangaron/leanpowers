# leanpowers Plan 4 – Release v0.1 (ohne API-Tests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make leanpowers ready to publish as v0.1.0: platform maps that no assistant mistakes for its own memory file, a free CI run on macOS, Windows and Linux, a Gemini install path from GitHub, and versioned release notes and docs — without any paid assistant runs.

**Architecture:** Only repository plumbing changes; skills and runtime stay as they are. The Gemini extension is published on a generated branch whose root is `dist/gemini-extension`, created by a script that only builds the branch locally — pushing stays a separate step the user approves.

**Tech Stack:** Node >= 20 ESM, `node:test`, git, GitHub Actions (free for public repositories).

**Spec:** `docs/specs/2026-10-29-leanpowers-design.md` (sections 11, 13, 16). This is plan 4 of 4.

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16).
- Never push, never create remote repositories or branches on GitHub, never `git stash`; publishing is done after this plan, only with the user's explicit approval.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- After changing anything the build copies, run `npm run build` and commit the regenerated `dist/`; generated `dist/**` is exempt from scope and structure findings.
- Docs stay honest: the ≈50 % saving is calculated, not measured; Codex and Gemini are "built, unverified"; Claude Code "loads (inferred from the init event)".
- Repository `https://github.com/Amangaron/leanpowers`, author `Dominic Shin`, license MIT.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.

---

### Task 1: Rename the platform maps

**Risk:** low

**Files:**
- Create: `platforms/claude-code.md`
- Create: `platforms/codex-cli.md`
- Create: `platforms/gemini-cli.md`
- Modify: `build/build.mjs`
- Modify: `tests/skills-content.test.mjs`
- Modify: `tests/build.test.mjs`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`

**Interfaces:**
- Consumes: `build()` in `build/build.mjs`
- Produces: `PLATFORM_MAP = { claude: 'claude-code', codex: 'codex-cli', gemini: 'gemini-cli' }` exported from `build/build.mjs`; source maps at `platforms/<PLATFORM_MAP[p]>.md`; packages still ship them as `platform.md`.

Why: on case-insensitive file systems (macOS default) Claude Code loads `platforms/claude.md` as a directory `CLAUDE.md`, and Gemini CLI would do the same with `platforms/gemini.md` as `GEMINI.md`.

- [ ] **Step 1:** Move the three files with `git mv` (`claude.md` → `claude-code.md`, `codex.md` → `codex-cli.md`, `gemini.md` → `gemini-cli.md`) so history is kept.
- [ ] **Step 2: Write the failing test** — append to `tests/build.test.mjs`:
```js
import { PLATFORM_MAP } from '../build/build.mjs';

test('platform maps never use a name an assistant loads as its memory file', () => {
  const names = fs.readdirSync(path.join(repo, 'platforms')).map((f) => f.toLowerCase());
  for (const banned of ['claude.md', 'gemini.md', 'agents.md']) assert.ok(!names.includes(banned), banned);
  assert.deepEqual(PLATFORM_MAP, { claude: 'claude-code', codex: 'codex-cli', gemini: 'gemini-cli' });
});
```
(Move the import to the top of the file.)
- [ ] **Step 3:** Run `npm test` → FAIL (no `PLATFORM_MAP` export).
- [ ] **Step 4: Implement** — export `PLATFORM_MAP`, read `platforms/${PLATFORM_MAP[platform]}.md` in `build()`; update the path in `tests/skills-content.test.mjs` (the platform-maps test) and the `platform.md` test in `tests/build.test.mjs`; update the two docs mentions. Run `npm run build`; `dist/` must not change, because the shipped `platform.md` text is identical.
- [ ] **Step 5:** `npm test` + self-check, then commit:
```bash
git add platforms build/build.mjs tests docs/README.md docs/README.de.md dist
git commit -m "fix: rename platform maps so no assistant loads them as memory files"
```

---

### Task 2: CI on macOS, Windows and Linux

**Risk:** high

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `tests/git.test.mjs`
- Modify: `tests/check.test.mjs`
- Modify: `tests/brief.test.mjs`
- Modify: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `npm test`, `node bin/leanpowers.mjs check --all`, `npm run build`
- Produces: a workflow named `ci` with one job `test` over `os: [ubuntu-latest, macos-latest, windows-latest]` and `node: [20, 22]`

- [ ] **Step 1: Write the workflow**
```yaml
name: ci
on:
  push:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: git config --global user.email "ci@example.invalid"
      - run: git config --global user.name "ci"
      - run: git config --global commit.gpgsign false
      - run: npm test
      - run: node bin/leanpowers.mjs check --all
      - run: npm run build
      - run: git diff --exit-code -- dist .claude-plugin .agents
```
- [ ] **Step 2: Make the tests CI-safe** (the workflow cannot be run locally — audit instead). In every test that creates temp git repos (`tests/git.test.mjs`, `tests/check.test.mjs`, `tests/brief.test.mjs`, `tests/cli.test.mjs`, and any other found with `grep -l "git', \['init'" tests`), pass `-c commit.gpgsign=false` on commits and set `user.email`/`user.name` locally (already done in most); make sure no test depends on the machine's global git config, `$HOME`, a POSIX shell, `chmod` on Windows, or forward slashes in `path.join` results. Fix what you find; list each fix in the report.
- [ ] **Step 3: Simulate what you can locally** — run `npm test` with `HOME` pointed at an empty temp dir and `GIT_CONFIG_GLOBAL=/dev/null` (so no global git config is visible); everything must pass. Run `npm run build` and confirm `git diff --exit-code -- dist .claude-plugin .agents` is clean.
- [ ] **Step 4:** `npm test` + self-check, then commit:
```bash
git add .github tests
git commit -m "ci: test on macOS, Windows and Linux with Node 20 and 22"
```

---

### Task 3: Gemini install from GitHub

**Risk:** low

**Files:**
- Create: `scripts/gemini-branch.mjs`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Modify: `README.md`
- Test: `tests/gemini-branch.test.mjs`

**Interfaces:**
- Consumes: `dist/gemini-extension`
- Produces: `prepareGeminiBranch(repoRoot, { branch = 'gemini-extension' } = {}): { branch: string, commit: string }` — builds or updates the local branch `gemini-extension` whose root tree equals `dist/gemini-extension` (one new commit per run, message `release: gemini-extension from <master short sha>`), without touching the current branch, index or working tree (use `git worktree add` in a temp dir, or plumbing: `git read-tree` + `git write-tree` + `git commit-tree` with a temporary `GIT_INDEX_FILE`). Never pushes. CLI: `node scripts/gemini-branch.mjs` prints the branch and commit plus the exact push command for the user: `git push origin gemini-extension`.

Why: `gemini extensions install <github-url>` installs the repository root; leanpowers' root has source `skills/` and `agents/` that Gemini would load. A branch whose root is the built extension avoids that: `gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension` (unverified).

- [ ] **Step 1: Write the failing test** `tests/gemini-branch.test.mjs`: create a temp git repo containing a `dist/gemini-extension/` with two files and one commit on `main`; call `prepareGeminiBranch(root)`; assert the branch exists, `git ls-tree -r --name-only gemini-extension` lists exactly the two files at the root, the current branch is still `main`, `git status --porcelain` is empty, and a second run adds exactly one commit whose parent is the first.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** (plumbing route recommended). **Step 4:** Docs: Gemini install line becomes `gemini extensions install https://github.com/Amangaron/leanpowers --ref gemini-extension` (unverified) in all three READMEs; mention that the branch is regenerated per release.
- [ ] **Step 5:** `npm test` + self-check, then commit:
```bash
git add scripts/gemini-branch.mjs tests/gemini-branch.test.mjs README.md docs/README.md docs/README.de.md
git commit -m "feat: gemini-extension release branch for GitHub installs"
```

---

### Task 4: Version 0.1.0, changelog and release docs

**Risk:** low

**Files:**
- Modify: `package.json`
- Create: `CHANGELOG.md`
- Create: `docs/RELEASE.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`

**Interfaces:**
- Consumes: `build/meta.mjs` (version from package.json), all prior docs
- Produces: version `0.1.0` in every manifest (via rebuild); `CHANGELOG.md` (Keep a Changelog format, section `## [0.1.0] - 2026-10-29`); `docs/RELEASE.md` checklist

- [ ] **Step 1:** Set `"version": "0.1.0"` in `package.json`; run `npm run build` (manifests and marketplace files pick it up); `npm test` must stay green (tests read the version from package.json).
- [ ] **Step 2:** `CHANGELOG.md`, English: Added — deterministic checks (`check`, `brief`, `metrics`, `config`), skills and agent prompts, packages for Claude Code / Codex / Gemini CLI, `start`, `skills`, `init`, verification scripts; Notes — calculated ≈50 % less always-loaded text than Superpowers 6.3.0 (not measured), Codex and Gemini built but unverified, credit to Superpowers (MIT).
- [ ] **Step 3:** `docs/RELEASE.md`, English, a short checklist the maintainer follows by hand: `npm test` → `npm run build` → `git diff --exit-code` → update CHANGELOG → `git tag v<version>` → `node scripts/gemini-branch.mjs` → (with explicit decision) `git push origin master --tags` and `git push origin gemini-extension` → check the CI run on GitHub. Also how users self-verify: `node scripts/verify-claude.mjs` after `/login`, `scripts/verify-codex.sh`.
- [ ] **Step 4:** READMEs: add the version and a "Status / Verify it yourself" section (English and German): no paid test runs were made by the authors; what is confirmed (deterministic tests, CI, Claude package loads), what is not; the two verify scripts.
- [ ] **Step 5:** `npm test` + self-check, then commit:
```bash
git add package.json CHANGELOG.md docs/RELEASE.md README.md docs/README.md docs/README.de.md dist .claude-plugin .agents
git commit -m "chore: release v0.1.0 notes and docs"
```
