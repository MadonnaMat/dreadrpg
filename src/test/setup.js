import "@testing-library/jest-dom";
import { vi } from "vitest";

// Polyfill Web APIs for Node.js environment
if (typeof globalThis.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = await import("util");
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Polyfill URLSearchParams if needed
if (typeof globalThis.URLSearchParams === "undefined") {
  globalThis.URLSearchParams = class URLSearchParams {
    constructor(params = "") {
      this.params = new Map();
      if (typeof params === "string") {
        params.split("&").forEach((param) => {
          const [key, value] = param.split("=");
          if (key) this.params.set(key, value || "");
        });
      }
    }
    get(key) {
      return this.params.get(key);
    }
    set(key, value) {
      this.params.set(key, value);
    }
    toString() {
      return Array.from(this.params.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    }
  };
}

// Polyfill URL if needed
if (typeof globalThis.URL === "undefined") {
  globalThis.URL = class URL {
    constructor(url) {
      this.href = url;
      this.origin = "http://localhost:3000";
      this.pathname = "/";
      this.search = "";
      this.searchParams = new URLSearchParams();
    }
  };
}

// Mock PeerJS since it doesn't work well in test environment. Real peerjs
// tries to reach the actual signaling server over WebSocket even under
// happy-dom, which never resolves/rejects within a test's lifetime - `import
// Peer from "peerjs"` must resolve to this mock via vi.mock below, not just
// via a global (ES module imports don't read from globalThis).
class MockPeer {
  constructor(id) {
    this.id = id;
    this.connections = new Map();
    this.eventHandlers = {};

    // Simulate async peer connection
    setTimeout(() => {
      if (this.eventHandlers.open) {
        this.eventHandlers.open(id);
      }
    }, 10);
  }

  on(event, handler) {
    this.eventHandlers[event] = handler;
  }

  connect(peerId) {
    const connection = new MockConnection(peerId);
    this.connections.set(peerId, connection);

    // Simulate async connection
    setTimeout(() => {
      if (this.eventHandlers.connection) {
        this.eventHandlers.connection(connection);
      }
    }, 10);

    return connection;
  }

  disconnect() {
    this.connections.clear();
    this.disconnected = true;
  }

  // Real PeerJS re-establishes the signaling connection and re-fires "open"
  // with the same id; tests rely on this to exercise reconnect-with-backoff
  // paths without needing real network behavior.
  reconnect() {
    this.disconnected = false;
    setTimeout(() => {
      if (this.eventHandlers.open) {
        this.eventHandlers.open(this.id);
      }
    }, 10);
  }

  destroy() {
    this.connections.clear();
    this.eventHandlers = {};
  }
}

class MockConnection {
  constructor(peerId) {
    this.peer = peerId;
    this.open = false;
    this.eventHandlers = {};

    // Simulate async connection opening
    setTimeout(() => {
      this.open = true;
      if (this.eventHandlers.open) {
        this.eventHandlers.open();
      }
    }, 10);
  }

  on(event, handler) {
    this.eventHandlers[event] = handler;
  }

  send() {
    // Mock send - could be extended to simulate receiving
  }

  close() {
    this.open = false;
    if (this.eventHandlers.close) {
      this.eventHandlers.close();
    }
  }
}

// `import Peer from "peerjs"` must resolve to MockPeer for this to actually
// take effect - plain `globalThis.Peer = MockPeer` has no effect on an ES
// module import, so without this every test that calls createGame/joinGame
// was silently instantiating the real peerjs client (which just never fires
// any event within a test's lifetime, since it can't reach a real signaling
// server under happy-dom).
vi.mock("peerjs", () => ({ default: MockPeer }));

globalThis.Peer = MockPeer;

// Mock URL constructor for browser environment
Object.defineProperty(window, "location", {
  value: {
    origin: "http://localhost:3000",
    pathname: "/",
    search: "",
  },
  writable: true,
});

// Navigator clipboard will be mocked by userEvent when needed

// Mock performance.now
if (!globalThis.performance) {
  globalThis.performance = {
    now: () => Date.now(),
  };
}
