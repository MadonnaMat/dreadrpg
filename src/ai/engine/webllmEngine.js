import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

// The one module that touches the real Worker + WebLLM package directly.
// Tests `vi.mock` this exact module (mirroring `vi.mock("peerjs", ...)` in
// src/test/setup.js) rather than trying to polyfill a real Worker or
// download a real multi-gigabyte model under happy-dom.
export async function createLlmEngine({ modelId, onProgress }) {
  const worker = new Worker(
    new URL("../worker/llmWorker.worker.js", import.meta.url),
    { type: "module" }
  );

  const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: onProgress,
  });

  return {
    chatCompletion(messages, options = {}) {
      return engine.chatCompletion({ messages, ...options });
    },
    // WebLLM holds a per-model lock for the duration of a generation, so an
    // abandoned call doesn't just waste its own time - every later call
    // queues behind it. Callers that give up on a slow generation need a way
    // to actually stop it rather than leaving it holding the lock.
    interrupt() {
      return engine.interruptGenerate();
    },
    dispose() {
      worker.terminate();
    },
  };
}
