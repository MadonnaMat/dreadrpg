# Dread RPG

[![Test and Deploy](https://github.com/MadonnaMat/dreadrpg/actions/workflows/test-and-deploy.yml/badge.svg)](https://github.com/MadonnaMat/dreadrpg/actions/workflows/test-and-deploy.yml)

A digital implementation of the Dread RPG system, replacing the traditional Jenga tower with a spinning wheel mechanic. Built with React and PIXI.js for real-time multiplayer horror gaming.

## Features

- **Multiplayer Support**: Host and join games using PeerJS for real-time communication
- **Digital Wheel**: PIXI.js-powered spinning wheel that simulates the tension of pulling Jenga blocks
- **Character Sheets**: Create and manage character sheets with customizable questions
- **Scenario Management**: Set up and share scenarios between players
- **Chat System**: In-game chat for player communication
- **Progressive Tension**: Wheel wedges turn to "death" as players make actions, building suspense

## Development

### Prerequisites

- Node.js 18 or higher
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
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## Testing

The project includes a comprehensive test suite with 44+ tests covering:

- Component rendering and interactions
- State management (PeerProvider, WheelProvider)
- Game mechanics and wheel logic
- User interface workflows
- Integration scenarios

See [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md) for detailed testing information.

## Deployment

### Automatic Deployment

The project uses GitHub Actions for continuous integration and deployment:

1. **On every push/PR**: Runs linting, tests, and builds the application
2. **On main branch**: Automatically deploys to GitHub Pages if all tests pass

The workflow is defined in [`.github/workflows/test-and-deploy.yml`](./.github/workflows/test-and-deploy.yml) and includes:

- ✅ Dependency installation
- ✅ Code linting with ESLint
- ✅ Full test suite execution
- ✅ Production build
- ✅ Automatic deployment to GitHub Pages

### Manual Deployment

```bash
# Deploy to GitHub Pages
npm run deploy
```

## Game Rules

**Dread** is a horror tabletop RPG that uses a Jenga tower instead of dice. In this digital version:

1. Players create characters using questionnaire-style character sheets
2. When attempting risky actions, players spin the wheel
3. Landing on "success" wedges allows the action to succeed
4. Landing on "death" wedges means something terrible happens to your character
5. As the game progresses, success wedges turn into death wedges, increasing tension

Learn more about Dread at the [official website](https://www.tiltingatwindmills.net/games/dread/).

## Technology Stack

- **Frontend**: React 19, Vite
- **Graphics**: PIXI.js for the spinning wheel
- **Networking**: PeerJS for peer-to-peer multiplayer
- **Testing**: Vitest, React Testing Library
- **Deployment**: GitHub Pages with GitHub Actions CI/CD

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the test suite (`npm run test:run`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

The CI/CD pipeline will automatically run tests and provide feedback on your PR.
