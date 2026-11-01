#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../checks/check.mjs';
import { loadConfig } from '../checks/lib/config.mjs';
import { toPosix } from '../checks/lib/glob.mjs';
import { writeBrief, writeBaseFor, runDirFor, BRIEF_NAME_ERROR } from '../checks/brief.mjs';
import { outsideWarning } from '../checks/lib/paths.mjs';
import { writeMetrics } from '../checks/metrics.mjs';
import { writeReport } from '../checks/report.mjs';
import { startText, agentsMdText } from '../checks/start.mjs';
import { updateAgentsMd } from '../checks/agents-md.mjs';
import { proposeConfig, applyTemplate } from '../checks/init.mjs';
import { listSkills, setSkills, nativeHint, formatList, parseSet, interactiveChecklist, loadSkillConfig, NATIVE_PLATFORMS } from '../checks/skills-cmd.mjs';

const USAGE = [
  'usage: leanpowers <check|brief|metrics|report|config|start|skills|init> [options]',
  '  check [--all] [--plan <file> --task <n> | --brief <file>]',
  '  brief (--plan <file> --task <n> | --file <brief>) [--reset-base]',
  '  metrics --plan <file>',
  '  report --plan <file>',
  '  config',
  '  start [--format plain|claude]',
  '  skills [--list | --set <name>=on|off,... | --native claude|codex|gemini]',
  '  init [--write | --template <name> | --agents-md]',
].join('\n');

/** Print a path warning to stderr; stdout and the exit code stay unchanged. */
function warnOutside(config, file, kind) {
  const warning = outsideWarning(root, config, file, kind);
  if (warning) console.error(`warning: ${warning}`);
}

function usage() {
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv, { skills = false, init = false, brief = false, check = false } = {}) {
  const opts = { all: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') opts.all = true;
    else if (brief && arg === '--reset-base') opts.resetBase = true;
    else if (brief && arg === '--file') {
      opts.file = argv[++i];
      if (!opts.file) usage();
    } else if (check && arg === '--brief') {
      opts.brief = argv[++i];
      if (!opts.brief) usage();
    } else if (arg === '--plan') {
      opts.plan = argv[++i];
      if (!opts.plan) usage();
    } else if (arg === '--task') {
      const value = argv[++i];
      if (!/^[1-9]\d*$/.test(value ?? '')) usage();
      opts.task = Number(value);
    } else if (arg === '--format') {
      opts.format = argv[++i];
      if (!['plain', 'claude'].includes(opts.format)) usage();
    } else if (skills && arg === '--list') opts.list = true;
    else if (skills && arg === '--set') {
      opts.set = argv[++i];
      if (!opts.set) usage();
    } else if (skills && arg === '--native') {
      opts.native = argv[++i];
      if (!NATIVE_PLATFORMS.includes(opts.native)) usage();
    } else if (init && arg === '--write') opts.write = true;
    else if (init && arg === '--agents-md') opts.agentsMd = true;
    else if (init && arg === '--template') {
      opts.template = argv[++i];
      if (!opts.template) usage();
    } else usage();
  }
  return opts;
}

const [command, ...rest] = process.argv.slice(2);
const root = process.cwd();

switch (command) {
  case 'check': {
    const opts = parseArgs(rest, { check: true });
    if (opts.brief !== undefined && (opts.plan !== undefined || opts.task !== undefined)) usage();
    if ((opts.plan === undefined) !== (opts.task === undefined)) usage();
    const result = runCheck({ root, ...opts });
    console.log(result.text);
    process.exit(result.ok ? 0 : 1);
    break;
  }
  case 'brief': {
    const { plan, task, file, resetBase } = parseArgs(rest, { brief: true });
    if (file !== undefined) {
      if (plan !== undefined || task !== undefined) usage();
      try {
        console.log(toPosix(path.relative(root, writeBaseFor(root, file, { resetBase }))));
      } catch (err) {
        const msg = String(err.message);
        if (!msg.startsWith('brief not found: ') && msg !== BRIEF_NAME_ERROR) throw err;
        console.error(msg);
        process.exit(1);
      }
      warnOutside(loadConfig(root).config, file, 'brief');
      break;
    }
    if (!plan || task === undefined) usage();
    const { config } = loadConfig(root);
    try {
      console.log(toPosix(path.relative(root, writeBrief(root, plan, task, config, { resetBase }))));
    } catch (err) {
      if (!String(err.message).startsWith('plan not found: ')) throw err;
      console.error(err.message);
      process.exit(1);
    }
    warnOutside(config, plan, 'plan');
    break;
  }
  case 'metrics': {
    const { plan } = parseArgs(rest);
    if (!plan) usage();
    const { config } = loadConfig(root);
    const m = writeMetrics(runDirFor(root, config, plan));
    console.log(`metrics: ${m.briefs} briefs, ${m.reports} reports, ${m.reviews} reviews`);
    warnOutside(config, plan, 'plan');
    break;
  }
  case 'report': {
    const { plan } = parseArgs(rest);
    if (!plan) usage();
    const { config } = loadConfig(root);
    try {
      console.log(toPosix(path.relative(root, writeReport(root, config, plan))));
    } catch (err) {
      if (!String(err.message).startsWith('no ledger for ')) throw err;
      console.error(err.message);
      process.exit(1);
    }
    break;
  }
  case 'config': {
    parseArgs(rest);
    const { config, errors } = loadConfig(root);
    console.log(JSON.stringify(config, null, 2));
    for (const e of errors) console.error(e);
    break;
  }
  case 'start': {
    const { format = 'plain' } = parseArgs(rest);
    const { config } = loadConfig(root);
    const pluginRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const text = startText(pluginRoot, config);
    console.log(format === 'claude'
      ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } })
      : text);
    break;
  }
  case 'skills': {
    const opts = parseArgs(rest, { skills: true });
    if ([opts.list, opts.set, opts.native].filter((v) => v !== undefined).length > 1) usage();
    const pluginRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const { config, errors } = loadSkillConfig(root);
    let warned = false;
    const warn = () => {
      if (!warned) for (const e of errors) console.error(`warning: ${e}`);
      warned = true;
    };
    const list = listSkills(pluginRoot, root, config);
    const save = (changes) => {
      try {
        const file = setSkills(root, changes);
        warn();
        console.log(`updated ${toPosix(path.relative(root, file))}`);
      } catch (err) {
        // A broken leanpowers.json is already named by the error itself.
        if (!err.message.startsWith('leanpowers.json:')) warn();
        console.error(err.message);
        process.exit(1);
      }
    };
    if (opts.set !== undefined) {
      let changes;
      try {
        changes = parseSet(opts.set);
      } catch (err) {
        console.error(err.message);
        process.exit(2);
      }
      save(changes);
    } else if (opts.native !== undefined) {
      warn();
      console.log(nativeHint(opts.native, list.filter((s) => !s.enabled), pluginRoot));
    } else if (opts.list || !process.stdin.isTTY || !process.stdout.isTTY) {
      warn();
      console.log(formatList(list));
    } else {
      warn();
      const after = await interactiveChecklist(list.map(({ name, enabled }) => ({ name, enabled })));
      const changes = {};
      for (const [i, item] of (after ?? []).entries()) if (item.enabled !== list[i].enabled) changes[item.name] = item.enabled;
      if (!after) console.log('cancelled');
      else if (!Object.keys(changes).length) console.log('no changes');
      else save(changes);
    }
    break;
  }
  case 'init': {
    const opts = parseArgs(rest, { init: true });
    if ([opts.write, opts.template, opts.agentsMd].filter((v) => v !== undefined).length > 1) usage();
    const pluginRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const agentsMd = () => {
      try {
        console.log(`AGENTS.md: ${updateAgentsMd(root, agentsMdText(pluginRoot, loadConfig(root).config))}`);
      } catch (err) {
        if (!err.message.startsWith('AGENTS.md: ')) throw err;
        console.error(err.message);
        process.exit(1);
      }
    };
    if (opts.agentsMd) {
      agentsMd();
      break;
    }
    if (opts.template !== undefined) {
      let created;
      const skipped = [];
      try {
        created = applyTemplate(pluginRoot, opts.template, root, skipped);
      } catch (err) {
        if (!err.message.startsWith('unknown template: ')) throw err;
        console.error(err.message);
        process.exit(1);
      }
      const lines = [...created.map((f) => `created ${f}`), ...skipped.map((f) => `skipped ${f}`)];
      console.log(lines.length ? lines.join('\n') : 'nothing to create: all template files exist');
      agentsMd();
      break;
    }
    const text = `${JSON.stringify(proposeConfig(root), null, 2)}\n`;
    if (!opts.write) {
      console.log(text.trimEnd());
      console.log('run "leanpowers init --write" to save it');
      break;
    }
    try {
      fs.writeFileSync(path.join(root, 'leanpowers.json'), text, { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      console.error('leanpowers.json exists — not overwritten');
      process.exit(1);
    }
    console.log('created leanpowers.json');
    agentsMd();
    break;
  }
  default:
    usage();
}
