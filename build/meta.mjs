import fs from 'node:fs';
import path from 'node:path';

/** Package metadata shared by every platform manifest and marketplace file. */
export function packageMeta(repoRoot) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: 'Dominic Shin',
    repository: 'https://github.com/Amangaron/leanpowers',
    license: pkg.license,
  };
}
