# dreadrpg app vs. the real Dread rules — compliance audit

This is the living answer to "does this app's code still match the real
Dread rules?" Re-run this comparison (don't just trust it blindly — code
drifts) whenever you touch `WheelProvider.jsx`, `helpers/index.js`,
`WheelGraphics.jsx`, `CharacterSheet.jsx`, or `Scenario.jsx`. Rule citations
are paraphrased from [`quick-reference.md`](./quick-reference.md); example
citations are from [`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md).

Verdict legend: ✅ Matches · 🟡 Intentional simplification (by design, not a bug) · 🔧 Fixed this pass · 🔷 Gap — needs a product decision

## GM / host model

**✅ Matches.** The rules' "Host" (creates the framework, adjudicates
conflict, controls other characters) maps directly to the app's `isGM`
concept — GM is the connection hub (`src/providers/PeerProvider.jsx`
`createGame`/`joinGame`), controls the wheel's spin resolution
(`WheelProvider.jsx` `handleHostSpin`), and is the source of truth
broadcast to all players (`sendToPeers`, `buildGameSnapshot`).

## The tower → the wheel

**🟡 Intentional simplification**, stated explicitly in the app's own
README and now in `CLAUDE.md`. The wheel (`src/components/WheelGraphics.jsx`,
`src/providers/WheelProvider.jsx`) replaces the physical Jenga tower as the
resolution mechanic. This is the app's foundational design choice, not
something to "fix" — but the _behavior_ of that stand-in should still track
the rule's actual escalation logic where practical (see next item).

## Escalating danger after a collapse

**🔧 Fixed this pass.** The rule: "re-stack it and pre-pull, as at the
start, but with three additional blocks for every character removed from
the game" — escalation is cumulative and never decreases.

Before this pass, `getNewWheelStateOnSpin` (`src/helpers/index.js`) reset
the _entire_ wheel back to all-`success` every time a `death` wedge was
hit — every re-stack was exactly as easy as the very first one, contradicting
the rule.

Now: `WheelProvider.jsx` tracks a local `charactersRemoved` count
(`src/providers/WheelProvider.jsx:27`), increments it on every `death` spin
inside `handleSpinEnd` (`src/providers/WheelProvider.jsx:115-135`), and
passes it into `getNewWheelStateOnSpin(selectedIdx, wheelState,
charactersRemoved)`. The helper now pre-sets `min(wedgeCount, 3 *
charactersRemoved)` random wedges to `death` on every reset
(`src/helpers/index.js:1-39`) — mirroring the "+3 blocks per removed
character" rule, scaled to the wheel's own wedge count instead of a fixed
54-block tower (there's no rule-mandated wedge count to match against, so
scaling relative to the current wheel size is the closest equivalent).
Verified in `src/test/helpers.test.js` (escalation, cumulative escalation,
capping at wheel size, and the original all-`success` default when no count
is passed).

## Declining a pull vs. a tower collapse (two different severities)

**🔷 Gap.** The rules distinguish two outcomes with very different stakes:

- _Declining/failing a pull_ → the action just fails; "This failure can not
  be so drastic that it would remove the character from the game."
- _A tower collapse_ → the character is removed from the game.

The app's wheel collapses these into one binary outcome per spin: landing on
`success` = "Success!", landing on `death` = "You Died!"
(`src/providers/WheelProvider.jsx` `handleSpinEnd`). There's no app-level
concept of "the character failed this one action but is still alive and
in the game" as a distinct, less-severe result from a spin — nor is there a
way to _decline_ a requested spin the way the rules allow declining a pull.
Not fixed this pass: this is a meaningful game-design decision (would need a
third wheel-outcome type, or a "decline" affordance in `GameLoaded.jsx`/
`WheelGraphics.jsx`), not a mechanical bug.

## "Ways to remove a character" (death is only one option)

**🔷 Gap** (cosmetic/content, not mechanical). The rulebook lists ~25
host-narrated outcomes for a removed character — death is just one. The
app always shows the literal text `"You Died!"`
(`src/providers/WheelProvider.jsx` `handleSpinEnd`). Not fixed this pass:
deliberately **not** copying the rulebook's own copyrighted flavor-text list
into shipped UI — if pursued, this needs originally-written flavor text (or
simply a GM-editable "what happens on death" field), not a straight port of
the source material.

## Elective pulls

**✅ Matches** (incidentally, not by explicit design). "Players always have
the option to pull a block without being asked." The app's spin button
(`id="spin-btn"`, `src/components/GameLoaded.jsx:109-110`) is never gated
behind a "you must be asked" check — any player can request a spin at any
time via `handleSpin` → `spin-request` (`WheelProvider.jsx`). There's no
labeled "elective spin" affordance distinguishing it from a required one,
but nothing blocks the underlying behavior the rule describes.

## Multi-pull complex/difficult tasks

**🔷 Gap.** The host can require several pulls for one complex action, each
representing a distinct step. The app has no concept of chaining multiple
spins to a single declared action — every spin is independent
(`WheelGraphics.jsx` → `onSpinEnd` → `WheelProvider.handleSpinEnd`). Not
fixed this pass: would need new state to track "this spin is step N of an
in-progress multi-step action," plus GM-facing UI to declare step counts.

## Conflict between players' characters

**🔷 Gap.** The rulebook's escalating pull-off procedure (aggressor pulls
and declares intent → target accepts or pulls to defend → repeat until
someone declines or the tower falls) isn't modeled at all. Every spin in the
app is a single player vs. the wheel; there's no second-party
accept/defend/escalate flow. Not fixed this pass: would need new PeerJS
message types and turn-based UI, a nontrivial feature addition explicitly
out of scope for a "safe fix."

## Mismatched opponents (variable pull counts)

**🔷 Gap.** "If one character clearly has an advantage... his or her player
may be required to make fewer pulls" (aggressor still needs at least one).
The app has no situational weighting of a spin's difficulty or count —
every spin draws from the same shared wheel regardless of context. Not
fixed this pass: would need a way for the host to attach a modifier to an
individual spin.

## Initial pre-pull scaled to player count

**🔷 Gap.** "Stack the tower and pre-pull 3 blocks for every player you
have less than 5" — a game with fewer than 5 players should start harder.
`PeerProvider.createGame` (`src/providers/PeerProvider.jsx`) always starts a
new game with `Array(numWedgesArg).fill("success")` regardless of player
count (the host sets `numWedges` manually, unrelated to who's actually
joined). Not fixed this pass: would need to either delay initial wheel setup
until players have joined, or retroactively apply pre-pulls as the lobby
fills — a real behavior change to game start, not a one-line fix.

## Questionnaires: unique per character vs. one shared list

**🔷 Gap — the largest one.** "The host creates a unique character
questionnaire for each of the players' characters." The "Beneath a Metal
Sky" example proves this in practice: 6 characters, 6 completely distinct
~11-question sheets built around each character's specific role and secrets
(see [`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md)).

The app has exactly one shared questionnaire for the whole game:
`DEFAULT_QUESTIONS` (`src/constants/questions.js:1`), editable only as one
set by the GM via `QuestionEditor`
(`src/components/character-sheet/QuestionEditor.jsx`), applied to every
player identically (`src/components/CharacterSheet.jsx:35`, `:77`, `:123`).
There is no per-player question data model at all — `questions` is a single
array in `PeerProvider`/`PeerContext`, not a map keyed by player.

Not fixed this pass — this is a real data-model and UI change (`questions`
would need to become `{ [playerName]: Question[] }`, plus new GM UI to
author/edit one questionnaire per joined player, plus migration of the
"send default questions to a new joiner" flow in `PeerProvider.jsx`). Flagged
for a product decision: is per-character uniqueness worth the added GM
setup burden for this app's use case, or is one shared questionnaire an
acceptable, deliberate simplification (similar to the wheel-for-tower
swap)? Worth an explicit call rather than a silent implementation.

## Question count guidance ("a baker's dozen")

**✅ Matches, loosely.** `DEFAULT_QUESTIONS` has 10 questions
(`src/constants/questions.js`) — in the range the rules describe as
reasonable (the rulebook's own suggestion is "a good number to start with,"
not a hard rule; the real example scenario's 6 sample questionnaires
average ~11). Not a gap.

## Host approval of questionnaire answers

**🔷 Gap** (minor). "The host has to approve any answer a player puts on a
questionnaire." The app has no approval/review step — a player's answers in
`MyCharacterSheet.jsx` sync directly to everyone the instant they're typed
(`handleAnswerChange` in `src/components/CharacterSheet.jsx`) with no GM
gate. Not fixed this pass: minor scope, would need an approval/flag state
per answer.

## Scenario structure vs. GM-craft advice

**🟡 Intentional simplification** — scenario formatting isn't a _rule_
(it's GM-authoring advice), so there's nothing to "match" strictly. See
[`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md) for how
the app's `Scenario` fields (`title`/`description`/`setting`/`characters`/
`goals`/`threats`/`rules` in `src/components/Scenario.jsx`) compare to a
real published scenario's structure (Premise/Deception/Acts/beats) — a
reasonable subset, missing act-by-act beats and explicit "pull here"
call-outs, which is fine since that level of detail is host improvisation
either way.

## Summary

| Area                                 | Verdict                                            |
| ------------------------------------ | -------------------------------------------------- |
| GM/host model                        | ✅                                                 |
| Tower → wheel                        | 🟡 by design                                       |
| Escalating danger after a collapse   | 🔧 fixed this pass                                 |
| Decline-a-pull vs. collapse severity | 🔷 gap                                             |
| "Ways to remove a character" flavor  | 🔷 gap (cosmetic)                                  |
| Elective pulls                       | ✅                                                 |
| Multi-pull complex tasks             | 🔷 gap                                             |
| Conflict between characters          | 🔷 gap                                             |
| Mismatched opponents                 | 🔷 gap                                             |
| Initial pre-pull by player count     | 🔷 gap                                             |
| Unique per-character questionnaires  | 🔷 **gap — biggest one, needs a product decision** |
| Question count                       | ✅                                                 |
| Host approval of answers             | 🔷 gap (minor)                                     |
| Scenario structure                   | 🟡 by design                                       |
