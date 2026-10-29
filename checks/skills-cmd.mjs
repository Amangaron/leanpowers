import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './skill-lint.mjs';
import { loadConfig } from './lib/config.mjs';
import { toPosix } from './lib/glob.mjs';

const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOT_SWITCHABLE = new Set(['start']);

function skillsIn(dir, source) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name, 'SKILL.md');
    if (!e.isDirectory() || NOT_SWITCHABLE.has(e.name) || !fs.existsSync(file)) continue;
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    out.push({ name: e.name, source, description: fm?.data.description ?? '' });
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

/** Write `skills.<name>` switches into `<root>/leanpowers.json`, keeping every other key. Returns the file path. */
export function setSkills(root, changes) {
  const { config } = loadConfig(root);
  const known = new Set(listSkills(PLUGIN_ROOT, root, config).map((s) => s.name));
  for (const name of Object.keys(changes)) {
    if (!known.has(name)) throw new Error(`unknown skill: ${name}`);
  }
  const file = path.join(root, 'leanpowers.json');
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
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

/** Text telling the user how to switch skills off in the assistant itself. Never applied by leanpowers. */
export function nativeHint(platform, disabled, pluginRoot = PLUGIN_ROOT) {
  const names = disabled.length ? disabled.join(', ') : '(none)';
  switch (platform) {
    case 'claude':
      return `Claude Code has no per-skill switch for plugin skills; leanpowers.json already disables: ${names}`;
    case 'codex':
      return [
        '# Paste into ~/.codex/config.toml',
        ...disabled.map((name) => `[[skills.config]]\npath = "${toPosix(path.join(pluginRoot, 'skills', name, 'SKILL.md'))}"\nenabled = false`),
      ].join('\n\n');
    case 'gemini':
      return disabled.length ? disabled.map((name) => `/skills disable ${name}`).join('\n') : '# no disabled skills';
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
    if (!m) throw new Error(`invalid --set entry: ${pair || '(empty)'} (expected name=on|off)`);
    changes[m[1]] = m[2] === 'on';
  }
  return changes;
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
      for (const key of buf.toString().match(/\x1b\[[A-D]|[\s\S]/g) ?? []) {
        if (key === '\x1b[A') state = toggle(state, 'up');
        else if (key === '\x1b[B') state = toggle(state, 'down');
        else if (key === ' ') state = toggle(state, 'space');
        else if (key === '\r' || key === '\n') return finish(state.items);
        else if (key === 'q' || key === '\x1b' || key === '\x03') return finish(null);
      }
      draw();
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
    draw();
  });
}
