# Release checklist

Steps the maintainer follows by hand. Nothing here is run by an assistant, and nothing is pushed
without the maintainer's decision.

## Prepare

1. `npm test` must pass, and `node bin/leanpowers.mjs check --all` must print
   `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
2. Set the new version in `package.json`, then run `npm run build`. The manifests and marketplace
   files pick the version up from there.
3. `git diff --exit-code -- dist .claude-plugin .agents` must be clean after committing the
   rebuilt output (CI checks the same).
4. Add a section `## [<version>] - <date>` to `CHANGELOG.md`.
5. Commit, then `git tag v<version>`.
6. `node scripts/gemini-branch.mjs` builds the `gemini-extension` branch locally from the committed
   `dist/gemini-extension` and prints the push command. It never pushes.

## Publish (only with the maintainer's decision)

These steps publish to GitHub. Do them only when the maintainer has decided to release.

7. `git push origin master --tags`
8. `git push origin gemini-extension`
9. Check the CI run on GitHub: all of macOS, Windows and Linux with Node 20 and 22 must be green.

## Verify it yourself

The authors made no paid test runs. Users who want to confirm the packages on their machine:

- Claude Code: log in with `/login`, then run `node scripts/verify-claude.mjs`. It loads
  `dist/claude-plugin` for one session only (`--plugin-dir`) and installs nothing. It makes a few
  small model calls with your own Claude login (so it uses your quota) and creates a temporary
  git repository.
- Codex: run `bash scripts/verify-codex.sh`. It changes your Codex configuration (adds a local
  marketplace and a plugin), so read the script first.
