import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import Scenario from "../components/Scenario";
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

// Renders Scenario as the GM by flipping isGM on mount via the real PeerProvider context.
function GmScenario() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <Scenario />;
}

// Enables AI with an explicit tier (bypassing WebGPU detection entirely,
// since enableAi only calls detectRecommendedTier() when no tier is given)
// via the real AiProvider context, mirroring how GmScenario flips isGM.
function EnableAi() {
  const { enableAi } = useAi();
  useEffect(() => {
    enableAi(MODEL_TIERS.MEDIUM);
  }, [enableAi]);
  return null;
}

function renderAsGm() {
  return render(
    <AiProvider>
      <PeerProvider>
        <GmScenario />
      </PeerProvider>
    </AiProvider>
  );
}

describe("Scenario Component", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("shows a placeholder message for players when no scenario exists", () => {
    render(
      <AiProvider>
        <PeerProvider>
          <Scenario />
        </PeerProvider>
      </AiProvider>
    );

    expect(
      screen.getByText("No scenario has been set up yet.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Setup Scenario")).not.toBeInTheDocument();
  });

  it("shows a Setup Scenario button for the GM when no scenario exists", () => {
    renderAsGm();

    expect(
      screen.getByRole("button", { name: "Setup Scenario" })
    ).toBeInTheDocument();
  });

  it("opens the editor with all fields when the GM clicks Setup Scenario", async () => {
    renderAsGm();

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));

    expect(screen.getByText("Scenario Title:")).toBeInTheDocument();
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Setting:")).toBeInTheDocument();
    expect(screen.getByText("Characters & Roles:")).toBeInTheDocument();
    expect(screen.getByText("Goals & Objectives:")).toBeInTheDocument();
    expect(screen.getByText("Threats & Dangers:")).toBeInTheDocument();
    expect(screen.getByText("Special Rules & Notes:")).toBeInTheDocument();
  });

  it("saves a scenario and shows it in the read view", async () => {
    renderAsGm();

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
    await user.type(
      screen.getByPlaceholderText("Enter scenario title..."),
      "The Haunted Manor"
    );
    await user.type(
      screen.getByPlaceholderText("Describe the scenario overview..."),
      "A night of terror."
    );
    await user.click(screen.getByRole("button", { name: "Save Scenario" }));

    expect(screen.getByText("The Haunted Manor")).toBeInTheDocument();
    expect(screen.getByText("A night of terror.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Scenario" })
    ).toBeInTheDocument();
  });

  it("discards edits when Cancel is clicked", async () => {
    renderAsGm();

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
    await user.type(
      screen.getByPlaceholderText("Enter scenario title..."),
      "Discarded Title"
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Discarded Title")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Click 'Setup Scenario' to create a scenario for your players."
      )
    ).toBeInTheDocument();
  });

  it("does not show a Generate with AI affordance when AI isn't enabled", async () => {
    renderAsGm();

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));

    expect(screen.queryByText("Generate with AI")).not.toBeInTheDocument();
  });

  describe("with AI enabled", () => {
    function renderAsGmWithAiEnabled() {
      return render(
        <AiProvider>
          <EnableAi />
          <PeerProvider>
            <GmScenario />
          </PeerProvider>
        </AiProvider>
      );
    }

    it("shows the Generate with AI affordance once AI is enabled", async () => {
      renderAsGmWithAiEnabled();

      await user.click(screen.getByRole("button", { name: "Setup Scenario" }));

      await waitFor(() =>
        expect(screen.getByText("Generate with AI")).toBeInTheDocument()
      );
    });

    it("drafts a scenario via AI into the edit form without saving it", async () => {
      mockEngine.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "AI Title",
                description: "AI description.",
                setting: "AI setting.",
                characters: "AI characters.",
                goals: "AI goals.",
                threats: "AI threats.",
                rules: "",
              }),
            },
          },
        ],
      });

      renderAsGmWithAiEnabled();

      await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
      await waitFor(() =>
        expect(screen.getByText("Generate with AI")).toBeInTheDocument()
      );

      await user.click(screen.getByText("Generate with AI"));

      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter scenario title...")
        ).toHaveValue("AI Title")
      );
      // Still just a draft in the edit form - not saved/sent yet.
      expect(
        screen.queryByText("AI Title", { selector: "h2" })
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save Scenario" }));

      expect(screen.getByText("AI Title")).toBeInTheDocument();
      expect(screen.getByText("AI description.")).toBeInTheDocument();
    });

    it("shows an inline error and leaves the form untouched when the AI returns an invalid draft", async () => {
      mockEngine.chatCompletion.mockResolvedValue({
        choices: [{ message: { content: "not json" } }],
      });

      renderAsGmWithAiEnabled();

      await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
      await waitFor(() =>
        expect(screen.getByText("Generate with AI")).toBeInTheDocument()
      );

      await user.click(screen.getByText("Generate with AI"));

      await waitFor(() =>
        expect(
          screen.getByText(/didn't return a usable scenario|not valid JSON/)
        ).toBeInTheDocument()
      );
      expect(
        screen.getByPlaceholderText("Enter scenario title...")
      ).toHaveValue("");
    });
  });
});
