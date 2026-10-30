import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFIX = 'plugin:';

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const subdirs = (dir) => {
  try {
    return fs.readdirSync(dir).filter((e) => isDir(path.join(dir, e)));
  } catch {
    return [];
  }
};

/** Numeric comparison of dot-separated version parts; non-numeric parts count as 0. */
function compareVersions(a, b) {
  const pa = a.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Claude Code: first entry of each `<name>@<marketplace>` key in installed_plugins.json. */
function claudeInstallPaths(name, home) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(home, '.claude/plugins/installed_plugins.json'), 'utf8'));
    return Object.entries(data?.plugins ?? {})
      .filter(([key]) => key.includes('@') && key.slice(0, key.lastIndexOf('@')) === name)
      .map(([, entries]) => (Array.isArray(entries) ? entries[0]?.installPath : undefined))
      .filter((p) => typeof p === 'string');
  } catch {
    return [];
  }
}

/** Codex: `<home>/.codex/plugins/cache/<marketplace>/<name>/<version>` with the highest version. */
function codexInstallPath(name, home) {
  const cache = path.join(home, '.codex/plugins/cache');
  const found = subdirs(cache).flatMap((m) => subdirs(path.join(cache, m, name)).map((v) => ({ v, dir: path.join(cache, m, name, v) })));
  found.sort((a, b) => compareVersions(b.v, a.v));
  return found.length ? [found[0].dir] : [];
}

/**
 * Skills folder of an installed plugin: Claude Code, then Codex, then Gemini.
 * Returns `<plugin>/skills` only if it exists, else null.
 */
export function resolvePluginSkillDir(name, { home = os.homedir() } = {}) {
  const candidates = [
    ...claudeInstallPaths(name, home),
    ...codexInstallPath(name, home),
    path.join(home, '.gemini/extensions', name),
  ];
  for (const plugin of candidates) {
    const skills = path.join(plugin, 'skills');
    if (isDir(skills)) return skills;
  }
  return null;
}

/**
 * Resolve `extraSkillDirs`: plain entries against `root` (source `extra`), `plugin:<name>` entries
 * via resolvePluginSkillDir (source `plugin:<name>`). Plugins not found become warnings.
 */
export function resolveSkillDirs(root, extraSkillDirs, { home = os.homedir() } = {}) {
  const dirs = [];
  const warnings = [];
  for (const entry of extraSkillDirs ?? []) {
    if (!entry.startsWith(PREFIX)) {
      dirs.push({ dir: path.resolve(root, entry), source: 'extra' });
      continue;
    }
    const name = entry.slice(PREFIX.length);
    const dir = resolvePluginSkillDir(name, { home });
    if (dir) dirs.push({ dir, source: entry });
    else warnings.push(`extraSkillDirs: plugin ${name} not found`);
  }
  return { dirs, warnings };
}
