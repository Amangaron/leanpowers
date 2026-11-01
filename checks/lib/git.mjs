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

/** Trimmed git output, or null when git fails (git missing, no repository, missing folder, non-zero exit). */
function tryGit(root, args) {
  try {
    return git(root, args).trim();
  } catch {
    return null;
  }
}

/** Short name of the checked-out branch; null on a detached HEAD or without git. Never throws. */
export function currentBranch(root) {
  return tryGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || null;
}

/**
 * Default branch: the HEAD of a remote (origin first, then the others in listed order),
 * else `main`, else `master` when that local branch exists; null otherwise. Never throws.
 */
export function defaultBranch(root) {
  const listed = lines(tryGit(root, ['remote']) ?? '');
  const remotes = listed.includes('origin') ? ['origin', ...listed.filter((r) => r !== 'origin')] : listed;
  for (const r of remotes) {
    const prefix = `refs/remotes/${r}/`;
    const ref = tryGit(root, ['symbolic-ref', '--quiet', `refs/remotes/${r}/HEAD`]);
    if (ref && ref.startsWith(prefix) && ref.length > prefix.length) return ref.slice(prefix.length);
  }
  for (const name of ['main', 'master']) {
    if (tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]) !== null) return name;
  }
  return null;
}

/** Warning text when the checked-out branch is the default branch; null otherwise. Never throws. */
export function defaultBranchWarning(root) {
  const current = currentBranch(root);
  const name = defaultBranch(root);
  if (current === null || name === null || current !== name) return null;
  return `on default branch ${name}: leanpowers works on a feature branch (feat/<topic>) unless the user named this branch`;
}
