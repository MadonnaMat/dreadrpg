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
  const { setIsGM, setGameName, setTowerSize } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setGameName("Beneath a Metal Sky");
    setTowerSize(25);
  }, [setIsGM, setGameName, setTowerSize]);
  return <AdminPanel showRoster={showRoster} />;
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
});
