import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import CharacterSheet from "../components/CharacterSheet";
import { PeerProvider } from "../providers/PeerProvider";
import { AiProvider } from "../providers/AiProvider";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { MODEL_TIERS } from "../constants/aiModels";

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

function GmCharacterSheet() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <CharacterSheet />;
}

function EnableAi() {
  const { enableAi } = useAi();
  useEffect(() => {
    enableAi(MODEL_TIERS.MEDIUM);
  }, [enableAi]);
  return null;
}

function renderAsGmWithAiEnabled() {
  return render(
    <AiProvider>
      <EnableAi />
      <PeerProvider>
        <GmCharacterSheet />
      </PeerProvider>
    </AiProvider>
  );
}

describe("CastAiGenerator (via CharacterSheet)", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("does not show the cast generator when AI isn't enabled", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <GmCharacterSheet />
        </PeerProvider>
      </AiProvider>
    );

    expect(screen.queryByText("Generate Cast with AI")).not.toBeInTheDocument();
  });

  it("drafts characters and creates one as a real character on accept", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(
        JSON.stringify([
          { name: "The Technician", questions: ["What is your name?"] },
        ])
      )
    );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(screen.getByText("Generate Cast with AI")).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Cast with AI"));

    await waitFor(() =>
      expect(screen.getByDisplayValue("The Technician")).toBeInTheDocument()
    );

    // Not created yet - only a roster entry after Create Character is clicked.
    expect(
      screen.queryByRole("button", { name: "The Technician" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Character" }));

    expect(
      screen.getByRole("button", { name: "The Technician" })
    ).toBeInTheDocument();
    // The draft editor is gone once accepted.
    expect(
      screen.queryByDisplayValue("The Technician")
    ).not.toBeInTheDocument();
  });

  it("discards a draft without creating a character", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(JSON.stringify([{ name: "Unwanted", questions: ["Q1?"] }]))
    );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(screen.getByText("Generate Cast with AI")).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Cast with AI"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("Unwanted")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByDisplayValue("Unwanted")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unwanted" })
    ).not.toBeInTheDocument();
  });

  it("shows an error and no drafts when the AI returns invalid JSON", async () => {
    mockEngine.chatCompletion.mockResolvedValue(completionWith("not json"));

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(screen.getByText("Generate Cast with AI")).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Cast with AI"));

    await waitFor(() =>
      expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
    );
  });

  it("offers Suggest more questions with AI once a character's questions are being edited, and appends new ones", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(
        JSON.stringify([
          {
            name: "The Technician",
            questions: ["What is your name?", "What is your specialty?"],
          },
        ])
      )
    );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(screen.getByText("Generate Cast with AI")).toBeInTheDocument()
    );
    // Create a character directly (skip AI cast drafting for this test).
    await user.click(screen.getByRole("button", { name: "New Character" }));
    await user.click(screen.getByRole("button", { name: "Edit Questions" }));

    expect(
      screen.getByText("Suggest more questions with AI")
    ).toBeInTheDocument();

    await user.click(screen.getByText("Suggest more questions with AI"));

    await waitFor(() =>
      expect(
        screen.getByDisplayValue("What is your specialty?")
      ).toBeInTheDocument()
    );
  });
});
