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
      secondCallMessages.some(
        (m) => m.role === "user" && m.content.includes("invalid")
      )
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
      chatCompletion: vi
        .fn()
        .mockResolvedValue(completionWith("still not json")),
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

  it("resolves with an error instead of throwing when the engine call keeps rejecting", async () => {
    const engine = {
      chatCompletion: vi.fn().mockRejectedValue(new Error("worker crashed")),
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
    expect(result.errors).toEqual(["worker crashed"]);
    expect(result.attempts).toBe(2);
  });

  it("retries after a transient engine rejection instead of giving up immediately", async () => {
    const engine = {
      chatCompletion: vi
        .fn()
        .mockRejectedValueOnce(new Error("worker crashed"))
        .mockResolvedValue(completionWith('{"a":1}')),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
    });

    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ a: 1 });
    expect(result.attempts).toBe(2);
  });

  it("returns messages ending with the accepted assistant turn on success", async () => {
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

    expect(result.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user" },
      { role: "assistant", content: '{"a":1}' },
    ]);
  });

  it("continues from a supplied history instead of starting a fresh system+user pair", async () => {
    const engine = {
      chatCompletion: vi.fn().mockResolvedValue(completionWith('{"a":2}')),
    };
    const history = [
      { role: "system", content: "system" },
      { role: "user", content: "first request" },
      { role: "assistant", content: '{"a":1}' },
    ];

    const result = await runStructuredPrompt({
      engine,
      userContent: "make it better",
      schema: { type: "object" },
      validate: passthroughValidate,
      history,
    });

    expect(engine.chatCompletion).toHaveBeenCalledWith(
      [...history, { role: "user", content: "make it better" }],
      expect.anything()
    );
    expect(result.messages).toEqual([
      ...history,
      { role: "user", content: "make it better" },
      { role: "assistant", content: '{"a":2}' },
    ]);
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

describe("runStructuredPrompt attempt timeouts", () => {
  it("gives up on a generation that outruns its timeout and says so", async () => {
    const engine = {
      // Never settles - the exact case nothing in the WebLLM stack bounds.
      chatCompletion: vi.fn(() => new Promise(() => {})),
      interrupt: vi.fn(),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      maxRetries: 0,
      attemptTimeoutMs: 20,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/timed out/i);
  });

  it("interrupts the abandoned generation so the next call isn't queued behind it", async () => {
    const engine = {
      chatCompletion: vi.fn(() => new Promise(() => {})),
      interrupt: vi.fn(),
    };

    await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      maxRetries: 0,
      attemptTimeoutMs: 20,
    });

    expect(engine.interrupt).toHaveBeenCalled();
  });

  it("times out each attempt separately rather than sharing one budget", async () => {
    let calls = 0;
    const engine = {
      chatCompletion: vi.fn(() => {
        calls += 1;
        // First attempt hangs; a shared budget would leave nothing for the
        // retry, which is the whole point of retrying.
        if (calls === 1) return new Promise(() => {});
        return Promise.resolve(completionWith('{"answer":"recovered"}'));
      }),
      interrupt: vi.fn(),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      attemptTimeoutMs: 20,
    });

    expect(result).toMatchObject({
      valid: true,
      parsed: { answer: "recovered" },
    });
    expect(engine.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("survives an engine with no interrupt support", async () => {
    const engine = { chatCompletion: vi.fn(() => new Promise(() => {})) };
    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      maxRetries: 0,
      attemptTimeoutMs: 20,
    });
    expect(result.valid).toBe(false);
  });

  it("names the error class when a rejection carries no message", async () => {
    class DeviceLostError extends Error {
      constructor() {
        super("");
        this.name = "DeviceLostError";
      }
    }
    const engine = {
      chatCompletion: vi.fn().mockRejectedValue(new DeviceLostError()),
    };

    const result = await runStructuredPrompt({
      engine,
      systemPromptText: "system",
      userContent: "user",
      schema: { type: "object" },
      validate: passthroughValidate,
      maxRetries: 0,
    });

    // "Model request failed." told us nothing; the class name is the only
    // thing distinguishing a lost GPU from a bad response format.
    expect(result.errors.join(" ")).toContain("DeviceLostError");
  });
});
