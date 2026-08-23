import { describe, it, expect } from "vitest";
import {
  generateSectionId,
  applyCampaignNoteUpdates,
} from "../helpers/campaignNotes";

describe("generateSectionId", () => {
  it("returns a note- prefixed id", () => {
    expect(generateSectionId()).toMatch(/^note-/);
  });

  it("returns a different id on each call", () => {
    expect(generateSectionId()).not.toBe(generateSectionId());
  });
});

describe("applyCampaignNoteUpdates", () => {
  it("returns the original array unchanged when there are no updates", () => {
    const notes = [{ id: "note-1", name: "Locations", items: [] }];
    expect(applyCampaignNoteUpdates(notes, [])).toBe(notes);
    expect(applyCampaignNoteUpdates(notes, undefined)).toBe(notes);
  });

  it("adds a new item to a matching section by name (case-insensitive)", () => {
    const notes = [
      {
        id: "note-1",
        name: "Locations",
        items: [
          { text: "Old Mill", description: "", seenBy: [], takenBy: null },
        ],
      },
    ];
    const result = applyCampaignNoteUpdates(notes, [
      {
        sectionName: "locations",
        itemText: "Lighthouse",
        description: "On the cliff.",
        seenByCharacter: "",
        takenByCharacter: "",
      },
    ]);
    expect(result[0].items).toEqual([
      { text: "Old Mill", description: "", seenBy: [], takenBy: null },
      {
        text: "Lighthouse",
        description: "On the cliff.",
        seenBy: [],
        takenBy: null,
      },
    ]);
  });

  it("updates an existing item's description instead of duplicating it", () => {
    const notes = [
      {
        id: "note-1",
        name: "Locations",
        items: [
          {
            text: "Old Mill",
            description: "Downstream.",
            seenBy: [],
            takenBy: null,
          },
        ],
      },
    ];
    const result = applyCampaignNoteUpdates(notes, [
      {
        sectionName: "Locations",
        itemText: "old mill",
        description: "Downstream, now flooded.",
        seenByCharacter: "",
        takenByCharacter: "",
      },
    ]);
    expect(result[0].items).toEqual([
      {
        text: "Old Mill",
        description: "Downstream, now flooded.",
        seenBy: [],
        takenBy: null,
      },
    ]);
  });

  it("creates a new section when no existing section matches", () => {
    const result = applyCampaignNoteUpdates(
      [],
      [
        {
          sectionName: "Threats",
          itemText: "The Hollow Man",
          description: "Follows at night.",
          seenByCharacter: "",
          takenByCharacter: "",
        },
      ]
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Threats");
    expect(result[0].items).toEqual([
      {
        text: "The Hollow Man",
        description: "Follows at night.",
        seenBy: [],
        takenBy: null,
      },
    ]);
  });

  it("handles a null campaignNotes array as empty", () => {
    const result = applyCampaignNoteUpdates(null, [
      {
        sectionName: "Items",
        itemText: "Rusty Key",
        description: "",
        seenByCharacter: "",
        takenByCharacter: "",
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("treats a leading article as the same item, avoiding a near-duplicate", () => {
    const notes = [
      {
        id: "note-1",
        name: "Locations",
        items: [
          {
            text: "Old Mill",
            description: "Downstream.",
            seenBy: [],
            takenBy: null,
          },
        ],
      },
    ];
    const result = applyCampaignNoteUpdates(notes, [
      {
        sectionName: "Locations",
        itemText: "The Old Mill",
        description: "Downstream, now flooded.",
        seenByCharacter: "",
        takenByCharacter: "",
      },
    ]);
    expect(result[0].items).toEqual([
      {
        text: "Old Mill",
        description: "Downstream, now flooded.",
        seenBy: [],
        takenBy: null,
      },
    ]);
  });

  it("tracks which characters have seen an item, deduping repeats", () => {
    const result = applyCampaignNoteUpdates(
      [],
      [
        {
          sectionName: "Items",
          itemText: "Journal",
          description: "A leather journal.",
          seenByCharacter: "Alice",
          takenByCharacter: "",
        },
      ]
    );
    const afterSecondSighting = applyCampaignNoteUpdates(result, [
      {
        sectionName: "Items",
        itemText: "Journal",
        description: "",
        seenByCharacter: "Alice",
        takenByCharacter: "",
      },
    ]);
    const afterThirdSighting = applyCampaignNoteUpdates(afterSecondSighting, [
      {
        sectionName: "Items",
        itemText: "Journal",
        description: "",
        seenByCharacter: "Bob",
        takenByCharacter: "",
      },
    ]);
    expect(afterThirdSighting[0].items[0].seenBy).toEqual(["Alice", "Bob"]);
  });

  it("records who took an item and keeps it once set", () => {
    const result = applyCampaignNoteUpdates(
      [],
      [
        {
          sectionName: "Items",
          itemText: "Rusty Key",
          description: "",
          seenByCharacter: "Alice",
          takenByCharacter: "Alice",
        },
      ]
    );
    expect(result[0].items[0].takenBy).toBe("Alice");

    const afterAnotherUpdate = applyCampaignNoteUpdates(result, [
      {
        sectionName: "Items",
        itemText: "Rusty Key",
        description: "It unlocks the shed.",
        seenByCharacter: "Bob",
        takenByCharacter: "",
      },
    ]);
    expect(afterAnotherUpdate[0].items[0].takenBy).toBe("Alice");
    expect(afterAnotherUpdate[0].items[0].seenBy).toEqual(["Alice", "Bob"]);
  });

  it("truncates an unusually long description instead of letting it grow unbounded", () => {
    const longDescription = "x".repeat(500);
    const result = applyCampaignNoteUpdates(
      [],
      [
        {
          sectionName: "Items",
          itemText: "Journal",
          description: longDescription,
        },
      ]
    );
    expect(result[0].items[0].description.length).toBeLessThan(250);
    expect(result[0].items[0].description.endsWith("…")).toBe(true);
  });

  it("evicts the oldest item once a section exceeds the per-section cap", () => {
    let notes = [];
    for (let i = 0; i < 9; i += 1) {
      notes = applyCampaignNoteUpdates(notes, [
        { sectionName: "Items", itemText: `Item ${i}`, description: "" },
      ]);
    }
    expect(notes[0].items).toHaveLength(8);
    expect(notes[0].items.map((item) => item.text)).not.toContain("Item 0");
    expect(notes[0].items.map((item) => item.text)).toContain("Item 8");
  });

  it("evicts the oldest section once the total section cap is exceeded", () => {
    let notes = [];
    for (let i = 0; i < 9; i += 1) {
      notes = applyCampaignNoteUpdates(notes, [
        { sectionName: `Section ${i}`, itemText: "First", description: "" },
      ]);
    }
    expect(notes).toHaveLength(8);
    expect(notes.map((section) => section.name)).not.toContain("Section 0");
    expect(notes.map((section) => section.name)).toContain("Section 8");
  });
});
