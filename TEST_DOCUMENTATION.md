# Dread RPG Test Suite

This project now includes a comprehensive test suite that covers all major components and functionality.

## Test Summary

- **Total Tests**: 105 passing, 4 skipped
- **Test Files**: 15 files
- **Coverage**: All components, providers, helpers, and integration scenarios

## Test Structure

### Helper Functions (`src/test/helpers.test.js`)

- Tests the core wheel state management logic
- Validates success-to-death conversion
- Tests wheel reset after death
- Edge cases for empty and single-wedge wheels

### Providers

#### PeerProvider (`src/test/PeerProvider.test.jsx`)

- Initial state validation
- State setter functionality
- Game creation and GM state management
- Game joining and player state management
- Default question handling

#### WheelProvider (`src/test/WheelProvider.test.jsx`)

- Initial wheel state
- Spin mechanics for GM
- Spin end handling and state updates
- Death result handling
- Wheel state synchronization
- Non-GM `handleSpinEnd` is a no-op (only the GM resolves a spin outcome -
  see the extracted modules below for the message-handling side of this)

### Extracted provider modules

`PeerProvider.jsx` and `WheelProvider.jsx` delegate their connection-lifecycle
and network-message-handling logic to smaller modules under
`src/providers/peer/` and `src/providers/wheel/`, each covered independently
so the logic is testable without mounting the whole provider tree:

#### Connection manager (`src/test/connectionManager.test.js`)

- GM side: broadcasting to registered connections, replacing a stale
  connection for a reconnecting peerId instead of duplicating it, pruning a
  connection on close, excluding a peerId from a broadcast, ping/pong
  heartbeat handling
- Player side: dialing the GM on peer open, ping/pong heartbeat handling,
  reconnect-with-backoff after a drop (including giving up after exhausting
  the configured retry attempts)

#### Game snapshot (`src/test/gameSnapshot.test.js`)

- `buildGameSnapshot` reflects current state for the given message type
- `dispatchToRegisteredHandlers` fans a message out to the right registered
  handler(s) by message type

#### Wheel message handler (`src/test/wheelMessageHandler.test.js`)

- GM branch: forwards `spin-request` to `handleHostSpin`, ignores other types
- Player branch: `spin-start`/`spin`/`spin-final`/`wheel-reset`/
  `welcome`/`game-data-sync` each update the right local state, including
  result text coming from the GM's broadcast rather than being computed
  locally

#### Wheel persistence (`src/test/wheelPersistence.test.js`)

- Round-trips GM danger-state through localStorage, keyed by gameId
- Returns `null` (not a throw) when nothing is saved or the stored value is
  corrupted

### Components

#### App Component (`src/test/App.test.jsx`)

- Component rendering without crashes
- Provider context setup
- PIXI integration
- Nested provider structure

#### PreGame Component (`src/test/PreGame.test.jsx`)

- Initial state with create/join buttons
- Form validation for both create and join modes
- Input handling (including number inputs)
- URL parameter handling for auto-join
- Game creation workflow
- Tab navigation functionality

#### GameLoaded Component (`src/test/GameLoaded.test.jsx`)

- Main game interface rendering
- Tab switching between Game, Scenario, and Characters
- PIXI application rendering
- Spin button functionality
- Active tab styling
- Non-GM refetch request handling

#### Chat Component (`src/test/Chat.test.jsx`)

- Renders heading, connected-users list, and message input
- Clears input after sending; ignores empty messages
- Enter-to-send
- GM's own message is echoed into the list immediately

#### Scenario Component (`src/test/Scenario.test.jsx`)

- Player placeholder view when no scenario exists
- GM-only "Setup Scenario" entry point and full editor form
- Saving a scenario renders it in the read view
- Cancel discards edits without saving

#### CharacterSheet Component (`src/test/CharacterSheet.test.jsx`)

- Player's own sheet renders using the default (or GM-set) questions
- Player can type answers
- Other players' sheets stay hidden until the GM allows viewing
- GM controls: question editor (add/remove/save questions), sheet-visibility
  toggle, and the player-sheet selector
- Exercises the split `character-sheet/` subcomponents together as one unit

#### WheelGraphics Component (`src/test/WheelGraphics.test.jsx`)

- Registers a tick callback via `@pixi/react`'s `useTick` (mocked, since
  `pixiGraphics` elements require the real `@pixi/react` reconciler to render)
- No-ops on tick while not spinning
- Animates `spinAngle` toward the target while spinning
- Finishes a spin at the configured duration: sets the final angle, stops
  spinning, and reports a result via `onSpinEnd`

### Integration Tests (`src/test/integration.test.jsx`)

- Basic rendering tests
- URL parameter handling
- Component integration verification
- _Note: Complex async workflow tests are skipped to avoid flaky test behavior_

## Test Configuration

### Setup (`src/test/setup.js`)

- Mock PeerJS for testing environment
- Mock browser APIs (navigator, performance, location)
- Mock PIXI components
- Test environment configuration

### Vitest Configuration (`vitest.config.js`)

- React plugin integration
- JSDOM environment
- Global test utilities
- CSS support

## Running Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Mock Strategy

The test suite uses comprehensive mocking to isolate components:

1. **PeerJS**: Mocked to avoid network dependencies
2. **PIXI.js**: Mocked to avoid WebGL/Canvas requirements
3. **Browser APIs**: Mocked for clipboard, location, performance
4. **Child Components**: Mocked for focused unit testing

## Best Practices Implemented

1. **Isolation**: Each test is independent and doesn't affect others
2. **Mocking**: External dependencies are properly mocked
3. **User Events**: Tests use realistic user interactions
4. **Async Handling**: Proper handling of async operations with userEvent
5. **Error Boundaries**: Tests handle both success and error cases
6. **Performance**: Fast test execution with minimal external dependencies

## E2E tests (`e2e/`, Playwright)

Separate from the Vitest suite above, `e2e/` holds real-browser tests that
exercise the actual PeerJS client and its public cloud signaling server - the
Vitest suite mocks PeerJS entirely, so connection handshakes, reconnect
timing, and real WebRTC data-channel delivery aren't covered there at all.
Run via `npm run test:e2e` (Playwright's `webServer` config builds the app
and serves it with `vite preview`, deliberately not the dev server - React's
`<StrictMode>` double-invokes mount effects in dev only, which can defeat
one-shot "fire once on mount" patterns in ways that never happen for real
users hitting the production build). Wired into CI as its own `e2e` job,
kept independent of the `deploy` job since it depends on reaching an
external service.

- `e2e/helpers.js` - shared `createGameAsGM`/`joinGameAsPlayer`/
  `waitForGameLoaded`/`sendChat` helpers used by both spec files below.
- `e2e/p2p-hardening.spec.js` - GM-authoritative spin resolution over a real
  connection; reconnect-with-backoff and broadcast dedup after a real
  network drop; resync after being backgrounded and offline at once.
- `e2e/full-gameplay.spec.js` - scenario/character-sheet/chat sync between
  GM and player; user-list and chat/spin consistency across a GM plus two
  simultaneous players; a forced death spin (tower size 1) freezing the
  wheel until the GM re-stacks.

This suite has already caught two real bugs that the mocked unit suite
couldn't: `GameLoaded.jsx`'s mount-time refetch effect using a `useState`
guard that was also its own dependency, so the effect's own state update
re-triggered it and its cleanup cancelled the just-scheduled timer before it
ever fired (fixed with a `useRef` guard instead, set only once the timeout
actually completes - see the comment on `sentRefetchRef` there); and
`Scenario`/`CharacterSheet`/`Chat` being unmounted whenever their tab wasn't
active, silently dropping any live broadcast that arrived while a player was
looking at a different tab (fixed by keeping all three panels mounted and
toggling CSS visibility instead of conditional rendering).

## Future Enhancements

- Add visual regression tests for PIXI components
- Add performance benchmarking
- Increase test coverage for edge cases
- Add accessibility testing

The test suite provides solid coverage of the application's core functionality while being maintainable and fast to execute.
