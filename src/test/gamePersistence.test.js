import { describe, it, expect, beforeEach } from "vitest";
import {
  saveGameState,
  loadGameState,
  loadMyGames,
  upsertMyGame,
  deleteGameState,
} from "../providers/peer/gamePersistence";

describe("gamePersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("saveGameState / loadGameState", () => {
    it("returns null when nothing has been saved for a gameId/hostName pair", () => {
      expect(loadGameState("no-such-game", "GM")).toBeNull();
    });

    it("round-trips a saved state for a gameId/hostName pair", () => {
      const state = { gameName: "Campaign", towerSize: 25, characters: {} };
      saveGameState("game-abc", "GM", state);

      expect(loadGameState("game-abc", "GM")).toEqual(state);
    });

    it("keeps different hostNames on the same gameId independent", () => {
      saveGameState("game-a", "Alice", { gameName: "Alice's Game" });
      saveGameState("game-a", "Bob", { gameName: "Bob's Game" });

      expect(loadGameState("game-a", "Alice")).toEqual({
        gameName: "Alice's Game",
      });
      expect(loadGameState("game-a", "Bob")).toEqual({
        gameName: "Bob's Game",
      });
    });

    it("returns null instead of throwing on corrupted stored JSON", () => {
      localStorage.setItem("dread-rpg-game-state-broken-GM", "{not valid json");
      expect(loadGameState("broken", "GM")).toBeNull();
    });
  });

  describe("my games list", () => {
    it("starts empty", () => {
      expect(loadMyGames()).toEqual([]);
    });

    it("adds a new entry on upsert", () => {
      upsertMyGame("game-a", "GM", "Campaign A");

      const games = loadMyGames();
      expect(games).toHaveLength(1);
      expect(games[0]).toMatchObject({
        gameId: "game-a",
        hostName: "GM",
        gameName: "Campaign A",
      });
      expect(typeof games[0].lastPlayed).toBe("number");
    });

    it("updates the existing entry (by gameId+hostName) instead of duplicating it", () => {
      upsertMyGame("game-a", "GM", "Old Name");
      upsertMyGame("game-a", "GM", "New Name");

      const games = loadMyGames();
      expect(games).toHaveLength(1);
      expect(games[0].gameName).toBe("New Name");
    });

    it("keeps separate entries for the same gameId with different hostNames", () => {
      upsertMyGame("game-a", "Alice", "Alice's Game");
      upsertMyGame("game-a", "Bob", "Bob's Game");

      expect(loadMyGames()).toHaveLength(2);
    });

    it("deleteGameState removes both the state blob and the my-games entry", () => {
      saveGameState("game-a", "GM", { gameName: "Campaign A" });
      upsertMyGame("game-a", "GM", "Campaign A");

      deleteGameState("game-a", "GM");

      expect(loadGameState("game-a", "GM")).toBeNull();
      expect(loadMyGames()).toEqual([]);
    });

    it("deleteGameState only removes the matching gameId+hostName entry", () => {
      upsertMyGame("game-a", "Alice", "Alice's Game");
      upsertMyGame("game-a", "Bob", "Bob's Game");

      deleteGameState("game-a", "Alice");

      const games = loadMyGames();
      expect(games).toHaveLength(1);
      expect(games[0].hostName).toBe("Bob");
    });
  });
});
