import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiProvider } from "../providers/AiProvider";
import AiSettingsPanel from "../components/ai/AiSettingsPanel";
import { MODEL_TIERS } from "../constants/aiModels";

const mockEngine = {
  chatCompletion: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() => Promise.resolve(mockEngine)),
}));

function renderPanel() {
  return render(
    <AiProvider>
      <AiSettingsPanel />
    </AiProvider>
  );
}

// happy-dom has no navigator.gpu by default, so AiSettingsPanel's own
// device-detection effect resolves UNSUPPORTED unless a test stubs one in -
// stubbing/removing it here rather than in a global setup keeps that
// behavior explicit per test.
function stubWebGpuSupported() {
  Object.defineProperty(navigator, "gpu", {
    value: { requestAdapter: vi.fn().mockResolvedValue({}) },
    configurable: true,
  });
}

function removeWebGpuStub() {
  delete navigator.gpu;
}

describe("AiSettingsPanel", () => {
  let user;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  afterEach(() => {
    removeWebGpuStub();
  });

  it("shows the unsupported-device message when there's no WebGPU adapter", async () => {
    renderPanel();

    await waitFor(() =>
      expect(
        screen.getByText(/isn't supported on this browser/i)
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("Enable AI Assistance")).not.toBeInTheDocument();
  });

  it("shows a tier selector with the recommended tier marked once WebGPU is available", async () => {
    stubWebGpuSupported();
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Enable AI Assistance")).toBeInTheDocument()
    );
    expect(screen.getByText(/\(recommended\)/)).toBeInTheDocument();
  });

  it("lets the user override the recommended tier and enable AI, then disable it", async () => {
    stubWebGpuSupported();
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Enable AI Assistance")).toBeInTheDocument()
    );

    const largeOption = screen.getByText(
      (text, node) =>
        node.tagName === "DIV" && text.includes("Large (best quality)")
    );
    await user.click(largeOption.querySelector("input"));
    await user.click(screen.getByText("Enable AI Assistance"));

    await waitFor(() =>
      expect(screen.getByText(/AI assistance is enabled/)).toBeInTheDocument()
    );
    expect(JSON.parse(localStorage.getItem("dread-rpg-ai-preference"))).toEqual(
      { optedIn: true, tier: MODEL_TIERS.LARGE }
    );

    await user.click(screen.getByText("Disable AI Assistance"));

    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByText(/AI assistance is enabled/)
      ).not.toBeInTheDocument()
    );
  });
});
