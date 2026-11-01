import { matchesAny } from './lib/glob.mjs';

/** Every changed file (minus ignored ones) must be allowed by the task brief. */
export function checkScope(changed, allowed, ignore = []) {
  const messages = [];
  for (const file of changed) {
    if (matchesAny(file, ignore)) continue;
    if (matchesAny(file, allowed)) continue;
    // The project's own config belongs to the user: say so, so nobody edits it silently.
    messages.push(file === 'leanpowers.json'
      ? "not in brief: leanpowers.json (project configuration: change it only with the user's yes)"
      : `not in brief: ${file}`);
  }
  return { name: 'scope', ok: messages.length === 0, messages };
}
