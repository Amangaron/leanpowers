# leanpowers Plan 5 – docLint.ignore (v0.1.1) Implementation Plan

**Goal:** Let projects that adopt leanpowers mid-way exempt older spec and plan files from `doc-lint` via a new `docLint.ignore` setting, and prepare release 0.1.1.

**Architecture:** One new optional config key, validated by the existing schema, defaulted in `DEFAULTS`, read only by `checks/doc-lint.mjs`. Matching uses the existing `matchesAny` from `checks/lib/glob.mjs` against repo-relative POSIX paths. No other check changes.

**Tech Stack:** Node >= 20 ESM, `node:test`, zero dependencies.

**Spec:** user request 2026-10-30: docLint.ignore for the LIDO Code Studio pilot (LIDO-Code-Studio `docs/superpowers/specs/2026-10-30-segment-1c-teil-1-pilot-pruefung-design.md`, section 7)

## Global Constraints

- No paid assistant runs: never run `claude` model turns, `codex exec` or `gemini` (spec section 16 of `docs/specs/2026-10-29-leanpowers-design.md`).
- Never push, never tag, never create remote repositories or branches on GitHub, never `git stash`; publishing happens after this plan, only with the user's explicit approval.
- Zero dependencies, Node >= 20 ESM; every task ends with `npm test` green and `node bin/leanpowers.mjs check --all` printing `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- After changing anything the build copies, run `npm run build` and commit the regenerated `dist/`; generated `dist/**` is exempt from scope and structure findings.
- `docLint.ignore` patterns are repo-relative POSIX globs matched with `matchesAny` from `checks/lib/glob.mjs`; default `[]`.
- Work on branch `feat/doclint-ignore` created from `main`.
- Commits: conventional prefix, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the model that wrote the commit.

---

### Task 1: docLint.ignore setting

**Risk:** high

**Files:**
- Modify: `schema/leanpowers.schema.json`
- Modify: `checks/lib/defaults.mjs`
- Modify: `checks/doc-lint.mjs`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Test: `tests/doc-lint.test.mjs`
- Test: `tests/config.test.mjs`
- Modify: `dist/**`

**Interfaces:**
- Produces: config key `docLint: { ignore: string[] }` (schema: object, `additionalProperties: false`, property `ignore` of type array with string items).
- Produces: `DEFAULTS.docLint` equal to `{ ignore: [] }`.
- Produces: `lintDocs(root, config)` skips every spec or plan file whose repo-relative POSIX path (`<folder>/<name>`, the same string used in its messages) matches `config.docLint?.ignore ?? []`. Signature and return shape unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `tests/doc-lint.test.mjs`:

```js
test('lintDocs skips files matched by docLint.ignore', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/plans/old.md'), '# Old\n');
  fs.writeFileSync(path.join(root, 'docs/plans/new.md'), GOOD_PLAN);
  fs.writeFileSync(path.join(root, 'docs/specs/old-design.md'), '# T\n');
  const all = { ...DEFAULTS, docLint: { ignore: ['docs/plans/old.md', 'docs/specs/old-*.md'] } };
  assert.deepEqual(lintDocs(root, all), { name: 'doc-lint', ok: true, messages: [] });
  const some = { ...DEFAULTS, docLint: { ignore: ['docs/plans/old.md'] } };
  assert.deepEqual(lintDocs(root, some).messages, ['docs/specs/old-design.md: needs at least 2 sections (## ...)']);
});

test('lintDocs with an empty or missing ignore list lints every file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-doc-'));
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/b.md'), '# T\n');
  const expected = ['docs/specs/b.md: needs at least 2 sections (## ...)'];
  assert.deepEqual(lintDocs(root, DEFAULTS).messages, expected);
  const { docLint, ...withoutDocLint } = DEFAULTS;
  assert.deepEqual(lintDocs(root, withoutDocLint).messages, expected);
});
```

Append to `tests/config.test.mjs`:

```js
test('docLint.ignore defaults to an empty list and is validated', () => {
  assert.deepEqual(DEFAULTS.docLint, { ignore: [] });
  assert.deepEqual(validate({ docLint: { ignore: ['docs/plans/old.md'] } }, schema), []);
  assert.ok(validate({ docLint: { ignore: 'docs/plans/old.md' } }, schema).includes('docLint.ignore: expected array'));
  assert.ok(validate({ docLint: { ignore: [1] } }, schema).includes('docLint.ignore[0]: expected string'));
  assert.ok(validate({ docLint: { other: true } }, schema).includes('docLint.other: unknown property'));
});
```

- [ ] **Step 2: Run them** — `node --test tests/doc-lint.test.mjs tests/config.test.mjs` → FAIL (`DEFAULTS.docLint` undefined, ignored files still reported, `docLint: unknown property`).
- [ ] **Step 3: Implement**
  - Schema: add property `docLint` as described in Interfaces, placed after `review`.
  - `checks/lib/defaults.mjs`: add `docLint: { ignore: [] }` after `review`.
  - `checks/doc-lint.mjs`: `lintFolder(root, folder, lint, messages, ignore)` skips a file when `matchesAny(rel, ignore)` is true, where `rel` is the path already used for messages; `lintDocs` passes `config.docLint?.ignore ?? []` to both calls. Import `matchesAny` from `./lib/glob.mjs`.
  - `docs/README.md`: in the configuration table, add a row after `review` (or at the matching place in the table order): `` | `docLint.ignore` | Spec and plan files that doc-lint skips, as globs relative to the project root (for documents written before leanpowers). | `[]` | ``.
  - `docs/README.de.md`: same row in German: `` | `docLint.ignore` | Spec- und Plan-Dateien, die doc-lint überspringt, als Muster relativ zum Projekt-Root (für Dokumente aus der Zeit vor leanpowers). | `[]` | ``.
  - Run `npm run build` so `dist/` carries the new schema, defaults and doc-lint.
- [ ] **Step 4: Run them** — same command → PASS; then `npm test` → all PASS; then `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- [ ] **Step 5: Commit** — `git commit -am "feat: docLint.ignore exempts older specs and plans from doc-lint"` (add new or regenerated `dist/` files with `git add dist` first).

### Task 2: Version 0.1.1 and changelog

**Risk:** low

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/README.de.md`
- Modify: `.claude-plugin/**`
- Modify: `.agents/**`
- Modify: `dist/**`

**Interfaces:**
- Consumes: `docLint.ignore` from Task 1.
- Produces: version `0.1.1` in `package.json` and in every generated manifest; changelog section `## [0.1.1] - 2026-10-30`.

- [ ] **Step 1: Check the current state** — `grep -rn '0\.1\.0' package.json README.md docs/README.md docs/README.de.md .claude-plugin .agents dist --include='*.json' --include='*.md'` lists where the version appears; note which hits are version strings of leanpowers itself (not history such as the `## [0.1.0]` changelog heading).
- [ ] **Step 2: Implement**
  - Set `"version": "0.1.1"` in `package.json`.
  - Run `npm run build`; manifests under `dist/`, `.claude-plugin/` and `.agents/` take the version from `package.json`.
  - Replace the current-version mentions of `0.1.0` found in Step 1 in `README.md`, `docs/README.md` and `docs/README.de.md` with `0.1.1` only where they name the current release (install commands, badges); leave historical mentions unchanged.
  - Add above `## [0.1.0] - 2026-10-29` in `CHANGELOG.md`:

```markdown
## [0.1.1] - 2026-10-30

### Added

- `docLint.ignore` in `leanpowers.json`: spec and plan files that `doc-lint` skips, as globs relative to the
  project root. Helps projects that adopt leanpowers with documents written before it.
```

- [ ] **Step 3: Run checks** — `npm test` → all PASS (includes `committed dist matches a fresh build`); `git diff --exit-code -- dist .claude-plugin .agents` after a second `npm run build` → no output; `node bin/leanpowers.mjs check --all` → `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
- [ ] **Step 4: Commit** — `git add -A package.json CHANGELOG.md README.md docs dist .claude-plugin .agents && git commit -m "chore: release v0.1.1 notes and version"`
