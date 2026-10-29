function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const DEFAULTS = deepFreeze({
  skills: { worktrees: false, 'design.visualCompanion': false },
  extraSkillDirs: [],
  paths: { specs: 'docs/specs', plans: 'docs/plans', reports: 'docs/reports', runs: '.leanpowers/runs' },
  commands: { test: '', typecheck: '', lint: '' },
  structure: { newFolders: 'ask', rules: [] },
  review: { batch: 3, maxFixRounds: 2 },
  models: { small: 'auto', medium: 'auto', large: 'auto' },
  summarizer: 'none',
  orchestration: 'auto',
});
