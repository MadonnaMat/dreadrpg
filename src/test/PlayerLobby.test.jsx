import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import PlayerLobby from "../components/PlayerLobby";
import { PeerProvider } from "../providers/PeerProvider";
import { AiProvider } from "../providers/AiProvider";
import { usePeer } from "../hooks/usePeer";

// Once a character is assigned, PlayerLobby renders MyCharacterSheet, which
// calls useAi() - AiContext has no default value, so every render here
// needs an <AiProvider> even though most of these tests never touch AI.
vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() => new Promise(() => {})),
}));

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
function Seeded({ userName = "Bob", gameId = "game-abc", characters = {} }) {
  const { setUserName, setGameId, setCharacters } = usePeer();
  useEffect(() => {
    setUserName(userName);
    setGameId(gameId);
    setCharacters(characters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUserName, setGameId, setCharacters]);
  return <PlayerLobby />;
}

describe("PlayerLobby Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("tells the player the GM hasn't added characters yet when the roster is empty", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <Seeded />
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.getByText("The GM hasn't added any characters yet.")
    ).toBeInTheDocument();
  });

  it("lets a player choose an unassigned character", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <Seeded characters={{ "char-1": makeCharacter() }} />
        </PeerProvider>
      </AiProvider>
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
      <AiProvider>
        <PeerProvider>
          <Seeded
            userName="Bob"
            characters={{
              "char-1": makeCharacter({ assignedTo: "Alice" }),
            }}
          />
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.queryByRole("button", { name: "Choose" })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Already chosen/)).toBeInTheDocument();
  });

  it("renders chat so players can talk before the game starts", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <Seeded />
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("lets an already-assigned player edit their character's questionnaire before the game starts", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <Seeded
            userName="Bob"
            characters={{
              "char-1": makeCharacter({ assignedTo: "Bob" }),
            }}
          />
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("Character Sheet")).toBeInTheDocument();
    const answerField = screen.getByPlaceholderText("Enter your answer...");
    await user.type(answerField, "Bob the Detective");

    expect(answerField).toHaveValue("Bob the Detective");
    expect(screen.getByText("Pending GM approval")).toBeInTheDocument();
  });

  it("copies a rejoin link containing the game id and the player's own name", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    render(
      <AiProvider>
        <PeerProvider>
          <Seeded userName="Bob" gameId="game-abc" />
        </PeerProvider>
      </AiProvider>
    );

    await user.click(
      screen.getByRole("button", { name: "Copy my rejoin link" })
    );

    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/gameId=game-abc.*userName=Bob/)
    );
  });
});
