import { describe, it, expect, vi } from "vitest";
import {
  createHostDataHandler,
  createPlayerDataHandler,
} from "../providers/peer/dataHandlers";
import { normalizedId } from "../providers/peer/connectionManager";
import { MESSAGE_TYPES } from "../constants/messageTypes";

function makeHandlerRefs() {
  return {
    wheel: { current: null },
    chat: { current: null },
    scenario: { current: null },
    characterSheet: { current: null },
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
      [normalizedId("p1")]: "Alice",
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
      [normalizedId("new-peer")]: "Alice",
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
});
