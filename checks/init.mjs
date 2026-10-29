import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { toPosix } from './lib/glob.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor']);
const SCHEMA_REF = './node_modules/leanpowers/schema/leanpowers.schema.json';
const NPM_COMMANDS = { test: 'npm test', typecheck: 'npm run typecheck', lint: 'npm run lint' };
const MAKE_TARGETS = ['test', 'lint'];

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function detectCommands(root) {
  const commands = { test: '', typecheck: '', lint: '' };
  let scripts = {};
  try {
    scripts = JSON.parse(readText(path.join(root, 'package.json')) ?? '{}').scripts ?? {};
  } catch {
    // An unreadable package.json simply yields no npm commands.
  }
  const makefile = readText(path.join(root, 'Makefile')) ?? '';
  for (const name of Object.keys(commands)) {
    const script = scripts[name];
    // `npm init` seeds a failing placeholder test script; it is not a real command.
    if (typeof script === 'string' && script.trim() && !/no test specified/.test(script)) commands[name] = NPM_COMMANDS[name];
    else if (MAKE_TARGETS.includes(name) && new RegExp(`^${name}\\s*:`, 'm').test(makefile)) commands[name] = `make ${name}`;
  }
  return commands;
}

/** Collect file extensions below `dir`, never descending into skipped folders or following symlinks. */
function collectExtensions(root, dir, runDir, found) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name) || rel === runDir) continue;
      collectExtensions(root, rel, runDir, found);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext) found.add(`*${ext}`);
    }
  }
}

/** Propose commands and per-folder structure rules from what the project already contains. */
export function scanProject(root) {
  const runDir = toPosix(loadConfig(root).config.paths.runs).replace(/^\.\//, '').replace(/\/+$/, '');
  const rules = [];
  const tops = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name) && e.name !== runDir)
    .map((e) => e.name)
    .sort();
  for (const name of tops) {
    const found = new Set();
    collectExtensions(root, name, runDir, found);
    if (found.size) rules.push({ path: `${name}/**`, allow: [...found].sort() });
  }
  return { commands: detectCommands(root), structure: { newFolders: 'ask', rules } };
}

export function proposeConfig(root) {
  const { commands, structure } = scanProject(root);
  return { $schema: SCHEMA_REF, commands, structure };
}

function copyMissing(srcDir, destDir, relDir, created) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyMissing(src, dest, rel, created);
    } else if (entry.isFile()) {
      try {
        fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
        created.push(rel);
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
    }
  }
}

/** Copy `templates/<name>/` into root, creating only files that do not exist yet. */
export function applyTemplate(pluginRoot, name, root) {
  const templatesDir = path.join(pluginRoot, 'templates');
  const src = path.join(templatesDir, name);
  const known = /^[\w.-]+$/.test(name) && name !== '.' && name !== '..' && fs.existsSync(src) && fs.statSync(src).isDirectory();
  if (!known) throw new Error(`unknown template: ${name}`);
  const created = [];
  copyMissing(src, root, '', created);
  return created.sort();
}
