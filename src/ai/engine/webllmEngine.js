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
    dispose() {
      worker.terminate();
    },
  };
}
