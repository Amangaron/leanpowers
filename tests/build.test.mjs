import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, writeMarketplaces } from '../build/build.mjs';
import { copyRuntime } from '../build/runtime.mjs';
import { estimateTokens } from '../checks/skill-lint.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-build-'));
build(repo, out);
const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(out, rel));

test('claude package has manifest, hook, commands and runtime', () => {
  const pj = JSON.parse(read('claude-plugin/.claude-plugin/plugin.json'));
  assert.equal(pj.name, 'leanpowers');
  assert.equal(pj.version, JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version);
  const hooks = JSON.parse(read('claude-plugin/hooks/hooks.json'));
  assert.match(JSON.stringify(hooks), /bin\/leanpowers\.mjs\\?" start --format claude/);
  for (const c of ['design', 'plan', 'staff', 'run', 'debug', 'finish', 'check', 'skills', 'init']) {
    assert.ok(exists(`claude-plugin/commands/${c}.md`), c);
  }
  assert.ok(exists('claude-plugin/bin/leanpowers.mjs'));
  assert.ok(exists('claude-plugin/skills/run/SKILL.md'));
});

test('agent templates ship as prompts, never as agents', () => {
  assert.ok(!exists('claude-plugin/agents'));
  assert.ok(exists('claude-plugin/prompts/implementer.md'));
  const run = read('claude-plugin/skills/run/SKILL.md');
  assert.doesNotMatch(run, /`agents\//);
});

test('marketplace points at the claude package', () => {
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(m.plugins[0].name, 'leanpowers');
  assert.equal(m.plugins[0].source, './dist/claude-plugin');
});

test('codex package has manifest with skills and no session hook', () => {
  const pj = JSON.parse(read('codex-plugin/.codex-plugin/plugin.json'));
  assert.equal(pj.name, 'leanpowers');
  assert.equal(pj.skills, './skills/');
  assert.deepEqual(pj.hooks ?? {}, {});
  assert.ok(exists('codex-plugin/skills/design/SKILL.md'));
  assert.ok(exists('codex-plugin/prompts/reviewer.md'));
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(m.plugins[0].source, './dist/codex-plugin');
});

test('both marketplaces carry the package.json description', () => {
  const { description } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  for (const file of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const m = JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
    assert.equal(m.plugins[0].description, description, file);
  }
});

test('built text files use LF line endings', () => {
  for (const rel of ['claude-plugin/skills/run/SKILL.md', 'codex-plugin/skills/run/SKILL.md', 'codex-plugin/prompts/reviewer.md']) {
    assert.ok(!read(rel).includes('\r'), rel);
  }
});

test('gemini extension has manifest, small context file, toml commands and tier agents', () => {
  const ext = JSON.parse(read('gemini-extension/gemini-extension.json'));
  assert.equal(ext.contextFileName, 'GEMINI.md');
  assert.ok(estimateTokens(read('gemini-extension/GEMINI.md')) <= 150);
  assert.match(read('gemini-extension/commands/leanpowers/plan.toml'), /prompt\s*=/);
  for (const t of ['small', 'medium', 'large']) {
    assert.match(read(`gemini-extension/agents/lp-${t}.md`), new RegExp(`name: lp-${t}`));
  }
  assert.ok(!exists('gemini-extension/agents/implementer.md'));
});

test('committed dist matches a fresh build', () => {
  const list = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]);
  const fresh = list(out).sort();
  assert.deepEqual(list(path.join(repo, 'dist')).sort(), fresh, 'dist/ is stale — run npm run build');
  for (const rel of fresh) {
    assert.equal(fs.readFileSync(path.join(repo, 'dist', rel), 'utf8'), read(rel), `dist/ is stale — run npm run build (${rel})`);
  }
});

test('committed marketplace files match the generated ones', () => {
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-market-'));
  const files = writeMarketplaces(repo, fresh);
  assert.equal(files.length, 2);
  for (const rel of files) {
    assert.equal(fs.readFileSync(path.join(repo, rel), 'utf8'), fs.readFileSync(path.join(fresh, rel), 'utf8'),
      `${rel} is stale — run npm run build`);
  }
});

test('copyRuntime normalizes text, keeps NUL files and file modes', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-rt-src-'));
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lp-rt-out-')), 'pkg');
  fs.mkdirSync(path.join(src, 'skills/x'), { recursive: true });
  fs.mkdirSync(path.join(src, 'bin'));
  fs.mkdirSync(path.join(src, 'templates'));
  for (const f of ['package.json', 'LICENSE', 'NOTICE']) fs.writeFileSync(path.join(src, f), `${f}\n`);
  fs.writeFileSync(path.join(src, 'skills/x/SKILL.md'), 'line one\r\nline two\r\n');
  const binary = Buffer.from([0x41, 0x0d, 0x0a, 0x00, 0x42, 0x0d, 0x0a]);
  fs.writeFileSync(path.join(src, 'templates/blob.bin'), binary);
  fs.writeFileSync(path.join(src, 'bin/tool.mjs'), '#!/usr/bin/env node\n');
  fs.chmodSync(path.join(src, 'bin/tool.mjs'), 0o755);
  copyRuntime(src, dest);
  assert.equal(fs.readFileSync(path.join(dest, 'skills/x/SKILL.md'), 'utf8'), 'line one\nline two\n');
  assert.ok(fs.readFileSync(path.join(dest, 'templates/blob.bin')).equals(binary));
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(dest, 'bin/tool.mjs')).mode & 0o777, 0o755);
  }
});

test('gemini commands are valid TOML with the exact prompt, and tier agents stay short', () => {
  const dir = path.join(out, 'gemini-extension/commands/leanpowers');
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.toml')).length, 9);
  const m = /^description = "(.*)"\nprompt = """\n([\s\S]*)\n"""\n$/.exec(read('gemini-extension/commands/leanpowers/check.toml'));
  assert.ok(m, 'check.toml has the expected layout');
  const unescape = (s) => s.replace(/\\(["\\])/g, '$1');
  assert.equal(unescape(m[2]), 'Run `node "${extensionPath}/bin/leanpowers.mjs" check {{args}}` and show the output.');
  assert.ok(m[2].includes('\\"${extensionPath}/bin/leanpowers.mjs\\"'));
  for (const tier of ['small', 'medium', 'large']) {
    const description = /^description: (.*)$/m.exec(read(`gemini-extension/agents/lp-${tier}.md`))[1];
    assert.ok(description.split(/\s+/).length <= 15, `lp-${tier} description has more than 15 words`);
  }
});

test('the skills command passes arguments through, else lists and asks', () => {
  const claude = read('claude-plugin/commands/skills.md');
  assert.match(claude, /skills \$ARGUMENTS`/);
  assert.match(claude, /skills --list`/);
  assert.match(claude, /skills --set <name>=on\|off/);
  const gemini = read('gemini-extension/commands/leanpowers/skills.toml');
  assert.match(gemini, /skills \{\{args\}\}`/);
  assert.match(gemini, /skills --list`/);
});
