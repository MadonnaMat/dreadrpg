import { describe, it, expect } from "vitest";
import {
  characterNameFor,
  formatUserWithCharacter,
  isCharacterAlive,
} from "../helpers/characters";

const characters = {
  "char-1": { id: "char-1", name: "The Drifter", assignedTo: "Bob" },
  "char-2": {
    id: "char-2",
    name: "The Ghost",
    assignedTo: "Alice",
    alive: false,
  },
};

describe("characterNameFor", () => {
  it("returns the assigned character's name", () => {
    expect(characterNameFor(characters, "Bob")).toBe("The Drifter");
  });

  it("falls back to the userName when nobody has that assignment", () => {
    expect(characterNameFor(characters, "Carol")).toBe("Carol");
  });

  it("falls back to a generic placeholder with no userName at all", () => {
    expect(characterNameFor(characters, null)).toBe("The character");
  });
});

describe("formatUserWithCharacter", () => {
  it("combines userName and character name when assigned", () => {
    expect(formatUserWithCharacter(characters, "Bob")).toBe(
      "Bob <The Drifter>"
    );
  });

  it("returns just the userName when nobody has that assignment", () => {
    expect(formatUserWithCharacter(characters, "Carol")).toBe("Carol");
  });

  it("returns the userName unchanged (including falsy) with no assignment lookup possible", () => {
    expect(formatUserWithCharacter(characters, null)).toBe(null);
  });
});

describe("isCharacterAlive", () => {
  it("treats a character with no alive field as alive (pre-existing data)", () => {
    expect(isCharacterAlive({ name: "The Drifter" })).toBe(true);
  });

  it("treats alive: true as alive", () => {
    expect(isCharacterAlive({ alive: true })).toBe(true);
  });

  it("treats alive: false as not alive", () => {
    expect(isCharacterAlive({ alive: false })).toBe(false);
  });

  it("treats a missing character (no character at all) as not disqualifying", () => {
    expect(isCharacterAlive(undefined)).toBe(true);
  });
});
