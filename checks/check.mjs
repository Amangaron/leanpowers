import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { compress, formatResults } from './lib/output.mjs';
import { parsePlan } from './lib/plan.mjs';
import { changedFiles, dirsAt } from './lib/git.mjs';
import { toPosix } from './lib/glob.mjs';
import { checkScope } from './scope.mjs';
import { checkStructure } from './structure.mjs';
import { runGates } from './gates.mjs';
import { lintDocs } from './doc-lint.mjs';
import { lintSkills } from './skill-lint.mjs';
import { runDirFor } from './brief.mjs';

/** Scope and structure checks for one task, measured against the base recorded in its brief. */
function taskChecks(root, config, plan, task) {
  const baseFile = path.join(runDirFor(root, config, plan), `task-${task}-base.txt`);
  if (!fs.existsSync(baseFile)) {
    const msg = `no brief for task ${task}, run: leanpowers brief --plan ${toPosix(plan)} --task ${task}`;
    return [{ name: 'scope', ok: false, messages: [msg] }];
  }
  const base = fs.readFileSync(baseFile, 'utf8').trim();
  const taskDef = parsePlan(fs.readFileSync(path.join(root, plan), 'utf8')).tasks.find((t) => t.n === task);
  if (!taskDef) return [{ name: 'scope', ok: false, messages: [`task ${task} not found in ${toPosix(plan)}`] }];

  const changed = changedFiles(root, base);
  const allowed = taskDef.files.map((f) => f.path);
  const approvedFolders = taskDef.files
    .filter((f) => f.kind === 'Create')
    .map((f) => path.posix.dirname(toPosix(f.path)))
    .filter((d) => d !== '.');
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

/**
 * Run all configured checks and format them token-lean.
 * @param {{ root: string, plan?: string, task?: number, all?: boolean, userConfigPath?: string }} opts
 * @returns {{ ok: boolean, text: string }}
 */
export function runCheck({ root, plan, task, all = false, userConfigPath }) {
  const { config, errors } = loadConfig(root, userConfigPath ? { userConfigPath } : undefined);
  const results = runGates(config, root);
  if (plan && task) results.push(...taskChecks(root, config, plan, task));
  if (all) results.push(lintDocs(root, config), lintSkills(root, config));
  // Gate results are already compressed by runGates.
  const compressed = results.map((r) => (r.name.startsWith('gates:') ? r : { ...r, messages: compress(r.messages, 20) }));
  return formatResults(compressed, errors);
}
