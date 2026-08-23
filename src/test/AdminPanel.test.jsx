import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import AdminPanel from "../components/AdminPanel";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import { AiProvider } from "../providers/AiProvider";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { MODEL_TIERS } from "../constants/aiModels";

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() =>
    Promise.resolve({ chatCompletion: vi.fn(), dispose: vi.fn() })
  ),
}));

function EnableAi() {
  const { enableAi } = useAi();
  useEffect(() => {
    enableAi(MODEL_TIERS.MEDIUM);
  }, [enableAi]);
  return null;
}

// Renders AdminPanel as the GM with a starting campaign name/tower size,
// mirroring how a real game would have these set via createGame().
function GmAdminPanel() {
  const { setIsGM, setGameId, setGameName, setTowerSize } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setGameId("beneath-a-metal-sky-123");
    setGameName("Beneath a Metal Sky");
    setTowerSize(25);
  }, [setIsGM, setGameId, setGameName, setTowerSize]);
  return <AdminPanel />;
}

// Same, but also seeds a presence roster (one online, one offline player)
// and a character assigned to the offline player, to exercise the
// remove-a-disconnected-player flow.
function GmAdminPanelWithPresence() {
  const { setIsGM, setGameName, setTowerSize, setPresence, setCharacters } =
    usePeer();
  useEffect(() => {
    setIsGM(true);
    setGameName("Beneath a Metal Sky");
    setTowerSize(25);
    setPresence({
      Alice: { connected: true },
      Bob: { connected: false },
    });
    setCharacters({
      "char-1": {
        id: "char-1",
        name: "The Drifter",
        defaultName: "The Drifter",
        assignedTo: "Bob",
        questions: [],
        answers: {},
      },
    });
  }, [setIsGM, setGameName, setTowerSize, setPresence, setCharacters]);
  return <AdminPanel />;
}

describe("AdminPanel Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders the current campaign name and tower size", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByDisplayValue("Beneath a Metal Sky")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
  });

  it("shows the game ID and a sharable invite URL, still reachable mid-game", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("beneath-a-metal-sky-123")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(/gameId=beneath-a-metal-sky-123/)
    ).toBeInTheDocument();
  });

  it("lets the GM rename the campaign on blur", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const nameInput = screen.getByLabelText("Campaign Name");
    await user.clear(nameInput);
    await user.type(nameInput, "A New Campaign");
    await user.tab();

    expect(screen.getByDisplayValue("A New Campaign")).toBeInTheDocument();
  });

  it("lets the GM change the tower size on blur", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const sizeInput = screen.getByLabelText("Tower Size");
    await user.clear(sizeInput);
    await user.type(sizeInput, "40");
    await user.tab();

    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
  });

  it("shows a Start Game button until the game has started", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.getByRole("button", { name: "Start Game" })
    ).toBeInTheDocument();
  });

  it("defaults to the Default theme with no custom color pickers shown", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByLabelText("Theme")).toHaveValue("default");
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });

  it("lets the GM pick a built-in preset", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    await user.selectOptions(screen.getByLabelText("Theme"), "scifi");

    expect(screen.getByLabelText("Theme")).toHaveValue("scifi");
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });

  it("reveals a color picker per theme token when Custom is picked", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    await user.selectOptions(screen.getByLabelText("Theme"), "custom");

    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Accent")).toBeInTheDocument();
    expect(screen.getByText("Danger")).toBeInTheDocument();
    // The wheel's own colors get separate pickers from Accent/Danger, so a
    // Custom theme's wheel can be set independently of its button/UI colors.
    expect(screen.getByText("Wheel Success")).toBeInTheDocument();
    expect(screen.getByText("Wheel Death")).toBeInTheDocument();
  });

  it("lists known players with online/offline status, Remove only for offline", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanelWithPresence />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("Alice (online)")).toBeInTheDocument();
    expect(screen.getByText("Bob (offline)")).toBeInTheDocument();
    // Only one Remove button - Alice (online) doesn't get one.
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("removing a disconnected player frees the character they held", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanelWithPresence />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("Bob (offline)")).not.toBeInTheDocument();
  });

  it("defaults the death narration to the standard template", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByDisplayValue("{name} Died!")).toBeInTheDocument();
  });

  it("lets the GM customize the death narration on blur", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const textarea = screen.getByLabelText(/Death Narration/);
    await user.clear(textarea);
    // userEvent.type() treats {..} as special key syntax - only the
    // opening brace needs escaping (as {{) to type a literal "{"; a lone
    // "}" is never special on its own.
    await user.type(textarea, "{{name} vanishes into the dark.");
    await user.tab();

    expect(
      screen.getByDisplayValue("{name} vanishes into the dark.")
    ).toBeInTheDocument();
  });

  it("disables the AutoGM toggle until the AI assistant is enabled", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.getByRole("button", { name: "Enable AutoGM" })
    ).toBeDisabled();
    expect(screen.getByText(/Enable the AI assistant/)).toBeInTheDocument();
  });

  it("enables AutoGM and shows the debug panel once the AI assistant is on", async () => {
    render(
      <AiProvider>
        <EnableAi />
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmAdminPanel />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const toggle = await screen.findByRole("button", { name: "Enable AutoGM" });
    expect(toggle).not.toBeDisabled();

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: "Disable AutoGM" })
    ).toBeInTheDocument();
    expect(screen.getByText("AutoGM Debug")).toBeInTheDocument();
    expect(screen.getByText("No summary yet.")).toBeInTheDocument();
  });
});
