import { describe, it, expect } from "vitest";
import {
  scoreKeywordOverlap,
  buildRelevanceQuery,
  selectRelevantCampaignNotes,
  countNoteItems,
  countPinnedNoteItems,
} from "../helpers/contextRelevance";

function item(text, extra = {}) {
  return {
    text,
    description: "",
    seenBy: [],
    takenBy: null,
    pinned: false,
    pinnedSource: null,
    ...extra,
  };
}

describe("scoreKeywordOverlap", () => {
  it("counts shared meaningful words", () => {
    expect(scoreKeywordOverlap("the old mill burned", "mill")).toBe(1);
    expect(scoreKeywordOverlap("the old mill burned", "old mill")).toBe(2);
  });

  it("ignores stopwords and very short words, so they can't inflate a match", () => {
    expect(scoreKeywordOverlap("the and with from", "the and with from")).toBe(
      0
    );
    expect(scoreKeywordOverlap("it is a go", "it is a go")).toBe(0);
  });

  it("ignores case and punctuation", () => {
    expect(scoreKeywordOverlap("The Mill's door!", "mill door")).toBe(2);
  });

  it("scores nothing for unrelated text", () => {
    expect(scoreKeywordOverlap("lighthouse keeper", "rusty bicycle")).toBe(0);
  });

  it("handles empty and missing input without throwing", () => {
    expect(scoreKeywordOverlap("", "")).toBe(0);
    expect(scoreKeywordOverlap(undefined, null)).toBe(0);
  });
});

describe("buildRelevanceQuery", () => {
  it("separates the trigger from the recent lines around it", () => {
    const query = buildRelevanceQuery({
      trigger: { text: "I pry open the furnace" },
      rawHistory: [
        { from: "Alice", text: "oldest line" },
        { from: "Bob", text: "second line" },
        { from: "Alice", text: "third line" },
        { from: "Bob", text: "fourth line" },
      ],
    });
    expect(query.trigger).toContain("furnace");
    expect(query.recent).toContain("fourth line");
    // Only the last few lines are in scope, so the window stays bounded.
    expect(query.recent).not.toContain("oldest line");
  });

  it("leaves the story summary out entirely", () => {
    // The summary describes the whole game, so it name-drops most of the
    // notes - including it made nearly everything match every turn.
    const query = buildRelevanceQuery({
      trigger: { text: "I pry open the furnace" },
      storySummary: "The group reached the foundry and found a lantern.",
      rawHistory: [],
    });
    expect(JSON.stringify(query)).not.toContain("lantern");
  });

  it("tolerates missing pieces", () => {
    expect(buildRelevanceQuery({})).toEqual({ trigger: "", recent: "" });
  });
});

describe("selectRelevantCampaignNotes", () => {
  const notes = [
    {
      id: "note-1",
      name: "Locations",
      items: [item("Old Mill", { description: "Downstream by the river." })],
    },
    {
      id: "note-2",
      name: "Items",
      items: [item("Rusty Key"), item("Brass Lantern")],
    },
  ];

  it("keeps only the items the turn's words actually touch", () => {
    const result = selectRelevantCampaignNotes({
      campaignNotes: notes,
      query: "I search the old mill",
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Locations");
    expect(result[0].items.map((i) => i.text)).toEqual(["Old Mill"]);
  });

  it("drops a section once none of its items match", () => {
    const result = selectRelevantCampaignNotes({
      campaignNotes: notes,
      query: "I pick up the rusty key",
    });
    expect(result.map((section) => section.name)).toEqual(["Items"]);
    expect(result[0].items.map((i) => i.text)).toEqual(["Rusty Key"]);
  });

  it("always keeps a pinned item, however unrelated the turn is", () => {
    const withPin = [
      {
        id: "note-3",
        name: "Established Facts",
        items: [item("Marcus set the fire", { pinned: true })],
      },
      ...notes,
    ];
    const result = selectRelevantCampaignNotes({
      campaignNotes: withPin,
      query: "I order another drink",
    });
    expect(result.map((section) => section.name)).toEqual([
      "Established Facts",
    ]);
    expect(result[0].items[0].text).toBe("Marcus set the fire");
  });

  it("does not spend the item budget on pinned items", () => {
    const pinned = Array.from({ length: 5 }, (_, i) =>
      item(`Canon ${i}`, { pinned: true })
    );
    const result = selectRelevantCampaignNotes({
      campaignNotes: [
        { id: "note-1", name: "Facts", items: pinned },
        { id: "note-2", name: "Items", items: [item("Rusty Key")] },
      ],
      query: "the rusty key",
      maxItems: 1,
    });
    expect(countNoteItems(result)).toBe(6);
  });

  it("caps how many matching items it returns, keeping the strongest", () => {
    const items = [
      item("Mill"),
      item("Old Mill Wheel"),
      item("Mill Pond"),
      item("Lantern"),
    ];
    const result = selectRelevantCampaignNotes({
      campaignNotes: [{ id: "note-1", name: "Locations", items }],
      query: "the old mill wheel",
      maxItems: 2,
    });
    expect(countNoteItems(result)).toBe(2);
    expect(result[0].items.map((i) => i.text)).toContain("Old Mill Wheel");
  });

  it("ranks an already-seen item above a cold match on the same overlap", () => {
    const result = selectRelevantCampaignNotes({
      campaignNotes: [
        {
          id: "note-1",
          name: "Items",
          items: [item("Lantern"), item("Lantern", { seenBy: ["Marcus"] })],
        },
      ],
      query: "the lantern",
      maxItems: 1,
    });
    expect(result[0].items[0].seenBy).toEqual(["Marcus"]);
  });

  it("weighs what the player just said above the chatter around it", () => {
    const result = selectRelevantCampaignNotes({
      campaignNotes: [
        {
          id: "note-1",
          name: "Locations",
          items: [item("Old Mill"), item("Lighthouse")],
        },
      ],
      query: { trigger: "I search the mill", recent: "Bob: the lighthouse" },
      maxItems: 5,
    });
    // One word from the trigger clears the bar; one from recent chat alone
    // doesn't, so ambient mentions don't drag everything along.
    expect(result[0].items.map((i) => i.text)).toEqual(["Old Mill"]);
  });

  it("needs more than one coincidental word from recent chat", () => {
    const result = selectRelevantCampaignNotes({
      campaignNotes: [
        {
          id: "note-1",
          name: "Locations",
          items: [
            item("Loading Yard", { description: "Cut open from the inside." }),
          ],
        },
      ],
      // "inside" appears, but only as passing chatter - this is the exact
      // false match that made filtering a no-op before.
      query: { trigger: "I wait by the car", recent: "Bob: it is dark inside" },
    });
    expect(result).toEqual([]);
  });

  it("returns nothing when the turn matches nothing and nothing is pinned", () => {
    expect(
      selectRelevantCampaignNotes({
        campaignNotes: notes,
        query: "I order another drink",
      })
    ).toEqual([]);
  });

  it("handles missing notes and an empty query", () => {
    expect(selectRelevantCampaignNotes({ query: "anything" })).toEqual([]);
    expect(
      selectRelevantCampaignNotes({ campaignNotes: notes, query: "" })
    ).toEqual([]);
  });
});

describe("note counters", () => {
  const notes = [
    { name: "A", items: [item("one", { pinned: true }), item("two")] },
    { name: "B", items: [item("three")] },
  ];

  it("counts all items and pinned items", () => {
    expect(countNoteItems(notes)).toBe(3);
    expect(countPinnedNoteItems(notes)).toBe(1);
  });

  it("treats missing notes as zero", () => {
    expect(countNoteItems(undefined)).toBe(0);
    expect(countPinnedNoteItems(undefined)).toBe(0);
  });
});
