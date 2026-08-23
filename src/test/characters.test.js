import { describe, it, expect } from "vitest";
import {
  characterNameFor,
  formatUserWithCharacter,
  formatNameForList,
  isCharacterAlive,
  withUpdatedAnswer,
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

// Alice's original character died and she picked a replacement - both stay
// assigned to her (the dead one as a historical record), so any lookup by
// userName alone must specifically prefer the alive one, not just whichever
// happens to be first in the characters map.
const charactersWithReplacement = {
  ...characters,
  "char-3": {
    id: "char-3",
    name: "The Survivor",
    assignedTo: "Alice",
    alive: true,
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

  it("falls back to the userName when their only assignment is dead", () => {
    expect(characterNameFor(characters, "Alice")).toBe("Alice");
  });

  it("prefers a replacement character over a dead earlier one for the same player", () => {
    expect(characterNameFor(charactersWithReplacement, "Alice")).toBe(
      "The Survivor"
    );
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

  it("returns just the userName when their only assignment is dead", () => {
    expect(formatUserWithCharacter(characters, "Alice")).toBe("Alice");
  });

  it("prefers a replacement character over a dead earlier one for the same player", () => {
    expect(formatUserWithCharacter(charactersWithReplacement, "Alice")).toBe(
      "Alice <The Survivor>"
    );
  });
});

describe("formatNameForList", () => {
  it("tags the GM's own row with <GM> instead of a character", () => {
    expect(formatNameForList(characters, "GM Vera", "GM Vera")).toBe(
      "GM Vera <GM>"
    );
  });

  it("formats a player row the same way formatUserWithCharacter would", () => {
    expect(formatNameForList(characters, "Bob", "GM Vera")).toBe(
      "Bob <The Drifter>"
    );
  });

  it("leaves a player with no character as just their name", () => {
    expect(formatNameForList(characters, "Carol", "GM Vera")).toBe("Carol");
  });

  it("returns a falsy name unchanged", () => {
    expect(formatNameForList(characters, null, "GM Vera")).toBe(null);
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

describe("withUpdatedAnswer", () => {
  it("sets a new answer as unapproved on a character with no prior answers", () => {
    expect(withUpdatedAnswer({}, 0, "Bob")).toEqual({
      0: { text: "Bob", approved: false },
    });
  });

  it("resets approved to false when editing a previously-approved answer", () => {
    const character = { answers: { 0: { text: "Old", approved: true } } };
    expect(withUpdatedAnswer(character, 0, "New")).toEqual({
      0: { text: "New", approved: false },
    });
  });

  it("preserves other questions' answers untouched", () => {
    const character = {
      answers: {
        0: { text: "Name", approved: true },
        1: { text: "Fear", approved: false },
      },
    };
    expect(withUpdatedAnswer(character, 1, "New fear")).toEqual({
      0: { text: "Name", approved: true },
      1: { text: "New fear", approved: false },
    });
  });
});
