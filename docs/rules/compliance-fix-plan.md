# Compliance fix plan

This is the working plan for closing the remaining 🔷 gaps in
[`dreadrpg-app-compliance.md`](./dreadrpg-app-compliance.md), plus a set of
related product features (characters as first-class entities, a GM admin
panel, per-game theming, full game persistence, rejoin flows) that share
the same foundation as those gaps. Each item below is implemented and
reviewed one at a time, in order — later items build on data/UI introduced
by earlier ones. As each item lands, `dreadrpg-app-compliance.md`'s
relevant row(s) and summary table are updated to match (🔷 → 🔧, or 🔷 → 🟡
for the two items reclassified as by-design rather than implemented).

## Decisions

- **Per-character questionnaires**: implement, as part of a new Character
  entity (not just a `characterName` string).
- **PvP conflict / mismatched opponents**: not a separate feature —
  reclassified 🔷→🟡. Everyone always pulls from the same shared tower by
  design; a conflict between characters is something the GM
  narrates/adjudicates using the same designate-a-spinner + pulls-required
  mechanism (items 7–8) as any other risky action.
- **Decline vs. collapse severity**: GM designates who spins next; only
  that player sees the Spin button; a Decline button is added; spins/
  declines are logged to chat; the death message names the character, not
  "You Died!".
- **Pre-pull scaling**: computed from the actual number of joined players
  at an explicit game-start moment, not a GM-entered guess.
- **State management**: stays React Context per `CLAUDE.md` — new
  Character/Theme concerns get their own contexts rather than growing
  `PeerContext` further or introducing Zustand/Redux.
- **Player identity**: `userName`s must be unique among currently-connected
  players (enforced at join time); a name belonging to a since-disconnected
  player remains reclaimable by the same player reconnecting.

## Key existing-code facts this plan relies on

- `gameId` is used directly as the PeerJS peer ID
  (`new Peer(normalizedId(gameId))` in `src/providers/peer/
  connectionManager.js`), so recreating a game with the same `gameId`
  reproduces the same pairing code.
- **There is no lobby/waiting stage today.** `WheelProvider.jsx` sets
  `showWheel = true` the instant `conn` becomes truthy, and for the GM,
  `conn` is only set once the *first* player connects. The moment one
  player joins, everyone is thrown straight into `GameLoaded` — no
  "wait for more players, then GM clicks Start" step exists, and no
  player-side waiting-room UI exists at all.
- `Scenario.jsx`'s existing `characters` field is free-text prose (scenario
  NPCs/characters description for GM authoring) — unrelated to the new
  structured Character entity this plan introduces.
- `src/providers/wheel/wheelPersistence.js` is the existing localStorage
  precedent (key prefix `dread-rpg-wheel-state-{gameId}`, try/catch
  guarded) — new persistence work follows this pattern.
- `PreGame.jsx` already reads `?gameId=` from the URL to prefill the join
  form, and has a `getShareUrl()` helper — the per-player rejoin link
  extends this rather than inventing new mechanics.
- `characterSheets`/`questions` are keyed by `userName`, not peerId. This
  plan fixes the duplicate-name half of that fragility (unique
  currently-connected names); renaming a player's own display name mid-game
  stays out of scope.

## Work items

0. **This doc.**
1. **Explicit lobby → Start Game transition** — replace the implicit
   "first connection flips `showWheel`" behavior with a GM-triggered
   `startGame()` action broadcasting `GAME_STARTED`; late joiners skip
   straight to `GameLoaded` via a `gameStarted` snapshot flag.
2. **Character entity + GM authoring** — `characters` map
   (`{ id, name, defaultName, assignedTo, questions }`) replaces the single
   shared `questions` array; GM can create, clone, rename, delete
   characters and edit each one's questionnaire independently.
3. **Player lobby: character picker + working chat** — a `PlayerLobby`
   component for joined-but-not-started players to chat and claim an
   unassigned character.
4. **Unique connected userNames; rejoin reclaims character; chat identity**
   — join rejects a `userName` already in active use; a reconnecting
   player with a previously-assigned character gets it back automatically;
   chat messages show `userName <CharacterName>` when assigned.
5. **Game/campaign name + GM Admin Panel** — GM names the campaign at
   creation (`gameName`, distinct from the `gameId` pairing code) and can
   rename it later; a consolidated Admin Panel holds the rename control,
   tower size (now editable, not creation-only), the character roster, the
   theme picker (item 6), and Start Game.
6. **Per-game UI theming** — CSS custom properties for the main themable
   surfaces; SciFi/Slasher/Halloween/Custom presets; GM picks per-game from
   the Admin Panel, broadcast and applied via `data-theme` + custom color
   overrides.
7. **Designated spinner, Decline, chat-logged spins, named death message**
   — GM assigns who spins next; that player gets Spin + Decline; every
   spin/decline is logged to chat; death message names the character.
   Documents the resulting ✅→trade-off change to "Elective pulls."
8. **Multi-pull complex/difficult actions** — GM can require several pulls
   for one declared action, tracked as a pulls-remaining countdown on top
   of item 7's assignment mechanism.
9. **Host approval of questionnaire answers** — answers carry an
   `approved` flag; other players only see approved answers; GM approves
   per-answer.
10. **Pre-pull scaled to actual joined players + GM-editable death flavor
    text** — `startGame()` seeds extra virtual pulls from
    `3 * max(0, 5 - joinedPlayerCount)`; GM can customize the death
    narration text shown instead of a hardcoded string.
11. **Full game persistence + homepage game list** — GM-side full game
    snapshot persisted to localStorage; a homepage list of the GM's own
    games (by campaign name) with Resume/Delete.
12. **Per-player shareable rejoin link** — extends the existing `?gameId=`
    URL convention with `&userName=` so a player's own link logs them back
    in without retyping anything.

## Verification

- `corepack npm run lint` and `corepack npm run test:run` after every item.
- Manual two-tab (GM + player) walkthrough of each network-protocol item's
  flow via `corepack npm run dev`.
- End-to-end run-through after the last item: create a named campaign, 3
  players join and pick characters in the lobby with chat working
  throughout, GM sets a theme and tower size from the Admin Panel, GM
  starts the game (confirm the harder starting curve vs. a 5+-player game),
  play a full designate → spin/decline → multi-pull → death cycle (chat
  log + named death message), refresh the GM tab and resume from the
  homepage list with all state intact, and confirm a player's rejoin link
  logs them back in as the same character.
