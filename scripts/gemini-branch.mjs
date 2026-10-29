#!/usr/bin/env node
// Builds the local branch `gemini-extension`, whose root is the built Gemini extension, so that
// `gemini extensions install <repo> --ref gemini-extension` installs it (the repository root holds
// source skills/ and agents/ that Gemini would otherwise load).
// Source: the COMMITTED tree HEAD:dist/gemini-extension (reproducible; run `npm run build` and commit first).
// Plumbing only: no checkout, index or working-tree change, current branch untouched. Never pushes.
// Usage: node scripts/gemini-branch.mjs
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'dist/gemini-extension';

const git = (cwd, args, { allowFail = false } = {}) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${String(e.stderr || e.message).trim()}`);
  }
};

/**
 * Adds one commit to `branch` whose root tree equals HEAD:dist/gemini-extension.
 * @returns {{ branch: string, commit: string }}
 */
export function prepareGeminiBranch(repoRoot, { branch = 'gemini-extension' } = {}) {
  const ref = `refs/heads/${branch}`;
  if (git(repoRoot, ['symbolic-ref', '-q', 'HEAD'], { allowFail: true }) === ref) {
    throw new Error(`refusing to rewrite the checked-out branch ${branch}`);
  }
  const tree = git(repoRoot, ['rev-parse', '--verify', '-q', `HEAD:${SOURCE}`], { allowFail: true });
  if (!tree) throw new Error(`${SOURCE} is not committed in HEAD: run "npm run build" and commit dist/ first`);
  // Staged, modified or untracked changes under the source would make the branch differ from what is on disk.
  if (git(repoRoot, ['status', '--porcelain', '--', SOURCE])) {
    throw new Error(`${SOURCE} has uncommitted changes: commit or discard them first`);
  }
  const previous = git(repoRoot, ['rev-parse', '--verify', '-q', ref], { allowFail: true });
  const short = git(repoRoot, ['rev-parse', '--short', 'HEAD']);
  const args = ['commit-tree', tree, ...(previous ? ['-p', previous] : []), '-m', `release: gemini-extension from ${short}`];
  const commit = git(repoRoot, args);
  // Old value guard: fails instead of overwriting a branch that moved meanwhile ("" = must not exist yet).
  git(repoRoot, ['update-ref', ref, commit, previous || '']);
  return { branch, commit };
}

const isMain = () => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
};
if (process.argv[1] && isMain()) {
  try {
    const root = git(resolve(dirname(fileURLToPath(import.meta.url)), '..'), ['rev-parse', '--show-toplevel']);
    const { branch, commit } = prepareGeminiBranch(root);
    console.log(`branch ${branch} -> ${commit}`);
    console.log('Nothing was pushed. To publish it yourself, run:');
    console.log(`  git push origin ${branch}`);
  } catch (e) {
    console.error(`gemini-branch: ${e.message}`);
    process.exit(1);
  }
}
