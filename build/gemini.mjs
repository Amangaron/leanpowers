import path from 'node:path';
import { COMMANDS, COMMAND_SKILL, startText } from '../checks/start.mjs';
import { DEFAULTS } from '../checks/lib/defaults.mjs';
import { copyRuntime, writeText } from './runtime.mjs';
import { packageMeta } from './meta.mjs';

// (unverified) whether Gemini CLI substitutes ${extensionPath} in context files and command prompts.
const CLI = 'node "${extensionPath}/bin/leanpowers.mjs"';
const FALLBACK = 'if `${extensionPath}` is not expanded, the extension folder is the one containing gemini-extension.json';
const CONTEXT_FALLBACK = 'else: folder of gemini-extension.json';

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

const TIERS = ['small', 'medium', 'large'];

function commandPrompt(cmd) {
  if (cmd in COMMAND_SKILL) return `Invoke the leanpowers ${COMMAND_SKILL[cmd]} skill. {{args}}`;
  const fallback = ` (${FALLBACK[0].toUpperCase()}${FALLBACK.slice(1)}.)`;
  if (cmd === 'skills') {
    return `If the arguments are not empty, run \`${CLI} skills {{args}}\` and show the output. Otherwise run \`${CLI} skills --list\`, show the output, ask the user which skills to change, and apply them with \`${CLI} skills --set <name>=on|off,...\`.${fallback} Arguments: {{args}}`;
  }
  return `Run \`${CLI} ${cmd} {{args}}\` and show the output.${fallback}`;
}

/** TOML basic string body: escaping backslashes and quotes also keeps `"""` from closing a multi-line string. */
function toml(text) {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function commandToml(cmd) {
  return `description = "${toml(DESCRIPTIONS[cmd])}"\nprompt = """\n${toml(commandPrompt(cmd))}\n"""\n`;
}

function tierAgent(tier) {
  return `---\nname: lp-${tier}\ndescription: leanpowers worker at tier ${tier}; the prompt carries its template.\nkind: local\nmodel: inherit\n---\nYour prompt carries the full template; follow it.\n`;
}

/**
 * Gemini CLI extension (built from documentation, unverified): manifest, GEMINI.md start text,
 * TOML commands, tier agents and the shared runtime. Agent templates stay in prompts/.
 */
export function buildGemini(repoRoot, outDir) {
  const meta = packageMeta(repoRoot);
  const written = copyRuntime(repoRoot, outDir).filter((f) => !f.startsWith('agents/'));
  const emit = (rel, text) => {
    writeText(path.join(outDir, rel), text);
    written.push(rel);
  };
  emit('gemini-extension.json', `${JSON.stringify({
    name: meta.name,
    version: meta.version,
    description: meta.description,
    contextFileName: 'GEMINI.md',
  }, null, 2)}\n`);
  emit('GEMINI.md', `${startText(repoRoot, DEFAULTS, `${CLI} (${CONTEXT_FALLBACK})`)}\n`);
  for (const cmd of COMMANDS) emit(`commands/leanpowers/${cmd}.toml`, commandToml(cmd));
  for (const tier of TIERS) emit(`agents/lp-${tier}.md`, tierAgent(tier));
  return written.sort();
}
