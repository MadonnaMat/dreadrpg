import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import AiToggleButton from "../components/ai/AiToggleButton";
import { PeerProvider } from "../providers/PeerProvider";
import { AiProvider } from "../providers/AiProvider";
import { useAi } from "../hooks/useAi";
import { MODEL_TIERS } from "../constants/aiModels";

const mockEngine = {
  chatCompletion: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() => Promise.resolve(mockEngine)),
}));

function EnableAi() {
  const { enableAi } = useAi();
  useEffect(() => {
    enableAi(MODEL_TIERS.MEDIUM);
  }, [enableAi]);
  return null;
}

function renderButton({ withAiEnabled = false } = {}) {
  return render(
    <AiProvider>
      {withAiEnabled && <EnableAi />}
      <PeerProvider>
        <AiToggleButton />
      </PeerProvider>
    </AiProvider>
  );
}

describe("AiToggleButton", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders a single icon button styled with the death color when AI is off", () => {
    renderButton();

    const button = screen.getByRole("button", {
      name: /AI assistant \(off\)/i,
    });
    expect(button.style.getPropertyValue("--ai-toggle-color")).toBe("#cc0000");
  });

  it("switches to the success color once AI is enabled", async () => {
    renderButton({ withAiEnabled: true });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /AI assistant \(on\)/i })
      ).toBeInTheDocument()
    );
    const button = screen.getByRole("button", { name: /AI assistant \(on\)/i });
    expect(button.style.getPropertyValue("--ai-toggle-color")).toBe("#00cc00");
  });

  it("opens a modal with the AI settings panel on click, and closes via the close button", async () => {
    renderButton();

    await user.click(screen.getByRole("button", { name: /AI assistant/i }));

    expect(
      screen.getByText(/isn't supported on this browser/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByText(/isn't supported on this browser/)
    ).not.toBeInTheDocument();
  });

  it("closes the modal on Escape", async () => {
    renderButton();

    await user.click(screen.getByRole("button", { name: /AI assistant/i }));
    expect(
      screen.getByText(/isn't supported on this browser/)
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByText(/isn't supported on this browser/)
    ).not.toBeInTheDocument();
  });

  it("offers the dev-only prompt harness toggle inside the modal", async () => {
    renderButton();

    await user.click(screen.getByRole("button", { name: /AI assistant/i }));

    expect(
      screen.getByRole("button", { name: "Dev: Prompt Harness" })
    ).toBeInTheDocument();
  });
});
