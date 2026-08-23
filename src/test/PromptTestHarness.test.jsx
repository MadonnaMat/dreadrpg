import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiProvider } from "../providers/AiProvider";
import PromptTestHarness from "../components/dev/PromptTestHarness";
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

function renderHarness() {
  return render(
    <AiProvider>
      <PromptTestHarness />
    </AiProvider>
  );
}

describe("PromptTestHarness", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.chatCompletion.mockReset();
    mockEngine.dispose.mockReset();
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("disables Run when AI isn't enabled and no override tier is selected", () => {
    renderHarness();
    expect(screen.getByText("Run")).toBeDisabled();
  });

  it("enables Run once an override model tier is selected, without requiring the shared engine", async () => {
    renderHarness();
    await user.selectOptions(screen.getByLabelText("Model"), MODEL_TIERS.SMALL);
    expect(screen.getByText("Run")).not.toBeDisabled();
  });

  it("runs a prompt against an independently-created engine for the override tier and records history", async () => {
    mockEngine.chatCompletion.mockResolvedValue(
      completionWith(
        JSON.stringify({
          title: "T",
          description: "D",
          setting: "S",
          characters: "C",
          goals: "G",
          threats: "Th",
          rules: "",
        })
      )
    );

    renderHarness();
    await user.selectOptions(screen.getByLabelText("Model"), MODEL_TIERS.SMALL);
    await user.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/scenarioGeneration/)).toBeInTheDocument()
    );
    expect(screen.getByText(/valid/)).toBeInTheDocument();
    expect(mockEngine.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("records an error entry instead of crashing when the override input isn't valid JSON", async () => {
    renderHarness();
    await user.selectOptions(screen.getByLabelText("Model"), MODEL_TIERS.SMALL);
    fireEvent.change(screen.getByLabelText(/Override input/), {
      target: { value: "{not valid json" },
    });
    await user.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(
        screen.getByText("Override input is not valid JSON.")
      ).toBeInTheDocument()
    );
    expect(mockEngine.chatCompletion).not.toHaveBeenCalled();
  });

  it("switching the prompt kind resets the fixture and version selection", async () => {
    renderHarness();
    await user.selectOptions(screen.getByLabelText("Prompt"), "castGeneration");
    expect(screen.getByLabelText("Prompt").value).toBe("castGeneration");
    expect(screen.getByLabelText("Fixture").selectedIndex).toBe(0);
  });
});
