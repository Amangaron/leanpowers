import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClaude } from './claude.mjs';

// Platform name -> output folder and builder. Platforms without a builder are skipped.
const PACKAGES = {
  claude: { dir: 'claude-plugin', build: buildClaude },
};

const RUNTIME_DIRS = ['skills', 'agents', 'bin', 'checks', 'schema', 'templates'];
const RUNTIME_FILES = ['package.json', 'LICENSE', 'NOTICE'];

/** Sorted list of files below dir (posix, relative), skipping OS noise. */
function walk(dir, rel = '') {
  const files = [];
  const entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    .filter((e) => e.name !== '.DS_Store')
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) files.push(...walk(dir, child));
    else if (e.isFile()) files.push(child);
  }
  return files;
}

/** Write a text file with `\n` line endings, creating parent folders. */
export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'));
}

/**
 * Copy the shared runtime into outDir. `agents/*.md` ships as `prompts/*.md`; in copied
 * `skills/**\/*.md` the references `` `agents/`` and `(agents/` are rewritten to `prompts/`.
 * Returns the written files (posix, relative to outDir).
 */
export function copyRuntime(repoRoot, outDir) {
  const written = [];
  const put = (srcRel, destRel) => {
    const src = path.join(repoRoot, srcRel);
    const dest = path.join(outDir, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (srcRel.startsWith('skills/') && srcRel.endsWith('.md')) {
      const text = fs.readFileSync(src, 'utf8').replaceAll('`agents/', '`prompts/').replaceAll('(agents/', '(prompts/');
      fs.writeFileSync(dest, text);
    } else {
      fs.copyFileSync(src, dest);
    }
    written.push(destRel);
  };
  for (const dir of RUNTIME_DIRS) {
    if (!fs.existsSync(path.join(repoRoot, dir))) continue;
    for (const rel of walk(path.join(repoRoot, dir))) {
      put(`${dir}/${rel}`, dir === 'agents' ? `prompts/${rel}` : `${dir}/${rel}`);
    }
  }
  for (const file of RUNTIME_FILES) put(file, file);
  return written.sort();
}

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const files = build(repoRoot);
  console.log(`built ${files.length} files into dist/`);
}
