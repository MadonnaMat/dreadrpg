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

// Renders CharacterSheet as a named player.
function PlayerCharacterSheet() {
  const { setUserName } = usePeer();
  useEffect(() => {
    setUserName("Alice");
  }, [setUserName]);
  return <CharacterSheet />;
}

describe("CharacterSheet Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders the player's own sheet using the default questions", () => {
    render(
      <PeerProvider>
        <PlayerCharacterSheet />
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
        <PlayerCharacterSheet />
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
        <PlayerCharacterSheet />
      </PeerProvider>
    );

    expect(
      screen.queryByText("Other Players' Character Sheets")
    ).not.toBeInTheDocument();
  });

  it("shows GM controls and the question editor for the GM", async () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    expect(
      screen.getByText("GM Character Sheet Management")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Questions" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Sheets to Players" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Questions" }));

    expect(screen.getByText("Edit Questionnaire")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Question \d+/)).toHaveLength(
      DEFAULT_QUESTIONS.length
    );
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

  it("lets the GM add and remove questions in the editor", async () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "Edit Questions" }));
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

  it("shows a player selector for the GM to review submitted sheets", () => {
    render(
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    );

    expect(screen.getByText("Player Character Sheets")).toBeInTheDocument();
    expect(screen.getByText("Select a player...")).toBeInTheDocument();
  });
});
