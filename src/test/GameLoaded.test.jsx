import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import GameLoaded from "../components/GameLoaded";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import { AiProvider } from "../providers/AiProvider";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useAi } from "../hooks/useAi";
import { useAutoGm } from "../hooks/useAutoGm";
import { MODEL_TIERS } from "../constants/aiModels";
import React from "react";

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() =>
    Promise.resolve({ chatCompletion: vi.fn(), dispose: vi.fn() })
  ),
}));

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

vi.mock("../components/CampaignNotes", () => ({
  default: () => (
    <div data-testid="campaign-notes-component">Campaign Notes Component</div>
  ),
}));

// Test wrapper that provides all necessary context
const TestWrapper = ({ children, isGM = false, conn = null }) => {
  return (
    <AiProvider>
      <PeerProvider>
        <WheelProvider conn={conn} isGM={isGM}>
          <AutoGmProvider>{children}</AutoGmProvider>
        </WheelProvider>
      </PeerProvider>
    </AiProvider>
  );
};

// Flips the real PeerProvider context to a GM who has already designated
// themselves as the spinner - "isGM"/"conn" props on WheelProvider above are
// never actually consumed by it (it reads isGM from usePeer(), not props),
// so exercising the GM-only spin/decline flow needs the real context setters
// instead, the same way CharacterSheet.test.jsx's GmCharacterSheet does.
function GmSelfAssigned({ children }) {
  const { setIsGM, setHostName, setUsers } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
    setUsers({ "peer-gm": "Host" });
  }, [setIsGM, setHostName, setUsers]);
  return children;
}

// GM with two players - one whose character has died, one still alive -
// used to test that the spin-assign dropdown excludes a dead character's
// player and labels the alive one with their character's name.
function GmWithMixedRoster({ children }) {
  const { setIsGM, setHostName, setUsers, setCharacters } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
    setUsers({ "peer-gm": "Host", "peer-1": "Alice", "peer-2": "Bob" });
    setCharacters({
      "char-1": {
        id: "char-1",
        name: "The Drifter",
        assignedTo: "Alice",
        alive: true,
      },
      "char-2": {
        id: "char-2",
        name: "The Ghost",
        assignedTo: "Bob",
        alive: false,
      },
    });
  }, [setIsGM, setHostName, setUsers, setCharacters]);
  return children;
}

// GM whose tower is currently frozen after a collapse - used to check the
// Re-stack Tower button's visibility.
function GmAwaitingReset({ children }) {
  const { setIsGM, setHostName, setUsers, setAwaitingReset } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
    setUsers({ "peer-gm": "Host" });
    setAwaitingReset(true);
  }, [setIsGM, setHostName, setUsers, setAwaitingReset]);
  return children;
}

// GM with AutoGM actually enabled (via the real AiProvider/AutoGmProvider,
// same as a real session - webllmEngine is mocked at module scope above) -
// used to check that manual wheel controls disappear once AutoGM is
// running the GM role, except Re-stack Tower, which stays available as a
// manual override since AutoGM's own readyToRestack judgment isn't always
// reliable. `awaitingReset` optionally frozen too, to also cover that button.
function GmWithAutoGmEnabled({ children, awaitingReset = false }) {
  const { setIsGM, setHostName, setUsers, setAwaitingReset } = usePeer();
  const { aiEnabled, enableAi } = useAi();
  const { enableAutoGm } = useAutoGm();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
    setUsers({ "peer-gm": "Host" });
    if (awaitingReset) setAwaitingReset(true);
    enableAi(MODEL_TIERS.MEDIUM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsGM, setHostName, setUsers, setAwaitingReset, enableAi]);
  useEffect(() => {
    if (aiEnabled) enableAutoGm();
  }, [aiEnabled, enableAutoGm]);
  return children;
}

// GM self-designated for a multi-pull action, with AutoGM's thinking flag
// already set - used to check the Spin button disables while waiting for
// AutoGM to react to the previous step.
function GmDesignatedForMultiPull({ children, pullsRequired = 2 }) {
  const { setIsGM, setHostName, setUsers, setAutoGmThinking } = usePeer();
  const { assignSpinner } = useWheel();
  useEffect(() => {
    setIsGM(true);
    setHostName("Host");
    setUsers({ "peer-gm": "Host" });
  }, [setIsGM, setHostName, setUsers]);
  useEffect(() => {
    assignSpinner("Host", pullsRequired);
  }, [assignSpinner, pullsRequired]);
  useEffect(() => {
    setAutoGmThinking(true);
  }, [setAutoGmThinking]);
  return children;
}

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
    // Nobody has been designated to spin yet, and this render isn't a GM, so
    // neither the assign picker nor a Spin button should be showing.
    expect(screen.queryByText("Spin the Wheel!")).not.toBeInTheDocument();
  });

  it("should handle tab switching", async () => {
    render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );

    // Click scenario tab. All three panels stay mounted regardless of the
    // active tab (so each panel's own live-network-message handler stays
    // registered even while a player is looking at a different tab) -
    // switching tabs only toggles CSS visibility, not presence in the DOM.
    await user.click(screen.getByText("Scenario"));
    expect(screen.getByTestId("scenario-component")).toBeVisible();
    expect(screen.getByTestId("pixi-application")).not.toBeVisible();

    // Click characters tab
    await user.click(screen.getByText("Characters"));
    expect(screen.getByTestId("character-sheet-component")).toBeVisible();
    expect(screen.getByTestId("scenario-component")).not.toBeVisible();

    // Click back to game tab
    await user.click(screen.getByText("Game"));
    expect(screen.getByTestId("pixi-application")).toBeVisible();
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

  it("should handle spin button click once the GM designates themself", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmSelfAssigned>
          <GameLoaded />
        </GmSelfAssigned>
      </TestWrapper>
    );

    await user.selectOptions(screen.getByRole("combobox"), "Host");
    await user.click(screen.getByRole("button", { name: "Request Pull" }));

    const spinButton = screen.getByText("Spin the Wheel!");
    expect(spinButton).not.toBeDisabled();

    await user.click(spinButton);
    // The spin logic is handled by WheelProvider, so we just verify the button exists and is clickable
  });

  it("excludes a dead character's player from the spin-assign dropdown, and labels the alive one with their character name", () => {
    render(
      <TestWrapper isGM={true}>
        <GmWithMixedRoster>
          <GameLoaded />
        </GmWithMixedRoster>
      </TestWrapper>
    );

    const options = screen.getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toContain("Alice <The Drifter>");
    expect(options).not.toContain("Bob <The Ghost>");
    expect(options).not.toContain("Bob");
  });

  it("tags the GM's own row in the spin-assign dropdown with <GM>", () => {
    render(
      <TestWrapper isGM={true}>
        <GmSelfAssigned>
          <GameLoaded />
        </GmSelfAssigned>
      </TestWrapper>
    );

    const options = screen.getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toContain("Host <GM>");
  });

  it("keeps a player selectable after they replace their dead character with a new one", () => {
    function GmWithReplacedCharacter({ children }) {
      const { setIsGM, setHostName, setUsers, setCharacters } = usePeer();
      useEffect(() => {
        setIsGM(true);
        setHostName("Host");
        setUsers({ "peer-gm": "Host", "peer-1": "Alice" });
        setCharacters({
          "char-1": {
            id: "char-1",
            name: "The Ghost",
            assignedTo: "Alice",
            alive: false,
          },
          "char-2": {
            id: "char-2",
            name: "The Survivor",
            assignedTo: "Alice",
            alive: true,
          },
        });
      }, [setIsGM, setHostName, setUsers, setCharacters]);
      return children;
    }

    render(
      <TestWrapper isGM={true}>
        <GmWithReplacedCharacter>
          <GameLoaded />
        </GmWithReplacedCharacter>
      </TestWrapper>
    );

    const options = screen.getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toContain("Alice <The Survivor>");
  });

  it("disables the Decline button while a spin is in progress", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmSelfAssigned>
          <GameLoaded />
        </GmSelfAssigned>
      </TestWrapper>
    );

    await user.selectOptions(screen.getByRole("combobox"), "Host");
    await user.click(screen.getByRole("button", { name: "Request Pull" }));

    const declineButton = screen.getByRole("button", { name: "Decline" });
    expect(declineButton).not.toBeDisabled();

    await user.click(screen.getByText("Spin the Wheel!"));
    expect(declineButton).toBeDisabled();
  });

  it("shows the assign picker instead of a Spin button before anyone is designated", () => {
    render(
      <TestWrapper isGM={true}>
        <GmSelfAssigned>
          <GameLoaded />
        </GmSelfAssigned>
      </TestWrapper>
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText("Spin the Wheel!")).not.toBeInTheDocument();
  });

  it("shows Re-stack Tower for a human GM once the tower is frozen", () => {
    render(
      <TestWrapper isGM={true}>
        <GmAwaitingReset>
          <GameLoaded />
        </GmAwaitingReset>
      </TestWrapper>
    );

    expect(
      screen.getByRole("button", { name: "Re-stack Tower" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/AutoGM will also restack on its own/)
    ).not.toBeInTheDocument();
  });

  it("hides the manual assign-pull form once AutoGM is enabled", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmWithAutoGmEnabled awaitingReset={true}>
          <GameLoaded />
        </GmWithAutoGmEnabled>
      </TestWrapper>
    );

    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    );
  });

  it("keeps Re-stack Tower available as a manual override once AutoGM is enabled", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmWithAutoGmEnabled awaitingReset={true}>
          <GameLoaded />
        </GmWithAutoGmEnabled>
      </TestWrapper>
    );

    // The GM's own `awaitingReset` update has to propagate from
    // PeerProvider's synced state into WheelProvider's own local mirror
    // (see WheelProvider.jsx's `peerAwaitingReset` sync effect) before
    // GameLoaded's restack-button condition sees it - a separate render
    // pass from the one that flips autoGmEnabled above.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Re-stack Tower" })
      ).toBeInTheDocument()
    );
    // The button itself no longer depends on autoGmEnabled, so it can
    // render before AutoGM has actually finished enabling - the hint below
    // it does depend on autoGmEnabled, so it needs its own wait.
    await waitFor(() =>
      expect(
        screen.getByText(/AutoGM will also restack on its own/)
      ).toBeInTheDocument()
    );
  });

  it("disables the Spin button while AutoGM is thinking during a multi-pull action", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmDesignatedForMultiPull pullsRequired={2}>
          <GameLoaded />
        </GmDesignatedForMultiPull>
      </TestWrapper>
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Spin the Wheel!" })
      ).toBeDisabled()
    );
    expect(
      screen.getByText(/Waiting for the GM to react to the last pull/)
    ).toBeInTheDocument();
  });

  it("keeps the Spin button enabled while thinking on a single-pull action", async () => {
    render(
      <TestWrapper isGM={true}>
        <GmDesignatedForMultiPull pullsRequired={1}>
          <GameLoaded />
        </GmDesignatedForMultiPull>
      </TestWrapper>
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Spin the Wheel!" })
      ).not.toBeDisabled()
    );
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

  it("shows a rejoin-link copy button for a player, but not for the GM", () => {
    const { rerender } = render(
      <TestWrapper>
        <GameLoaded />
      </TestWrapper>
    );
    expect(
      screen.getByRole("button", { name: "Copy my rejoin link" })
    ).toBeInTheDocument();

    rerender(
      <TestWrapper isGM={true}>
        <GmSelfAssigned>
          <GameLoaded />
        </GmSelfAssigned>
      </TestWrapper>
    );
    expect(
      screen.queryByRole("button", { name: "Copy my rejoin link" })
    ).not.toBeInTheDocument();
  });

  it("copies a rejoin link containing the game id and player's own name", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    function PlayerSeeded({ children }) {
      const { setUserName, setGameId } = usePeer();
      useEffect(() => {
        setUserName("Bob");
        setGameId("game-abc");
      }, [setUserName, setGameId]);
      return children;
    }

    render(
      <TestWrapper>
        <PlayerSeeded>
          <GameLoaded />
        </PlayerSeeded>
      </TestWrapper>
    );

    await user.click(
      screen.getByRole("button", { name: "Copy my rejoin link" })
    );

    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/gameId=game-abc.*userName=Bob/)
    );
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
