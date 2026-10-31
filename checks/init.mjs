import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { toPosix } from './lib/glob.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor']);
const SCHEMA_REF = 'https://raw.githubusercontent.com/Amangaron/leanpowers/main/schema/leanpowers.schema.json';
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
    else if (MAKE_TARGETS.includes(name) && new RegExp(`^${name}[ \\t]*:(?!:?=)`, 'm').test(makefile)) commands[name] = `make ${name}`;
  }
  return commands;
}

/** Collect file extensions below `dir`, never descending into skipped folders or following symlinks. */
function collectExtensions(root, dir, runDir, found) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return; // unreadable folder: leave it out of the proposal
  }
  for (const entry of entries) {
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

// Sibling extensions of one language family: a folder with .tsx also needs .ts (and vice versa).
const SIBLINGS = { '*.ts': '*.tsx', '*.tsx': '*.ts', '*.js': '*.jsx', '*.jsx': '*.js' };

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
    if (found.size) {
      const allow = new Set(found);
      for (const ext of found) if (SIBLINGS[ext]) allow.add(SIBLINGS[ext]);
      rules.push({ path: `${name}/**`, allow: [...allow].sort() });
    }
  }
  return { commands: detectCommands(root), structure: { newFolders: 'ask', rules } };
}

export function proposeConfig(root) {
  const { commands, structure } = scanProject(root);
  return { $schema: SCHEMA_REF, commands, structure };
}

function isInside(real, realRoot) {
  return real === realRoot || real.startsWith(realRoot + path.sep);
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const BLOCKED = new Set(['EEXIST', 'ENOTDIR', 'EISDIR']);

function copyMissing(srcDir, destDir, relDir, realRoot, created, skipped) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    try {
      if (entry.isDirectory()) {
        const existing = lstatOrNull(dest);
        if (!existing) fs.mkdirSync(dest);
        else if (existing.isSymbolicLink()) {
          skipped.push(`${rel} (${fs.existsSync(dest) ? 'symlink, not followed' : 'blocked by existing file'})`);
          continue;
        } else if (!existing.isDirectory()) {
          skipped.push(`${rel} (blocked by existing file)`);
          continue;
        }
        if (!isInside(fs.realpathSync(dest), realRoot)) {
          skipped.push(`${rel} (outside the project)`);
          continue;
        }
        copyMissing(src, dest, rel, realRoot, created, skipped);
      } else if (entry.isFile()) {
        try {
          fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
          created.push(rel);
        } catch (err) {
          // An existing file is the normal "keep what is there" case.
          if (err.code !== 'EEXIST') throw err;
        }
      }
    } catch (err) {
      if (!BLOCKED.has(err.code)) throw err;
      skipped.push(`${rel} (blocked by existing file)`);
    }
  }
}

/**
 * Copy `templates/<name>/` into root, creating only files that do not exist yet. Existing files are kept;
 * directories that are symlinks or blocked by a file are skipped and described in the optional `skipped` array.
 */
export function applyTemplate(pluginRoot, name, root, skipped = []) {
  const templatesDir = path.join(pluginRoot, 'templates');
  const src = path.join(templatesDir, name);
  const known = /^[\w.-]+$/.test(name) && name !== '.' && name !== '..' && fs.existsSync(src) && fs.statSync(src).isDirectory();
  if (!known) throw new Error(`unknown template: ${name}`);
  const created = [];
  copyMissing(src, root, '', fs.realpathSync(root), created, skipped);
  return created.sort();
}
