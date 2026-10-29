#!/usr/bin/env bash
# Manual verification of the leanpowers Codex package.
# Run this yourself: it changes your Codex configuration (adds a local marketplace and a plugin).
# Agents never run it. Usage: bash scripts/verify-codex.sh
# Optional: CODEX_MODEL=<small model> bash scripts/verify-codex.sh   (a small, cheap model is
# recommended, for example a "mini" model; the name is only an example and unverified).
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FALLBACK="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
CODEX_MODEL="${CODEX_MODEL:-}"

if command -v codex >/dev/null 2>&1; then
  CODEX="$(command -v codex)"
elif [ -x "$FALLBACK" ]; then
  CODEX="$FALLBACK"
else
  echo "codex not found on PATH and not at $FALLBACK" >&2
  exit 1
fi
echo "Using codex: $CODEX ($("$CODEX" --version 2>&1 | head -n 1))"

ADD_MARKETPLACE=("$CODEX" plugin marketplace add "$REPO")
ADD_PLUGIN=("$CODEX" plugin add leanpowers@leanpowers-marketplace)
ADDED=0

print_removal() {
  echo
  echo "To remove leanpowers from Codex again (check '$CODEX plugin --help' if a name differs):"
  echo "  $CODEX plugin remove leanpowers@leanpowers-marketplace"
  echo "  $CODEX plugin marketplace remove leanpowers-marketplace"
}
trap 'if [ "$ADDED" -eq 1 ]; then print_removal; fi' EXIT

echo
echo "This will change your Codex configuration by running:"
echo "  ${ADD_MARKETPLACE[*]}"
echo "  ${ADD_PLUGIN[*]}"
if [ -z "$CODEX_MODEL" ]; then
  echo "Note: the test run uses your default Codex model. Set CODEX_MODEL to a small, cheap model"
  echo "(for example a mini model, name unverified) to keep the cost low."
fi
read -r -p "Run these two commands now? [y/yes/N] " answer
case "$answer" in
  y|Y|yes|YES|Yes) ;;
  *) echo "Aborted. Nothing was changed."; exit 0 ;;
esac

ADDED=1
"${ADD_MARKETPLACE[@]}" || { echo "marketplace add failed" >&2; exit 1; }
"${ADD_PLUGIN[@]}" || { echo "plugin add failed" >&2; exit 1; }

WORK="$(mktemp -d)"
OUT="$WORK/codex-output.jsonl"
MODEL_ARGS=()
if [ -n "$CODEX_MODEL" ]; then MODEL_ARGS=(-m "$CODEX_MODEL"); fi
echo
echo "Running codex exec in $WORK (output: $OUT)"
( cd "$WORK" && "$CODEX" exec --json --skip-git-repo-check ${MODEL_ARGS[@]+"${MODEL_ARGS[@]}"} \
    "Use the leanpowers check skill or run its command and reply with the output." ) >"$OUT" 2>&1
echo "codex exec exit status: $?"

# The real CLI output line is "✔ leanpowers check: ok ..." or "✖ leanpowers check: N failed ...".
# A bare "leanpowers check:" would also match skill or source text echoed by the model.
echo
RESULT=1
if grep -Eq '(✔|✖) leanpowers check: (ok|[0-9]+ failed)' "$OUT"; then
  if grep -q 'leanpowers\.mjs' "$OUT"; then
    echo "PASS codex-check: CLI output line found and the events show leanpowers.mjs being run"
    RESULT=0
  else
    echo "FAIL codex-check: output line found, but no event shows leanpowers.mjs being run; inspect $OUT"
  fi
else
  echo "FAIL codex-check: no '(✔|✖) leanpowers check:' output line found; inspect $OUT"
fi
exit "$RESULT"
