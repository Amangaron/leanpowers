import fs from 'node:fs';
import path from 'node:path';
import { toPosix } from './lib/glob.mjs';

const MAX_SKILL_WORDS = 600;
const MAX_AGENT_WORDS = 400;
const MAX_START_TOKENS = 150;
const MAX_DESCRIPTION_WORDS = 60;

/** Parse `---` delimited frontmatter (simple `key: value` lines). Returns null when absent. */
export function parseFrontmatter(text) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const data = {};
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(': ');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 2).trim();
  }
  return { data, body: lines.slice(end + 1).join('\n') };
}

/** Whitespace-separated word count. */
export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Rough token estimate: 4/3 tokens per word. */
export function estimateTokens(text) {
  return Math.ceil((countWords(text) * 4) / 3);
}

/** Lint one skill or agent file; returns messages without path prefix. */
export function lintSkillFile(file, { name, maxWords }) {
  const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (!fm) return ['missing frontmatter'];
  const messages = [];
  if (fm.data.name !== name) messages.push(`name "${fm.data.name ?? ''}" must be "${name}"`);
  if (!fm.data.description) {
    messages.push('description missing');
  } else {
    const n = countWords(fm.data.description);
    if (n > MAX_DESCRIPTION_WORDS) messages.push(`description ${n} words (max ${MAX_DESCRIPTION_WORDS})`);
  }
  const bodyWords = countWords(fm.body);
  if (bodyWords > maxWords) messages.push(`${bodyWords} words (max ${maxWords})`);
  for (const match of fm.body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^https?:/i.test(target) || target.startsWith('#')) continue;
    const local = target.split(/[#?]/)[0];
    if (!fs.existsSync(path.resolve(path.dirname(file), local))) messages.push(`broken link ${target}`);
  }
  return messages;
}

function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Check word/token limits, frontmatter and relative links of skills, agents and the start text. */
export function lintSkills(root, config) {
  const entries = []; // { rel, file, name, maxWords }
  for (const dir of ['skills', ...(config.extraSkillDirs ?? [])]) {
    for (const name of subdirs(path.join(root, dir))) {
      const file = path.join(root, dir, name, 'SKILL.md');
      if (fs.existsSync(file)) entries.push({ rel: toPosix(path.join(dir, name, 'SKILL.md')), file, name, maxWords: MAX_SKILL_WORDS });
    }
  }
  const agentsDir = path.join(root, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const e of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.md')) {
        entries.push({ rel: `agents/${e.name}`, file: path.join(agentsDir, e.name), name: e.name.slice(0, -3), maxWords: MAX_AGENT_WORDS });
      }
    }
  }
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const messages = [];
  for (const { rel, file, name, maxWords } of entries) {
    const found = lintSkillFile(file, { name, maxWords });
    if (rel === 'skills/start/SKILL.md') {
      const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      if (fm) {
        const tokens = estimateTokens(fm.body);
        if (tokens > MAX_START_TOKENS) found.push(`start text ~${tokens} tokens (max ${MAX_START_TOKENS})`);
      }
    }
    for (const m of found) messages.push(`${rel}: ${m}`);
  }
  return { name: 'skill-lint', ok: messages.length === 0, messages };
}
