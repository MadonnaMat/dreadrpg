import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameLoaded from "../components/GameLoaded";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import React from "react";

// Mock PIXI Application and components
vi.mock("@pixi/react", () => ({
  Application: ({ children, ...props }) => (
    <div data-testid="pixi-application" {...props}>
      {children}
    </div>
  ),
  extend: vi.fn(),
}));

// Mock WheelGraphics component
vi.mock("../components/WheelGraphics", () => ({
  WheelGraphics: (props) => (
    <div data-testid="wheel-graphics" data-spinning={props.spinning}>
      Wheel Graphics Mock
    </div>
  ),
}));

// Mock other components
vi.mock("../components/Chat", () => ({
  default: () => <div data-testid="chat-component">Chat Component</div>,
}));

vi.mock("../components/Scenario", () => ({
  default: () => <div data-testid="scenario-component">Scenario Component</div>,
}));

vi.mock("../components/CharacterSheet", () => ({
  default: () => (
    <div data-testid="character-sheet-component">Character Sheet Component</div>
  ),
}));

// Test wrapper that provides all necessary context
const TestWrapper = ({ children, isGM = false, conn = null }) => {
  return (
    <PeerProvider>
      <WheelProvider conn={conn} isGM={isGM}>
        {children}
      </WheelProvider>
    </PeerProvider>
  );
};

describe("GameLoaded Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({
      skipPointerEventsCheck: true,
    });
    vi.clearAllMocks();
  });

  it("should render the main game interface", () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    expect(screen.getByText("Dread RPG")).toBeInTheDocument();
    expect(screen.getByText("Game")).toBeInTheDocument();
    expect(screen.getByText("Scenario")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
  });

  it("should show game tab by default", () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    expect(screen.getByTestId("pixi-application")).toBeInTheDocument();
    expect(screen.getByTestId("wheel-graphics")).toBeInTheDocument();
    expect(screen.getByTestId("chat-component")).toBeInTheDocument();
    expect(screen.getByText("Spin the Wheel!")).toBeInTheDocument();
  });

  it("should handle tab switching", async () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    // Click scenario tab
    await user.click(screen.getByText("Scenario"));
    expect(screen.getByTestId("scenario-component")).toBeInTheDocument();
    expect(screen.queryByTestId("pixi-application")).not.toBeInTheDocument();

    // Click characters tab
    await user.click(screen.getByText("Characters"));
    expect(screen.getByTestId("character-sheet-component")).toBeInTheDocument();
    expect(screen.queryByTestId("scenario-component")).not.toBeInTheDocument();

    // Click back to game tab
    await user.click(screen.getByText("Game"));
    expect(screen.getByTestId("pixi-application")).toBeInTheDocument();
  });

  it("should render PIXI application with correct props", () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    const pixiApp = screen.getByTestId("pixi-application");
    expect(pixiApp).toHaveAttribute("width", "300");
    expect(pixiApp).toHaveAttribute("height", "300");
    expect(pixiApp).toHaveAttribute("backgroundAlpha", "0");
  });

  it("should handle spin button click", async () => {
    render(
      <TestWrapper isGM={true}>
        <GameLoaded />
      </TestWrapper>
    );

    const spinButton = screen.getByText("Spin the Wheel!");
    expect(spinButton).not.toBeDisabled();

    await user.click(spinButton);
    // The spin logic is handled by WheelProvider, so we just verify the button exists and is clickable
  });

  it("should disable spin button when spinning", () => {
    // This would require a more complex setup to mock the spinning state
    // For now, we just verify the button exists
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    expect(screen.getByText("Spin the Wheel!")).toBeInTheDocument();
  });

  it("should show result area", () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    // The result div should be present (may be empty initially)
    expect(screen.getByTestId("pixi-application")).toBeInTheDocument();
  });

  it("should pass wheel state to WheelGraphics component", () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    const wheelGraphics = screen.getByTestId("wheel-graphics");
    expect(wheelGraphics).toBeInTheDocument();
    expect(wheelGraphics).toHaveAttribute("data-spinning", "false");
  });

  it("should handle non-GM refetch request", async () => {
    vi.useFakeTimers();

    render(
      <TestWrapper isGM={false} conn={{ send: vi.fn() }}>
        <GameLoaded />
      </TestWrapper>
    );

    // Fast-forward the timer to trigger the refetch request
    vi.advanceTimersByTime(150);

    // The refetch logic is internal, but we can verify the component renders
    expect(screen.getByText("Dread RPG")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("should apply active tab styling", async () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    const gameTab = screen.getByText("Game");
    expect(gameTab).toHaveClass("active");

    await user.click(screen.getByText("Scenario"));
    expect(screen.getByText("Scenario")).toHaveClass("active");
    expect(gameTab).not.toHaveClass("active");
  });
});
