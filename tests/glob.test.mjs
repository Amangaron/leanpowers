import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAny, toPosix } from '../checks/lib/glob.mjs';

test('* matches within one segment only', () => {
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/x/a.ts'));
});

test('** matches across segments, **/ also matches zero segments', () => {
  assert.ok(globToRegExp('src/**').test('src/a/b/c.tsx'));
  assert.ok(globToRegExp('**/*.ts').test('a.ts'));
  assert.ok(globToRegExp('**/*.ts').test('x/y/a.ts'));
  assert.ok(!globToRegExp('**/*.ts').test('x/y/a.tsx'));
});

test('? matches one non-slash char and dots are literal', () => {
  assert.ok(globToRegExp('a?.md').test('ab.md'));
  assert.ok(!globToRegExp('a?.md').test('a/.md'));
  assert.ok(!globToRegExp('a.md').test('aXmd'));
});

test('exact paths match only themselves', () => {
  assert.ok(globToRegExp('docs/specs/x.md').test('docs/specs/x.md'));
  assert.ok(!globToRegExp('docs/specs/x.md').test('docs/specs/x.md.bak'));
});

test('matchesAny and toPosix', () => {
  assert.equal(matchesAny('src/a.ts', ['lib/**', 'src/*.ts']), true);
  assert.equal(matchesAny('src/a.ts', []), false);
  assert.equal(toPosix(['a', 'b', 'c'].join(process.platform === 'win32' ? '\\' : '/')), 'a/b/c');
});
