#!/usr/bin/env node
import path from 'node:path';
import { runCheck } from '../checks/check.mjs';
import { loadConfig } from '../checks/lib/config.mjs';
import { toPosix } from '../checks/lib/glob.mjs';
import { writeBrief, runDirFor } from '../checks/brief.mjs';
import { writeMetrics } from '../checks/metrics.mjs';

const USAGE = 'usage: leanpowers <check|brief|metrics|config> [--all] [--plan <file>] [--task <n>]';

function usage() {
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { all: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') opts.all = true;
    else if (arg === '--plan') {
      opts.plan = argv[++i];
      if (!opts.plan) usage();
    } else if (arg === '--task') {
      const value = argv[++i];
      if (!/^\d+$/.test(value ?? '')) usage();
      opts.task = Number(value);
    } else usage();
  }
  return opts;
}

const [command, ...rest] = process.argv.slice(2);
const root = process.cwd();

switch (command) {
  case 'check': {
    const opts = parseArgs(rest);
    if ((opts.plan === undefined) !== (opts.task === undefined)) usage();
    const result = runCheck({ root, ...opts });
    console.log(result.text);
    process.exit(result.ok ? 0 : 1);
    break;
  }
  case 'brief': {
    const { plan, task } = parseArgs(rest);
    if (!plan || task === undefined) usage();
    const { config } = loadConfig(root);
    console.log(toPosix(path.relative(root, writeBrief(root, plan, task, config))));
    break;
  }
  case 'metrics': {
    const { plan } = parseArgs(rest);
    if (!plan) usage();
    const { config } = loadConfig(root);
    const m = writeMetrics(runDirFor(root, config, plan));
    console.log(`metrics: ${m.briefs} briefs, ${m.reports} reports, ${m.reviews} reviews`);
    break;
  }
  case 'config': {
    parseArgs(rest);
    const { config, errors } = loadConfig(root);
    console.log(JSON.stringify(config, null, 2));
    for (const e of errors) console.error(e);
    break;
  }
  default:
    usage();
}
