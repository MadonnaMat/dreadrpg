import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import CharacterSheet from "../components/CharacterSheet";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";
import { DEFAULT_QUESTIONS } from "../constants/questions";

// Renders CharacterSheet as the GM by flipping isGM on mount via the real PeerProvider context.
function GmCharacterSheet() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <CharacterSheet />;
}

// Renders CharacterSheet as a named player, optionally pre-seeding a
// character already assigned to them (there's no in-app "claim a character"
// UI yet - that's a later item - so tests seed the assignment directly via
// setCharacters, the same way the GM's roster would end up mutating it).
function PlayerCharacterSheet({ userName = "Alice", assignedCharacter }) {
  const { setUserName, setCharacters } = usePeer();
  useEffect(() => {
    setUserName(userName);
    if (assignedCharacter) {
      setCharacters({ [assignedCharacter.id]: assignedCharacter });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUserName, setCharacters]);
  return <CharacterSheet />;
}

function makeCharacter(overrides = {}) {
  return {
    id: "char-1",
    name: "Alice's Character",
    defaultName: "Alice's Character",
    assignedTo: "Alice",
    questions: DEFAULT_QUESTIONS,
    answers: {},
    ...overrides,
  };
}

describe("CharacterSheet Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("tells a player they have no character yet when none is assigned", () => {
    render(
      <PeerProvider>
        <PlayerCharacterSheet />
      </PeerProvider>
    );

    expect(
      screen.getByText("You haven't been assigned a character yet.")
    ).toBeInTheDocument();
  });

  it("renders the player's assigned character sheet", () => {
    render(
      <PeerProvider>
        <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
      </PeerProvider>
    );

    expect(screen.getByText("Character Sheet")).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_QUESTIONS[0])).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Enter your answer...")).toHaveLength(
      DEFAULT_QUESTIONS.length
    );
  });

  it("lets a player type an answer without crashing", async () => {
    render(
      <PeerProvider>
        <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
      </PeerProvider>
    );

    const [firstAnswer] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    await user.type(firstAnswer, "Alice");

    expect(firstAnswer).toHaveValue("Alice");
  });

  it("does not show other players' sheets unless the GM allows it", () => {
    render(
      <PeerProvider>
        <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
      </PeerProvider>
    );

    expect(
      screen.queryByText("Other Players' Character Sheets")
    ).not.toBeInTheDocument();
  });

  it("shows GM controls and an empty roster for a new game", () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    expect(screen.getByText("GM Character Management")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Character" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Sheets to Players" })
    ).toBeInTheDocument();
    expect(screen.getByText(/No characters yet/)).toBeInTheDocument();
  });

  it("lets the GM create a character and edit its questions", async () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "New Character" }));
    // Two matches: the "New Character" create button, and the newly created
    // character's own default name in the roster.
    expect(
      screen.getAllByRole("button", { name: "New Character" })
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Edit Questions" }));
    expect(screen.getByText("Edit Questionnaire")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Question \d+/)).toHaveLength(
      DEFAULT_QUESTIONS.length
    );

    await user.click(screen.getByRole("button", { name: "Add Question" }));
    expect(screen.getAllByPlaceholderText(/Question \d+/)).toHaveLength(
      DEFAULT_QUESTIONS.length + 1
    );

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText(/Question \d+/)).toHaveLength(
      DEFAULT_QUESTIONS.length
    );
  });

  it("lets the GM clone and delete a character", async () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "New Character" }));
    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(screen.getByText("New Character (copy)")).toBeInTheDocument();

    // Re-query between clicks - deleting a row unmounts its own button, so a
    // cached reference from before the first delete is stale afterwards.
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(screen.getByText(/No characters yet/)).toBeInTheDocument();
  });

  it("toggles the sheet visibility button label for the GM", async () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    await user.click(
      screen.getByRole("button", { name: "Show Sheets to Players" })
    );

    expect(
      screen.getByRole("button", { name: "Hide Sheets to Players" })
    ).toBeInTheDocument();
  });
});
