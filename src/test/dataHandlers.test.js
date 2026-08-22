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
    const currentStateRef = { current: { users: {} } };
    const setUsers = vi.fn();
    const sendToPeers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      handlerRefs: makeHandlerRefs(),
      sendToPeers,
    });
    const c = makeConnection("p1");

    handler({ type: MESSAGE_TYPES.JOIN, peerId: "p1", userName: "Alice" }, c);

    expect(setUsers).toHaveBeenCalledWith({
      [normalizedId("p1")]: "Alice",
    });
    expect(c.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: MESSAGE_TYPES.WELCOME })
    );
  });

  it("rejects a join whose userName is already connected under a different peerId", () => {
    const currentStateRef = {
      current: { users: { [normalizedId("existing-peer")]: "Alice" } },
    };
    const setUsers = vi.fn();
    const sendToPeers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      handlerRefs: makeHandlerRefs(),
      sendToPeers,
    });
    const c = makeConnection("new-peer");

    handler(
      { type: MESSAGE_TYPES.JOIN, peerId: "new-peer", userName: "Alice" },
      c
    );

    expect(setUsers).not.toHaveBeenCalled();
    expect(c.send).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.JOIN_REJECTED,
      reason: "name-in-use",
    });
    expect(sendToPeers).not.toHaveBeenCalled();
  });

  it("allows the same peerId to re-send a join for its own existing name (idempotent)", () => {
    const peerId = normalizedId("p1");
    const currentStateRef = { current: { users: { [peerId]: "Alice" } } };
    const setUsers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
      handlerRefs: makeHandlerRefs(),
      sendToPeers: vi.fn(),
    });
    const c = makeConnection("p1");

    handler({ type: MESSAGE_TYPES.JOIN, peerId: "p1", userName: "Alice" }, c);

    expect(setUsers).toHaveBeenCalledWith({ [peerId]: "Alice" });
  });

  it("allows a disconnected player's name to be reclaimed once they're no longer in users", () => {
    // "existing-peer" already left (removed from users on disconnect), so
    // Alice's name is free again for a genuine rejoin under a new peerId.
    const currentStateRef = { current: { users: {} } };
    const setUsers = vi.fn();
    const handler = createHostDataHandler({
      currentStateRef,
      setUsers,
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
