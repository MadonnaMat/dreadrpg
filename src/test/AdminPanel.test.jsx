import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import AdminPanel from "../components/AdminPanel";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import { usePeer } from "../hooks/usePeer";

// Renders AdminPanel as the GM with a starting campaign name/tower size,
// mirroring how a real game would have these set via createGame().
function GmAdminPanel({ showRoster = false }) {
  const { setIsGM, setGameId, setGameName, setTowerSize } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setGameId("beneath-a-metal-sky-123");
    setGameName("Beneath a Metal Sky");
    setTowerSize(25);
  }, [setIsGM, setGameId, setGameName, setTowerSize]);
  return <AdminPanel showRoster={showRoster} />;
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
  return <AdminPanel showRoster={false} />;
}

describe("AdminPanel Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders the current campaign name and tower size", () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    expect(screen.getByDisplayValue("Beneath a Metal Sky")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
  });

  it("shows the game ID and a sharable invite URL, still reachable mid-game", () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    expect(screen.getByText("beneath-a-metal-sky-123")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(/gameId=beneath-a-metal-sky-123/)
    ).toBeInTheDocument();
  });

  it("lets the GM rename the campaign on blur", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    const nameInput = screen.getByLabelText("Campaign Name");
    await user.clear(nameInput);
    await user.type(nameInput, "A New Campaign");
    await user.tab();

    expect(screen.getByDisplayValue("A New Campaign")).toBeInTheDocument();
  });

  it("lets the GM change the tower size on blur", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    const sizeInput = screen.getByLabelText("Tower Size");
    await user.clear(sizeInput);
    await user.type(sizeInput, "40");
    await user.tab();

    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
  });

  it("shows a Start Game button until the game has started", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    expect(
      screen.getByRole("button", { name: "Start Game" })
    ).toBeInTheDocument();
  });

  it("embeds the character roster only when showRoster is true", () => {
    const { rerender } = render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel showRoster={false} />
        </WheelProvider>
      </PeerProvider>
    );
    expect(screen.queryByText("Characters")).not.toBeInTheDocument();

    rerender(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel showRoster={true} />
        </WheelProvider>
      </PeerProvider>
    );
    expect(screen.getByText("Characters")).toBeInTheDocument();
  });

  it("defaults to the Default theme with no custom color pickers shown", () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    expect(screen.getByLabelText("Theme")).toHaveValue("default");
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });

  it("lets the GM pick a built-in preset", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    await user.selectOptions(screen.getByLabelText("Theme"), "scifi");

    expect(screen.getByLabelText("Theme")).toHaveValue("scifi");
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });

  it("reveals a color picker per theme token when Custom is picked", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    await user.selectOptions(screen.getByLabelText("Theme"), "custom");

    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Accent")).toBeInTheDocument();
    expect(screen.getByText("Danger")).toBeInTheDocument();
  });

  it("lists known players with online/offline status, Remove only for offline", () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanelWithPresence />
        </WheelProvider>
      </PeerProvider>
    );

    expect(screen.getByText("Alice (online)")).toBeInTheDocument();
    expect(screen.getByText("Bob (offline)")).toBeInTheDocument();
    // Only one Remove button - Alice (online) doesn't get one.
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("removing a disconnected player frees the character they held", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanelWithPresence />
        </WheelProvider>
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("Bob (offline)")).not.toBeInTheDocument();
  });

  it("defaults the death narration to the standard template", () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
    );

    expect(screen.getByDisplayValue("{name} Died!")).toBeInTheDocument();
  });

  it("lets the GM customize the death narration on blur", async () => {
    render(
      <PeerProvider>
        <WheelProvider>
          <GmAdminPanel />
        </WheelProvider>
      </PeerProvider>
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
});
