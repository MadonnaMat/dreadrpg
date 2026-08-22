# dreadrpg app vs. the real Dread rules — compliance audit

This is the living answer to "does this app's code still match the real
Dread rules?" Re-run this comparison (don't just trust it blindly — code
drifts) whenever you touch `WheelProvider.jsx`, `helpers/index.js`,
`WheelGraphics.jsx`, `CharacterSheet.jsx`, or `Scenario.jsx`. Rule citations
are paraphrased from [`quick-reference.md`](./quick-reference.md); example
citations are from [`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md).

Verdict legend: ✅ Matches · 🟡 Intentional simplification (by design, not a bug) · 🔧 Fixed this pass · 🔷 Gap — needs a product decision

See [`compliance-fix-plan.md`](./compliance-fix-plan.md) for the ordered,
in-progress plan closing out the remaining 🔷 items below (plus related
character/admin/persistence features built on the same foundation).

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

**🔧 Fixed this pass (twice now).** The rule: "re-stack it and pre-pull, as
at the start, but with three additional blocks for every character removed
from the game" — escalation is cumulative and never decreases.

Originally, `getNewWheelStateOnSpin` reset the _entire_ wheel back to
all-`success` every time a `death` wedge was hit — every re-stack was
exactly as easy as the very first one, contradicting the rule. A first fix
made danger scale with `charactersRemoved` but did so as a flat, linear
count of pre-marked wedges — every safe spin converted exactly one more
wedge to `death`, a hazard curve that rose by a constant amount every pull.
That's nothing like a real Jenga tower, which stays comfortably stable
through most of its pulls and then gets sharply, suddenly dangerous near the
end; the rules themselves never quantify a numeric pull-by-pull curve, only
the cross-collapse "+3 blocks per removed character" escalation, so the
within-a-life hazard _shape_ was a legitimate design gap to close.

Now: collapse probability is computed directly by a logistic (S-curve)
hazard function, `computeDangerProbability(pullsSinceReset, charactersRemoved,
towerSize)` (`src/helpers/index.js`) — flat and low for an early "safe"
stretch of pulls, then a sharp rise toward near-certain collapse.
`WheelProvider.jsx` tracks a local `pullsSinceReset` counter (successful
spins since the tower was last stacked) and the existing cumulative
`charactersRemoved` count; `charactersRemoved` folds into the same curve as
`BLOCKS_PER_REMOVED_CHARACTER * charactersRemoved` extra "virtual" pulls —
mirroring the "+3 blocks per removed character" rule the same way the old
implementation did, just applied to a continuous curve instead of a discrete
wedge count, and still with no rule-mandated block count to match against
(scaling relative to the GM-configured `towerSize` remains the closest
equivalent). The wheel itself renders as a "pinwheel" of alternating
success/death wedges (`getWheelWedges`) whose angular size is proportional
to that probability, so danger is visibly continuous rather than jumping by
a fixed count. After a collapse the wheel freezes (`awaitingReset`) instead
of auto-resetting, until the GM clicks "Re-stack Tower" — giving the table a
beat to narrate the character's removal, closer to the rule's own two-step
"tower falls, then re-stack" sequencing than an instant auto-reset. Verified
in `src/test/helpers.test.js` (monotonicity, the `charactersRemoved` offset
behaving as extra virtual pulls, and the curve never reaching a hard 0 or 1)
and `src/test/WheelProvider.test.jsx` (the death → `awaitingReset` → GM
re-stack round trip).

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

**🔧 Fixed this pass.** "The host creates a unique character questionnaire
for each of the players' characters." The "Beneath a Metal Sky" example
proves this in practice: 6 characters, 6 completely distinct ~11-question
sheets built around each character's specific role and secrets (see
[`example-scenario-metal-sky.md`](./example-scenario-metal-sky.md)).

`questions`/`characterSheets` used to be one shared array + a map keyed by
player name, applied identically to everyone. Characters are now first-class
entities (`characters: { [characterId]: { id, name, defaultName, assignedTo,
questions, answers } }` in `src/providers/peer/useGameState.js`) that the GM
creates, clones, renames, and deletes independently via a roster
(`src/components/character-sheet/CharacterRoster.jsx`), each with its own
questionnaire edited through the same `QuestionEditor`
(`src/components/character-sheet/QuestionEditor.jsx`) scoped to one
character at a time (`src/components/CharacterSheet.jsx`). See
`docs/rules/compliance-fix-plan.md` item 2. Not yet wired up: a UI for a
player to actually claim one of these characters (that's plan item 3, next)
— until then `assignedTo` only ever gets set by direct state manipulation
(exercised in tests), not by an in-app flow.

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
| Unique per-character questionnaires  | 🔧 fixed this pass                                 |
| Question count                       | ✅                                                 |
| Host approval of answers             | 🔷 gap (minor)                                     |
| Scenario structure                   | 🟡 by design                                       |
