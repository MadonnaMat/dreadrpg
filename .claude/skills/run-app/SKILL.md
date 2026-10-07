---
name: run-app
description: Launch and drive the Dread RPG app to see a change actually working in a browser - dev/preview servers, creating a game as GM, joining as a second player for multiplayer paths, and what the Playwright e2e suite can and cannot cover. Use when asked to run, start, preview, or screenshot the app, or to confirm a change works for real rather than only in tests.
---

# Running the Dread RPG app

Client-only React SPA, no backend. Multiplayer is direct WebRTC via PeerJS,
so "the server" is only ever a static file server.

## Commands

Use `corepack npm <...>` rather than `npm <...>` if plain npm fails with
`UNC paths are not supported` or `Cannot find module '...install.js'` - see
CLAUDE.md, the `npm` on PATH can resolve to a mismatched Windows binary.

```bash
npm run dev                      # dev server, hot reload
npm run build && npm run preview # production build, closest to GH Pages
npm run test:e2e                 # Playwright (builds + previews on :4173 itself)
```

**The base path matters.** `vite.config.js` sets `base: "/dreadrpg/"` for
GitHub Pages, so the app is served at `/dreadrpg/`, not `/`. A bare
`localhost:5173` shows nothing useful - open `localhost:5173/dreadrpg/`.
Preview serves `localhost:4173/dreadrpg/`.

## Driving it by hand

1. Open the dev URL. You land in PreGame (the lobby).
2. **Create Game** makes you GM. The game id in the URL/lobby is what
   players join with.
3. To exercise anything multiplayer, open the join URL in a **second browser
   profile or an incognito window**, not just another tab - separate tabs
   share `localStorage`, which backs identity and per-game persistence, so
   two tabs can clobber each other's state. Join as a player with a
   different name.
4. The GM creates characters and starts the game; players pick a character.
   Once started, `GameLoaded` shows the Game / Scenario / Character Sheet
   tabs, with the wheel and chat under Game.
5. GM-only controls (themes, wheel size, death flavor text, AutoGM) live in
   the **Admin Panel**.

## Driving it with Playwright

`e2e/helpers.js` already wraps the whole setup path -
`createGameAsGM`, `joinGameAsPlayer`, `createCharacter`, `chooseCharacter`,
`startGame`, `waitForGameLoaded`, `assignSpinner`, `sendChat`. Reuse those
rather than re-deriving selectors; `e2e/full-gameplay.spec.js` is a worked
example of a complete two-browser session.

Playwright drives a real build with real WebRTC, which the Vitest suite
deliberately doesn't (`src/test/setup.js` mocks PeerJS outright). That makes
it the right tool for connection/lobby/sync regressions.

## What this can't show you

- **Anything AI/AutoGM.** Those features run a multi-gigabyte quantized
  model locally through WebLLM and need WebGPU; the e2e suite has no AutoGM
  coverage and realistically can't. Use the `verify-autogm` skill, which
  builds on this one, for that path.
- **Real GitHub Pages behavior** beyond the base path - deployment is CI's
  job (`.github/workflows/test-and-deploy.yml`).

## Before calling a UI change done

Tests check correctness, not whether the feature feels right. Actually use
the thing in a browser: walk the golden path, then at least one edge case
(a player disconnecting, a refresh mid-game, an empty list). If you can't
run a browser in the current environment, say so plainly rather than
implying it was verified.
