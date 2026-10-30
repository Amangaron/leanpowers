const FENCE = /^```/;
const TASK_HEADING = /^### Task (\d+):\s*(.+)$/;

function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

/** Per-line flags: true for fence delimiter lines and lines inside a fenced block. */
function fenceFlags(lines) {
  const flags = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      flags.push(true);
      inFence = !inFence;
    } else {
      flags.push(inFence);
    }
  }
  return flags;
}

/** Remove fenced code blocks and inline code spans; the line count stays the same. */
export function stripCode(text) {
  const lines = normalizeNewlines(text).split('\n');
  const flags = fenceFlags(lines);
  return lines.map((line, i) => (flags[i] ? '' : line.replace(/`[^`\n]*`/g, ''))).join('\n');
}

function headerValue(lines, flags, label) {
  const re = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    if (flags[i]) continue;
    const m = re.exec(lines[i]);
    if (m) return m[1].replaceAll('`', '').trim();
  }
  return '';
}

/** Join body lines, dropping trailing blank lines and `---` separator lines. */
function trimBody(rawLines) {
  const lines = [...rawLines];
  while (lines.length > 0 && (lines.at(-1).trim() === '' || lines.at(-1).trimEnd() === '---')) lines.pop();
  return lines.join('\n');
}

function parseTask(n, title, rawLines, flags) {
  const outside = rawLines.filter((_, i) => !flags[i]).join('\n');
  const riskMatch = /^\*\*Risk:\*\*\s*(low|high)\b/m.exec(outside);
  const files = [];
  for (const line of outside.split('\n')) {
    const m = /^- (Create|Modify|Test): `([^`]+)`/.exec(line);
    if (m) files.push({ kind: m[1], path: m[2].replace(/:\d+(?:-\d+)?$/, '') });
  }
  return {
    n,
    title: title.trim(),
    risk: riskMatch ? riskMatch[1] : null,
    parallel: /^\*\*Parallel:\*\*\s*true\b/m.test(outside),
    files,
    body: trimBody(rawLines),
  };
}

/** Parse a Markdown plan (format contract: see docs) into header fields and tasks. */
export function parsePlan(text) {
  const lines = normalizeNewlines(text).split('\n');
  const flags = fenceFlags(lines);

  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    if (flags[i]) continue;
    const m = TASK_HEADING.exec(lines[i]);
    if (m) headings.push({ index: i, n: Number(m[1]), title: m[2] });
  }

  let globalConstraints = '';
  const gc = lines.findIndex((l, i) => !flags[i] && l.trimEnd() === '## Global Constraints');
  if (gc !== -1) {
    const collected = [];
    for (let i = gc + 1; i < lines.length; i++) {
      if (!flags[i] && (lines[i].startsWith('## ') || lines[i].trimEnd() === '---' || TASK_HEADING.test(lines[i]))) break;
      collected.push(lines[i]);
    }
    globalConstraints = collected.join('\n').trim();
  }

  const tasks = headings.map((h, k) => {
    let end = k + 1 < headings.length ? headings[k + 1].index : lines.length;
    for (let i = h.index + 1; i < end; i++) {
      if (!flags[i] && lines[i].startsWith('## ')) {
        end = i;
        break;
      }
    }
    return parseTask(h.n, h.title, lines.slice(h.index, end), flags.slice(h.index, end));
  });

  return {
    goal: headerValue(lines, flags, 'Goal'),
    spec: headerValue(lines, flags, 'Spec'),
    sources: headerValue(lines, flags, 'Sources').split(',').map((s) => s.trim()).filter(Boolean),
    globalConstraints,
    tasks,
  };
}
