import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import CharacterSheet from "../components/CharacterSheet";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import { AiProvider } from "../providers/AiProvider";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { usePeer } from "../hooks/usePeer";
import { DEFAULT_QUESTIONS } from "../constants/questions";

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(
    () => new Promise(() => {}) // never resolves - AI isn't enabled in these tests
  ),
}));

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

// Renders CharacterSheet as the GM with a character already pre-seeded
// (e.g. one with a pending answer to approve), rather than an empty roster.
function GmCharacterSheetWithCharacter({ character }) {
  const { setIsGM, setCharacters } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setCharacters({ [character.id]: character });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsGM, setCharacters]);
  return <CharacterSheet />;
}

// Renders CharacterSheet as a different, unassigned player with sheet
// visibility already on, so OtherPlayersSheets renders Alice's character.
function OtherPlayerCharacterSheet({ characters }) {
  const { setUserName, setCharacters, setAllowPlayersToViewSheets } = usePeer();
  useEffect(() => {
    setUserName("Bob");
    setCharacters(characters);
    setAllowPlayersToViewSheets(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUserName, setCharacters, setAllowPlayersToViewSheets]);
  return <CharacterSheet />;
}

describe("CharacterSheet Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("offers the character picker when no character is assigned yet", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("Choose a Character")).toBeInTheDocument();
  });

  it("renders the player's assigned character sheet", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("Character Sheet")).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_QUESTIONS[0])).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Enter your answer...")).toHaveLength(
      DEFAULT_QUESTIONS.length
    );
  });

  it("offers a new character picker (with a death notice) once the player's character has died", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet
                assignedCharacter={makeCharacter({ alive: false })}
              />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.getByText(
        (_, el) => el?.tagName === "P" && el.textContent.includes("has died")
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Choose a Character")).toBeInTheDocument();
    expect(screen.queryByText("Character Sheet")).not.toBeInTheDocument();
  });

  it("lets a player type an answer without crashing", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const [firstAnswer] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    await user.type(firstAnswer, "Alice");

    expect(firstAnswer).toHaveValue("Alice");
  });

  it("does not show other players' sheets unless the GM allows it", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.queryByText("Other Players' Character Sheets")
    ).not.toBeInTheDocument();
  });

  it("shows GM controls and an empty roster for a new game", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmCharacterSheet />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
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
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmCharacterSheet />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
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
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmCharacterSheet />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
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

  it("marks a newly-typed answer as pending GM approval", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <PlayerCharacterSheet assignedCharacter={makeCharacter()} />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    const [firstAnswer] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    await user.type(firstAnswer, "Alice");

    expect(screen.getByText("Pending GM approval")).toBeInTheDocument();
  });

  it("lets the GM approve a submitted answer", async () => {
    const character = makeCharacter({
      answers: { 0: { text: "Alice", approved: false } },
    });
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmCharacterSheetWithCharacter character={character} />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    await user.click(
      screen.getByRole("button", { name: `${character.name} (Alice)` })
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" })
    ).not.toBeInTheDocument();
  });

  it("hides an unapproved answer from other players even with sheet visibility on", () => {
    const character = makeCharacter({
      answers: { 0: { text: "A secret", approved: false } },
    });
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <OtherPlayerCharacterSheet
                characters={{ [character.id]: character }}
              />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getAllByText("No answer provided").length).toBeGreaterThan(0);
    expect(screen.queryByText("A secret")).not.toBeInTheDocument();
  });

  it("shows an approved answer to other players once sheet visibility is on", () => {
    const character = makeCharacter({
      answers: { 0: { text: "A public fact", approved: true } },
    });
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <OtherPlayerCharacterSheet
                characters={{ [character.id]: character }}
              />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.getByText("A public fact")).toBeInTheDocument();
  });

  it("toggles the sheet visibility button label for the GM", async () => {
    render(
      <AiProvider>
        <PeerProvider>
          <WheelProvider>
            <AutoGmProvider>
              <GmCharacterSheet />
            </AutoGmProvider>
          </WheelProvider>
        </PeerProvider>
      </AiProvider>
    );

    await user.click(
      screen.getByRole("button", { name: "Show Sheets to Players" })
    );

    expect(
      screen.getByRole("button", { name: "Hide Sheets to Players" })
    ).toBeInTheDocument();
  });
});
