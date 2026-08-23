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
  computeDangerProbability: vi.fn(
    (pullsSinceReset, charactersRemoved, towerSize, initialVirtualPulls = 0) =>
      pullsSinceReset === 0 &&
      charactersRemoved === 0 &&
      initialVirtualPulls === 0
        ? 0
        : 0.5
  ),
  getWheelWedges: vi.fn((dangerProbability) => [
    { type: "success", angleFraction: 1 - dangerProbability },
    { type: "death", angleFraction: dangerProbability },
  ]),
  // No players joined in these tests (a bare TestWrapper/GM with no
  // opponents), so this is always 3 * 5 = 15 - irrelevant to what these
  // tests assert on, but must exist so startGame() doesn't throw.
  initialVirtualPullsForPlayerCount: vi.fn(() => 15),
}));

// Test component to access WheelProvider context
const TestWheelComponent = () => {
  const {
    wedges,
    dangerProbability,
    awaitingReset,
    designatedSpinner,
    assignSpinner,
    pullsRequired,
    pullsRemaining,
    result,
    showWheel,
    spinning,
    spinAngle,
    pointerIdx,
    handleSpin,
    handleDecline,
    handleSpinEnd,
    handleRestack,
    startGame,
  } = useWheel();
  const { characters } = usePeer();

  return (
    <div>
      <div data-testid="characters">{JSON.stringify(characters)}</div>
      <div data-testid="wedges">{JSON.stringify(wedges)}</div>
      <div data-testid="danger-probability">{dangerProbability}</div>
      <div data-testid="awaiting-reset">{awaitingReset.toString()}</div>
      <div data-testid="designated-spinner">
        {JSON.stringify(designatedSpinner)}
      </div>
      <div data-testid="pulls-required">{pullsRequired}</div>
      <div data-testid="pulls-remaining">{pullsRemaining}</div>
      <div data-testid="result">{result}</div>
      <div data-testid="show-wheel">{showWheel.toString()}</div>
      <div data-testid="spinning">{spinning.toString()}</div>
      <div data-testid="spin-angle">{spinAngle}</div>
      <div data-testid="pointer-idx">{JSON.stringify(pointerIdx)}</div>

      <button onClick={() => assignSpinner("Host")}>Assign Host</button>
      <button onClick={() => assignSpinner("Alice")}>Assign Alice</button>
      <button onClick={() => assignSpinner("Host", 3)}>
        Assign Host 3 Pulls
      </button>
      <button onClick={handleSpin}>Spin Wheel</button>
      <button onClick={handleDecline}>Decline</button>
      <button onClick={() => handleSpinEnd(0)}>End Spin Success</button>
      <button onClick={() => handleSpinEnd(1)}>End Spin Death</button>
      <button onClick={handleRestack}>Restack</button>
      <button onClick={startGame}>Start Game</button>
    </div>
  );
};

// Flips isGM on the real PeerProvider context before rendering children -
// WheelProvider reads isGM from usePeer(), not from a prop, so a prop passed
// straight to <WheelProvider> is silently ignored (mirrors the pattern in
// CharacterSheet.test.jsx).
const AsGM = ({ children }) => {
  const { setIsGM, setHostName } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
  }, [setIsGM, setHostName]);
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

// Seeds one character assigned to "Alice", alive by default - used to test
// that a death spin marks the assigned character no-longer-alive.
const WithAliceCharacter = ({ children }) => {
  const { setCharacters } = usePeer();
  useEffect(() => {
    setCharacters({
      "char-1": {
        id: "char-1",
        name: "The Wanderer",
        assignedTo: "Alice",
        alive: true,
      },
    });
  }, [setCharacters]);
  return children;
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

  it("should handle spin as GM once designated", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Assign Host"));
    await user.click(screen.getByText("Spin Wheel"));

    expect(screen.getByTestId("spinning")).toHaveTextContent("true");
  });

  it("ignores a spin attempt when nobody has been designated", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Spin Wheel"));

    expect(screen.getByTestId("spinning")).toHaveTextContent("false");
  });

  it("clears the designation and logs a decline when the assigned player declines", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Assign Host"));
    expect(screen.getByTestId("designated-spinner")).toHaveTextContent("Host");

    await user.click(screen.getByText("Decline"));

    expect(screen.getByTestId("designated-spinner")).toHaveTextContent("null");
  });

  it("clears the designation after a spin resolves, win or lose", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Assign Host"));
    await user.click(screen.getByText("End Spin Success"));

    expect(screen.getByTestId("designated-spinner")).toHaveTextContent("null");
  });

  it("should increment pullsSinceReset and recompute dangerProbability on a success spin", async () => {
    const { computeDangerProbability } = await import("../helpers");

    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("End Spin Success"));

    expect(computeDangerProbability).toHaveBeenCalledWith(1, 0, 25, 0);
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

    // No one was designated in this test, so the death text falls back to
    // the generic placeholder rather than a real character/player name.
    expect(screen.getByTestId("result")).toHaveTextContent(
      "The character Died!"
    );
    expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("true");
    expect(computeDangerProbability).not.toHaveBeenCalled();
  });

  it("marks the designated spinner's character no-longer-alive on a death spin", async () => {
    render(
      <TestWrapper isGM={true}>
        <WithAliceCharacter>
          <TestWheelComponent />
        </WithAliceCharacter>
      </TestWrapper>
    );

    await user.click(screen.getByText("Assign Alice"));
    await user.click(screen.getByText("End Spin Death"));

    const characters = JSON.parse(screen.getByTestId("characters").textContent);
    expect(characters["char-1"].alive).toBe(false);
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

    expect(computeDangerProbability).toHaveBeenCalledWith(0, 1, 25, 0);
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

  // Replaces the old "first connection flips showWheel for everyone"
  // behavior (docs/rules/compliance-fix-plan.md item 1) - nothing should
  // reveal the wheel until the GM explicitly starts the game.
  it("should stay in the lobby (showWheel false) until the GM starts the game", () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    expect(screen.getByTestId("show-wheel")).toHaveTextContent("false");
  });

  it("GM: startGame reveals the wheel", async () => {
    render(
      <TestWrapper isGM={true}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Start Game"));

    expect(screen.getByTestId("show-wheel")).toHaveTextContent("true");
  });

  it("GM: startGame seeds the danger curve from the actual joined player count", async () => {
    const { initialVirtualPullsForPlayerCount, computeDangerProbability } =
      await import("../helpers");

    // AsGM only sets hostName - seed a couple of joined players too, so
    // Object.keys(users).length reflects a real lobby instead of 0.
    function AsGMWithPlayers({ children }) {
      const { setIsGM, setHostName, setUsers } = usePeer();
      useEffect(() => {
        setIsGM(true);
        setHostName("Host");
        setUsers({ p1: "Host", p2: "Alice", p3: "Bob" });
      }, [setIsGM, setHostName, setUsers]);
      return children;
    }

    render(
      <PeerProvider>
        <WheelProvider>
          <AsGMWithPlayers>
            <TestWheelComponent />
          </AsGMWithPlayers>
        </WheelProvider>
      </PeerProvider>
    );

    await user.click(screen.getByText("Start Game"));

    expect(initialVirtualPullsForPlayerCount).toHaveBeenCalledWith(3);
    expect(computeDangerProbability).toHaveBeenCalledWith(0, 0, 25, 15);
  });

  it("non-GM: startGame is a no-op", async () => {
    render(
      <TestWrapper isGM={false}>
        <TestWheelComponent />
      </TestWrapper>
    );

    await user.click(screen.getByText("Start Game"));

    expect(screen.getByTestId("show-wheel")).toHaveTextContent("false");
  });

  describe("multi-pull complex/difficult actions", () => {
    it("keeps the same player designated after a partial success, decrementing pullsRemaining", async () => {
      render(
        <TestWrapper isGM={true}>
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("Assign Host 3 Pulls"));
      expect(screen.getByTestId("pulls-remaining")).toHaveTextContent("3");

      await user.click(screen.getByText("End Spin Success"));

      expect(screen.getByTestId("designated-spinner")).toHaveTextContent(
        "Host"
      );
      expect(screen.getByTestId("pulls-remaining")).toHaveTextContent("2");
    });

    it("only clears the designation once every required pull has succeeded", async () => {
      render(
        <TestWrapper isGM={true}>
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("Assign Host 3 Pulls"));
      await user.click(screen.getByText("End Spin Success"));
      await user.click(screen.getByText("End Spin Success"));
      expect(screen.getByTestId("designated-spinner")).toHaveTextContent(
        "Host"
      );

      await user.click(screen.getByText("End Spin Success"));

      expect(screen.getByTestId("designated-spinner")).toHaveTextContent(
        "null"
      );
      expect(screen.getByTestId("pulls-remaining")).toHaveTextContent("0");
    });

    it("a death mid-sequence ends the action early regardless of prior successes", async () => {
      render(
        <TestWrapper isGM={true}>
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("Assign Host 3 Pulls"));
      await user.click(screen.getByText("End Spin Success"));

      await user.click(screen.getByText("End Spin Death"));

      expect(screen.getByTestId("designated-spinner")).toHaveTextContent(
        "null"
      );
      expect(screen.getByTestId("awaiting-reset")).toHaveTextContent("true");
    });
  });

  describe("notifying AutoGM of spin outcomes", () => {
    // Captures whatever AutoGmProvider would register on autoGmChat, so
    // these tests can confirm WheelProvider's own outcome narration reaches
    // it (see sendSystemChatMessage's notifyAutoGm option, PeerProvider.jsx)
    // without needing a real AutoGmProvider in the tree.
    function AutoGmChatSpy({ onMessage }) {
      const { registerAutoGmChatEventHandler } = usePeer();
      useEffect(() => {
        registerAutoGmChatEventHandler(onMessage);
      }, [registerAutoGmChatEventHandler, onMessage]);
      return null;
    }

    it("notifies AutoGM when a designated spinner declines", async () => {
      const onMessage = vi.fn();
      render(
        <TestWrapper isGM={true}>
          <AutoGmChatSpy onMessage={onMessage} />
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("Assign Host"));
      await user.click(screen.getByText("Decline"));

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("declines") })
      );
    });

    it("notifies AutoGM on a successful spin", async () => {
      const onMessage = vi.fn();
      render(
        <TestWrapper isGM={true}>
          <AutoGmChatSpy onMessage={onMessage} />
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("End Spin Success"));

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("survives") })
      );
    });

    it("does not notify AutoGM when a pull is merely assigned", async () => {
      const onMessage = vi.fn();
      render(
        <TestWrapper isGM={true}>
          <AutoGmChatSpy onMessage={onMessage} />
          <TestWheelComponent />
        </TestWrapper>
      );

      await user.click(screen.getByText("Assign Host"));

      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
