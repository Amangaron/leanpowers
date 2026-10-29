#!/usr/bin/env bash
# Manual verification of the leanpowers Codex package.
# Run this yourself: it changes your Codex configuration (adds a local marketplace and a plugin).
# Agents never run it. Usage: bash scripts/verify-codex.sh
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FALLBACK="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"

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

echo
echo "This will change your Codex configuration by running:"
echo "  ${ADD_MARKETPLACE[*]}"
echo "  ${ADD_PLUGIN[*]}"
read -r -p "Run these two commands now? [y/N] " answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) echo "Aborted. Nothing was changed."; exit 0 ;;
esac

"${ADD_MARKETPLACE[@]}" || { echo "marketplace add failed" >&2; exit 1; }
"${ADD_PLUGIN[@]}" || { echo "plugin add failed" >&2; exit 1; }

WORK="$(mktemp -d)"
OUT="$WORK/codex-output.jsonl"
echo
echo "Running codex exec in $WORK (output: $OUT)"
( cd "$WORK" && "$CODEX" exec --json --skip-git-repo-check \
    "Use the leanpowers check skill or run its command and reply with the output." ) >"$OUT" 2>&1

echo
if grep -q 'leanpowers check:' "$OUT"; then
  echo "PASS codex-check: 'leanpowers check:' appears in the output"
  RESULT=0
else
  echo "FAIL codex-check: 'leanpowers check:' not found; inspect $OUT"
  RESULT=1
fi

echo
echo "To remove the plugin again (check '$CODEX plugin --help' if a name differs):"
echo "  $CODEX plugin remove leanpowers@leanpowers-marketplace"
echo "  $CODEX plugin marketplace remove leanpowers-marketplace"
exit "$RESULT"
