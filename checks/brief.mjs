import fs from 'node:fs';
import path from 'node:path';
import { parsePlan } from './lib/plan.mjs';
import { headSha } from './lib/git.mjs';
import { matchesAny, toPosix } from './lib/glob.mjs';
import { cliCommand } from './start.mjs';
import { approvedFoldersFor } from './check.mjs';

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
export function buildBrief(plan, n, config, runDirRel, planRel = 'the plan', exists = () => false) {
  const task = plan.tasks.find((t) => t.n === n);
  if (!task) throw new Error(`Task ${n} not found`);

  const allowed = task.files.map((f) => f.path);
  const rules = (config.structure?.rules ?? []).filter((r) => allowed.some((f) => matchesAny(f, [r.path])));
  const ruleLines = rules.map((r) => `- ${r.path} → allow ${r.allow.join(', ')}`);
  const fresh = approvedFoldersFor(task.files).filter((d) => !exists(d));
  const structure = [
    ...ruleLines,
    `New folders: ${config.structure?.newFolders ?? 'ask'}`,
    ...(fresh.length ? [`Approved new folders: ${fresh.join(', ')}`] : []),
  ].join('\n');

  const body = task.body.split('\n').slice(1).join('\n').trim();
  const reportPath = `${toPosix(runDirRel)}/task-${n}-report.md`;

  return [
    `# Task ${n} brief: ${task.title}`,
    `**Risk:** ${task.risk} · Plan goal: ${plan.goal}${plan.spec ? `\n**Spec:** ${plan.spec}` : ''}`,
    `## Allowed files\n\n${allowed.map((p) => `- ${p}`).join('\n')}`,
    `## Global constraints\n\n${plan.globalConstraints}`,
    ...(plan.sources?.length
      ? [`## Sources\n\n${plan.sources.map((s) => `- ${s}`).join('\n')}\n\nRead-only references for facts; read only what the task needs.`]
      : []),
    `## Structure rules\n\n${structure}`,
    `## Task\n\n${body}`,
    `## When done\n\nRun \`${cliCommand()} check --plan ${planRel} --task ${n}\`, written out in every call (never stored in a shell variable). Write your report (max 150 words) to \`${reportPath}\`: what changed, test result, open questions.`,
  ].join('\n\n') + '\n';
}

/** Write task-<n>-brief.md, task-<n>-base.txt and constraints.md into the run dir; returns the brief path. */
export function writeBrief(root, planPath, n, config, { resetBase = false } = {}) {
  const planAbs = path.resolve(root, planPath);
  const planRel = toPosix(path.relative(root, planAbs));
  if (!fs.existsSync(planAbs)) throw new Error(`plan not found: ${planRel}`);
  const plan = parsePlan(fs.readFileSync(planAbs, 'utf8'));
  const runDir = runDirFor(root, config, planAbs);
  const runDirRel = toPosix(path.relative(root, runDir));
  const briefPath = path.join(runDir, `task-${n}-brief.md`);
  fs.writeFileSync(briefPath, buildBrief(plan, n, config, runDirRel, planRel, (dir) => fs.existsSync(path.join(root, dir))));
  fs.writeFileSync(path.join(runDir, 'constraints.md'), `${plan.globalConstraints}\n`);
  // The base is the state before the task started: re-running brief must not move it, only resetBase does.
  const baseFile = path.join(runDir, `task-${n}-base.txt`);
  if (resetBase || !fs.existsSync(baseFile)) fs.writeFileSync(baseFile, `${headSha(root)}\n`);
  return briefPath;
}

/** Write task-<n>-base.txt next to a hand-written task-<n>-brief.md; returns the absolute brief path. */
export function writeBaseFor(root, briefPath, { resetBase = false } = {}) {
  const abs = path.resolve(root, briefPath);
  const rel = toPosix(path.relative(root, abs));
  const m = /^task-(\d+)-brief\.md$/.exec(path.basename(abs));
  if (!m) throw new Error('brief --file needs a task-<n>-brief.md');
  if (!fs.existsSync(abs)) throw new Error(`brief not found: ${rel}`);
  const baseFile = path.join(path.dirname(abs), `task-${m[1]}-base.txt`);
  if (resetBase || !fs.existsSync(baseFile)) fs.writeFileSync(baseFile, `${headSha(root)}\n`);
  return abs;
}

/** Allowed files and approved new folders of a brief, as written by buildBrief or by hand. */
export function parseBriefFile(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const clean = (s) => s.replace(/`/g, '').trim();
  const allowed = [];
  const start = lines.indexOf('## Allowed files');
  if (start !== -1) {
    for (const line of lines.slice(start + 1)) {
      if (line.startsWith('## ')) break;
      const m = /^- (.*)$/.exec(line);
      if (m && clean(m[1])) allowed.push(clean(m[1]));
    }
  }
  const approved = lines.find((l) => l.includes('Approved new folders:'));
  const approvedFolders = approved === undefined
    ? []
    : approved.slice(approved.indexOf('Approved new folders:') + 'Approved new folders:'.length).split(',').map(clean).filter(Boolean);
  return { allowed, approvedFolders };
}
