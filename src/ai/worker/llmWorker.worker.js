import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Runs entirely inside the Web Worker - the actual model weights, WebGPU
// calls, and generation loop all happen here so the main thread (and the
// page's UI) never blocks on inference. No app logic belongs in this file;
// see src/ai/engine/webllmEngine.js for everything else.
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
  handler.onmessage(msg);
};
