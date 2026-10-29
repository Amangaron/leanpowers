import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommandEvidence, pluginRootEvidence } from '../scripts/verify-claude.mjs';

const BIN = '/plug/dist/claude-plugin/bin/leanpowers.mjs';
const use = (id, command) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
const result = (id, content) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
const prompt = (text) => ({ type: 'user', message: { content: [{ type: 'text', text }] } });

test('check-command passes only on a leanpowers.mjs Bash call whose own result holds the CLI line', () => {
  const ok = [use('a', `node "${BIN}" check`), result('a', '✔ leanpowers check: ok (gates: none)')];
  assert.equal(checkCommandEvidence(ok).status, 'PASS');
  const blocks = [use('a', `node "${BIN}" check`), result('a', [{ type: 'text', text: '✖ leanpowers check: 2 failed' }])];
  assert.equal(checkCommandEvidence(blocks).status, 'PASS');
  // The model merely printing the line, or the line in another call's result, is no proof.
  const echoed = [use('a', 'ls'), result('a', '✔ leanpowers check: ok (x)'), use('b', `node "${BIN}" check`), result('b', 'command not found')];
  assert.equal(checkCommandEvidence(echoed).status, 'FAIL');
  assert.equal(checkCommandEvidence([prompt('✔ leanpowers check: ok (x)')]).status, 'FAIL');
  const pending = checkCommandEvidence([use('a', `node "${BIN}" check`)]);
  assert.equal(pending.status, 'UNCLEAR');
  assert.match(pending.detail, /no tool_result/);
});

test('plugin-root-var needs the substituted path in the expanded command text', () => {
  const source = 'Run `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" check $ARGUMENTS` and show the output.';
  const opts = { binPaths: [BIN], source };
  assert.equal(pluginRootEvidence([prompt(`Run \`node "${BIN}" check\` and show the output.`)], opts).status, 'PASS');
  // A Bash call naming the path proves nothing: the model may have found the path elsewhere.
  const bashOnly = pluginRootEvidence([use('a', `node "${BIN}" check`), result('a', BIN)], opts);
  assert.equal(bashOnly.status, 'UNCLEAR');
  assert.match(bashOnly.detail, /no expanded command text/);
  assert.equal(pluginRootEvidence([prompt(source)], opts).status, 'FAIL');
  assert.equal(pluginRootEvidence([prompt(`node "${BIN}"`)], { binPaths: [BIN], source: 'node bin/leanpowers.mjs' }).status, 'FAIL');
});
