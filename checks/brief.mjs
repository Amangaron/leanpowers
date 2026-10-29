import fs from 'node:fs';
import path from 'node:path';
import { parsePlan } from './lib/plan.mjs';
import { headSha } from './lib/git.mjs';
import { matchesAny, toPosix } from './lib/glob.mjs';

/** Run directory for a plan: <root>/<paths.runs>/<plan basename without .md>, self-ignoring. */
export function runDirFor(root, config, planPath) {
  const name = path.basename(planPath).replace(/\.md$/, '');
  const dir = path.join(root, config.paths.runs, name);
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  return dir;
}

/** Build the small brief an implementer receives instead of the whole plan. */
export function buildBrief(plan, n, config, runDirRel, planRel = 'the plan') {
  const task = plan.tasks.find((t) => t.n === n);
  if (!task) throw new Error(`Task ${n} not found`);

  const allowed = task.files.map((f) => f.path);
  const rules = (config.structure?.rules ?? []).filter((r) => allowed.some((f) => matchesAny(f, [r.path])));
  const ruleLines = rules.map((r) => `- ${r.path} → allow ${r.allow.join(', ')}`);
  const structure = [...ruleLines, `New folders: ${config.structure?.newFolders ?? 'ask'}`].join('\n');

  const body = task.body.split('\n').slice(1).join('\n').trim();
  const reportPath = `${toPosix(runDirRel)}/task-${n}-report.md`;

  return [
    `# Task ${n} brief: ${task.title}`,
    `**Risk:** ${task.risk} · Plan goal: ${plan.goal}`,
    `## Allowed files\n\n${allowed.map((p) => `- ${p}`).join('\n')}`,
    `## Global constraints\n\n${plan.globalConstraints}`,
    `## Structure rules\n\n${structure}`,
    `## Task\n\n${body}`,
    `## When done\n\nRun \`leanpowers check --plan ${planRel} --task ${n}\`. Write your report (max 150 words) to \`${reportPath}\`: what changed, test result, open questions.`,
  ].join('\n\n') + '\n';
}

/** Write task-<n>-brief.md and task-<n>-base.txt into the run dir; returns the brief path. */
export function writeBrief(root, planPath, n, config) {
  const planAbs = path.resolve(root, planPath);
  const planRel = toPosix(path.relative(root, planAbs));
  if (!fs.existsSync(planAbs)) throw new Error(`plan not found: ${planRel}`);
  const plan = parsePlan(fs.readFileSync(planAbs, 'utf8'));
  const runDir = runDirFor(root, config, planAbs);
  const runDirRel = toPosix(path.relative(root, runDir));
  const briefPath = path.join(runDir, `task-${n}-brief.md`);
  fs.writeFileSync(briefPath, buildBrief(plan, n, config, runDirRel, planRel));
  // The base is the state before the task started: re-running brief must not move it.
  const baseFile = path.join(runDir, `task-${n}-base.txt`);
  if (!fs.existsSync(baseFile)) fs.writeFileSync(baseFile, `${headSha(root)}\n`);
  return briefPath;
}
