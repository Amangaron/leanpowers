import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, stripCode } from '../checks/lib/plan.mjs';

const PLAN = `# Demo Plan

**Goal:** Build a demo.

**Spec:** \`docs/specs/demo.md\`

## Global Constraints

- Node >= 20
- No deps

---

### Task 1: First thing

**Risk:** low

**Files:**
- Create: \`src/a.mjs\`
- Test: \`tests/a.test.mjs\`

- [ ] **Step 1: Do it**

\`\`\`js
// ### Task 99: not a task inside code
\`\`\`

### Task 2: Second thing

**Risk:** high
**Parallel:** true

**Files:**
- Modify: \`src/b.mjs:10-20\`
`;

test('parsePlan reads header, constraints and tasks', () => {
  const p = parsePlan(PLAN);
  assert.equal(p.goal, 'Build a demo.');
  assert.equal(p.spec, 'docs/specs/demo.md');
  assert.equal(p.globalConstraints, '- Node >= 20\n- No deps');
  assert.equal(p.tasks.length, 2);
  assert.deepEqual(p.tasks[0].files, [
    { kind: 'Create', path: 'src/a.mjs' },
    { kind: 'Test', path: 'tests/a.test.mjs' },
  ]);
  assert.equal(p.tasks[0].risk, 'low');
  assert.equal(p.tasks[0].parallel, false);
  assert.equal(p.tasks[1].risk, 'high');
  assert.equal(p.tasks[1].parallel, true);
  assert.deepEqual(p.tasks[1].files, [{ kind: 'Modify', path: 'src/b.mjs' }]);
});

test('task body runs from heading to next task heading and keeps code', () => {
  const p = parsePlan(PLAN);
  assert.match(p.tasks[0].body, /^### Task 1: First thing/);
  assert.match(p.tasks[0].body, /not a task inside code/);
  assert.doesNotMatch(p.tasks[0].body, /Task 2/);
});

test('stripCode removes fences and inline code but keeps line count', () => {
  const t = 'a `x` b\n```\ncode\n```\nc';
  const s = stripCode(t);
  assert.equal(s.split('\n').length, 5);
  assert.doesNotMatch(s, /x|code/);
  assert.match(s, /c$/);
});

test('CRLF plans parse like LF plans', () => {
  const p = parsePlan(PLAN.replaceAll('\n', '\r\n'));
  assert.equal(p.goal, 'Build a demo.');
  assert.equal(p.spec, 'docs/specs/demo.md');
  assert.equal(p.globalConstraints, '- Node >= 20\n- No deps');
  assert.equal(p.tasks.length, 2);
  assert.equal(p.tasks[1].parallel, true);
  assert.doesNotMatch(p.tasks[0].body, /\r/);
});

test('last task body stops at the next ## section and drops trailing ---', () => {
  const p = parsePlan(`${PLAN}\n---\n\n## Self-Review\n\nall good\n`);
  const last = p.tasks[1].body;
  assert.doesNotMatch(last, /Self-Review|all good/);
  assert.doesNotMatch(last, /---\s*$/);
  assert.match(last, /src\/b\.mjs/);
});

test('first task body does not end with a separator', () => {
  const body = parsePlan(PLAN).tasks[0].body;
  assert.doesNotMatch(body, /---\s*$/);
  assert.doesNotMatch(body, /\n\s*$/);
});

test('global constraints end at the first task heading when there is no ---', () => {
  const p = parsePlan('# P\n\n## Global Constraints\n\n- a\n- b\n\n### Task 1: T\n\n**Risk:** low\n');
  assert.equal(p.globalConstraints, '- a\n- b');
  assert.equal(p.tasks.length, 1);
});

test('risk inside a fenced block is ignored', () => {
  const fenced = '### Task 1: T\n\n```\n**Risk:** high\n```\n';
  assert.equal(parsePlan(fenced).tasks[0].risk, null);
  const mixed = '### Task 1: T\n\n**Risk:** low\n\n```\n**Risk:** high\n```\n';
  assert.equal(parsePlan(mixed).tasks[0].risk, 'low');
});
