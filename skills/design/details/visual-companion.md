# Visual mockups

Use a mockup only when seeing beats reading: a layout, wireframe, diagram or side-by-side visual comparison. A question about a UI topic is not automatically visual — "what should the wizard ask?" stays in chat, "which of these two layouts?" is visual. Requirements, trade-offs and A/B/C text choices always stay in chat.

## Offer first

The first time a visual question comes up, offer mockups in a message of its own — no question or summary alongside — and mention that they cost extra tokens. Wait for the answer. If the user declines, continue in chat and do not offer again unless they raise it. Even after a yes, decide per question whether it is visual.

## Produce a screen

- Write one self-contained HTML file per question: inline CSS and SVG, no external scripts, fonts or network requests.
- Save it in the run folder `<paths.runs>/YYYY-MM-DD-<topic>/` as `mockup-<n>-<slug>.html`. If the folder is new, add a `.gitignore` containing `*`.
- One question per screen. Label the options A, B, C and keep wireframe fidelity with realistic content.
- Give the user the file path, ask them to open it in a browser and answer in chat (for example "B, but with the sidebar from A").
- No server, no file watcher, no click tracking: the answer always arrives in chat.

## After the choice

Describe the chosen option in words in the spec. Mockups stay in the git-ignored run folder and are never linked from the spec.
