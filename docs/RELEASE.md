# Release checklist

Steps the maintainer follows by hand. Nothing here is run by an assistant, and nothing is pushed
without the maintainer's decision.

## Prepare

1. Make sure all release work is merged into `master` and `master` is checked out. The tag and
   the `gemini-extension` branch are cut from `master`.
2. `npm test` must pass, and `node bin/leanpowers.mjs check --all` must print
   `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
3. Set the new version in `package.json`, then run `npm run build`. The manifests and marketplace
   files pick the version up from there.
4. Run `npm run build`; afterwards `git diff --exit-code -- dist .claude-plugin .agents` and
   `git status --porcelain -- dist .claude-plugin .agents` must both be empty after committing the
   rebuilt output (CI checks the same).
5. Add a section `## [<version>] - <date>` to `CHANGELOG.md`.
6. Commit, then `git tag v<version>`.
7. `node scripts/gemini-branch.mjs` builds the `gemini-extension` branch locally from the committed
   `dist/gemini-extension` and prints the push command. It never pushes.

For the first release (0.1.0) the version, CHANGELOG and dist steps (3 to 5) are already done and
committed. If the release happens later than 2026-10-29, adjust the date in the CHANGELOG section.

## Publish (only with the maintainer's decision)

These steps publish to GitHub. Do them only when the maintainer has decided to release.

8. Create the empty public repository `Amangaron/leanpowers` on GitHub, without README, license or
   .gitignore, so the first push is not rejected (only with the maintainer's decision).
9. The remote `origin` must exist. If it does not, add it, again only with the maintainer's
   decision: `git remote add origin https://github.com/Amangaron/leanpowers.git`.
10. Push `master` only: `git push origin master`. Do not push the tag yet.
11. Wait until the CI run on GitHub is green in all six cells: macOS, Windows and Linux, each with
    Node 20 and 22.
12. Once CI is green, update `README.md`, `docs/README.md`, `docs/README.de.md` and `CHANGELOG.md`,
    which still say "CI configured, not run yet" (German: "eingerichtet, noch nicht gelaufen"),
    and commit. If that commit comes before the tag, move the tag to it.
13. Push the tag: `git push origin v<version>`.
14. Push the Gemini branch: `git push origin gemini-extension`.
15. Optional: create a GitHub Release for the tag from the CHANGELOG section (web UI, or
    `gh release create v<version> --notes-file <file with the CHANGELOG section>`).

## Verify it yourself

The authors made no paid test runs. Users who want to confirm the packages on their machine:

- Claude Code: log in with `/login`, then run `node scripts/verify-claude.mjs`. It loads
  `dist/claude-plugin` for one session only (`--plugin-dir`) and installs nothing. It makes a few
  small model calls with your own Claude login (so it uses your quota) and creates a temporary
  git repository.
- Codex: run `bash scripts/verify-codex.sh`. It asks before it changes your Codex configuration
  (adds a local marketplace and the plugin) and prints how to remove it again.
