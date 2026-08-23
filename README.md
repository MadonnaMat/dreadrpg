# Dread RPG

[![Test and Deploy](https://github.com/MadonnaMat/dreadrpg/actions/workflows/test-and-deploy.yml/badge.svg)](https://github.com/MadonnaMat/dreadrpg/actions/workflows/test-and-deploy.yml)

A digital implementation of the Dread RPG system, replacing the traditional Jenga tower with a spinning wheel mechanic. It's a **client-only React SPA** — there is no backend server; a GM (host) and any number of players connect directly over peer-to-peer WebRTC via PeerJS, and the whole thing is deployed as a static site to GitHub Pages.

## Features

### Core gameplay

- **Multiplayer over WebRTC**: host or join a game with PeerJS, no server or account required. The GM is the connection hub; players connect directly to the GM.
- **Digital wheel**: a PIXI.js-powered spinning wheel stands in for the Jenga tower. Danger grows along a logistic (S-curve) hazard function as pulls accumulate, then escalates further — and never resets to "easy" — every time a character is removed, mirroring Dread's "+3 blocks per removed character" re-stacking rule.
- **GM-designated pulls**: the GM assigns who spins next (optionally requiring several pulls for one complex action); that player can spin or decline. Every spin, decline, and result is narrated in chat.
- **Characters as first-class entities**: the GM builds a roster of characters, each with its own questionnaire (not one shared set of questions for the whole table). Players claim an unassigned character from the lobby or mid-game and fill out their sheet; the GM approves each answer before other players can see it.
- **Scenario tab**: the GM writes and shares the scenario (premise, setting, characters, goals, threats, house rules) with the table.
- **In-game chat**, visible from the lobby (before the game starts) and throughout play.
- **GM Admin Panel**: rename the campaign, resize the tower, customize the death-narration flavor text, pick a UI theme (Default/Sci-Fi/Slasher/Halloween/Cosmic Horror/Gothic, or fully custom colors), check player presence/reconnect status, and start the game.
- **Persistence and rejoin**: the GM's full game state is saved to `localStorage` and resumable from a "Your Games" list after closing the tab; players get a personal shareable rejoin link that prefills their name so reconnecting is a single click.

### AI features (all opt-in, all on-device)

- **AI assistant**: an optional, locally-run LLM (via [WebLLM](https://github.com/mlc-ai/web-llm)/WebGPU, sized to a small/medium/large model tier based on your device) that can help draft a scenario, generate a starting cast, and suggest questionnaire answers. Nothing downloads until you opt in, and everything it drafts is a suggestion you review before saving. Requires a WebGPU-capable browser (recent Chrome/Edge).
- **AutoGM mode**: with the AI assistant enabled, the GM can hand the GM role itself to the AI. AutoGM narrates entirely through the existing chat, decides when a pull is warranted, restacks the tower after a collapse, and keeps a running, self-compacting story summary in `localStorage` — freeing the host to join the table as a player character instead. A live debug panel in the Admin Panel shows AutoGM's reasoning; it can be paused at any time without losing its story state.
- **Campaign Notes**: a GM-only prep space (freeform named sections of notes) that the AI assistant can help populate, and that AutoGM reads from and updates as the story progresses.

See [`docs/rules/`](./docs/rules/) for how these mechanics are checked against the actual published Dread rules, and [`docs/autogm-requirements.md`](./docs/autogm-requirements.md) for the AutoGM design record.

## Development

### Prerequisites

- Node.js 20 or higher
- npm

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview a production build locally
- `npm run lint` - Run ESLint
- `npm run format` - Format the codebase with Prettier
- `npm run format:check` - Check formatting without writing changes
- `npm run knip` - Check for unused files/exports/dependencies
- `npm run test` - Run the unit/component test suite in watch mode
- `npm run test:run` - Run the unit/component test suite once
- `npm run test:ci` - Run the unit/component test suite the way CI does
- `npm run test:coverage` - Run the unit/component test suite with a coverage report
- `npm run test:e2e` - Run the Playwright end-to-end suite against a real production build (real WebRTC connections, no mocks)

## Testing

The project has two separate test suites:

- **Unit/component suite** (Vitest + React Testing Library, `src/test/`): PeerJS and browser APIs are mocked, covering component rendering, provider/context state, the wheel danger-curve math, network message handling, AI/AutoGM logic, and persistence helpers. See [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md) for a per-file breakdown.
- **End-to-end suite** (Playwright, `e2e/`): drives real browsers against a real production build, making genuine WebRTC connections through PeerJS's public signaling server, to verify multi-client sync, reconnection, and full gameplay flows that mocks can't exercise.

## Deployment

### Automatic Deployment

The project uses GitHub Actions for continuous integration and deployment:

1. **On every push/PR**: lints, checks formatting, checks for unused code (`knip`), runs the unit/component suite, and builds the app. A separate job also runs the Playwright end-to-end suite (non-blocking, since it depends on reaching a public external signaling server).
2. **On `main`**: automatically deploys to GitHub Pages once the required checks pass.

The workflow is defined in [`.github/workflows/test-and-deploy.yml`](./.github/workflows/test-and-deploy.yml).

### Manual Deployment

```bash
# Deploy to GitHub Pages
npm run deploy
```

Manual deploy is a secondary/fallback path — normally unnecessary, since pushes to `main` deploy automatically.

## Game Rules

**Dread** is a horror tabletop RPG that uses a Jenga tower instead of dice — this app's spinning wheel is a deliberate digital stand-in for that tower. In this digital version:

1. The GM (a human, or optionally the AI in AutoGM mode) builds a scenario and a roster of characters, each with its own questionnaire.
2. Players join, claim a character, and answer that character's questionnaire; the GM approves each answer before it's visible to the rest of the table.
3. When a character attempts a risky action, the GM designates who spins next (or declines it).
4. Landing on a "success" wedge means the action succeeds; landing on a "death" wedge means the character is removed from the game.
5. As pulls accumulate, more of the wheel turns to "death," building tension - and after a removal, the wheel stays at least as dangerous as before once re-stacked, never resetting to "easy."

See [`docs/rules/`](./docs/rules/) for the source rules this app's mechanics are checked against, and [`docs/rules/dreadrpg-app-compliance.md`](./docs/rules/dreadrpg-app-compliance.md) for how closely they match.

Learn more about Dread at the [official website](https://www.tiltingatwindmills.net/games/dread/).

## Technology Stack

- **Frontend**: React 19, Vite 7
- **Graphics**: PIXI.js (via @pixi/react) for the spinning wheel
- **Networking**: PeerJS for peer-to-peer multiplayer over WebRTC
- **On-device AI**: WebLLM (WebGPU), for the opt-in AI assistant and AutoGM mode
- **Testing**: Vitest + React Testing Library (unit/component), Playwright (end-to-end)
- **Deployment**: GitHub Pages with GitHub Actions CI/CD

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the test suite (`npm run test:run`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

The CI/CD pipeline will automatically run linting, formatting, unused-code, and test checks and provide feedback on your PR.
