import { matchesAny, toPosix } from './lib/glob.mjs';

function ancestorDirs(file) {
  const parts = toPosix(file).split('/');
  const dirs = [];
  for (let i = 1; i < parts.length; i++) dirs.push(parts.slice(0, i).join('/'));
  return dirs;
}

/** Folder rules (allowed file types per path) and the new-folder policy. */
export function checkStructure({ changed, rules, newFolders, existingDirs, approvedFolders = [], ownFolders = [] }) {
  const messages = [];

  for (const file of changed) {
    const posix = toPosix(file);
    const base = posix.slice(posix.lastIndexOf('/') + 1);
    for (const rule of rules) {
      if (matchesAny(posix, [rule.path]) && !matchesAny(base, rule.allow)) {
        messages.push(`${posix}: not allowed by rule ${rule.path} (allow: ${rule.allow.join(', ')})`);
      }
    }
  }

  if (newFolders !== 'allow') {
    const fresh = new Set();
    for (const file of changed) {
      for (const dir of ancestorDirs(file)) if (!existingDirs.has(dir)) fresh.add(dir);
    }
    for (const dir of [...fresh].sort()) {
      // Configured own folders, their parents and their children are approved by the configuration.
      if (ownFolders.some((o) => o === dir || o.startsWith(`${dir}/`) || dir.startsWith(`${o}/`))) continue;
      if (newFolders === 'deny') {
        messages.push(`new folder not allowed: ${dir}`);
      } else {
        const approved = approvedFolders.some((a) => a === dir || a.startsWith(`${dir}/`));
        if (!approved) messages.push(`new folder needs approval: ${dir}`);
      }
    }
  }

  return { name: 'structure', ok: messages.length === 0, messages };
}
