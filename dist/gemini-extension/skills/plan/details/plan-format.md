# Plan format

`leanpowers brief` and `leanpowers check` parse plans line by line. Lines inside fenced code blocks are ignored, so code examples may contain anything.

## Header

- `# <title>` as the first line.
- `**Goal:** <one sentence>` — the rest of the line is the goal; backticks are dropped.
- `**Spec:** <path to the spec>` — same rule. Without a spec file, use a one-line summary of the request instead, e.g. `**Spec:** user request 2026-01-01: add a greet command`, and put the requirements into Goal and Global Constraints.
- `**Sources:** <path>, <path>` — optional. Comma-separated read-only references (READMEs, schemas, other docs) that implementers and reviewers may read for facts; backticks are dropped. Every brief lists them under `## Sources`.
- Other header lines (architecture, tech stack) are allowed and ignored.

## Global Constraints

- A line exactly `## Global Constraints`, followed by project-wide rules, one per line, values copied verbatim from the spec.
- The section ends at the next `## ` line, a `---` line or the first task heading. Every implementer brief includes it.

## Tasks

- Heading: `### Task <n>: <title>` with `<n>` a number.
- `**Risk:** low` or `**Risk:** high` on its own line — required.
- `**Parallel:** true` on its own line — optional; only for tasks whose files are disjoint from every other parallel task.
- `**Files:**` followed by list items that start at the line start, one path each in backticks:
  - ``- Create: `path` ``
  - ``- Modify: `path` ``, optionally with a line suffix such as `:10-24` inside the backticks
  - ``- Test: `path` ``
- These paths are the task's allowed files; the scope check rejects changes to any other file.
- A task body ends at the next task heading or the next `## ` line. Trailing blank lines and `---` lines are dropped.

## What doc-lint rejects

A missing `**Goal:**`, `**Spec:**` or `## Global Constraints`; no task; a task without `**Risk:**` or without files; `TBD`, `TODO` or `???` outside code.

## Example

````markdown
# Greeting CLI Implementation Plan

**Goal:** Add a `greet` command that prints a greeting.

**Spec:** `specs/example-design.md`

## Global Constraints

- Node >= 20, no new dependencies.
- Tests use `node:test`.

---

### Task 1: greeting function

**Risk:** low
**Parallel:** true

**Files:**
- Create: `src/greet.mjs`
- Test: `tests/greet.test.mjs`

**Interfaces:**
- Produces: `greet(name: string): string`, returns `Hello, <name>!`; an empty name gives `Hello, world!`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from '../src/greet.mjs';

test('greets by name', () => assert.equal(greet('Ada'), 'Hello, Ada!'));
test('falls back to world', () => assert.equal(greet(''), 'Hello, world!'));
```

- [ ] **Step 2: Run it** — `node --test tests/greet.test.mjs` → FAIL, module not found.
- [ ] **Step 3: Implement** `greet` as specified in Interfaces.
- [ ] **Step 4: Run it** — same command → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: greet function"`

### Task 2: wire the command

**Risk:** high

**Files:**
- Modify: `src/cli.mjs:10-24`
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `greet(name)` from Task 1.
- Produces: CLI command `greet <name>` printing `greet(name)` and exiting 0.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('greet command prints the greeting', () => {
  const out = execFileSync('node', ['src/cli.mjs', 'greet', 'Ada'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'Hello, Ada!');
});
```

- [ ] **Step 2: Run it** — `node --test tests/cli.test.mjs` → FAIL, unknown command.
- [ ] **Step 3: Implement** — add a `greet` branch to the command switch; keep existing commands unchanged.
- [ ] **Step 4: Run it** — same command → PASS; then `node --test` → all PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: greet command"`
````
