import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClaude } from './claude.mjs';
import { buildCodex } from './codex.mjs';
import { packageMeta } from './meta.mjs';
import { writeText } from './runtime.mjs';

// Platform name -> output folder and builder. Platforms without a builder are skipped.
const PACKAGES = {
  claude: { dir: 'claude-plugin', build: buildClaude },
  codex: { dir: 'codex-plugin', build: buildCodex },
};

/** Build the platform packages into outRoot. Returns written files (posix, relative to outRoot). */
export function build(repoRoot, outRoot = path.join(repoRoot, 'dist'), platforms = ['claude', 'codex', 'gemini']) {
  const written = [];
  for (const platform of platforms) {
    const pkg = PACKAGES[platform];
    if (!pkg) continue;
    const outDir = path.join(outRoot, pkg.dir);
    fs.rmSync(outDir, { recursive: true, force: true });
    for (const file of pkg.build(repoRoot, outDir)) written.push(`${pkg.dir}/${file}`);
  }
  return written;
}

/** Write the repo-root marketplace files that point at the built packages. */
export function writeMarketplaces(repoRoot) {
  const meta = packageMeta(repoRoot);
  const files = {
    '.claude-plugin/marketplace.json': 'claude',
    '.agents/plugins/marketplace.json': 'codex',
  };
  for (const [rel, platform] of Object.entries(files)) {
    writeText(path.join(repoRoot, rel), `${JSON.stringify({
      name: 'leanpowers-marketplace',
      owner: { name: meta.author },
      plugins: [{
        name: meta.name,
        source: `./dist/${PACKAGES[platform].dir}`,
        description: meta.description,
      }],
    }, null, 2)}\n`);
  }
  return Object.keys(files);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const files = build(repoRoot);
  writeMarketplaces(repoRoot);
  console.log(`built ${files.length} files into dist/`);
}
