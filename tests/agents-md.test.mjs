import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateAgentsMd } from '../checks/agents-md.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-agents-'));
const read = (root) => fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const BLOCK = (t) => `<!-- leanpowers:start -->\n${t}\n<!-- leanpowers:end -->`;

test('creates AGENTS.md with the block', () => {
  const root = tmp();
  assert.equal(updateAgentsMd(root, 'size rule'), 'created');
  assert.equal(read(root), `${BLOCK('size rule')}\n`);
});

test('appends the block and keeps existing text byte for byte', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project rules\n\nUse tabs.\n');
  assert.equal(updateAgentsMd(root, 'size rule'), 'updated');
  assert.equal(read(root), `# Project rules\n\nUse tabs.\n\n${BLOCK('size rule')}\n`);
});

test('replaces only the block content and reports unchanged runs', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), `before\n\n${BLOCK('old')}\n\nafter\n`);
  assert.equal(updateAgentsMd(root, 'new'), 'updated');
  assert.equal(read(root), `before\n\n${BLOCK('new')}\n\nafter\n`);
  assert.equal(updateAgentsMd(root, 'new'), 'unchanged');
});

test('broken markers throw and leave the file alone', () => {
  for (const content of ['<!-- leanpowers:start -->\nx\n', `${BLOCK('a')}\n${BLOCK('b')}\n`, 'x\n<!-- leanpowers:end -->\n']) {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), content);
    assert.throws(() => updateAgentsMd(root, 'new'), /AGENTS\.md: leanpowers block markers are broken/);
    assert.equal(read(root), content);
  }
});
