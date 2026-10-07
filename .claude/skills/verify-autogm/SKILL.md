---
name: verify-autogm
description: Manually verify AutoGM (the AI game master) after changing its prompts, turn pipeline, or prompt context - enabling it, picking a model tier, reading the debug panel, and the specific regressions prompt changes cause. Use after touching src/prompts/autogm-*.md, src/ai/promptContexts.js, src/ai/schemas/autoGm*, helpers/contextRelevance.js, or AutoGmProvider.jsx.
---

# Verifying AutoGM changes

Builds on the `run-app` skill - read that first for the dev server, the
`/dreadrpg/` base path, and the create-game/join-as-player setup.

**Why this is manual.** AutoGM runs a quantized Llama locally through
WebLLM (0.9GB / 2.3GB / 5.0GB by tier, see `src/constants/aiModels.js`) and
needs WebGPU. The Playwright e2e suite covers only WebRTC/P2P and has zero
AutoGM coverage; the Vitest suite mocks `runPrompt` entirely, so it proves
the pipeline wiring and nothing about output quality. Prompt work is only
ever verified by watching real turns.

If this environment has no WebGPU or can't download a model, say so and stop
rather than reporting the change as verified. Unit tests passing is not
verification of a prompt change.

**Check WebGPU before planning a session.** Every tier is a `q4f16_1` build,
which needs the `shader-f16` WebGPU feature - a browser can expose a working
adapter and still not have it, and WebLLM will refuse to load. Headless
Chromium has no `navigator.gpu` at all; headed Chrome needs
`--enable-unsafe-webgpu`:

```js
const b = await chromium.launch({ channel: "chrome", headless: false,
  args: ["--enable-unsafe-webgpu"] });
const a = await (await b.newPage()).evaluate(async () =>
  (await navigator.gpu?.requestAdapter())?.features.has("shader-f16"));
```

`false` means the model path can't run here, full stop. (Under WSL, WSLg
gives you `DISPLAY` so headed Chrome works, but the D3D12 adapter has
reported no f16.)

## Without a model: drive the real prompt builders

Most of what goes wrong with context changes is visible *before* inference -
and this is the check that actually catches filtering bugs, because unit
tests use short invented queries that hide them. Run the real modules over a
realistic mid-campaign fixture (full notes, a cast, a long story summary,
several turns of history) and print prompt sizes and which notes survived:

```bash
./node_modules/.bin/vite-node path/to/harness.mjs   # not plain node:
                                                    # sources use extensionless imports
```

Compare a turn focused on a location, one on an item, and one that's pure
small talk. **They must produce visibly different note sets.** If they come
out the same, relevance is matching on something ambient rather than on the
turn - that is exactly the bug this harness caught once already (the query
was including the whole story summary, so everything matched every turn).

## Setup

1. `npm run dev`, open `localhost:5173/dreadrpg/`, **Create Game** as GM.
2. Enable the **AI assistant** (top of page) and pick a tier. Start with
   SMALL (1B) - it's the weakest model the app ships, so it surfaces
   prompt-fragility the bigger tiers paper over. The download is cached
   after the first run.
3. Build a scenario and a cast of **at least three characters**, and put
   **several items in Campaign Notes** across a couple of sections. Filtering
   and pinning do nothing observable on an empty game.
4. Join as one or two players in separate browser profiles, pick characters,
   start the game.
5. In the **Admin Panel**, Enable AutoGM. The debug panel appears directly
   beneath the toggle while AutoGM is on.

## Play and watch

Send player chat that exercises different shapes of turn: a plainly risky
action ("I kick the hatch open"), something safe and chatty, a quiet stretch
of several low-stakes messages, and a message naming another character.
Then drive at least ~20 messages total so a **compaction** fires.

Read the debug panel's newest-first entries after each turn:

- **Pacing** - the scene-pacing read and its one-line reasoning.
- **Context: n/m note items (k pinned)** - how much of the notes the turn
  prompt actually carried.
- **Called for a pull** - with the skip reason when one applies.
- **Campaign notes** - updates the turn proposed.
- Draft vs final narration, when the self-check revised it.

## What to check

- **Filtering is actually saving something.** On a focused turn, `Context:`
  should be well under the total. If it's always n == m, the relevance query
  is matching everything and the scoring needs a look.
- **Pinned canon is always present.** `(k pinned)` should hold steady across
  turns, including turns with nothing to do with those facts. Pin an item by
  hand in Campaign Notes and confirm it keeps appearing.
- **Compaction rescues real facts.** After a compaction, the
  "Established Facts" section should gain pinned items that are durable
  specifics (a death, a revelation, a promise), not mood ("the group grew
  uneasy") or a restatement of the summary. Mood lines mean the compaction
  prompt needs tightening.
- **The GM doesn't start forgetting.** The regression that matters most:
  narration contradicting an established fact about a character or item that
  got filtered out of a turn. Watch for it over a long session, not one turn.
- **Pacing reads are sane.** `escalate` after a genuinely slack stretch,
  `continue` as the common case. Constant `escalate`, or `call_for_pull`
  whenever the tower is dangerous, means the prompt's examples aren't
  landing.
- **Nothing hangs.** Every call is raced against a 60s timeout; a turn that
  silently stops is a real bug, not slowness.

## If quality regressed

Prefer tuning before adding machinery:

- Note filtering too aggressive → raise `MAX_RELEVANT_NOTE_ITEMS` in
  `src/helpers/contextRelevance.js`, or widen `QUERY_HISTORY_LOOKBACK`.
- A prompt behaving worse → add a new version file
  (`autogm-*.v<n+1>.md`) and register it in `src/prompts/index.js` rather
  than editing a shipped version in place. The dev-only
  `PromptTestHarness` can run versions against each other.
- Schema validation failing often on SMALL → the prompt is asking for too
  many fields at once; that's the signal to split a narrow classifier out,
  the way `checkForPull` and the pacing read already are.
