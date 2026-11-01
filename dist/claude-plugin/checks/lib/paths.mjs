import path from 'node:path';
import { toPosix } from './glob.mjs';

const normalize = (p) => toPosix(p).replace(/^\.\//, '').replace(/\/+$/, '');

/** The configured own folders (specs, plans, reports, runs), posix, without ./ and trailing slash. */
export function ownFolders(config) {
  const { specs, plans, reports, runs } = config.paths;
  return [specs, plans, reports, runs].map(normalize);
}

/** True when file (relative to root or absolute) is the folder or lies below it. */
export function insideFolder(root, file, folder) {
  const rel = toPosix(path.relative(root, path.resolve(root, file)));
  const f = normalize(folder);
  return rel === f || rel.startsWith(`${f}/`);
}

/** Warning text when a plan lies outside paths.plans or a brief outside paths.runs; null when inside. */
export function outsideWarning(root, config, file, kind) {
  const key = kind === 'plan' ? 'plans' : 'runs';
  if (insideFolder(root, file, config.paths[key])) return null;
  const rel = toPosix(path.relative(root, path.resolve(root, file)));
  return `${kind} outside paths.${key} (${normalize(config.paths[key])}): ${rel}`;
}
