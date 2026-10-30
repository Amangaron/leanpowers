# Release checklist

Steps the maintainer follows by hand. Nothing here is run by an assistant, and nothing is pushed
without the maintainer's decision.

## Prepare

1. Make sure all release work is merged into `main` and `main` is checked out. The tag and
   the `gemini-extension` branch are cut from `main`.
2. `npm test` must pass, and `node bin/leanpowers.mjs check --all` must print
   `✔ leanpowers check: ok (gates:test, doc-lint, skill-lint)`.
3. Set the new version in `package.json`, then run `npm run build`. The manifests and marketplace
   files pick the version up from there.
4. Run `npm run build`; afterwards `git diff --exit-code -- dist .claude-plugin .agents` and
   `git status --porcelain -- dist .claude-plugin .agents` must both be empty after committing the
   rebuilt output (CI checks the same).
5. Add a section `## [<version>] - <date>` to `CHANGELOG.md`.
6. Commit. Do not tag yet — the tag is set in step 13, after CI is green.

For the first release (0.1.0) the version, CHANGELOG and dist steps (3 to 5) are already done and
committed. If the release happens later than 2026-10-29, adjust the date in the CHANGELOG section.

## Publish (only with the maintainer's decision)

These steps publish to GitHub. Do them only when the maintainer has decided to release.

7. Create the empty public repository `Amangaron/leanpowers` on GitHub, without README, license or
   .gitignore, so the first push is not rejected.
8. The remote `origin` must exist. If it does not: `git remote add origin
   https://github.com/Amangaron/leanpowers.git`.
9. Push `main`: `git push origin main`.
10. Wait until the CI run on GitHub is green in all six cells: macOS, Windows and Linux, each with
    Node 20 and 22. If a cell fails, fix it on `main`, push again and wait for green.
11. Update the CI status lines in `README.md`, `docs/README.md`, `docs/README.de.md`
    ("configured, not run yet" / "eingerichtet, noch nicht gelaufen") and `CHANGELOG.md`
    ("configured; not run yet"), commit, and push `main` again.
12. Wait until CI is green on that commit too.
13. Tag that commit and push the tag: `git tag v<version>`, then `git push origin v<version>`.
14. Build and push the Gemini branch from it: `node scripts/gemini-branch.mjs` (local only, prints
    the push command), then `git push origin gemini-extension`.
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
