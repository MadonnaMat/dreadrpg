import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAutoGmState,
  loadAutoGmState,
} from "../providers/autogm/autogmStoryPersistence";

describe("autogmStoryPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved for a gameId/hostName pair", () => {
    expect(loadAutoGmState("no-such-game", "GM")).toBeNull();
  });

  it("round-trips a saved state for a gameId/hostName pair", () => {
    const state = {
      enabled: true,
      storySummary: "The party arrived at the old mill at dusk.",
      rawHistory: [{ from: "Alice <The Drifter>", text: "I search the mill." }],
    };
    saveAutoGmState("game-abc", "GM", state);

    expect(loadAutoGmState("game-abc", "GM")).toEqual(state);
  });

  it("keeps different gameIds' state independent", () => {
    saveAutoGmState("game-a", "GM", { enabled: true });
    saveAutoGmState("game-b", "GM", { enabled: false });

    expect(loadAutoGmState("game-a", "GM")).toEqual({ enabled: true });
    expect(loadAutoGmState("game-b", "GM")).toEqual({ enabled: false });
  });

  it("keeps different hostNames on the same gameId independent - lets one browser simulate multiple GMs for testing", () => {
    saveAutoGmState("game-a", "Alice", { enabled: true });
    saveAutoGmState("game-a", "Bob", { enabled: false });

    expect(loadAutoGmState("game-a", "Alice")).toEqual({ enabled: true });
    expect(loadAutoGmState("game-a", "Bob")).toEqual({ enabled: false });
  });

  it("returns null instead of throwing on corrupted stored JSON", () => {
    localStorage.setItem("dread-rpg-autogm-state-broken-GM", "{not valid json");
    expect(loadAutoGmState("broken", "GM")).toBeNull();
  });
});
