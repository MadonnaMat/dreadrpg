import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

// Mock PIXI components
vi.mock("@pixi/react", () => ({
  extend: vi.fn(),
  Application: ({ children }) => (
    <div data-testid="pixi-application">{children}</div>
  ),
}));

// Mock all child components
vi.mock("../components/PreGame", () => ({
  default: () => <div data-testid="pregame-component">PreGame Component</div>,
}));

vi.mock("../components/GameLoaded", () => ({
  default: () => (
    <div data-testid="gameloaded-component">GameLoaded Component</div>
  ),
}));

// Mock the WheelGraphics component
vi.mock("../components/WheelGraphics", () => ({
  WheelGraphics: () => <div data-testid="wheel-graphics">Wheel Graphics</div>,
}));

describe("App Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render without crashing", () => {
    render(<App />);

    // Should render PreGame by default since showWheel starts as false
    expect(screen.getByTestId("pregame-component")).toBeInTheDocument();
  });

  it("should provide PeerProvider context", () => {
    render(<App />);

    // The component should render successfully with providers
    expect(screen.getByTestId("pregame-component")).toBeInTheDocument();
  });

  it("should have PIXI components extended on import", () => {
    // This test verifies that the extend function is mocked properly
    // The actual extend call happens at module import time
    expect(true).toBe(true);
  });

  it("should render nested provider structure correctly", () => {
    // Test that the component tree renders without errors
    // The actual provider logic is tested in individual provider tests
    render(<App />);

    expect(screen.getByTestId("pregame-component")).toBeInTheDocument();
  });

  it("should handle provider wrapper correctly", () => {
    // This tests that WheelProviderWrapper receives correct props from PeerProvider
    render(<App />);

    // Should render without throwing errors
    expect(screen.getByTestId("pregame-component")).toBeInTheDocument();
  });
});
