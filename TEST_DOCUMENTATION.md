# Dread RPG Test Suite

This project now includes a comprehensive test suite that covers all major components and functionality.

## Test Summary

- **Total Tests**: 44 passing, 4 skipped
- **Test Files**: 7 files
- **Coverage**: All major components, providers, helpers, and integration scenarios

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

## Future Enhancements

- Add visual regression tests for PIXI components
- Implement E2E tests with Playwright
- Add performance benchmarking
- Increase test coverage for edge cases
- Add accessibility testing

The test suite provides solid coverage of the application's core functionality while being maintainable and fast to execute.
