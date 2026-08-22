# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repo.

## Project overview

Dread RPG is a digital implementation of the _Dread_ tabletop horror RPG, which
normally uses a Jenga tower to resolve risky actions. This app replaces the
tower with a spinning wheel. It's a **client-only React SPA** — there is no
backend server. Multiplayer (one GM + N players) works over direct WebRTC
connections via PeerJS, and the whole thing is deployed as a static site to
**GitHub Pages** at the `/dreadrpg/` subpath (see `base` in `vite.config.js`).

**Before changing any game-mechanic code** (the wheel, spins, character
removal, questionnaires) — check [`docs/rules/`](./docs/rules/) first. It has
the actual published Dread rules paraphrased for reference, an example
scenario/questionnaire set, and a living compliance doc
(`docs/rules/dreadrpg-app-compliance.md`) mapping this app's code to those
rules. Don't change wheel/questionnaire behavior based on assumptions about
"how Dread works" — verify against that folder.

## Tech stack

- **React 19**, functional components + hooks only, no class components.
- **Vite 7** for dev/build (`vite.config.js` sets `base: "/dreadrpg/"` — required for GH Pages subpath hosting, don't remove it).
- **State management**: React Context only (`PeerContext`, `WheelContext`) — no Redux/Zustand.
- **PixiJS 8 + @pixi/react** for the canvas-rendered spinning wheel (`WheelGraphics.jsx`).
- **PeerJS** for WebRTC P2P networking — no server component at all.
- **Vitest 3 + React Testing Library + happy-dom** for tests.
- **ESLint 9** flat config (`eslint.config.js`) + **Prettier** (`.prettierrc.json`) for formatting. No TypeScript (the `@types/react*` deps are present but unused; there's no `tsconfig.json`).

## Commands

```bash
npm run dev             # dev server
npm run build           # production build to dist/
npm run lint             # eslint .
npm run format            # prettier --write .
npm run format:check      # prettier --check .
npm run test              # vitest, watch mode
npm run test:run          # vitest, single run
npm run test:ci           # vitest with vitest.ci.config.js — what CI actually runs
npm run test:coverage     # vitest with coverage
npm run deploy             # manual publish: builds then `gh-pages -d dist`
```

**If `npm` fails with something like `UNC paths are not supported` or a
`Cannot find module '...install.js'` error**, the `npm` on `PATH` in this
environment resolves to a mismatched Windows binary (WSL picking up
`/mnt/c/Program Files/nodejs/npm` against a Linux `node`). Use
`corepack npm <...>` instead of `npm <...>` for every command above — the
Linux-native `corepack` shim (`/usr/bin/corepack`) resolves npm correctly.
This is an environment quirk, not a project requirement — don't "fix" it by
changing the scripts themselves. If a command fails with `Failed to resolve
entry for package "pixi.js"`, the local `node_modules/pixi.js` install is
missing its `lib/index.mjs` build output — repair it with
`corepack npm install pixi.js@<version-from-package.json> --no-save` rather
than editing any source.

CI (`.github/workflows/test-and-deploy.yml`) runs `lint` → `test:ci` → `build`
on every push/PR (Node 20), then auto-deploys `main` to GitHub Pages via the
official `actions/deploy-pages` action if all of that passes. **Keep lint and
tests green** — there's no separate manual-deploy-only path that skips them
for `main`. Manual `npm run deploy` is a secondary/fallback path and normally
unnecessary.

## Architecture

```
main.jsx
  → App.jsx
      → PeerProvider            (all P2P connection + shared game state)
          → WheelProviderWrapper → WheelProvider  (spin/wheel state, needs conn+isGM from PeerProvider)
              → AppInner: PreGame (lobby: create/join)  or  GameLoaded (once showWheel is true)
                            GameLoaded tabs: Game (WheelGraphics + Chat) | Scenario | CharacterSheet
```

- `src/providers/PeerProvider.jsx` owns almost all cross-cutting state: game id,
  own `peerId`, users, connection, scenario, character sheets, questions,
  wheel size, etc., and exposes it via `PeerContext` (consumed through
  `usePeer()`).
- `src/providers/WheelProvider.jsx` owns spin-in-progress state and exposes
  it via `useWheel()`. It also tracks a local `charactersRemoved` count and
  passes it to `getNewWheelStateOnSpin` (`src/helpers/index.js`) on every
  "death" spin, so each wheel reset pre-sets more `death` wedges than the
  last (`3 * charactersRemoved`, capped at wheel size) — this mirrors
  Dread's rule that a re-stacked tower is always pre-pulled further than
  before, never resets to the easiest state. See `docs/rules/`.
- Components that care about specific inbound network messages **register a
  handler** with `PeerProvider` (`registerWheelEventHandler`,
  `registerChatEventHandler`, `registerScenarioEventHandler`,
  `registerCharacterSheetEventHandler`) rather than reading raw connection data
  themselves. If you add a new kind of syncable state, follow this pattern:
  add a ref + register function in `PeerProvider`, and route both the GM's and
  player's inbound data handlers through `dispatchToRegisteredHandlers` (the
  single shared forwarding function both paths already call).
- `src/components/CharacterSheet.jsx` is a container: it owns all
  question/sheet state and network sync, and composes four presentational
  children from `src/components/character-sheet/` (`QuestionEditor`,
  `PlayerSheetSelector`, `MyCharacterSheet`, `OtherPlayersSheets`). Keep new
  GM/player sheet UI in that folder rather than growing the container file.
- `src/App.css` is just an `@import` aggregator; the actual rules live in
  `src/styles/*.css`, split by concern (base, buttons, tabs, pregame,
  scenario, character-sheet, chat). Add new global styles to the matching
  file there, not to `App.css` directly.

### PeerJS message protocol

GM is the hub: the GM's `Peer` accepts connections from every player; players
each hold a single connection back to the GM. Players never talk to each
other directly. Message `type` values currently in use:

- `join` — player → GM on connect, carries `peerId` + `userName`.
- `welcome` — GM → new player, full game-state snapshot (users, wheel size/state, scenario, character sheets, questions, sheet-visibility flag).
- `user-list-update` — GM → all other players, after a new join.
- `refetch-request` — player → GM, ask for a fresh full snapshot (sent ~100ms after `GameLoaded` mounts on non-GM clients — see `GameLoaded.jsx`).
- `game-data-sync` — GM → player, response to `refetch-request` (same shape as `welcome`, built by the shared `buildGameSnapshot` helper in `PeerProvider.jsx`).
- wheel/chat/scenario/character-sheet event types — forwarded to whichever component registered a handler for them via `dispatchToRegisteredHandlers`.

`sendToPeers(msg)` in `PeerProvider` is the one send path: as GM it broadcasts
to every stored connection; as a player it sends to the GM only.

## Known issues / gotchas

- **CI pins Node 20**; Vite 7 / Vitest 3 want Node ≥20, so keep the workflow's
  `node-version` at or above that if you touch it.
- No TypeScript — don't introduce `.ts`/`.tsx` files without discussing it
  first, the toolchain isn't set up for a mixed migration.
- `WheelGraphics` receives `conn`, `isGM`, and `peerId` props from
  `GameLoaded` but doesn't currently use any of them internally — harmless,
  but don't assume they're wired to anything inside that component.

## Conventions

- Functional components + hooks + Context; no class components, no external state library.
- Shared constants (e.g. `DEFAULT_QUESTIONS`) live in `src/constants/` — don't
  redeclare them locally in a component.
- ESLint flat config customizes only one rule: `no-unused-vars` ignores
  identifiers matching `^[A-Z_]`. Otherwise it's `js.configs.recommended` +
  `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. Prettier
  handles formatting (`npm run format`) — don't hand-format to a different style.
- Avoid `console.log` in shipped provider/component code; it was previously
  stripped from `PeerProvider.jsx` and `CharacterSheet.jsx` as debug noise —
  don't reintroduce blanket payload logging there.

## Testing

Real, working Vitest + Testing Library suite in `src/test/` — see
`TEST_DOCUMENTATION.md` for a per-file breakdown and the mocking strategy.
`src/test/setup.js` mocks PeerJS and several browser APIs (TextEncoder,
URLSearchParams, URL) — reuse those mocks rather than writing new ones per
test file. Every component (including `Chat`, `Scenario`, `CharacterSheet`,
`WheelGraphics`) has a dedicated test file; follow the existing patterns
there (render inside `<PeerProvider>`, flip `isGM`/`userName` via a tiny
wrapper component that calls the context setter in a `useEffect`, as seen in
`CharacterSheet.test.jsx` and `Scenario.test.jsx`) when adding more.

`WheelGraphics.test.jsx` mocks `@pixi/react`'s `useTick` to capture and
manually invoke the tick callback — `WheelGraphics` renders raw
`<pixiGraphics>` elements that only work inside `@pixi/react`'s own
reconciler (via `<Application>`), so don't try to assert on their rendered
DOM output; assert on the state-setter/callback props instead, the way that
file does.

`TEST_DOCUMENTATION.md` also lists further future testing ideas (Playwright
E2E, visual regression, perf benchmarking) — check there before proposing new
test infrastructure.
