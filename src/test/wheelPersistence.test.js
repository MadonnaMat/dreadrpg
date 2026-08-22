import { describe, it, expect, beforeEach } from "vitest";
import {
  saveWheelState,
  loadWheelState,
} from "../providers/wheel/wheelPersistence";

describe("wheelPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved for a gameId", () => {
    expect(loadWheelState("no-such-game")).toBeNull();
  });

  it("round-trips a saved state for a gameId", () => {
    const state = {
      pullsSinceReset: 3,
      charactersRemoved: 1,
      dangerProbability: 0.42,
      awaitingReset: false,
    };
    saveWheelState("game-abc", state);

    expect(loadWheelState("game-abc")).toEqual(state);
  });

  it("keeps different gameIds' state independent", () => {
    saveWheelState("game-a", { pullsSinceReset: 1 });
    saveWheelState("game-b", { pullsSinceReset: 9 });

    expect(loadWheelState("game-a")).toEqual({ pullsSinceReset: 1 });
    expect(loadWheelState("game-b")).toEqual({ pullsSinceReset: 9 });
  });

  it("returns null instead of throwing on corrupted stored JSON", () => {
    localStorage.setItem("dread-rpg-wheel-state-broken", "{not valid json");
    expect(loadWheelState("broken")).toBeNull();
  });
});
