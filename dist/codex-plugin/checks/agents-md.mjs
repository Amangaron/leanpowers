import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- leanpowers:start -->';
const END = '<!-- leanpowers:end -->';

/** Writes `text` into the leanpowers block of AGENTS.md; text outside the markers stays byte for byte. */
export function updateAgentsMd(root, text) {
  const file = path.join(root, 'AGENTS.md');
  const block = `${START}\n${text}\n${END}`;
  let old;
  try {
    old = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    fs.writeFileSync(file, `${block}\n`);
    return 'created';
  }
  const starts = old.split(START).length - 1;
  const ends = old.split(END).length - 1;
  let next;
  if (starts === 0 && ends === 0) {
    // One blank line between the existing text and the block.
    const sep = old === '' || old.endsWith('\n\n') ? '' : old.endsWith('\n') ? '\n' : '\n\n';
    next = `${old}${sep}${block}\n`;
  } else {
    const s = old.indexOf(START);
    const e = old.indexOf(END);
    if (starts !== 1 || ends !== 1 || e < s) throw new Error('AGENTS.md: leanpowers block markers are broken');
    next = `${old.slice(0, s)}${block}${old.slice(e + END.length)}`;
  }
  if (next === old) return 'unchanged';
  fs.writeFileSync(file, next);
  return 'updated';
}
