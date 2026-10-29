import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClaude } from './claude.mjs';
import { buildCodex } from './codex.mjs';
import { buildGemini } from './gemini.mjs';
import { packageMeta } from './meta.mjs';
import { writeText } from './runtime.mjs';

// Platform name -> output folder and builder. Platforms without a builder are skipped.
const PACKAGES = {
  claude: { dir: 'claude-plugin', build: buildClaude },
  codex: { dir: 'codex-plugin', build: buildCodex },
  gemini: { dir: 'gemini-extension', build: buildGemini },
};

/** Build the platform packages into outRoot. Returns written files (posix, relative to outRoot). */
export function build(repoRoot, outRoot = path.join(repoRoot, 'dist'), platforms = ['claude', 'codex', 'gemini']) {
  const written = [];
  for (const platform of platforms) {
    const pkg = PACKAGES[platform];
    if (!pkg) continue;
    const outDir = path.join(outRoot, pkg.dir);
    fs.rmSync(outDir, { recursive: true, force: true });
    const files = pkg.build(repoRoot, outDir);
    // The platform map tells the skills how to dispatch, which models the tiers mean and whether nesting works.
    writeText(path.join(outDir, 'platform.md'), fs.readFileSync(path.join(repoRoot, 'platforms', `${platform}.md`), 'utf8'));
    files.push('platform.md');
    for (const file of files.sort()) written.push(`${pkg.dir}/${file}`);
  }
  return written;
}

/** Write the marketplace files that point at the built packages (into outRoot, default: the repo root). */
export function writeMarketplaces(repoRoot, outRoot = repoRoot) {
  const meta = packageMeta(repoRoot);
  const files = {
    '.claude-plugin/marketplace.json': 'claude',
    '.agents/plugins/marketplace.json': 'codex',
  };
  for (const [rel, platform] of Object.entries(files)) {
    writeText(path.join(outRoot, rel), `${JSON.stringify({
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
