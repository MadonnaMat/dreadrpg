import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCurrentStateRef } from "../providers/peer/useCurrentStateRef";

// Guards against the exact bug this hook once had: PeerProvider passed a
// field (gameStarted) into this hook, but the hook didn't destructure it, so
// it silently never reached the ref that buildGameSnapshot reads from - no
// error, just a snapshot field that was always undefined.
describe("useCurrentStateRef", () => {
  it("mirrors every field it's given into the ref", () => {
    const props = {
      scenario: { title: "Test" },
      gameName: "Beneath a Metal Sky",
      characters: { "char-1": { id: "char-1", name: "Alice" } },
      allowPlayersToViewSheets: true,
      users: { p1: "Alice" },
      hostName: "GM",
      towerSize: 30,
      isGM: true,
      dangerProbability: 0.4,
      awaitingReset: true,
      gameStarted: true,
    };

    const { result } = renderHook(() => useCurrentStateRef(props));

    expect(result.current.current).toEqual(props);
  });
});
