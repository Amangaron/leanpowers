import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './skill-lint.mjs';
import { toPosix } from './lib/glob.mjs';

export const COMMANDS = ['design', 'plan', 'staff', 'run', 'debug', 'finish', 'check', 'skills', 'init'];
// check, skills and init are CLI commands without a skill switch: always active.
export const COMMAND_SKILL = { design: 'design', plan: 'plan', staff: 'staff', run: 'run', debug: 'debug', finish: 'finish' };

/** Session-start text: the start skill body with only the active commands listed. */
export function startText(pluginRoot, config) {
  const file = path.join(pluginRoot, 'skills', 'start', 'SKILL.md');
  const raw = fs.readFileSync(file, 'utf8');
  const body = (parseFrontmatter(raw)?.body ?? raw).trim();
  const active = COMMANDS.filter((c) => !(c in COMMAND_SKILL) || config.skills?.[COMMAND_SKILL[c]] !== false);
  return body.replace(/^Commands: .*$/m, () => `Commands: ${active.join(', ')}.`);
}

/** Command a subagent can run to reach this CLI. */
export function cliCommand() {
  if (process.env.LEANPOWERS_CLI) return process.env.LEANPOWERS_CLI;
  const bin = fileURLToPath(new URL('../bin/leanpowers.mjs', import.meta.url));
  return `node "${toPosix(bin)}"`;
}
