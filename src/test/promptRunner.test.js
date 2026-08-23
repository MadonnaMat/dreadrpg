import { describe, it, expect, vi } from "vitest";
import { runStructuredPrompt } from "../ai/promptRunner";

function completionWith(content) {
  return { choices: [{ message: { content } }] };
}

const passthroughValidate = () => ({ valid: true, errors: [] });

describe("runStructuredPrompt", () => {
  it("resolves valid on the first attempt when the model returns valid JSON", async () => {
    const engine = {
      chatCompletion: vi
        .fn()
        .mockResolvedValue(completionWith('{"answer":"Yes."}')),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
    });

    expect(result).toMatchObject({
      valid: true,
      parsed: { answer: "Yes." },
      attempts: 1,
    });
    expect(engine.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("retries with a corrective message when the model returns malformed JSON, then succeeds", async () => {
    const engine = {
      chatCompletion: vi
        .fn()
        .mockResolvedValueOnce(completionWith("not json"))
        .mockResolvedValueOnce(completionWith('{"answer":"Fixed."}')),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
    });

    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ answer: "Fixed." });
    expect(result.attempts).toBe(2);
    expect(engine.chatCompletion).toHaveBeenCalledTimes(2);

    // The second call's messages should include the corrective follow-up.
    const secondCallMessages = engine.chatCompletion.mock.calls[1][0];
    expect(
      secondCallMessages.some((m) => m.role === "user" && m.content.includes("invalid"))
    ).toBe(true);
  });

  it("retries on schema validation failure, then succeeds", async () => {
    const validate = vi
      .fn()
      .mockReturnValueOnce({ valid: false, errors: ["missing field"] })
      .mockReturnValueOnce({ valid: true, errors: [] });
    const engine = {
      chatCompletion: vi
        .fn()
        .mockResolvedValue(completionWith('{"answer":"x"}')),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate,
    });

    expect(result.valid).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("gives up after maxRetries and returns valid:false with errors, never throwing", async () => {
    const engine = {
      chatCompletion: vi.fn().mockResolvedValue(completionWith("still not json")),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      maxRetries: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.parsed).toBeNull();
    expect(result.attempts).toBe(2);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("resolves with an error instead of throwing when the engine call itself rejects", async () => {
    const engine = {
      chatCompletion: vi.fn().mockRejectedValue(new Error("worker crashed")),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["worker crashed"]);
    expect(result.attempts).toBe(1);
  });

  it("always includes latencyMs as a number", async () => {
    const engine = {
      chatCompletion: vi.fn().mockResolvedValue(completionWith('{"a":1}')),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
    });

    expect(typeof result.latencyMs).toBe("number");
  });
});
