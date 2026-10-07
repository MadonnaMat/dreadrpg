const DEFAULT_MAX_RETRIES = 2;
// Local in-browser inference has no server to time a request out, and
// nothing in the WebLLM stack bounds a single generation. A hung worker (a
// lost GPU context, a tab throttled in the background) would otherwise block
// every later call behind it forever, since WebLLM serializes generations on
// a per-model lock. Applied per attempt rather than across the whole call:
// sharing one budget across retries meant a slow first attempt ate it and
// the retries it exists to allow never got a fair chance to run.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 60000;
// A failed attempt usually means the engine is still settling, so re-firing
// in the same tick tends to reproduce the same failure. Grows per attempt.
const RETRY_BACKOFF_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Engine rejections are not reliably Errors: WebLLM's worker bridge rejects
// with a plain string, so reading `.message` threw away the only description
// there was and left the debug panel showing "Model request failed." for
// every distinct cause. Handle primitives and non-Error objects too, and
// keep the class name when it's the only thing carrying information.
const GENERIC_FAILURE = "Model request failed.";

function describeThrownObject(err) {
  const name = err.name || err.constructor?.name || "";
  const message = err.message || "";
  if (message)
    return name && name !== "Error" ? `${name}: ${message}` : message;

  // Its own stringification usually beats the class name - except for the
  // default, which says nothing at all.
  const stringified = String(err);
  if (stringified && stringified !== "[object Object]") return stringified;
  return name ? `${name} (no message)` : GENERIC_FAILURE;
}

function describeThrown(err) {
  if (err === null || err === undefined) return GENERIC_FAILURE;
  if (typeof err === "string") return err.trim() || GENERIC_FAILURE;
  if (typeof err !== "object") return String(err);
  return describeThrownObject(err);
}

async function completeWithTimeout({
  engine,
  messages,
  responseFormat,
  timeoutMs,
}) {
  let timer;
  try {
    return await Promise.race([
      engine.chatCompletion(messages, { response_format: responseFormat }),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          // Best-effort: free the per-model lock so the retry isn't queued
          // behind the generation we just gave up on. An engine that can't
          // be interrupted still fails safe - we just stop waiting on it.
          try {
            engine.interrupt?.();
          } catch {
            // Nothing useful to do; the timeout below is the real signal.
          }
          reject(new Error("Model call timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
//
// Pass `history` (a prior successful result's own `messages`, which already
// starts with the system prompt) instead of `systemPromptText` to continue
// a conversation - e.g. a follow-up "make it scarier" refinement - rather
// than starting a fresh one. On success the returned `messages` includes
// the accepted assistant turn, ready to hand back in as the next call's
// `history`.
export async function runStructuredPrompt({
  engine,
  systemPromptText,
  userContent,
  schema,
  validate,
  maxRetries = DEFAULT_MAX_RETRIES,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  history,
}) {
  const messages = history
    ? [...history, { role: "user", content: userContent }]
    : [
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
      completion = await completeWithTimeout({
        engine,
        messages,
        responseFormat,
        timeoutMs: attemptTimeoutMs,
      });
    } catch (err) {
      // An engine-level rejection (a worker hiccup, a transient generation
      // failure, a generation that outran its timeout) is exactly the kind
      // of recoverable failure this runner exists to survive - retry it the
      // same as an invalid-JSON or schema-validation failure, up to
      // maxRetries, instead of giving up on the very first attempt. There's
      // no completion to append a corrective message about, so just retry
      // with the same messages, after letting the engine settle.
      lastErrors = [describeThrown(err)];
      if (attempts <= maxRetries) await sleep(RETRY_BACKOFF_MS * attempts);
      continue;
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
        messages: [...messages, { role: "assistant", content: lastRaw }],
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
    messages,
  };
}

function appendCorrection(messages, lastRaw, errors) {
  messages.push({ role: "assistant", content: lastRaw });
  messages.push({
    role: "user",
    content: `That response was invalid: ${errors.join("; ")}. Reply again with ONLY corrected JSON.`,
  });
}
