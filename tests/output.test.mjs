import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compress, formatResults } from '../checks/lib/output.mjs';

test('compress trims, drops empty lines and dedupes in order', () => {
  assert.deepEqual(compress(['  a ', '', 'b', 'a', '   ', 'c']), ['a', 'b', 'c']);
});

test('compress caps at max and reports the rest', () => {
  const lines = Array.from({ length: 25 }, (_, i) => `line ${i}`);
  const out = compress(lines, 20);
  assert.equal(out.length, 21);
  assert.equal(out[20], '… 5 more');
});

test('formatResults: all ok gives exactly one line', () => {
  const r = formatResults([
    { name: 'gates:test', ok: true, messages: [] },
    { name: 'scope', ok: true, messages: [] },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.text, '✔ leanpowers check: ok (gates:test, scope)');
});

test('formatResults: failures list name and indented messages only for failed checks', () => {
  const r = formatResults([
    { name: 'gates:test', ok: false, messages: ['1 failing'] },
    { name: 'scope', ok: true, messages: ['ignored'] },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.text, '✖ leanpowers check: 1 failed\n✖ gates:test\n  1 failing');
});

test('formatResults: warnings are prefixed and placed after the status line', () => {
  const r = formatResults([{ name: 'scope', ok: true, messages: [] }], ['config: bad']);
  assert.equal(r.text, '✔ leanpowers check: ok (scope)\n⚠ config: bad');
});
