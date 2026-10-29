import fs from 'node:fs';
import path from 'node:path';
import { COMMANDS, COMMAND_SKILL } from '../checks/start.mjs';
import { copyRuntime, writeText } from './build.mjs';

const CLI = 'node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs"';

const DESCRIPTIONS = {
  design: 'Turn an idea into an approved design before any code',
  plan: 'Write an implementation plan from an approved spec',
  staff: 'Recommend and confirm the staffing for an approved plan',
  run: 'Execute an approved, staffed plan task by task',
  debug: 'Find the root cause of a bug before fixing it',
  finish: 'Merge, push, keep or discard the finished branch',
  check: 'Run the deterministic leanpowers checks',
  skills: 'List leanpowers skills and switch them on or off',
  init: 'Propose or create the leanpowers project files',
};

function commandBody(cmd) {
  if (cmd in COMMAND_SKILL) return `Invoke the leanpowers ${COMMAND_SKILL[cmd]} skill. $ARGUMENTS`;
  if (cmd === 'skills') {
    return `Run \`${CLI} skills --list\` and show the output. Then ask the user which skills to change and apply them with \`${CLI} skills --set <name>=on|off,...\`.`;
  }
  return `Run \`${CLI} ${cmd} $ARGUMENTS\` and show the output.`;
}

/** Claude Code plugin: manifest, SessionStart hook, commands and the shared runtime. */
export function buildClaude(repoRoot, outDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const written = copyRuntime(repoRoot, outDir);
  const emit = (rel, text) => {
    writeText(path.join(outDir, rel), text);
    written.push(rel);
  };
  emit('.claude-plugin/plugin.json', `${JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: { name: 'Dominic Shin' },
    repository: 'https://github.com/Amangaron/leanpowers',
    license: pkg.license,
  }, null, 2)}\n`);
  emit('hooks/hooks.json', `${JSON.stringify({
    hooks: {
      SessionStart: [{
        matcher: 'startup|clear|compact',
        hooks: [{ type: 'command', command: `${CLI} start --format claude` }],
      }],
    },
  }, null, 2)}\n`);
  for (const cmd of COMMANDS) {
    emit(`commands/${cmd}.md`, `---\ndescription: ${DESCRIPTIONS[cmd]}\n---\n${commandBody(cmd)}\n`);
  }
  return written.sort();
}
