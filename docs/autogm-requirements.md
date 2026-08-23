# AutoGM mode — requirements (future phase, not implemented yet)

This captures the full intent for a future "AutoGM" phase, deliberately out
of scope for the current WebLLM foundation work, so it isn't lost. Treat it
as a living spec — update it as the AutoGM phase is actually scoped and
built, the same way `docs/rules/dreadrpg-app-compliance.md` is meant to be
re-run rather than trusted blindly forever.

## Goal

An AI-driven Game Master mode where the LLM plays the GM role live,
communicating with players entirely through the existing in-game Chat
(`src/components/Chat.jsx`), rather than the GM being a live human.

## Core requirements

1. AutoGM communicates with players via the chat window.
2. When AutoGM is enabled, the person who started the server (the GM/host)
   can choose a character sheet and actually play as a character, rather
   than running the GM role themselves.
3. AutoGM must track its own state (story progress, key facts, decisions
   made) in `localStorage` so that:
   - It can compact/summarize its running conversation history at
     appropriate points to keep the context sent to the model bounded,
     without losing track of where the story currently stands.
   - State persists across a reload of the host's browser (mirrors the
     existing per-game persistence pattern in
     `src/providers/wheel/wheelPersistence.js` and
     `src/providers/peer/gamePersistence.js`).

## Known prerequisites / gaps this phase will need to close

- **GM self-assignment**: today, `CharacterPicker.jsx` (letting a user
  claim an unassigned, living character) is only ever rendered for
  non-GM players (`CharacterSheet.jsx`'s `PlayerCharacterPanel` branch).
  For the host to "choose a character sheet" while AutoGM runs the GM
  role, the GM needs an equivalent self-assignment path that doesn't
  exist yet.
- **New message types & a bot-message convention**: `Chat.jsx`'s message
  shape is `{ from, text }` with no notion of a bot/system sender.
  AutoGM will need something like `{ from, text, fromBot: true }` (or a
  distinct `from` convention) so clients can style/attribute AI narration
  distinctly from a human GM, plus whatever new `MESSAGE_TYPES` are
  needed for AutoGM-specific coordination (e.g. triggering a spin on the
  AI's behalf).
- **Triggering game actions, not just drafting text fields**: unlike the
  foundation phase (which only pre-fills local form state for a human to
  review and send), AutoGM needs to actually _act_ — e.g. call for a spin
  (today: `assignSpinner` / `SPIN_REQUEST` flow in `WheelProvider.jsx` +
  `GameLoaded.jsx`'s `SpinControls`, which already supports
  `pullsRequired` for multi-pull actions and `SPIN_DECLINE`). AutoGM's
  system prompt/tooling needs a defined decision procedure for _when_ a
  declared player action warrants a pull, matching the host judgment call
  described in `docs/rules/quick-reference.md`.
- **Original removal/collapse narration**: `docs/rules/dreadrpg-app-compliance.md`
  explicitly warns against porting the rulebook's own copyrighted "~25
  ways to remove a character" list verbatim. AutoGM's death/removal
  narration prompt must be instructed to invent original flavor text
  inspired by the categories (fled, imprisoned, transformed, etc.), never
  reproduce rulebook wording, and should not always narrate literal
  death — Dread's actual rule treats death as only one of many valid
  outcomes.
- **Reuse, don't rebuild, existing danger/wheel logic**:
  `computeDangerProbability` (`src/helpers/index.js`) and the existing
  `awaitingReset` / "Re-stack Tower" flow already correctly implement the
  rulebook's cumulative escalation rule. AutoGM only needs to narrate
  around these events, not reimplement escalation.

## Design components to reuse from the WebLLM foundation phase

- `src/ai/promptRunner.js`'s `runStructuredPrompt` — reusable as-is for
  each AutoGM turn's structured output (e.g. `{ narration: string,
callForPull: boolean, pullsRequired?: number }`).
- `src/prompts/index.js`'s versioned `.md` prompt registry — add
  `autogm-turn.v1.md`, `autogm-removal-narration.v1.md`, etc. alongside
  the foundation's prompts.
- `src/providers/ai/aiPreferencePersistence.js`'s pattern (dedicated
  module, prefixed `localStorage` key, try/catch fail-soft read/write) —
  the template for a new `autogmStoryPersistence.js` that stores
  compacted story state per game.
- The foundation phase's "AI drafts into local state, a human approves
  via an existing send path" pattern generalizes to "AI drafts a
  narration/action and it is sent as the GM's turn," since in AutoGM mode
  there is no separate human GM to approve it — a deliberate deviation
  from the foundation phase's human-in-the-loop model. Call this out
  clearly when scoping the AutoGM phase, since it's a meaningfully
  different trust model than everything built in the foundation phase.

## Explicitly not decided yet (for the AutoGM phase's own planning to resolve)

- Exact new `MESSAGE_TYPES` needed.
- Exact context-compaction strategy/thresholds (e.g. summarize every N
  turns, or when a token estimate crosses a threshold).
- Whether AutoGM narration is generated on the host's browser only
  (matching the GM-hub topology used everywhere else in this app) —
  presumed yes, but worth confirming explicitly when that phase is
  scoped.
- Whether/how a human GM can intervene or pause AutoGM mid-session.
