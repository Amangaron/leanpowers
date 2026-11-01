import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIRS = ['skills', 'agents', 'bin', 'checks', 'schema', 'templates'];
const RUNTIME_FILES = ['package.json', 'LICENSE', 'NOTICE'];

/** Sorted list of files below dir (posix, relative), skipping OS noise. */
export function walk(dir, rel = '') {
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
 * `skills/**\/*.md` the references `` `agents/`` is rewritten to `` `<plugin>/prompts/`` and `(agents/` to `(prompts/`.
 * Text files are written with LF line endings; files containing a NUL byte are copied as is.
 * Returns the written files (posix, relative to outDir).
 */
export function copyRuntime(repoRoot, outDir) {
  const written = [];
  const put = (srcRel, destRel) => {
    const src = path.join(repoRoot, srcRel);
    const dest = path.join(outDir, destRel);
    const data = fs.readFileSync(src);
    const mode = fs.statSync(src).mode & 0o777;
    if (data.includes(0)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
    } else {
      let text = data.toString('utf8');
      if (srcRel.startsWith('skills/') && srcRel.endsWith('.md')) {
        text = text.replaceAll('`agents/', '`<plugin>/prompts/').replaceAll('(agents/', '(prompts/');
      }
      writeText(dest, text);
    }
    fs.chmodSync(dest, mode);
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
