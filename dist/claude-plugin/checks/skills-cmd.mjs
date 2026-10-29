import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './skill-lint.mjs';
import { loadConfig } from './lib/config.mjs';
import { toPosix } from './lib/glob.mjs';

const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOT_SWITCHABLE = new Set(['start']);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Bad command-line usage; the CLI exits 2 for it. */
export class UsageError extends Error {}

function skillsIn(dir, source) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name, 'SKILL.md');
    if (!e.isDirectory() || NOT_SWITCHABLE.has(e.name) || !fs.existsSync(file)) continue;
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    out.push({ name: e.name, source, description: fm?.data.description ?? '', path: toPosix(file) });
  }
  return out;
}

/** Skill folders of the plugin and of `config.extraSkillDirs`, with their on/off switch, sorted by name. */
export function listSkills(pluginRoot, root, config) {
  const found = new Map();
  const dirs = [[path.join(pluginRoot, 'skills'), 'builtin'],
    ...(config.extraSkillDirs ?? []).map((d) => [path.resolve(root, d), 'extra'])];
  for (const [dir, source] of dirs) {
    for (const skill of skillsIn(dir, source)) if (!found.has(skill.name)) found.set(skill.name, skill);
  }
  return [...found.values()]
    .map((s) => ({ ...s, enabled: config.skills?.[s.name] !== false }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * loadConfig plus lenient skill discovery: when a config file was rejected, its raw
 * `extraSkillDirs` still count so extra skills stay switchable. `errors` are warnings.
 */
export function loadSkillConfig(root) {
  const { config, errors } = loadConfig(root);
  if (errors.length) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(root, 'leanpowers.json'), 'utf8'));
      const dirs = isPlainObject(raw) && Array.isArray(raw.extraSkillDirs) ? raw.extraSkillDirs.filter((d) => typeof d === 'string') : [];
      config.extraSkillDirs = [...new Set([...(config.extraSkillDirs ?? []), ...dirs])];
    } catch { /* unreadable file: the loadConfig error already says so */ }
  }
  return { config, errors };
}

function readProjectConfig(file) {
  if (!fs.existsSync(file)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`leanpowers.json: invalid JSON (${e.message})`);
  }
  if (!isPlainObject(parsed)) throw new Error('leanpowers.json: expected an object');
  if (parsed.skills !== undefined && !isPlainObject(parsed.skills)) throw new Error('leanpowers.json: skills must be an object');
  return parsed;
}

/** Write `skills.<name>` switches into `<root>/leanpowers.json`, keeping every other key. Returns the file path. */
export function setSkills(root, changes) {
  const file = path.join(root, 'leanpowers.json');
  const current = readProjectConfig(file);
  const known = new Set(listSkills(PLUGIN_ROOT, root, loadSkillConfig(root).config).map((s) => s.name));
  for (const name of Object.keys(changes)) {
    if (!known.has(name)) throw new Error(`unknown skill: ${name}`);
  }
  current.skills = { ...current.skills, ...changes };
  fs.writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
  return file;
}

/** Pure checklist state transition: move the cursor (clamped) or flip the current item. */
export function toggle(state, key) {
  const { cursor, items } = state;
  if (key === 'up') return { cursor: Math.max(0, cursor - 1), items };
  if (key === 'down') return { cursor: Math.min(items.length - 1, cursor + 1), items };
  if (key === 'space') {
    return { cursor, items: items.map((item, i) => (i === cursor ? { ...item, enabled: !item.enabled } : item)) };
  }
  return state;
}

export const NATIVE_PLATFORMS = ['claude', 'codex', 'gemini'];

/**
 * Text telling the user how to switch skills off in the assistant itself. Never applied by leanpowers.
 * `disabled` holds skill names or listSkills() entries (which carry the real SKILL.md path).
 */
export function nativeHint(platform, disabled, pluginRoot = PLUGIN_ROOT) {
  const skills = disabled.map((d) => (typeof d === 'string'
    ? { name: d, path: toPosix(path.join(pluginRoot, 'skills', d, 'SKILL.md')) }
    : d));
  const names = skills.length ? skills.map((d) => d.name).join(', ') : '(none)';
  switch (platform) {
    case 'claude':
      return `Claude Code has no per-skill switch for plugin skills; leanpowers.json already disables: ${names}`;
    case 'codex':
      return [
        '# Paste into ~/.codex/config.toml',
        ...skills.map((d) => `[[skills.config]]\npath = "${d.path}"\nenabled = false`),
      ].join('\n\n');
    case 'gemini':
      return skills.length ? skills.map((d) => `/skills disable ${d.name}`).join('\n') : '# no disabled skills';
    default:
      throw new Error(`unknown platform: ${platform}`);
  }
}

export function formatList(skills) {
  return skills.map((s) => `[${s.enabled ? 'x' : ' '}] ${s.name} — ${s.description}`).join('\n');
}

/** Parse `name=on|off[,name=on|off]` into a changes record. */
export function parseSet(value) {
  const changes = {};
  for (const pair of String(value ?? '').split(',')) {
    const m = /^([^=\s]+)=(on|off)$/.exec(pair.trim());
    if (!m) throw new UsageError(`invalid --set entry: ${pair || '(empty)'} (expected name=on|off)`);
    changes[m[1]] = m[2] === 'on';
  }
  return changes;
}

/** Split a stdin chunk into key names: up, down, space, enter, cancel. Unknown input is ignored. */
export function tokenizeKeys(chunk) {
  if (chunk === '\x1b') return ['cancel'];
  const keys = [];
  for (const token of chunk.match(/\x1b\[[0-9;]*[A-Za-z~]|\x1bO.|[\s\S]/g) ?? []) {
    if (token === '\x1b[A' || token === '\x1bOA') keys.push('up');
    else if (token === '\x1b[B' || token === '\x1bOB') keys.push('down');
    else if (token === ' ') keys.push('space');
    else if (token === '\r' || token === '\n') keys.push('enter');
    else if (token === 'q' || token === '\x03') keys.push('cancel');
  }
  return keys;
}

function render(state) {
  return [...state.items.map((item, i) => `${i === state.cursor ? '>' : ' '} [${item.enabled ? 'x' : ' '}] ${item.name}`),
    '', 'up/down move, space toggles, enter saves, q/esc cancels'];
}

/**
 * Interactive checklist on a TTY. Resolves to the final items on enter, or null when cancelled.
 * Raw mode is always switched off again before resolving.
 */
export function interactiveChecklist(items, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    let state = { cursor: 0, items };
    let lines = 0;
    const draw = () => {
      if (lines) output.write(`\x1b[${lines}A\x1b[J`);
      const frame = render(state);
      output.write(`${frame.join('\n')}\n`);
      lines = frame.length;
    };
    const finish = (result) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      resolve(result);
    };
    const onData = (buf) => {
      for (const key of tokenizeKeys(buf.toString())) {
        if (key === 'enter') return finish(state.items);
        if (key === 'cancel') return finish(null);
        state = toggle(state, key);
      }
      draw();
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
    draw();
  });
}
