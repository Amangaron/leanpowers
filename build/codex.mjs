import path from 'node:path';
import { copyRuntime, writeText } from './runtime.mjs';
import { packageMeta } from './meta.mjs';

/** Codex plugin: manifest and the shared runtime. No session hook (hooks need user trust). */
export function buildCodex(repoRoot, outDir) {
  const meta = packageMeta(repoRoot);
  const written = copyRuntime(repoRoot, outDir);
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
