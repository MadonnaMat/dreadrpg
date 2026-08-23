import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AiProvider } from "../providers/AiProvider";
import { useAi } from "../hooks/useAi";
import { MODEL_TIERS, ENGINE_STATUS } from "../constants/aiModels";

const mockEngine = {
  chatCompletion: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("../ai/engine/webllmEngine", () => ({
  createLlmEngine: vi.fn(() => Promise.resolve(mockEngine)),
}));

import { createLlmEngine } from "../ai/engine/webllmEngine";

function TestConsumer() {
  const {
    engineStatus,
    aiEnabled,
    modelTier,
    savedPreference,
    enableAi,
    disableAi,
    generateScenario,
    refineScenario,
  } = useAi();
  const [result, setResult] = useState(null);

  return (
    <div>
      <div data-testid="status">{engineStatus}</div>
      <div data-testid="enabled">{String(aiEnabled)}</div>
      <div data-testid="tier">{modelTier || ""}</div>
      <div data-testid="saved">{JSON.stringify(savedPreference)}</div>
      <div data-testid="result">{result ? JSON.stringify(result) : ""}</div>
      <button onClick={() => enableAi(MODEL_TIERS.MEDIUM)}>
        enable-medium
      </button>
      <button onClick={() => enableAi()}>enable-auto</button>
      <button onClick={disableAi}>disable</button>
      <button
        onClick={async () =>
          setResult(await generateScenario({ premise: "test" }))
        }
      >
        generate
      </button>
      <button
        onClick={async () =>
          setResult(
            await refineScenario({
              history: result?.messages,
              refinementText: "make it scarier",
            })
          )
        }
      >
        refine
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AiProvider>
      <TestConsumer />
    </AiProvider>
  );
}

describe("AiProvider", () => {
  let user;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("starts idle and not enabled", () => {
    renderProvider();
    expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.IDLE);
    expect(screen.getByTestId("enabled").textContent).toBe("false");
  });

  it("enableAi(tier) creates an engine, becomes ready, and persists the preference", async () => {
    renderProvider();

    await user.click(screen.getByText("enable-medium"));

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.READY)
    );
    expect(screen.getByTestId("enabled").textContent).toBe("true");
    expect(screen.getByTestId("tier").textContent).toBe(MODEL_TIERS.MEDIUM);
    expect(createLlmEngine).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: expect.any(String) })
    );
    expect(JSON.parse(localStorage.getItem("dread-rpg-ai-preference"))).toEqual(
      { optedIn: true, tier: MODEL_TIERS.MEDIUM }
    );
  });

  it("enableAi() with no explicit tier resolves to unsupported under happy-dom (no navigator.gpu)", async () => {
    renderProvider();

    await user.click(screen.getByText("enable-auto"));

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe(
        ENGINE_STATUS.UNSUPPORTED
      )
    );
    expect(createLlmEngine).not.toHaveBeenCalled();
  });

  it("disableAi tears down the engine and resets status without deleting the saved preference", async () => {
    renderProvider();
    await user.click(screen.getByText("enable-medium"));
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.READY)
    );

    await user.click(screen.getByText("disable"));

    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.IDLE);
  });

  it("generateScenario resolves an error result instead of throwing when AI hasn't been enabled", async () => {
    renderProvider();

    await user.click(screen.getByText("generate"));

    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toContain(
        "AI is not enabled"
      )
    );
  });

  it("loads a previously saved opt-in preference on mount without auto-starting a download", async () => {
    localStorage.setItem(
      "dread-rpg-ai-preference",
      JSON.stringify({ optedIn: true, tier: MODEL_TIERS.LARGE })
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("saved").textContent).toBe(
        JSON.stringify({ optedIn: true, tier: MODEL_TIERS.LARGE })
      )
    );
    expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.IDLE);
    expect(createLlmEngine).not.toHaveBeenCalled();
  });

  it("generateScenario runs the real prompt runner against the mocked engine once enabled", async () => {
    mockEngine.chatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "T",
              description: "D",
              setting: "S",
              characters: "C",
              goals: "G",
              threats: "Th",
              rules: "",
            }),
          },
        },
      ],
    });

    renderProvider();
    await user.click(screen.getByText("enable-medium"));
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.READY)
    );

    await user.click(screen.getByText("generate"));

    await waitFor(() => {
      const result = JSON.parse(screen.getByTestId("result").textContent);
      expect(result.valid).toBe(true);
      expect(result.parsed.title).toBe("T");
    });
  });

  it("refineScenario continues the conversation from a prior result's messages", async () => {
    mockEngine.chatCompletion
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "T",
                description: "D",
                setting: "S",
                characters: "C",
                goals: "G",
                threats: "Th",
                rules: "",
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Scarier T",
                description: "D",
                setting: "S",
                characters: "C",
                goals: "G",
                threats: "Th",
                rules: "",
              }),
            },
          },
        ],
      });

    renderProvider();
    await user.click(screen.getByText("enable-medium"));
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe(ENGINE_STATUS.READY)
    );
    await user.click(screen.getByText("generate"));
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("result").textContent).valid).toBe(
        true
      )
    );

    await user.click(screen.getByText("refine"));

    await waitFor(() => {
      const result = JSON.parse(screen.getByTestId("result").textContent);
      expect(result.valid).toBe(true);
      expect(result.parsed.title).toBe("Scarier T");
    });
    const secondCallMessages = mockEngine.chatCompletion.mock.calls[1][0];
    expect(
      secondCallMessages.some((m) => m.content === "make it scarier")
    ).toBe(true);
    expect(secondCallMessages[0].role).toBe("system");
  });
});
