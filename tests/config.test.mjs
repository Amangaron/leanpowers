import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { validate, deepMerge, loadConfig } from '../checks/lib/config.mjs';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/leanpowers.schema.json', import.meta.url)));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lp-cfg-'));
const NO_USER = { userConfigPath: path.join(os.tmpdir(), 'lp-does-not-exist', 'config.json') };

test('defaults are valid against the schema', () => {
  assert.deepEqual(validate(DEFAULTS, schema), []);
});

test('defaults have the spec values', () => {
  assert.deepEqual(DEFAULTS.paths, { specs: 'docs/specs', plans: 'docs/plans', reports: 'docs/reports', runs: '.leanpowers/runs' });
  assert.deepEqual(DEFAULTS.review, { batch: 3, maxFixRounds: 2 });
  assert.equal(DEFAULTS.skills.worktrees, false);
  assert.equal(DEFAULTS.structure.newFolders, 'ask');
  assert.equal(DEFAULTS.summarizer, 'none');
});

test('template config is valid', () => {
  const tpl = JSON.parse(fs.readFileSync(new URL('../templates/leanpowers.json', import.meta.url)));
  assert.deepEqual(validate(tpl, schema), []);
});

test('validate reports path and problem', () => {
  const errs = validate({ review: { batch: 'three' }, structure: { newFolders: 'maybe' }, bogus: 1 }, schema);
  assert.ok(errs.includes('review.batch: expected integer'));
  assert.ok(errs.includes('structure.newFolders: must be one of ask, allow, deny'));
  assert.ok(errs.includes('bogus: unknown property'));
});

test('validate checks array items and minimum', () => {
  const errs = validate({ structure: { rules: [{ path: 'src/**' }] }, review: { batch: 0 } }, schema);
  assert.ok(errs.includes('structure.rules[0].allow: required'));
  assert.ok(errs.includes('review.batch: must be >= 1'));
});

test('deepMerge merges objects and replaces arrays', () => {
  assert.deepEqual(
    deepMerge({ a: { x: 1, y: 2 }, l: [1, 2] }, { a: { y: 3 }, l: [9] }),
    { a: { x: 1, y: 3 }, l: [9] },
  );
});

test('loadConfig without files returns defaults and no errors', () => {
  const { config, errors } = loadConfig(tmp(), NO_USER);
  assert.deepEqual(config, DEFAULTS);
  assert.deepEqual(errors, []);
});

test('project config overrides user config, which overrides defaults', () => {
  const root = tmp();
  const userPath = path.join(tmp(), 'config.json');
  fs.writeFileSync(userPath, JSON.stringify({ commands: { test: 'user-test', lint: 'user-lint' } }));
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ commands: { test: 'npm test' } }));
  const { config, errors } = loadConfig(root, { userConfigPath: userPath });
  assert.deepEqual(errors, []);
  assert.equal(config.commands.test, 'npm test');
  assert.equal(config.commands.lint, 'user-lint');
  assert.equal(config.paths.specs, 'docs/specs');
});

test('invalid project file is reported and ignored', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), JSON.stringify({ review: { batch: 'x' }, commands: { test: 'npm test' } }));
  const { config, errors } = loadConfig(root, NO_USER);
  assert.deepEqual(errors, ['leanpowers.json: review.batch: expected integer']);
  assert.equal(config.commands.test, '');
});

test('broken JSON is reported and ignored', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), '{ nope');
  const { config, errors } = loadConfig(root, NO_USER);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^leanpowers\.json: invalid JSON/);
  assert.deepEqual(config, DEFAULTS);
});

test('validate does not see inherited properties', () => {
  assert.ok(validate({ constructor: 1 }, schema).includes('constructor: unknown property'));
  assert.ok(validate({ skills: { toString: 'x' } }, schema).includes('skills.toString: expected boolean'));
});

test('a __proto__ key in a config file does not pollute the config', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), '{"__proto__":{"polluted":1}}');
  const { config } = loadConfig(root, NO_USER);
  assert.equal(config.polluted, undefined);
  assert.equal(Object.getPrototypeOf(config), Object.prototype);
  assert.deepEqual(deepMerge({}, JSON.parse('{"__proto__":{"polluted":1}}')).polluted, undefined);
});

test('root-level type errors use (root) as path', () => {
  assert.deepEqual(validate([], schema), ['(root): expected object']);
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leanpowers.json'), '[]');
  const { errors } = loadConfig(root, NO_USER);
  assert.deepEqual(errors, ['leanpowers.json: (root): expected object']);
});

test('orchestration defaults to auto and is validated', () => {
  assert.equal(DEFAULTS.orchestration, 'auto');
  assert.ok(validate({ orchestration: 'sometimes' }, schema).includes('orchestration: must be one of auto, switch, recommend'));
  assert.deepEqual(validate({ orchestration: 'switch' }, schema), []);
});
