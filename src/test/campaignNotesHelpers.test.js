import { describe, it, expect } from "vitest";
import {
  generateSectionId,
  applyCampaignNoteUpdates,
  reconcileConsolidatedNotes,
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

describe("reconcileConsolidatedNotes", () => {
  it("converts a consolidated section/item into the app's real shape", () => {
    const result = reconcileConsolidatedNotes(
      [
        {
          name: "Locations",
          items: [
            {
              text: "Old Mill",
              description: "Downstream.",
              seenBy: ["Alice"],
              takenBy: "",
            },
          ],
        },
      ],
      []
    );
    expect(result).toEqual([
      {
        id: expect.stringMatching(/^note-/),
        name: "Locations",
        items: [
          {
            text: "Old Mill",
            description: "Downstream.",
            seenBy: ["Alice"],
            takenBy: null,
          },
        ],
      },
    ]);
  });

  it("reuses an existing section's id when the name matches", () => {
    const previous = [{ id: "note-existing", name: "Locations", items: [] }];
    const result = reconcileConsolidatedNotes(
      [{ name: "locations", items: [] }],
      previous
    );
    expect(result[0].id).toBe("note-existing");
  });

  it("assigns a fresh id to a genuinely new section", () => {
    const previous = [{ id: "note-existing", name: "Locations", items: [] }];
    const result = reconcileConsolidatedNotes(
      [{ name: "Threats", items: [] }],
      previous
    );
    expect(result[0].id).not.toBe("note-existing");
    expect(result[0].id).toMatch(/^note-/);
  });

  it("truncates an unusually long description", () => {
    const longDescription = "x".repeat(500);
    const result = reconcileConsolidatedNotes(
      [
        {
          name: "Items",
          items: [
            {
              text: "Journal",
              description: longDescription,
              seenBy: [],
              takenBy: "",
            },
          ],
        },
      ],
      []
    );
    expect(result[0].items[0].description.length).toBeLessThan(250);
    expect(result[0].items[0].description.endsWith("…")).toBe(true);
  });

  it("caps the number of sections and items per section", () => {
    const sections = Array.from({ length: 9 }, (_, i) => ({
      name: `Section ${i}`,
      items: [{ text: "First", description: "", seenBy: [], takenBy: "" }],
    }));
    const result = reconcileConsolidatedNotes(sections, []);
    expect(result).toHaveLength(8);
    expect(result.map((s) => s.name)).not.toContain("Section 0");

    const oneSectionManyItems = [
      {
        name: "Items",
        items: Array.from({ length: 9 }, (_, i) => ({
          text: `Item ${i}`,
          description: "",
          seenBy: [],
          takenBy: "",
        })),
      },
    ];
    const capped = reconcileConsolidatedNotes(oneSectionManyItems, []);
    expect(capped[0].items).toHaveLength(8);
    expect(capped[0].items.map((i) => i.text)).not.toContain("Item 0");
  });

  it("treats a missing consolidated list as empty", () => {
    expect(reconcileConsolidatedNotes(null, [])).toEqual([]);
    expect(reconcileConsolidatedNotes(undefined, [])).toEqual([]);
  });
});
