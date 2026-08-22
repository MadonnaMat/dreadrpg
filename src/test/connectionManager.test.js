import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createHostConnectionManager,
  createPlayerConnectionManager,
  normalizedId,
} from "../providers/peer/connectionManager";

// A hand-rolled DataConnection/Peer double pair with no autonomous behavior
// (unlike MockConnection/MockPeer in src/test/setup.js, which auto-open
// after a real setTimeout) - every open/close/data event here is driven
// explicitly by the test, so reconnect/backoff timing can be asserted
// deterministically. Declared via vi.hoisted since vi.mock's factory below
// is hoisted above normal declarations and would otherwise see these in
// their temporal dead zone.
const { FakeConnection, FakePeer } = vi.hoisted(() => {
  class FakeConnection {
    constructor(peer) {
      this.peer = peer;
      this.open = true;
      this.eventHandlers = {};
      this.sent = [];
    }
    on(event, handler) {
      this.eventHandlers[event] = handler;
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.open = false;
      this.eventHandlers.close?.();
    }
    emit(event, ...args) {
      this.eventHandlers[event]?.(...args);
    }
  }

  // connect() never auto-opens, so tests fully control when (and whether) a
  // redialed connection succeeds.
  class FakePeer {
    constructor(id) {
      this.id = id;
      this.eventHandlers = {};
      this.connections = new Map();
    }
    on(event, handler) {
      this.eventHandlers[event] = handler;
    }
    connect(peerId) {
      const connection = new FakeConnection(peerId);
      this.connections.set(peerId, connection);
      return connection;
    }
    reconnect() {}
    destroy() {
      this.connections.clear();
      this.eventHandlers = {};
    }
  }

  return { FakeConnection, FakePeer };
});

vi.mock("peerjs", () => ({ default: FakePeer }));

describe("createHostConnectionManager", () => {
  let manager;

  afterEach(() => {
    manager?.destroy();
  });

  it("sends broadcasts to a newly-registered connection", () => {
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData: vi.fn(),
      onConnectionClosed: vi.fn(),
    });
    const conn = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(conn);

    manager.sendToPeers({ type: "hello" });

    expect(conn.sent).toContainEqual({ type: "hello" });
  });

  it("reports a newly-opened connection via onConnectionOpen", () => {
    const onConnectionOpen = vi.fn();
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onConnectionOpen,
      onData: vi.fn(),
      onConnectionClosed: vi.fn(),
    });
    const conn = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(conn);

    conn.emit("open");

    expect(onConnectionOpen).toHaveBeenCalledWith(conn);
  });

  it("replaces a stale connection for the same peerId instead of duplicating it", () => {
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData: vi.fn(),
      onConnectionClosed: vi.fn(),
    });
    const first = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(first);
    const second = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(second);

    expect(first.open).toBe(false);

    manager.sendToPeers({ type: "hello" });
    expect(second.sent).toContainEqual({ type: "hello" });
    expect(first.sent).toEqual([]);
  });

  it("prunes a connection on close and reports it via onConnectionClosed", () => {
    const onConnectionClosed = vi.fn();
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData: vi.fn(),
      onConnectionClosed,
    });
    const conn = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(conn);

    conn.close();

    expect(onConnectionClosed).toHaveBeenCalledWith("player-1");
    manager.sendToPeers({ type: "hello" });
    expect(conn.sent).toEqual([]);
  });

  it("excludes a given peerId from a broadcast", () => {
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData: vi.fn(),
      onConnectionClosed: vi.fn(),
    });
    const a = new FakeConnection("a");
    const b = new FakeConnection("b");
    manager.peer.eventHandlers.connection(a);
    manager.peer.eventHandlers.connection(b);

    manager.sendToPeers({ type: "hello" }, { excludePeerId: "a" });

    expect(a.sent).toEqual([]);
    expect(b.sent).toContainEqual({ type: "hello" });
  });

  it("replies to a ping with a pong instead of forwarding it to onData", () => {
    const onData = vi.fn();
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData,
      onConnectionClosed: vi.fn(),
    });
    const conn = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(conn);

    conn.emit("data", { type: "ping" });

    expect(conn.sent).toContainEqual({ type: "pong" });
    expect(onData).not.toHaveBeenCalled();
  });

  it("forwards a non-heartbeat message to onData with the source connection", () => {
    const onData = vi.fn();
    manager = createHostConnectionManager({
      gameId: "game1",
      onPeerOpen: vi.fn(),
      onData,
      onConnectionClosed: vi.fn(),
    });
    const conn = new FakeConnection("player-1");
    manager.peer.eventHandlers.connection(conn);

    conn.emit("data", { type: "chat", text: "hi" });

    expect(onData).toHaveBeenCalledWith({ type: "chat", text: "hi" }, conn);
  });
});

describe("createPlayerConnectionManager", () => {
  let manager;

  afterEach(() => {
    manager?.destroy();
  });

  function openPeer(m) {
    m.peer.eventHandlers.open(m.peer.id);
  }

  function getConnection(m, gameId) {
    return m.peer.connections.get(normalizedId(gameId));
  }

  it("dials the GM once the local peer opens and reports a fresh (non-reconnect) open", () => {
    const onOpen = vi.fn();
    manager = createPlayerConnectionManager({
      gameId: "game1",
      peerId: "player-1",
      onPeerOpen: vi.fn(),
      onOpen,
      onData: vi.fn(),
      onStatusChange: vi.fn(),
    });

    openPeer(manager);
    const conn = getConnection(manager, "game1");
    conn.emit("open");

    expect(onOpen).toHaveBeenCalledWith(conn, { isReconnect: false });
  });

  it("replies to a ping with a pong instead of forwarding it to onData", () => {
    const onData = vi.fn();
    manager = createPlayerConnectionManager({
      gameId: "game1",
      peerId: "player-1",
      onPeerOpen: vi.fn(),
      onOpen: vi.fn(),
      onData,
      onStatusChange: vi.fn(),
    });

    openPeer(manager);
    const conn = getConnection(manager, "game1");
    conn.emit("open");

    conn.emit("data", { type: "ping" });

    expect(conn.sent).toContainEqual({ type: "pong" });
    expect(onData).not.toHaveBeenCalled();
  });

  it("marks a redial after a drop as a reconnect and resets the backoff counter", () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    const onStatusChange = vi.fn();
    manager = createPlayerConnectionManager({
      gameId: "game1",
      peerId: "player-1",
      onPeerOpen: vi.fn(),
      onOpen,
      onData: vi.fn(),
      onStatusChange,
    });

    openPeer(manager);
    let conn = getConnection(manager, "game1");
    conn.emit("open");

    conn.emit("close");
    expect(onStatusChange).toHaveBeenCalledWith("Reconnecting...");

    vi.advanceTimersByTime(1000); // first backoff delay - redials
    conn = getConnection(manager, "game1");
    conn.emit("open"); // the redialed connection succeeds

    expect(onOpen).toHaveBeenLastCalledWith(conn, { isReconnect: true });

    vi.useRealTimers();
  });

  it("gives up after exhausting its reconnect attempts", () => {
    vi.useFakeTimers();
    const onStatusChange = vi.fn();
    manager = createPlayerConnectionManager({
      gameId: "game1",
      peerId: "player-1",
      onPeerOpen: vi.fn(),
      onOpen: vi.fn(),
      onData: vi.fn(),
      onStatusChange,
    });

    openPeer(manager);
    let conn = getConnection(manager, "game1");
    conn.emit("open");

    // Every retry in this test keeps failing before it ever opens, burning
    // through all three configured backoff delays (1s/2s/4s).
    conn.emit("close");
    for (const delay of [1000, 2000, 4000]) {
      vi.advanceTimersByTime(delay);
      conn = getConnection(manager, "game1");
      conn.emit("close");
    }

    expect(onStatusChange).toHaveBeenCalledWith(
      "Connection lost. Please rejoin the game."
    );

    vi.useRealTimers();
  });
});
