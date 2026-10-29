/** Replace every backslash with a forward slash. */
export function toPosix(p) {
  return p.replaceAll('\\', '/');
}

/**
 * Convert a glob to an anchored RegExp.
 * a double star followed by a slash matches zero or more segments, a bare double star matches anything, `*` matches
 * within one segment, `?` matches one non-slash character.
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** True if the (posix-normalized) path matches at least one glob. */
export function matchesAny(path, globs) {
  const p = toPosix(path);
  return globs.some((g) => globToRegExp(g).test(p));
}
