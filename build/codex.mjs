import fs from 'node:fs';
import path from 'node:path';
import { copyRuntime, writeText } from './runtime.mjs';
import { packageMeta } from './meta.mjs';

// Codex has no session hook to name the plugin's bin, so each skill that uses the CLI says it itself.
export const CODEX_CLI_LINE = 'CLI: run `leanpowers` as `node "<this plugin>/bin/leanpowers.mjs"`; the plugin folder is two levels above this SKILL.md.';

/** Put the CLI line after the skill's switch line, or at the top of the body when there is none. */
export function addCliLine(text) {
  if (!/`leanpowers[ `]/.test(text)) return text;
  const switchLine = /^(---\n[\s\S]*?\n---\n\s*)(If `skills\.[^`]+` is false in leanpowers\.json[^\n]*\n)?/;
  return text.replace(switchLine, (match, head, line = '', offset, all) => {
    const gap = all[offset + match.length] === '\n' ? '\n' : '\n\n';
    return `${head}${line}${line ? '\n' : ''}${CODEX_CLI_LINE}${gap}`;
  });
}

/** Codex plugin: manifest and the shared runtime with CLI lines. No session hook (hooks need user trust). */
export function buildCodex(repoRoot, outDir) {
  const meta = packageMeta(repoRoot);
  const written = copyRuntime(repoRoot, outDir);
  for (const rel of written.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f))) {
    const file = path.join(outDir, rel);
    writeText(file, addCliLine(fs.readFileSync(file, 'utf8')));
  }
  const rel = '.codex-plugin/plugin.json';
  writeText(path.join(outDir, rel), `${JSON.stringify({
    name: meta.name,
    version: meta.version,
    description: meta.description,
    author: { name: meta.author },
    repository: meta.repository,
    license: meta.license,
    skills: './skills/',
    interface: { displayName: 'leanpowers' },
  }, null, 2)}\n`);
  written.push(rel);
  return written.sort();
}
