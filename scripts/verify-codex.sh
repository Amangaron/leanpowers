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

# PASS needs ONE event (one JSONL line) in which a command running `node ... leanpowers.mjs` and the
# real CLI output line appear together. The output line is "✔ leanpowers check: ok (gates...)" or
# "✖ leanpowers check: N failed ...". Skill text that merely shows that line, or an unrelated mention of
# leanpowers.mjs (cat, ls), is therefore not enough. Event field names are unverified, so every string
# in the event is inspected: strings under a "command"/"cmd" key are the command; all others are output.
echo
RESULT=1
if node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n");
const re = /(✔|✖) leanpowers check: (ok \([a-z]|[0-9]+ failed)/;
const walk = (v, key, cmds, outs) => {
  if (typeof v === "string") (/^(command|cmd)$/.test(key || "") ? cmds : outs).push(v);
  else if (Array.isArray(v)) v.forEach((x) => walk(x, key, cmds, outs));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k, cmds, outs);
};
let sawLine = false;
for (const line of lines) {
  let ev; try { ev = JSON.parse(line); } catch { continue; }
  const cmds = [], outs = []; walk(ev, "", cmds, outs);
  const ran = cmds.some((c) => /\bnode\b/.test(c) && c.includes("leanpowers.mjs"));
  const out = outs.some((o) => re.test(o));
  if (out) sawLine = true;
  if (ran && out) process.exit(0);
}
process.exit(sawLine ? 3 : 1);
' "$OUT"; then
  echo "PASS codex-check: one event shows a node leanpowers.mjs command together with the CLI output line"
  RESULT=0
else
  echo "FAIL codex-check: no single event combines a node leanpowers.mjs command with the '(✔|✖) leanpowers check:' output line; inspect $OUT"
fi
exit "$RESULT"
