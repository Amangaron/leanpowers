import fs from 'node:fs';
import path from 'node:path';
import { stripCode, parsePlan } from './lib/plan.mjs';
import { toPosix } from './lib/glob.mjs';

const PLACEHOLDERS = [
  { word: 'TBD', re: /\bTBD\b/ },
  { word: 'TODO', re: /\bTODO\b/ },
  { word: '???', re: /\?\?\?/ },
];

function placeholderMessages(text) {
  const messages = [];
  stripCode(text).split('\n').forEach((line, i) => {
    const hit = PLACEHOLDERS.find((p) => p.re.test(line));
    if (hit) messages.push(`line ${i + 1}: placeholder "${hit.word}"`);
  });
  return messages;
}

/** Lint a spec document; returns a list of problems (empty when clean). */
export function lintSpec(text) {
  const lines = stripCode(text).split('\n');
  const errors = [];
  if (!lines.some((l) => l.startsWith('# '))) errors.push('missing title (# ...)');
  if (lines.filter((l) => l.startsWith('## ')).length < 2) errors.push('needs at least 2 sections (## ...)');
  return [...errors, ...placeholderMessages(text)];
}

/** Lint a plan document against the plan format contract. */
export function lintPlan(text) {
  const stripped = stripCode(text);
  const errors = [];
  if (!/^\*\*Goal:\*\*/m.test(stripped)) errors.push('missing **Goal:**');
  if (!/^\*\*Spec:\*\*/m.test(stripped)) errors.push('missing **Spec:**');
  if (!/^## Global Constraints\s*$/m.test(stripped)) errors.push('missing ## Global Constraints');
  const { tasks } = parsePlan(text);
  if (tasks.length === 0) errors.push('no tasks (### Task N: ...)');
  for (const t of tasks) {
    if (t.risk === null) errors.push(`Task ${t.n}: missing **Risk:** low|high`);
    if (t.files.length === 0) errors.push(`Task ${t.n}: no files listed`);
  }
  return [...errors, ...placeholderMessages(text)];
}

function lintFolder(root, folder, lint, messages) {
  const dir = path.join(root, folder);
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
  } catch {
    return;
  }
  for (const name of names.sort()) {
    const rel = toPosix(path.join(folder, name));
    for (const m of lint(fs.readFileSync(path.join(dir, name), 'utf8'))) messages.push(`${rel}: ${m}`);
  }
}

/** Lint all specs and plans in the configured folders. */
export function lintDocs(root, config) {
  const messages = [];
  lintFolder(root, config.paths.specs, lintSpec, messages);
  lintFolder(root, config.paths.plans, lintPlan, messages);
  return { name: 'doc-lint', ok: messages.length === 0, messages };
}
