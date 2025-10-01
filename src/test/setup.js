import "@testing-library/jest-dom";

// Mock PeerJS since it doesn't work well in test environment
globalThis.Peer = class MockPeer {
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
  }

  destroy() {
    this.connections.clear();
    this.eventHandlers = {};
  }
};

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

  send(data) {
    // Mock send - could be extended to simulate receiving
    console.log("Mock connection sending:", data);
  }

  close() {
    this.open = false;
  }
}

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
