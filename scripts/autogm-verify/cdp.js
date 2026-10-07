// Minimal Chrome DevTools Protocol client, Node builtins only.
//
// Why this exists rather than Playwright: AutoGM needs WebGPU with the
// shader-f16 feature, which in practice means the host's own Chrome. Under
// WSL that browser is on the Windows side, Chrome binds its debugging port
// to loopback only, and WSL cannot reach Windows loopback - so the half of
// the harness that talks to Chrome has to run on Windows, where installing
// Playwright is a yak shave. Node 22+ ships a global WebSocket, which is the
// only thing CDP actually needs.
const CDP = "http://localhost:9222";

export async function attach() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  let target = targets.find((t) => t.type === "page");
  if (!target) {
    const created = await fetch(`${CDP}/json/new?about:blank`, {
      method: "PUT",
    });
    target = await created.json();
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("could not open a CDP socket"));
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = [];

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) {
      listeners.forEach((fn) => fn(message));
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (m) =>
        m.error
          ? reject(new Error(`${method}: ${m.error.message}`))
          : resolve(m.result)
      );
      ws.send(JSON.stringify({ id, method, params }));
    });

  const waitFor = (method, timeoutMs = 30000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${method}`)),
        timeoutMs
      );
      listeners.push((m) => {
        if (m.method === method) {
          clearTimeout(timer);
          resolve(m.params);
        }
      });
    });

  await send("Page.enable");
  await send("Runtime.enable");

  // `fnOrExpr` may be a function (serialized and called in the page) or a
  // raw expression string, which is what you want for anything built from
  // JSON.stringify'd arguments.
  const evaluate = async (fnOrExpr, { timeout = 60000 } = {}) => {
    const expression =
      typeof fnOrExpr === "function" ? `(${fnOrExpr.toString()})()` : fnOrExpr;
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "evaluate failed"
      );
    }
    return result.result.value;
  };

  const goto = async (url) => {
    const loaded = waitFor("Page.loadEventFired");
    await send("Page.navigate", { url });
    await loaded;
  };

  return {
    send,
    evaluate,
    goto,
    waitFor,
    onEvent: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}
