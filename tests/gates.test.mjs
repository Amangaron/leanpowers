import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGates } from '../checks/gates.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-gates-'));
const script = (name, body) => {
  const p = path.join(root, name);
  fs.writeFileSync(p, body);
  return `node "${p}"`;
};
const cfg = (commands, extra = {}) => ({ ...DEFAULTS, ...extra, commands: { ...DEFAULTS.commands, ...commands } });

test('missing test command is a failure, empty typecheck/lint are skipped', () => {
  assert.deepEqual(runGates(cfg({}), root), [
    { name: 'gates:test', ok: false, messages: ['no test command configured'] },
  ]);
});

test('passing commands are ok with no messages', () => {
  const ok = script('ok.mjs', 'console.log("all good")');
  assert.deepEqual(runGates(cfg({ test: ok, lint: ok }), root), [
    { name: 'gates:test', ok: true, messages: [] },
    { name: 'gates:lint', ok: true, messages: [] },
  ]);
});

test('failing command keeps only relevant, deduplicated lines', () => {
  const bad = script('bad.mjs', `
    console.log('setup noise');
    console.log('not ok 1 - adds numbers');
    console.error('AssertionError: expected 3');
    console.error('AssertionError: expected 3');
    process.exit(1);`);
  const [r] = runGates(cfg({ test: bad }), root);
  assert.equal(r.ok, false);
  assert.deepEqual(r.messages, ['not ok 1 - adds numbers', 'AssertionError: expected 3']);
});

test('failure without matching lines falls back to the last lines', () => {
  const bad = script('quiet.mjs', 'console.log("something odd"); process.exit(2);');
  const [r] = runGates(cfg({ test: bad }), root);
  assert.deepEqual(r.messages, ['something odd']);
});

test('summarizer is used only for long relevant output', () => {
  const long = script('long.mjs', 'for (let i = 0; i < 80; i++) console.log("error " + i); process.exit(1);');
  const sum = script('sum.mjs', 'process.stdin.resume(); process.stdin.on("end", () => console.log("SUMMARY: 80 errors"));');
  const [withSum] = runGates(cfg({ test: long }, { summarizer: sum }), root);
  assert.deepEqual(withSum.messages, ['SUMMARY: 80 errors']);
  const [without] = runGates(cfg({ test: long }), root);
  assert.equal(without.messages.length, 21);
});

test('failing summarizer falls back to compression with a note', () => {
  const long = script('long2.mjs', 'for (let i = 0; i < 80; i++) console.log("error " + i); process.exit(1);');
  const broken = script('broken.mjs', 'process.exit(3);');
  const [r] = runGates(cfg({ test: long }, { summarizer: broken }), root);
  assert.equal(r.messages[0], 'summarizer failed, showing compressed output');
  assert.equal(r.messages[1], 'error 0');
});
