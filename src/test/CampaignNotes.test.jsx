import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import CampaignNotes from "../components/CampaignNotes";
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

function GmCampaignNotes() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <CampaignNotes />;
}

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
        <GmCampaignNotes />
      </PeerProvider>
    </AiProvider>
  );
}

function renderAsGmWithAiEnabled() {
  return render(
    <AiProvider>
      <EnableAi />
      <PeerProvider>
        <GmCampaignNotes />
      </PeerProvider>
    </AiProvider>
  );
}

describe("CampaignNotes", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("shows quick-add buttons for the priority sections when empty", () => {
    renderAsGm();
    expect(screen.getByText("+ Items")).toBeInTheDocument();
    expect(screen.getByText("+ Monster Types")).toBeInTheDocument();
    expect(screen.getByText("+ Locations")).toBeInTheDocument();
    expect(screen.getByText("+ Win Scenarios")).toBeInTheDocument();
  });

  it("adds a section via quick-add (expanded by default) and lets the GM add/edit/remove items", async () => {
    renderAsGm();

    await user.click(screen.getByText("+ Items"));
    // A section starts expanded, so its "Add Item" button is visible right
    // away without needing to click the bar first.
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Item" })
    ).toBeInTheDocument();
    // Quick-add buttons disappear once a section exists.
    expect(screen.queryByText("+ Items")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Item" }));
    // A fresh item shows its placeholder as the bar title, not an editable
    // input, until the pencil icon is used.
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit item title" }));
    const itemTitleInput = screen.getByPlaceholderText("Item 1");
    await user.type(itemTitleInput, "Rusty key");
    await user.tab();
    expect(screen.getByText("Rusty key")).toBeInTheDocument();

    // Details are hidden by default for every item, regardless of content.
    expect(
      screen.queryByPlaceholderText(/how to beat it/)
    ).not.toBeInTheDocument();
    // Clicking the bar itself (not the icon buttons) opens the details.
    await user.click(screen.getByText("Rusty key"));
    const descriptionInput = screen.getByPlaceholderText(/how to beat it/);
    await user.type(descriptionInput, "Found in the basement closet");
    expect(
      screen.getByDisplayValue("Found in the basement closet")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.queryByText("Rusty key")).not.toBeInTheDocument();
  });

  it("renames and deletes a custom section", async () => {
    renderAsGm();

    await user.type(screen.getByPlaceholderText("New section name"), "Clues");
    await user.click(screen.getByRole("button", { name: "Add Section" }));
    expect(screen.getByText("Clues")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit section name" }));
    const nameInput = screen.getByPlaceholderText("Section name");
    await user.clear(nameInput);
    await user.type(nameInput, "Evidence");
    await user.tab();
    expect(screen.getByText("Evidence")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete section" }));
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument();
  });

  it("does not show the AI generator when AI isn't enabled", () => {
    renderAsGm();
    expect(
      screen.queryByText("Generate Campaign Notes with AI")
    ).not.toBeInTheDocument();
  });

  it("drafts sections (with details) and accepts one as a real section", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(
        JSON.stringify([
          {
            name: "Monster Types",
            items: [
              {
                text: "The Lighthouse Keeper",
                description: "Weak to sunlight; found in the lamp room.",
              },
            ],
          },
        ])
      )
    );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(
        screen.getByText("Generate Campaign Notes with AI")
      ).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Campaign Notes with AI"));

    await waitFor(() =>
      expect(screen.getByDisplayValue("Monster Types")).toBeInTheDocument()
    );
    expect(screen.getByText("The Lighthouse Keeper")).toBeInTheDocument();
    // Details are hidden by default even when the AI already provided one.
    expect(
      screen.queryByDisplayValue(/Weak to sunlight/)
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("The Lighthouse Keeper"));
    expect(
      screen.getByDisplayValue("Weak to sunlight; found in the lamp room.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept Section" }));

    // Draft editor gone, but the accepted section remains as a real
    // section, description included.
    expect(screen.getByText("Monster Types")).toBeInTheDocument();
    expect(screen.getByText("The Lighthouse Keeper")).toBeInTheDocument();
    await user.click(screen.getByText("The Lighthouse Keeper"));
    expect(
      screen.getByDisplayValue("Weak to sunlight; found in the lamp room.")
    ).toBeInTheDocument();
  });

  it("discards a draft without adding a section", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(
        JSON.stringify([
          { name: "Unwanted", items: [{ text: "X", description: "Y" }] },
        ])
      )
    );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(
        screen.getByText("Generate Campaign Notes with AI")
      ).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Campaign Notes with AI"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("Unwanted")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByDisplayValue("Unwanted")).not.toBeInTheDocument();
  });

  it("lets a follow-up refine the drafted batch", async () => {
    mockEngine.chatCompletion
      .mockResolvedValueOnce(
        completionWith(
          JSON.stringify([
            {
              name: "Locations",
              items: [
                { text: "The Lighthouse", description: "Sits on the cliff." },
              ],
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        completionWith(
          JSON.stringify([
            {
              name: "Locations",
              items: [
                {
                  text: "The Lighthouse Basement",
                  description: "Connects to the sea caves.",
                },
              ],
            },
          ])
        )
      );

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(
        screen.getByText("Generate Campaign Notes with AI")
      ).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Campaign Notes with AI"));
    await waitFor(() =>
      expect(screen.getByText("The Lighthouse")).toBeInTheDocument()
    );

    const refineInput = screen.getByPlaceholderText(/cult's rituals/);
    await user.type(refineInput, "add the basement");
    await user.click(screen.getByRole("button", { name: "Refine" }));

    await waitFor(() =>
      expect(screen.getByText("The Lighthouse Basement")).toBeInTheDocument()
    );
  });

  it("shows an error and no drafts when the AI returns invalid JSON", async () => {
    mockEngine.chatCompletion.mockResolvedValue(completionWith("not json"));

    renderAsGmWithAiEnabled();

    await waitFor(() =>
      expect(
        screen.getByText("Generate Campaign Notes with AI")
      ).toBeInTheDocument()
    );
    await user.click(screen.getByText("Generate Campaign Notes with AI"));

    await waitFor(() =>
      expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
    );
  });
});
