import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { compress, formatResults } from './lib/output.mjs';
import { parsePlan } from './lib/plan.mjs';
import { changedFiles, dirsAt } from './lib/git.mjs';
import { toPosix, matchesAny } from './lib/glob.mjs';
import { checkScope } from './scope.mjs';
import { checkStructure } from './structure.mjs';
import { runGates } from './gates.mjs';
import { lintDocs } from './doc-lint.mjs';
import { lintSkills } from './skill-lint.mjs';
import { runDirFor, parseBriefFile } from './brief.mjs';

/** Folders a task may create: parents of its Create and Test files, sorted, without the root. */
export function approvedFoldersFor(files) {
  const dirs = files
    .filter((f) => f.kind === 'Create' || f.kind === 'Test')
    .map((f) => path.posix.dirname(toPosix(f.path)))
    .filter((d) => d !== '.');
  return [...new Set(dirs)].sort();
}

/** Scope and structure checks for one task, measured against the base recorded in its brief. */
function taskChecks(root, config, plan, task) {
  const planAbs = path.resolve(root, plan);
  const planRel = toPosix(path.relative(root, planAbs));
  if (!fs.existsSync(planAbs)) return [{ name: 'scope', ok: false, messages: [`plan not found: ${planRel}`] }];
  const baseFile = path.join(runDirFor(root, config, planAbs), `task-${task}-base.txt`);
  if (!fs.existsSync(baseFile)) {
    const msg = `no brief for task ${task}, run: leanpowers brief --plan ${planRel} --task ${task}`;
    return [{ name: 'scope', ok: false, messages: [msg] }];
  }
  const base = fs.readFileSync(baseFile, 'utf8').trim();
  const taskDef = parsePlan(fs.readFileSync(planAbs, 'utf8')).tasks.find((t) => t.n === task);
  if (!taskDef) return [{ name: 'scope', ok: false, messages: [`task ${task} not found in ${planRel}`] }];

  return scopeAndStructure(root, config, {
    base,
    allowed: taskDef.files.map((f) => f.path),
    approvedFolders: approvedFoldersFor(taskDef.files),
  });
}

/** Scope and structure of everything changed since base, shared by the plan and the brief form. */
function scopeAndStructure(root, config, { base, allowed, approvedFolders }) {
  const changed = changedFiles(root, base);
  return [
    checkScope(changed, allowed, [`${toPosix(config.paths.runs)}/**`]),
    checkStructure({
      changed: changed.filter((f) => fs.existsSync(path.join(root, f))),
      rules: config.structure.rules,
      newFolders: config.structure.newFolders,
      existingDirs: dirsAt(root, base),
      approvedFolders,
    }),
  ];
}

/** Scope and structure for a hand-written task-<n>-brief.md, against the base next to it. */
function briefChecks(root, config, briefPath) {
  const abs = path.resolve(root, briefPath);
  const rel = toPosix(path.relative(root, abs));
  const fail = (msg) => [{ name: 'scope', ok: false, messages: [msg] }];
  if (!fs.existsSync(abs)) return fail(`brief not found: ${rel}`);
  const m = /^task-(\d+)-brief\.md$/.exec(path.basename(abs));
  if (!m) return fail('check --brief needs a task-<n>-brief.md');
  // Never create the base here: a forgotten brief --file must stay red, not turn green.
  const baseFile = path.join(path.dirname(abs), `task-${m[1]}-base.txt`);
  if (!fs.existsSync(baseFile)) return fail(`no base for ${rel}, run: leanpowers brief --file ${rel}`);
  const base = fs.readFileSync(baseFile, 'utf8').trim();
  const { allowed, approvedFolders } = parseBriefFile(fs.readFileSync(abs, 'utf8'));
  return scopeAndStructure(root, config, { base, allowed, approvedFolders });
}

/** Warning text when files differ from HEAD outside the run folder; null when clean or git is unusable. */
function uncommittedWarning(root, config) {
  let files;
  try {
    files = changedFiles(root, 'HEAD');
  } catch {
    return null;
  }
  files = files.filter((f) => !matchesAny(f, [`${toPosix(config.paths.runs)}/**`]));
  if (files.length === 0) return null;
  return `uncommitted changes: ${files.length} files (${files.slice(0, 3).join(', ')})`;
}

/**
 * Run all configured checks and format them token-lean.
 * Scope and structure come from either a plan task (plan + task) or a hand-written brief (brief), never both.
 * @param {{ root: string, plan?: string, task?: number, brief?: string, all?: boolean, userConfigPath?: string }} opts
 * @returns {{ ok: boolean, text: string }}
 */
export function runCheck({ root, plan, task, brief, all = false, userConfigPath }) {
  const { config, errors } = loadConfig(root, userConfigPath ? { userConfigPath } : undefined);
  const results = runGates(config, root, { configFound: fs.existsSync(path.join(root, 'leanpowers.json')) });
  if (brief !== undefined && (plan !== undefined || task !== undefined)) {
    results.push({ name: 'scope', ok: false, messages: ['check takes --brief or --plan with --task, not both'] });
  } else if (brief !== undefined) results.push(...briefChecks(root, config, brief));
  else if (plan !== undefined && task !== undefined) results.push(...taskChecks(root, config, plan, task));
  else if (plan !== undefined || task !== undefined) {
    results.push({ name: 'scope', ok: false, messages: ['check needs both --plan and --task'] });
  }
  const warnings = [...errors];
  if (all) {
    const skills = lintSkills(root, config);
    results.push(lintDocs(root, config), skills);
    warnings.push(...(skills.warnings ?? []));
    const uncommitted = uncommittedWarning(root, config);
    if (uncommitted) warnings.push(uncommitted);
  }
  // Gate results are already compressed by runGates.
  const compressed = results.map((r) => (r.name.startsWith('gates:') ? r : { ...r, messages: compress(r.messages, 20) }));
  return formatResults(compressed, warnings);
}
