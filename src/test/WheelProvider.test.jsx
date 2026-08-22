import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { WheelProvider } from "../providers/WheelProvider";
import { useWheel } from "../hooks/useWheel";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";
import React from "react";

// Mock the helpers with a simple 2-wedge model: index 0 is always the
// "success" wedge, index 1 is always the "death" wedge, regardless of the
// current dangerProbability - this keeps handleSpinEnd(idx) calls in tests
// deterministic without depending on the real WEDGE_PAIRS arrangement.
vi.mock("../helpers", () => ({
  computeDangerProbability: vi.fn((pullsSinceReset, charactersRemoved) =>
    pullsSinceReset === 0 && charactersRemoved === 0 ? 0 : 0.5
  ),
  getWheelWedges: vi.fn((dangerProbability) => [
    { type: "success", angleFraction: 1 - dangerProbability },
    { type: "death", angleFraction: dangerProbability },
  ]),
}));

// Test component to access WheelProvider context
const TestWheelComponent = () => {
  const {
    wedges,
    dangerProbability,
    awaitingReset,
    result,
    showWheel,
    spinning,
    spinAngle,
    pointerIdx,
    handleSpin,
    handleSpinEnd,
    handleRestack,
  } = useWheel();

  return (
    <div>
      <div data-testid="wedges">{JSON.stringify(wedges)}</div>
      <div data-testid="danger-probability">{dangerProbability}</div>
      <div data-testid="awaiting-reset">{awaitingReset.toString()}</div>
      <div data-testid="result">{result}</div>
      <div data-testid="show-wheel">{showWheel.toString()}</div>
      <div data-testid="spinning">{spinning.toString()}</div>
      <div data-testid="spin-angle">{spinAngle}</div>
      <div data-testid="pointer-idx">{JSON.stringify(pointerIdx)}</div>

      <button onClick={handleSpin}>Spin Wheel</button>
      <button onClick={() => handleSpinEnd(0)}>End Spin Success</button>
      <button onClick={() => handleSpinEnd(1)}>End Spin Death</button>
      <button onClick={handleRestack}>Restack</button>
    </div>
  );
};

// Flips isGM on the real PeerProvider context before rendering children -
// WheelProvider reads isGM from usePeer(), not from a prop, so a prop passed
// straight to <WheelProvider> is silently ignored (mirrors the pattern in
// CharacterSheet.test.jsx).
const AsGM = ({ children }) => {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return children;
};

// Wrapper component that provides both PeerProvider and WheelProvider
const TestWrapper = ({ children, isGM = false }) => {
  return (
    <PeerProvider>
      <WheelProvider>{isGM ? <AsGM>{children}</AsGM> : children}</WheelProvider>
    </PeerProvider>
  );
};

describe("WheelProvider", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({
      skipPointerEventsCheck: true,
    });
    vi.clearAllMocks();
  });

  it("should provide initial wheel state", () => {
    render(
      <TestWrapper>
        <TestWheelComponent />
      </TestWrapper>
    );

    expect(screen.getByTestId("danger-probability")).toHaveTextContent("0");
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("false");
    expect(screen.getByTestId("result")).toHaveTextContent("");
    expect(screen.getByTestId("show-wheel")).toHaveTextContent("false");
    expect(screen.getByTestId("spinning")).toHaveTextContent("false");
    expect(screen.getByTestId("spin-angle")).toHaveTextContent("0");
    expect(screen.getByTestId("pointer-idx")).toHaveTextContent("null");
  });

  it("should handle spin as GM", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Spin Wheel"));

    expect(screen.getByTestId("spinning")).toBeInTheDocument();
  });

  it("should increment pullsSinceReset and recompute dangerProbability on a success spin", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Success"));

    expect(computeDangerProbability).toHaveBeenCalledWith(1, 0, 25);
    expect(screen.getByTestId("result")).toHaveTextContent("Success!");
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("false");
  });

  it("should freeze the wheel (awaitingReset) on a death spin without recomputing dangerProbability", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Death"));

    expect(screen.getByTestId("result")).toHaveTextContent("You Died!");
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("true");
    expect(computeDangerProbability).not.toHaveBeenCalled();
  });

  it("should not start a new spin while awaitingReset is true", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Death"));
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("true");

    await user.click(screen.getByText("Spin Wheel"));
    expect(screen.getByTestId("spinning")).toHaveTextContent("false");
  });

  it("should re-stack the tower on handleRestack, escalating from the incremented charactersRemoved", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Death"));
    computeDangerProbability.mockClear();

    await user.click(screen.getByText("Restack"));

    expect(computeDangerProbability).toHaveBeenCalledWith(0, 1, 25);
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("false");
  });

  it("should do nothing when restacking while not awaiting a reset", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Restack"));

    expect(computeDangerProbability).not.toHaveBeenCalled();
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("false");
  });

  // Every client's own WheelGraphics animates locally and calls
  // handleSpinEnd via onSpinEnd, but only the GM's resolution is
  // authoritative - a player's own call must be an inert no-op, since a
  // backgrounded tab's late-firing local resolve is exactly what caused the
  // wheel to desync (see WheelProvider.jsx's isGM gate).
  it("should not mutate any state when handleSpinEnd is called as a non-GM player", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={false}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Success"));
    expect(computeDangerProbability).not.toHaveBeenCalled();
    expect(screen.getByTestId("result")).toHaveTextContent("");
    expect(screen.getByTestId("danger-probability")).toHaveTextContent("0");

    await user.click(screen.getByText("End Spin Death"));
    expect(computeDangerProbability).not.toHaveBeenCalled();
    expect(screen.getByTestId("result")).toHaveTextContent("");
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("false");
  });
});
