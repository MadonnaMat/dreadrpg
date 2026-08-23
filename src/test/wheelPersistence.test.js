import { describe, it, expect, beforeEach } from "vitest";
import {
  saveWheelState,
  loadWheelState,
} from "../providers/wheel/wheelPersistence";

describe("wheelPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved for a gameId/hostName pair", () => {
    expect(loadWheelState("no-such-game", "GM")).toBeNull();
  });

  it("round-trips a saved state for a gameId/hostName pair", () => {
    const state = {
      pullsSinceReset: 3,
      charactersRemoved: 1,
      dangerProbability: 0.42,
      awaitingReset: false,
    };
    saveWheelState("game-abc", "GM", state);

    expect(loadWheelState("game-abc", "GM")).toEqual(state);
  });

  it("keeps different gameIds' state independent", () => {
    saveWheelState("game-a", "GM", { pullsSinceReset: 1 });
    saveWheelState("game-b", "GM", { pullsSinceReset: 9 });

    expect(loadWheelState("game-a", "GM")).toEqual({ pullsSinceReset: 1 });
    expect(loadWheelState("game-b", "GM")).toEqual({ pullsSinceReset: 9 });
  });

  it("keeps different hostNames on the same gameId independent - lets one browser simulate multiple GMs for testing", () => {
    saveWheelState("game-a", "Alice", { pullsSinceReset: 1 });
    saveWheelState("game-a", "Bob", { pullsSinceReset: 9 });

    expect(loadWheelState("game-a", "Alice")).toEqual({ pullsSinceReset: 1 });
    expect(loadWheelState("game-a", "Bob")).toEqual({ pullsSinceReset: 9 });
  });

  it("returns null instead of throwing on corrupted stored JSON", () => {
    localStorage.setItem("dread-rpg-wheel-state-broken-GM", "{not valid json");
    expect(loadWheelState("broken", "GM")).toBeNull();
  });
});
