// All paths in and out of this module are root-relative POSIX: git runs with cwd = root,
// results never carry the repository-toplevel prefix, and changes outside root are not reported.
import { execFileSync } from 'node:child_process';
import { toPosix } from './glob.mjs';

function git(root, args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
}

function lines(output) {
  return output.split(/\r?\n/).filter((l) => l !== '');
}

/** Full SHA of HEAD. */
export function headSha(root) {
  return git(root, ['rev-parse', 'HEAD']).trim();
}

/**
 * Files changed since `base`: committed + uncommitted changes plus untracked files
 * (respecting .gitignore). Sorted, posix, deduplicated.
 */
export function changedFiles(root, base) {
  const tracked = lines(git(root, ['diff', '--name-only', '--no-renames', '--relative', base]));
  const untracked = lines(git(root, ['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...tracked, ...untracked].map(toPosix))].sort();
}

/** All tracked directories at `ref` (posix paths, no root entry). */
export function dirsAt(root, ref) {
  // From a subdirectory, ls-tree also prints the root itself as "./".
  return new Set(lines(git(root, ['ls-tree', '-r', '-d', '--name-only', ref])).filter((d) => d !== './').map(toPosix));
}
