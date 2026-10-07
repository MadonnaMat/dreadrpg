import { describe, it, expect } from "vitest";
import {
  looksLikeCommentary,
  stripEchoedPlayerAction,
} from "../helpers/narrationGuards";

describe("looksLikeCommentary", () => {
  it("catches the self-check describing its own edit", () => {
    // Verbatim shape of what reached players in a live 1B session.
    expect(
      looksLikeCommentary(
        "I revise the draft narration to make it consistent with the story and its characters. I remove the reference to the Drifter's new connection."
      )
    ).toBe(true);
  });

  it("catches other first-person edit reports", () => {
    expect(
      looksLikeCommentary("I removed the mention of the GM's plans.")
    ).toBe(true);
    expect(looksLikeCommentary("I also make sure to advance the scene.")).toBe(
      true
    );
    expect(
      looksLikeCommentary("I add the following lines to the narrative:")
    ).toBe(true);
    expect(
      looksLikeCommentary("The revised narration keeps the tension.")
    ).toBe(true);
  });

  it("leaves real narration alone, including NPC speech in first person", () => {
    expect(
      looksLikeCommentary(
        "The hatch gives way with a shriek of rust, and cold air pours out of the dark below."
      )
    ).toBe(false);
    expect(
      looksLikeCommentary(
        '"I told them not to come down here," the old man says, not looking up.'
      )
    ).toBe(false);
    expect(
      looksLikeCommentary(
        "Marcus changed after that night, and everyone knew it."
      )
    ).toBe(false);
  });

  it("treats empty input as fine", () => {
    expect(looksLikeCommentary("")).toBe(false);
    expect(looksLikeCommentary(null)).toBe(false);
  });
});

describe("stripEchoedPlayerAction", () => {
  const action = "I squeeze through the cut fence into the loading yard.";

  it("drops a verbatim echo of the player's action and keeps the rest", () => {
    const result = stripEchoedPlayerAction(
      `${action} The rain comes down harder, and somewhere inside, metal shifts.`,
      action
    );
    expect(result).toBe(
      "The rain comes down harder, and somewhere inside, metal shifts."
    );
  });

  it("ignores punctuation and casing differences in the echo", () => {
    const result = stripEchoedPlayerAction(
      "I squeeze through the cut fence into the loading yard — the rain comes down harder than before.",
      action
    );
    expect(result).toBe("the rain comes down harder than before.");
  });

  it("keeps narration that merely mentions the same place", () => {
    const narration =
      "The loading yard is empty, and the fence sways where it was cut.";
    expect(stripEchoedPlayerAction(narration, action)).toBe(narration);
  });

  it("keeps the original when the echo is the entire response", () => {
    expect(stripEchoedPlayerAction(action, action)).toBe(action);
  });

  it("does nothing without a trigger, or for a very short one", () => {
    const narration = "The door swings open.";
    expect(stripEchoedPlayerAction(narration, "")).toBe(narration);
    expect(stripEchoedPlayerAction(narration, "I go")).toBe(narration);
  });

  it("tolerates missing input", () => {
    expect(stripEchoedPlayerAction(null, action)).toBe("");
  });
});
