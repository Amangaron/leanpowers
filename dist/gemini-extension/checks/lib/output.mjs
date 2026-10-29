/** @typedef {{ name: string, ok: boolean, messages: string[] }} CheckResult */

/** Trim lines, drop empty ones, dedupe (first wins) and cap at `max`. */
export function compress(lines, max = 20) {
  const seen = new Set();
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  if (out.length <= max) return out;
  const rest = out.length - max;
  return [...out.slice(0, max), `… ${rest} more`];
}

/**
 * Format check results. All ok: a single status line. Otherwise a failure
 * count plus each failed check with its indented messages. Warnings follow.
 * @param {CheckResult[]} results
 * @param {string[]} [warnings]
 * @returns {{ ok: boolean, text: string }}
 */
export function formatResults(results, warnings = []) {
  const failed = results.filter((r) => !r.ok);
  const ok = failed.length === 0;
  const lines = [];
  if (ok) {
    lines.push(`✔ leanpowers check: ok (${results.map((r) => r.name).join(', ')})`);
  } else {
    lines.push(`✖ leanpowers check: ${failed.length} failed`);
    for (const r of failed) {
      lines.push(`✖ ${r.name}`);
      for (const m of r.messages) lines.push(`  ${m}`);
    }
  }
  for (const w of warnings) lines.push(`⚠ ${w}`);
  return { ok, text: lines.join('\n') };
}
