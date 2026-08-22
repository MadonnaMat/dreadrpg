import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import PlayerLobby from "../components/PlayerLobby";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";

function makeCharacter(overrides = {}) {
  return {
    id: "char-1",
    name: "The Detective",
    defaultName: "The Detective",
    assignedTo: null,
    questions: ["What is your name?"],
    answers: {},
    ...overrides,
  };
}

// Seeds a userName + a set of characters on the real PeerProvider context
// before rendering PlayerLobby, the same way CharacterSheet.test.jsx seeds
// state for a component that expects to be mounted mid-game rather than
// driven through the full join flow.
function Seeded({ userName = "Bob", characters = {} }) {
  const { setUserName, setCharacters } = usePeer();
  useEffect(() => {
    setUserName(userName);
    setCharacters(characters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUserName, setCharacters]);
  return <PlayerLobby />;
}

describe("PlayerLobby Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("tells the player the GM hasn't added characters yet when the roster is empty", () => {
    render(
      <PeerProvider>
        <Seeded />
      </PeerProvider>
    );

    expect(
      screen.getByText("The GM hasn't added any characters yet.")
    ).toBeInTheDocument();
  });

  it("lets a player choose an unassigned character", async () => {
    render(
      <PeerProvider>
        <Seeded characters={{ "char-1": makeCharacter() }} />
      </PeerProvider>
    );

    expect(screen.getByText("The Detective")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose" }));

    expect(
      screen.getByText(
        (_, el) => el?.textContent === "You're playing as The Detective."
      )
    ).toBeInTheDocument();
  });

  it("doesn't offer an already-assigned character to another player", () => {
    render(
      <PeerProvider>
        <Seeded
          userName="Bob"
          characters={{
            "char-1": makeCharacter({ assignedTo: "Alice" }),
          }}
        />
      </PeerProvider>
    );

    expect(
      screen.queryByRole("button", { name: "Choose" })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Already chosen/)).toBeInTheDocument();
  });

  it("renders chat so players can talk before the game starts", () => {
    render(
      <PeerProvider>
        <Seeded />
      </PeerProvider>
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
  });
});
