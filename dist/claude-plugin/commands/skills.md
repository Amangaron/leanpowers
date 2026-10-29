---
description: List leanpowers skills and switch them on or off
---
If the arguments are not empty, run `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" skills $ARGUMENTS` and show the output. Otherwise run `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" skills --list`, show the output, ask the user which skills to change, and apply them with `node "${CLAUDE_PLUGIN_ROOT}/bin/leanpowers.mjs" skills --set <name>=on|off,...`. Arguments: $ARGUMENTS
