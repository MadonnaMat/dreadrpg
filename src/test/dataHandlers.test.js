import { describe, it, expect, vi } from "vitest";
import {
  createHostDataHandler,
  createPlayerDataHandler,
} from "../providers/peer/dataHandlers";
import { MESSAGE_TYPES } from "../constants/messageTypes";

function makeHandlerRefs() {
  return {
    wheel: { current: null },
    chat: { current: null },
    scenario: { current: null },
    characterSheet: { current: null },
    ping: { current: null },
    autoGmChat: { current: null },
  };
}

function makeConnection(peerId) {
  return { peer: peerId, send: vi.fn() };
}

describe("createHostDataHandler - join handling", () => {
  it("accepts a join with a userName nobody else is currently using", () => {
    const currentStateRef = { current: { users: {}, presence: {} } };
    const setUsers = vi.fn();
    const setPresence = vi.fn();
    const sendToPeers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      setPresence,
      handlerRefs: makeHandlerRefs(),
      sendToPeers,
    });
    const c = makeConnection("p1");

    handler({ type: MESSAGE_TYPES.JOIN, peerId: "p1", userName: "Alice" }, c);

    expect(setUsers).toHaveBeenCalledWith({
      p1: "Alice",
    });
    expect(setPresence).toHaveBeenCalledWith({
      Alice: { connected: true },
    });
    expect(c.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: MESSAGE_TYPES.WELCOME })
    );
  });

  it("rejects a join whose userName's presence is currently connected", () => {
    const currentStateRef = {
      current: { users: {}, presence: { Alice: { connected: true } } },
    };
    const setUsers = vi.fn();
    const setPresence = vi.fn();
    const sendToPeers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      setPresence,
      handlerRefs: makeHandlerRefs(),
      sendToPeers,
    });
    const c = makeConnection("new-peer");

    handler(
      { type: MESSAGE_TYPES.JOIN, peerId: "new-peer", userName: "Alice" },
      c
    );

    expect(setUsers).not.toHaveBeenCalled();
    expect(setPresence).not.toHaveBeenCalled();
    expect(c.send).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.JOIN_REJECTED,
      reason: "name-in-use",
    });
    expect(sendToPeers).not.toHaveBeenCalled();
  });

  it("sends the new joiner a welcome snapshot that already includes themselves, not the stale pre-join state", () => {
    // currentStateRef only mirrors real state via a post-render effect, so
    // without the fix this regresses to reflecting `current` from *before*
    // this join - i.e. missing the very player the snapshot is being sent
    // to (see the comment above the fix in dataHandlers.js).
    const currentStateRef = {
      current: {
        users: { existingPeer: "Alice" },
        presence: { Alice: { connected: true } },
      },
    };
    const setUsers = vi.fn();
    const setPresence = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      setPresence,
      handlerRefs: makeHandlerRefs(),
      sendToPeers: vi.fn(),
    });
    const c = makeConnection("new-peer");

    handler(
      { type: MESSAGE_TYPES.JOIN, peerId: "new-peer", userName: "Bob" },
      c
    );

    const welcomeMessage = c.send.mock.calls
      .map(([msg]) => msg)
      .find((msg) => msg.type === MESSAGE_TYPES.WELCOME);
    expect(welcomeMessage.users).toEqual({
      existingPeer: "Alice",
      "new-peer": "Bob",
    });
    expect(welcomeMessage.presence).toEqual({
      Alice: { connected: true },
      Bob: { connected: true },
    });
  });

  it("allows a disconnected player's name to be reclaimed and flips their presence back to connected", () => {
    const currentStateRef = {
      current: { users: {}, presence: { Alice: { connected: false } } },
    };
    const setUsers = vi.fn();
    const setPresence = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      setPresence,
      handlerRefs: makeHandlerRefs(),
      sendToPeers: vi.fn(),
    });
    const c = makeConnection("new-peer");

    handler(
      { type: MESSAGE_TYPES.JOIN, peerId: "new-peer", userName: "Alice" },
      c
    );

    expect(setUsers).toHaveBeenCalledWith({
      "new-peer": "Alice",
    });
    expect(setPresence).toHaveBeenCalledWith({
      Alice: { connected: true },
    });
  });
});

describe("createPlayerDataHandler - join-rejected handling", () => {
  it("surfaces a friendly error and clears conn without touching users", () => {
    const setConn = vi.fn();
    const setJoinError = vi.fn();
    const setConnectionStatus = vi.fn();
    const setUsers = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs: makeHandlerRefs(),
      setUsers,
      setConnectionStatus,
      setConn,
      setJoinError,
    });

    handler({ type: MESSAGE_TYPES.JOIN_REJECTED, reason: "name-in-use" });

    expect(setJoinError).toHaveBeenCalledWith(expect.any(String));
    expect(setConn).toHaveBeenCalledWith(null);
    expect(setUsers).not.toHaveBeenCalled();
  });
});

describe("createPlayerDataHandler - presence ping", () => {
  it("replies to a presence-ping with the player's own userName and the echoed sentAt, without dispatching it further", () => {
    const handlerRefs = makeHandlerRefs();
    handlerRefs.wheel.current = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs,
      setUsers: vi.fn(),
      setConnectionStatus: vi.fn(),
      userName: "Bob",
    });
    const connection = { send: vi.fn() };

    handler({ type: MESSAGE_TYPES.PRESENCE_PING, sentAt: 1000 }, connection);

    expect(connection.send).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.PRESENCE_PONG,
      userName: "Bob",
      sentAt: 1000,
    });
    expect(handlerRefs.wheel.current).not.toHaveBeenCalled();
  });
});

describe("createPlayerDataHandler - GM Admin Panel broadcasts", () => {
  it("applies a live game-name-update from the GM", () => {
    const setGameName = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs: makeHandlerRefs(),
      setUsers: vi.fn(),
      setConnectionStatus: vi.fn(),
      setGameName,
      setTowerSize: vi.fn(),
    });

    handler({
      type: MESSAGE_TYPES.GAME_NAME_UPDATE,
      gameName: "A Renamed Campaign",
    });

    expect(setGameName).toHaveBeenCalledWith("A Renamed Campaign");
  });

  it("applies a live tower-size-update from the GM", () => {
    const setTowerSize = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs: makeHandlerRefs(),
      setUsers: vi.fn(),
      setConnectionStatus: vi.fn(),
      setGameName: vi.fn(),
      setTowerSize,
    });

    handler({ type: MESSAGE_TYPES.TOWER_SIZE_UPDATE, towerSize: 40 });

    expect(setTowerSize).toHaveBeenCalledWith(40);
  });

  it("applies a live presence-update (e.g. a disconnect, or a GM removing a player)", () => {
    const setPresence = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs: makeHandlerRefs(),
      setUsers: vi.fn(),
      setConnectionStatus: vi.fn(),
      setPresence,
    });

    const presence = { Alice: { connected: false } };
    handler({ type: MESSAGE_TYPES.PRESENCE_UPDATE, presence });

    expect(setPresence).toHaveBeenCalledWith(presence);
  });

  it("applies a live autogm-thinking-update from the GM", () => {
    const setAutoGmThinking = vi.fn();
    const handler = createPlayerDataHandler({
      handlerRefs: makeHandlerRefs(),
      setUsers: vi.fn(),
      setConnectionStatus: vi.fn(),
      setAutoGmThinking,
    });

    handler({
      type: MESSAGE_TYPES.AUTOGM_THINKING_UPDATE,
      autoGmThinking: true,
    });

    expect(setAutoGmThinking).toHaveBeenCalledWith(true);
  });
});
