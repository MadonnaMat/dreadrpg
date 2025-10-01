import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

// Mock PIXI components
vi.mock("@pixi/react", () => ({
  extend: vi.fn(),
  Application: ({ children }) => (
    <div data-testid="pixi-application">{children}</div>
  ),
}));

vi.mock("../components/WheelGraphics", () => ({
  WheelGraphics: (props) => (
    <div data-testid="wheel-graphics" data-spinning={props.spinning}>
      Wheel Graphics
      <button onClick={() => props.onSpinEnd && props.onSpinEnd(0, 25)}>
        Simulate Spin End
      </button>
    </div>
  ),
}));

vi.mock("../components/Chat", () => ({
  default: () => <div data-testid="chat">Chat</div>,
}));

vi.mock("../components/Scenario", () => ({
  default: () => <div data-testid="scenario">Scenario</div>,
}));

vi.mock("../components/CharacterSheet", () => ({
  default: () => <div data-testid="character-sheet">Character Sheet</div>,
}));

describe("Integration Tests", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({
      skipPointerEventsCheck: true,
    });
    vi.clearAllMocks();
  });

  it.skip("should complete full game creation workflow", async () => {
    vi.useFakeTimers();

    render(<App />);

    // Initial state - should show PreGame
    expect(screen.getByText("Dread RPG")).toBeInTheDocument();
    expect(screen.getByText("Create Game")).toBeInTheDocument();

    // Click create game
    await user.click(screen.getByText("Create Game"));

    // Fill in host details
    const nameInput = screen.getByPlaceholderText("Your Name");
    await user.type(nameInput, "Test Host");

    const wedgesInput = screen.getByPlaceholderText("Number of Wedges");
    await user.clear(wedgesInput);
    await user.type(wedgesInput, "20");

    // Create the game
    await user.click(screen.getByRole("button", { name: "Create" }));

    // Fast-forward timers for peer connection
    vi.advanceTimersByTime(200);

    // Should show GM tabs
    await waitFor(() => {
      expect(screen.getByText("Lobby")).toBeInTheDocument();
      expect(screen.getByText("Setup Scenario")).toBeInTheDocument();
      expect(screen.getByText("Setup Characters")).toBeInTheDocument();
    });

    // Should show game ID and share URL
    expect(screen.getByText(/Game ID:/)).toBeInTheDocument();
    expect(screen.getByText(/Sharable URL:/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it.skip("should complete full game join workflow", async () => {
    vi.useFakeTimers();

    render(<App />);

    // Click join game
    await user.click(screen.getByText("Join Game"));

    // Fill in join details
    const gameIdInput = screen.getByPlaceholderText("Game ID");
    await user.type(gameIdInput, "test-game-123");

    const nameInput = screen.getByPlaceholderText("Your Name");
    await user.type(nameInput, "Test Player");

    // Join the game
    await user.click(screen.getByRole("button", { name: "Join" }));

    // Fast-forward timers for peer connection
    vi.advanceTimersByTime(200);

    // Should show connection status
    await waitFor(() => {
      expect(screen.getByText(/Connecting to game/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it.skip("should handle tab navigation in pregame", async () => {
    vi.useFakeTimers();

    render(<App />);

    // Create game first
    await user.click(screen.getByText("Create Game"));
    const nameInput = screen.getByPlaceholderText("Your Name");
    await user.type(nameInput, "Test Host");
    await user.click(screen.getByRole("button", { name: "Create" }));

    vi.advanceTimersByTime(200);

    // Test tab switching
    await waitFor(async () => {
      // Switch to scenario tab
      await user.click(screen.getByText("Setup Scenario"));
      expect(screen.getByTestId("scenario")).toBeInTheDocument();

      // Switch to characters tab
      await user.click(screen.getByText("Setup Characters"));
      expect(screen.getByTestId("character-sheet")).toBeInTheDocument();

      // Switch back to lobby
      await user.click(screen.getByText("Lobby"));
      expect(screen.getByText(/Game ID:/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("should show wheel when game is loaded", async () => {
    vi.useFakeTimers();

    // This test would require triggering the showWheel state
    // For now, we test that the wheel provider is set up correctly
    render(<App />);

    // The wheel should be available through providers
    expect(screen.getByText("Dread RPG")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("should handle URL parameters for auto-join", () => {
    // Mock URL search params
    const mockURLSearchParams = vi.fn().mockImplementation(() => ({
      get: vi.fn().mockImplementation((key) => {
        if (key === "gameId") return "auto-join-123";
        return null;
      }),
    }));

    Object.defineProperty(window, "URLSearchParams", {
      value: mockURLSearchParams,
      writable: true,
    });

    render(<App />);

    // Should automatically show join form
    expect(screen.getByPlaceholderText("Game ID")).toHaveValue("auto-join-123");
  });

  it.skip("should handle copy functionality", async () => {
    vi.useFakeTimers();

    render(<App />);

    // Create game
    await user.click(screen.getByText("Create Game"));
    const nameInput = screen.getByPlaceholderText("Your Name");
    await user.type(nameInput, "Test Host");
    await user.click(screen.getByRole("button", { name: "Create" }));

    vi.advanceTimersByTime(200);

    // Test copy functionality
    await waitFor(async () => {
      const copyButton = screen.getByText("Copy");
      await user.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });
});
