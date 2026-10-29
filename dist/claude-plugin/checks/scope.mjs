import { matchesAny } from './lib/glob.mjs';

/** Every changed file (minus ignored ones) must be allowed by the task brief. */
export function checkScope(changed, allowed, ignore = []) {
  const messages = [];
  for (const file of changed) {
    if (matchesAny(file, ignore)) continue;
    if (!matchesAny(file, allowed)) messages.push(`not in brief: ${file}`);
  }
  return { name: 'scope', ok: messages.length === 0, messages };
}
