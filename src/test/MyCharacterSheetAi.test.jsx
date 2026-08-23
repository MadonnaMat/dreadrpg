import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import CharacterSheet from "../components/CharacterSheet";
import { PeerProvider } from "../providers/PeerProvider";
import { WheelProvider } from "../providers/WheelProvider";
import { AiProvider } from "../providers/AiProvider";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { MODEL_TIERS } from "../constants/aiModels";
import { DEFAULT_QUESTIONS } from "../constants/questions";

const mockEngine = {
  chatCompletion: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() => Promise.resolve(mockEngine)),
}));

function completionWith(content) {
  return { choices: [{ message: { content } }] };
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

function PlayerCharacterSheet({ assignedCharacter }) {
  const { setUserName, setCharacters } = usePeer();
  useEffect(() => {
    setUserName("Alice");
    setCharacters({ [assignedCharacter.id]: assignedCharacter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUserName, setCharacters]);
  return <CharacterSheet />;
}

function EnableAi() {
  const { enableAi } = useAi();
  useEffect(() => {
    enableAi(MODEL_TIERS.MEDIUM);
  }, [enableAi]);
  return null;
}

function renderPlayerWithAi(character) {
  return render(
    <AiProvider>
      <EnableAi />
      <PeerProvider>
        <WheelProvider>
          <AutoGmProvider>
            <PlayerCharacterSheet assignedCharacter={character} />
          </AutoGmProvider>
        </WheelProvider>
      </PeerProvider>
    </AiProvider>
  );
}

describe("MyCharacterSheet AI answer suggestions", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("does not show a Suggest an answer button when AI isn't enabled", () => {
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

    expect(screen.queryByText("Suggest an answer")).not.toBeInTheDocument();
  });

  it("drafts a suggestion into a preview and accepting it fills the textarea without auto-sending on generation", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(JSON.stringify({ answer: "Riley Voss" }))
    );

    renderPlayerWithAi(makeCharacter());

    await waitFor(() =>
      expect(screen.getAllByText("Suggest an answer").length).toBeGreaterThan(0)
    );

    const [firstSuggestButton] = screen.getAllByText("Suggest an answer");
    await user.click(firstSuggestButton);

    await waitFor(() =>
      expect(screen.getByText("Riley Voss")).toBeInTheDocument()
    );
    // Still just a preview - the textarea itself hasn't been touched yet.
    const [firstTextarea] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    expect(firstTextarea).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(firstTextarea).toHaveValue("Riley Voss");
    expect(screen.getByText("Pending GM approval")).toBeInTheDocument();
    // The suggestion preview (with its own Accept/Discard) is gone now.
    expect(
      screen.queryByRole("button", { name: "Accept" })
    ).not.toBeInTheDocument();
  });

  it("lets a follow-up refine a suggestion before accepting it", async () => {
    mockEngine.chatCompletion
      .mockResolvedValueOnce(
        completionWith(JSON.stringify({ answer: "Riley Voss" }))
      )
      .mockResolvedValueOnce(
        completionWith(JSON.stringify({ answer: "Riley 'Doc' Voss" }))
      );

    renderPlayerWithAi(makeCharacter());

    await waitFor(() =>
      expect(screen.getAllByText("Suggest an answer").length).toBeGreaterThan(0)
    );
    const [firstSuggestButton] = screen.getAllByText("Suggest an answer");
    await user.click(firstSuggestButton);

    await waitFor(() =>
      expect(screen.getByText("Riley Voss")).toBeInTheDocument()
    );

    const refineInput = screen.getByPlaceholderText(/more dramatic/);
    await user.type(refineInput, "add a nickname");
    await user.click(screen.getByRole("button", { name: "Refine" }));

    await waitFor(() =>
      expect(screen.getByText("Riley 'Doc' Voss")).toBeInTheDocument()
    );
    const secondCallMessages = mockEngine.chatCompletion.mock.calls[1][0];
    expect(secondCallMessages.some((m) => m.content === "add a nickname")).toBe(
      true
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));
    const [firstTextarea] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    expect(firstTextarea).toHaveValue("Riley 'Doc' Voss");
  });

  it("discarding a suggestion clears the preview and leaves the textarea untouched", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(JSON.stringify({ answer: "Unwanted suggestion" }))
    );

    renderPlayerWithAi(makeCharacter());

    await waitFor(() =>
      expect(screen.getAllByText("Suggest an answer").length).toBeGreaterThan(0)
    );
    const [firstSuggestButton] = screen.getAllByText("Suggest an answer");
    await user.click(firstSuggestButton);

    await waitFor(() =>
      expect(screen.getByText("Unwanted suggestion")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByText("Unwanted suggestion")).not.toBeInTheDocument();
    const [firstTextarea] = screen.getAllByPlaceholderText(
      "Enter your answer..."
    );
    expect(firstTextarea).toHaveValue("");
  });

  it("shows an inline error and no preview when the AI returns invalid JSON", async () => {
    mockEngine.chatCompletion.mockResolvedValue(completionWith("not json"));

    renderPlayerWithAi(makeCharacter());

    await waitFor(() =>
      expect(screen.getAllByText("Suggest an answer").length).toBeGreaterThan(0)
    );
    const [firstSuggestButton] = screen.getAllByText("Suggest an answer");
    await user.click(firstSuggestButton);

    await waitFor(() =>
      expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "Accept" })
    ).not.toBeInTheDocument();
  });
});
