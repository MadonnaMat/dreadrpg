const DEFAULT_MAX_RETRIES = 2;

function extractMessageContent(completion) {
  return completion?.choices?.[0]?.message?.content ?? "";
}

function tryParseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Runs one structured-output prompt against an already-created engine (see
// src/ai/engine/webllmEngine.js), validating the result against a
// caller-supplied JSON schema and retrying with a corrective follow-up
// message on invalid/malformed output. Never throws - always resolves to a
// result object the caller can render or report, since "the model
// returned garbage" is an expected, recoverable outcome here, not a bug.
// Feature-agnostic by design so a future AutoGM turn loop can reuse it
// directly for its own structured per-turn output.
export async function runStructuredPrompt({
  engine,
  systemPromptText,
  userContent,
  schema,
  validate,
  maxRetries = DEFAULT_MAX_RETRIES,
}) {
  const messages = [
    { role: "system", content: systemPromptText },
    { role: "user", content: userContent },
  ];
  const responseFormat = {
    type: "json_object",
    schema: JSON.stringify(schema),
  };

  const start = Date.now();
  let attempts = 0;
  let lastRaw = "";
  let lastErrors = [];

  while (attempts <= maxRetries) {
    attempts += 1;

    let completion;
    try {
      completion = await engine.chatCompletion(messages, {
        response_format: responseFormat,
      });
    } catch (err) {
      lastErrors = [err.message || "Model request failed."];
      break;
    }

    lastRaw = extractMessageContent(completion);
    const parsedResult = tryParseJson(lastRaw);

    if (!parsedResult.ok) {
      lastErrors = [`Response was not valid JSON: ${parsedResult.error}`];
      appendCorrection(messages, lastRaw, lastErrors);
      continue;
    }

    const { valid, errors } = validate(parsedResult.value);
    if (valid) {
      return {
        raw: lastRaw,
        parsed: parsedResult.value,
        valid: true,
        errors: [],
        attempts,
        latencyMs: Date.now() - start,
      };
    }

    lastErrors = errors;
    appendCorrection(messages, lastRaw, lastErrors);
  }

  return {
    raw: lastRaw,
    parsed: null,
    valid: false,
    errors: lastErrors,
    attempts,
    latencyMs: Date.now() - start,
  };
}

function appendCorrection(messages, lastRaw, errors) {
  messages.push({ role: "assistant", content: lastRaw });
  messages.push({
    role: "user",
    content: `That response was invalid: ${errors.join("; ")}. Reply again with ONLY corrected JSON.`,
  });
}
