import { describe, it, expect, vi } from "vitest";
import {
  buildGameSnapshot,
  dispatchToRegisteredHandlers,
} from "../providers/peer/gameSnapshot";

function makeStateRef(overrides = {}) {
  return {
    current: {
      hostName: "GM",
      users: { p1: "Alice" },
      towerSize: 25,
      dangerProbability: 0.2,
      awaitingReset: false,
      designatedSpinner: null,
      gameStarted: false,
      scenario: null,
      gameName: "",
      characters: {},
      allowPlayersToViewSheets: false,
      theme: "default",
      customColors: null,
      ...overrides,
    },
  };
}

describe("buildGameSnapshot", () => {
  it("builds a snapshot with the given type and current state", () => {
    const snapshot = buildGameSnapshot("welcome", makeStateRef());

    expect(snapshot).toEqual({
      type: "welcome",
      hostName: "GM",
      users: { p1: "Alice" },
      towerSize: 25,
      dangerProbability: 0.2,
      awaitingReset: false,
      designatedSpinner: null,
      gameStarted: false,
      scenario: null,
      gameName: "",
      characters: {},
      allowPlayersToViewSheets: false,
      theme: "default",
      customColors: null,
    });
  });

  it("includes designatedSpinner so a late joiner knows whose turn it is", () => {
    const snapshot = buildGameSnapshot(
      "game-data-sync",
      makeStateRef({ designatedSpinner: "Alice" })
    );

    expect(snapshot.designatedSpinner).toBe("Alice");
  });

  it("includes gameStarted so a late joiner can skip the lobby", () => {
    const snapshot = buildGameSnapshot(
      "game-data-sync",
      makeStateRef({ gameStarted: true })
    );

    expect(snapshot.gameStarted).toBe(true);
  });

  it("reflects whatever is currently in the ref, not a stale copy", () => {
    const stateRef = makeStateRef();
    stateRef.current.dangerProbability = 0.9;

    expect(
      buildGameSnapshot("game-data-sync", stateRef).dangerProbability
    ).toBe(0.9);
  });
});

describe("dispatchToRegisteredHandlers", () => {
  function makeHandlerRefs() {
    return {
      wheel: { current: vi.fn() },
      chat: { current: vi.fn() },
      scenario: { current: vi.fn() },
      characterSheet: { current: vi.fn() },
      ping: { current: vi.fn() },
      autoGmChat: { current: vi.fn() },
    };
  }

  it("always forwards to the wheel handler regardless of message type", () => {
    const handlerRefs = makeHandlerRefs();
    const data = { type: "chat", text: "hi" };
    dispatchToRegisteredHandlers(data, "conn", handlerRefs);

    expect(handlerRefs.wheel.current).toHaveBeenCalledWith(data, "conn");
  });

  it("only forwards to the chat handler for chat messages", () => {
    const handlerRefs = makeHandlerRefs();
    dispatchToRegisteredHandlers(
      { type: "scenario-update" },
      "conn",
      handlerRefs
    );

    expect(handlerRefs.chat.current).not.toHaveBeenCalled();
  });

  it("forwards chat messages to both the chat and autoGmChat handlers independently", () => {
    const handlerRefs = makeHandlerRefs();
    const data = { type: "chat", from: "Bob", text: "hi" };
    dispatchToRegisteredHandlers(data, "conn", handlerRefs);

    expect(handlerRefs.chat.current).toHaveBeenCalledWith(data, "conn");
    expect(handlerRefs.autoGmChat.current).toHaveBeenCalledWith(data, "conn");

    handlerRefs.autoGmChat.current.mockClear();
    dispatchToRegisteredHandlers(
      { type: "scenario-update" },
      "conn",
      handlerRefs
    );
    expect(handlerRefs.autoGmChat.current).not.toHaveBeenCalled();
  });

  it("forwards all five character-sheet-related types to the same handler", () => {
    const handlerRefs = makeHandlerRefs();
    const types = [
      "character-create",
      "character-clone",
      "character-update",
      "character-delete",
      "sheet-visibility-update",
    ];

    types.forEach((type) => {
      handlerRefs.characterSheet.current.mockClear();
      dispatchToRegisteredHandlers({ type }, "conn", handlerRefs);
      expect(handlerRefs.characterSheet.current).toHaveBeenCalledWith(
        { type },
        "conn"
      );
    });
  });

  it("only forwards presence-pong replies to the ping handler", () => {
    const handlerRefs = makeHandlerRefs();
    dispatchToRegisteredHandlers(
      { type: "presence-ping" },
      "conn",
      handlerRefs
    );
    expect(handlerRefs.ping.current).not.toHaveBeenCalled();

    const data = { type: "presence-pong", userName: "Bob", sentAt: 123 };
    dispatchToRegisteredHandlers(data, "conn", handlerRefs);
    expect(handlerRefs.ping.current).toHaveBeenCalledWith(data, "conn");
  });

  it("does nothing for an unregistered handler slot", () => {
    const handlerRefs = makeHandlerRefs();
    handlerRefs.wheel.current = null;
    expect(() =>
      dispatchToRegisteredHandlers({ type: "spin" }, "conn", handlerRefs)
    ).not.toThrow();
  });
});
