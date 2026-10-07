import { describe, it, expect } from "vitest";
import {
  collapseRepeatedSentences,
  recentGmNarration,
  looksLikeCommentary,
  revisionIsPlausible,
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

describe("revisionIsPlausible", () => {
  const draft = "The hatch gives way with a shriek of rust.";

  it("accepts a focused correction", () => {
    expect(
      revisionIsPlausible("The hatch gives way with a groan of rust.", draft)
    ).toBe(true);
  });

  it("rejects a revision that reports on the table instead of the fiction", () => {
    // Appended verbatim by the self-check in a live 1B session.
    expect(
      revisionIsPlausible(
        "The yard is quiet. The players are stuck waiting for something new to happen, and the game is waiting for them to make a move.",
        draft
      )
    ).toBe(false);
  });

  it("rejects a revision that balloons well past the draft", () => {
    expect(
      revisionIsPlausible(`${draft} ${"and more. ".repeat(40)}`, draft)
    ).toBe(false);
  });

  it("rejects an empty revision", () => {
    expect(revisionIsPlausible("", draft)).toBe(false);
    expect(revisionIsPlausible(null, draft)).toBe(false);
  });

  it("accepts anything non-empty when there is no draft to compare against", () => {
    expect(revisionIsPlausible("Something happens.", "")).toBe(true);
  });
});

describe("collapseRepeatedSentences", () => {
  it("collapses a sentence the model looped on", () => {
    // Verbatim from a live 1B opening turn. Every sentence opens "The
    // Drifter is standing", which is the loop even where the tails differ,
    // so only the first survives.
    const looped =
      "The Drifter is standing near the casting hall, looking out into the rain. The Drifter is standing near the sub-level, checking the water level. The Drifter is standing near the sub-level, checking the water level. The Drifter is standing near the sub-level, checking the water level.";
    expect(collapseRepeatedSentences(looped)).toBe(
      "The Drifter is standing near the casting hall, looking out into the rain."
    );
  });

  it("collapses sentences that share an opening but diverge after it", () => {
    // Also verbatim from a live opening - too little word overlap to catch
    // by threshold, but three runs at the same sentence all the same.
    const looped =
      "The Drifter is standing near the furnace, their eyes fixed on the entrance. The Drifter is standing at the edge, a small flashlight casting eerie shadows on the walls. The Drifter is standing at the edge of the foundry, with the Drifter nearby.";
    expect(collapseRepeatedSentences(looped)).toBe(
      "The Drifter is standing near the furnace, their eyes fixed on the entrance."
    );
  });

  it("leaves sentences that merely start with the same two words", () => {
    const text = "The door opens slowly. The air smells of rust and oil.";
    expect(collapseRepeatedSentences(text)).toBe(text);
  });

  it("ignores casing and punctuation when matching duplicates", () => {
    expect(collapseRepeatedSentences("The door opens. the door opens!")).toBe(
      "The door opens."
    );
  });

  it("collapses a sentence reworded with one noun swapped", () => {
    // Verbatim from a live 1B opening: three sentences sharing "with the
    // only sound being the creaking of old wooden beams".
    const looped =
      "The foundry is dimly lit, with the only sound being the creaking of old wooden beams. The night watchman's lantern casts flickering shadows on the walls. The sub-level is dimly lit, with the only sound being the creaking of old wooden beams. The sub-level's walls are dimly lit, with the only sound being the creaking of old wooden beams.";
    const result = collapseRepeatedSentences(looped);
    expect(result).toBe(
      "The foundry is dimly lit, with the only sound being the creaking of old wooden beams. The night watchman's lantern casts flickering shadows on the walls."
    );
  });

  it("leaves short lookalike sentences alone", () => {
    // Too few content words to tell a loop from ordinary prose.
    const text = "The door opens. The hatch opens.";
    expect(collapseRepeatedSentences(text)).toBe(text);
  });

  it("leaves distinct sentences alone", () => {
    const text = "The door opens. Something moves. The light fails.";
    expect(collapseRepeatedSentences(text)).toBe(text);
  });

  it("leaves a single sentence alone", () => {
    expect(collapseRepeatedSentences("The door opens.")).toBe(
      "The door opens."
    );
  });

  it("tolerates empty input", () => {
    expect(collapseRepeatedSentences("")).toBe("");
    expect(collapseRepeatedSentences(null)).toBe("");
  });
});

describe("cross-turn repetition", () => {
  const lastTurn =
    "The Drifter stands near the casting hall, looking out at the rain-soaked streets.";

  it("drops a sentence the GM already said on an earlier turn", () => {
    // The live failure: asked to read a ledger, the GM restated its own
    // previous line almost word for word.
    expect(collapseRepeatedSentences(lastTurn, lastTurn)).toBe("");
  });

  it("keeps the genuinely new part of a partly-repeated response", () => {
    const result = collapseRepeatedSentences(
      `${lastTurn} The ledger's last entry breaks off mid-word.`,
      lastTurn
    );
    expect(result).toBe("The ledger's last entry breaks off mid-word.");
  });

  it("leaves a response that says something new alone", () => {
    const fresh = "A door slams somewhere below, and the water keeps rising.";
    expect(collapseRepeatedSentences(fresh, lastTurn)).toBe(fresh);
  });

  it("does nothing without prior narration", () => {
    expect(collapseRepeatedSentences(lastTurn, "")).toBe(lastTurn);
  });
});

describe("recentGmNarration", () => {
  it("takes the GM's own recent lines and ignores the players'", () => {
    const history = [
      { from: "GM", text: "Older GM line." },
      { from: "Alice", text: "I open the door." },
      { from: "GM", text: "The hinges shriek." },
      { from: "Bob", text: "I follow." },
      { from: "GM", text: "Something moves below." },
    ];
    const result = recentGmNarration(history);
    expect(result).toContain("The hinges shriek.");
    expect(result).toContain("Something moves below.");
    // Bounded lookback, so an earlier beat can still be called back to.
    expect(result).not.toContain("Older GM line.");
    expect(result).not.toContain("I open the door.");
  });

  it("returns an empty string for an empty or missing history", () => {
    expect(recentGmNarration([])).toBe("");
    expect(recentGmNarration(undefined)).toBe("");
  });
});
