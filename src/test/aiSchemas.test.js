import { describe, it, expect } from "vitest";
import { validate as validateScenario } from "../ai/schemas/scenarioSchema";
import { validate as validateCast } from "../ai/schemas/castSchema";
import { validate as validateSheetAnswer } from "../ai/schemas/sheetAnswerSchema";
import { validate as validateCampaignNotes } from "../ai/schemas/campaignNotesSchema";
import { validate as validateAutoGmTurn } from "../ai/schemas/autoGmTurnSchema";
import { validate as validateAutoGmRemovalNarration } from "../ai/schemas/autoGmRemovalNarrationSchema";
import { validate as validateAutoGmCompaction } from "../ai/schemas/autoGmCompactionSchema";
import { validate as validateAutoGmSelfCheck } from "../ai/schemas/autoGmSelfCheckSchema";
import { validate as validateAutoGmPullCheck } from "../ai/schemas/autoGmPullCheckSchema";
import { validate as validateAutoGmCampaignNotesConsolidation } from "../ai/schemas/autoGmCampaignNotesConsolidationSchema";

describe("scenarioSchema.validate", () => {
  const validScenario = {
    title: "The Wreck",
    description: "A ship adrift.",
    setting: "Open ocean, 1920s.",
    characters: "Crew members.",
    goals: "Survive and find land.",
    threats: "The thing in the hold.",
    rules: "",
  };

  it("accepts a complete object with all string fields", () => {
    expect(validateScenario(validScenario)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a non-object", () => {
    expect(validateScenario("not an object").valid).toBe(false);
    expect(validateScenario(null).valid).toBe(false);
    expect(validateScenario(["array"]).valid).toBe(false);
  });

  it("rejects an object missing a required field", () => {
    const { valid, errors } = validateScenario({
      ...validScenario,
      threats: undefined,
    });
    expect(valid).toBe(false);
    expect(errors).toContain('Field "threats" must be a string.');
  });

  it("rejects a field with the wrong type", () => {
    const { valid, errors } = validateScenario({ ...validScenario, goals: 42 });
    expect(valid).toBe(false);
    expect(errors).toContain('Field "goals" must be a string.');
  });
});

describe("castSchema.validate", () => {
  const validCast = [
    { name: "The Technician", questions: ["What is your name?"] },
  ];

  it("accepts a non-empty array of valid character drafts", () => {
    expect(validateCast(validCast)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-array", () => {
    expect(validateCast({ name: "x" }).valid).toBe(false);
  });

  it("rejects an empty array", () => {
    expect(validateCast([]).valid).toBe(false);
  });

  it("rejects a draft with a missing name", () => {
    const { valid, errors } = validateCast([
      { questions: ["What is your name?"] },
    ]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"name"/);
  });

  it("rejects a draft with an empty questions array", () => {
    const { valid, errors } = validateCast([{ name: "X", questions: [] }]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"questions"/);
  });

  it("rejects a draft with a non-string question", () => {
    const { valid } = validateCast([{ name: "X", questions: ["ok", 5] }]);
    expect(valid).toBe(false);
  });
});

describe("campaignNotesSchema.validate", () => {
  const validNotes = [
    {
      name: "Monster Types",
      items: [
        {
          text: "The Drowned Sailor",
          description: "Weak to fire; haunts the flooded cargo hold.",
        },
      ],
    },
  ];

  it("accepts a non-empty array of valid section drafts", () => {
    expect(validateCampaignNotes(validNotes)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a non-array", () => {
    expect(validateCampaignNotes({ name: "x" }).valid).toBe(false);
  });

  it("rejects an empty array", () => {
    expect(validateCampaignNotes([]).valid).toBe(false);
  });

  it("rejects a section with a missing name", () => {
    const { valid, errors } = validateCampaignNotes([
      { items: validNotes[0].items },
    ]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"name"/);
  });

  it("rejects a section with an empty items array", () => {
    const { valid, errors } = validateCampaignNotes([{ name: "X", items: [] }]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"items"/);
  });

  it("rejects an item missing a description", () => {
    const { valid, errors } = validateCampaignNotes([
      { name: "X", items: [{ text: "Y" }] },
    ]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"description"/);
  });

  it("rejects an item with a blank text", () => {
    const { valid, errors } = validateCampaignNotes([
      { name: "X", items: [{ text: "  ", description: "Y" }] },
    ]);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/"text"/);
  });
});

describe("sheetAnswerSchema.validate", () => {
  it("accepts a non-empty answer string", () => {
    expect(validateSheetAnswer({ answer: "Something specific." })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a missing answer field", () => {
    expect(validateSheetAnswer({}).valid).toBe(false);
  });

  it("rejects a blank answer", () => {
    expect(validateSheetAnswer({ answer: "   " }).valid).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateSheetAnswer("nope").valid).toBe(false);
  });
});

describe("autoGmTurnSchema.validate", () => {
  const validTurn = {
    narration: "The floor creaks beneath your feet.",
    callForPull: true,
    targetPlayerName: "Alice",
    pullsRequired: 1,
    readyToRestack: false,
    campaignNoteUpdates: [],
  };

  it("accepts a fully-formed turn with no note updates", () => {
    expect(validateAutoGmTurn(validTurn)).toEqual({ valid: true, errors: [] });
  });

  it("accepts an empty narration (say nothing this turn)", () => {
    expect(validateAutoGmTurn({ ...validTurn, narration: "" }).valid).toBe(
      true
    );
  });

  it("accepts campaign note updates with all five string fields", () => {
    const result = validateAutoGmTurn({
      ...validTurn,
      campaignNoteUpdates: [
        {
          sectionName: "Locations",
          itemText: "Old Mill",
          description: "Abandoned, downstream.",
          seenByCharacter: "Alice",
          takenByCharacter: "",
        },
      ],
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-boolean callForPull", () => {
    expect(validateAutoGmTurn({ ...validTurn, callForPull: "yes" }).valid).toBe(
      false
    );
  });

  it("rejects a non-integer pullsRequired", () => {
    expect(validateAutoGmTurn({ ...validTurn, pullsRequired: 1.5 }).valid).toBe(
      false
    );
  });

  it("rejects a campaignNoteUpdates entry missing a field", () => {
    const result = validateAutoGmTurn({
      ...validTurn,
      campaignNoteUpdates: [{ sectionName: "Locations", itemText: "Old Mill" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateAutoGmTurn(null).valid).toBe(false);
  });
});

describe("autoGmRemovalNarrationSchema.validate", () => {
  it("accepts a non-empty narration string", () => {
    expect(
      validateAutoGmRemovalNarration({ narration: "Swallowed by the dark." })
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a blank narration", () => {
    expect(validateAutoGmRemovalNarration({ narration: "   " }).valid).toBe(
      false
    );
  });

  it("rejects a non-object", () => {
    expect(validateAutoGmRemovalNarration("nope").valid).toBe(false);
  });
});

describe("autoGmCompactionSchema.validate", () => {
  it("accepts a non-empty summary string", () => {
    expect(
      validateAutoGmCompaction({ summary: "The party reached the mill." })
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a blank summary", () => {
    expect(validateAutoGmCompaction({ summary: "" }).valid).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateAutoGmCompaction(null).valid).toBe(false);
  });
});

describe("autoGmSelfCheckSchema.validate", () => {
  it("accepts a consistent result with an empty revisedNarration", () => {
    expect(
      validateAutoGmSelfCheck({
        consistent: true,
        reasoning: "Matches established facts.",
        revisedNarration: "",
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts an inconsistent result with a revision", () => {
    expect(
      validateAutoGmSelfCheck({
        consistent: false,
        reasoning: "Marcus is already dead.",
        revisedNarration: "Selene presses forward alone.",
      }).valid
    ).toBe(true);
  });

  it("rejects a blank reasoning", () => {
    expect(
      validateAutoGmSelfCheck({
        consistent: true,
        reasoning: "",
        revisedNarration: "",
      }).valid
    ).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateAutoGmSelfCheck("nope").valid).toBe(false);
  });
});

describe("autoGmPullCheckSchema.validate", () => {
  it("accepts a fully-formed pull check", () => {
    expect(
      validateAutoGmPullCheck({ requiresPull: true, pullsRequired: 2 })
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts requiresPull: false", () => {
    expect(
      validateAutoGmPullCheck({ requiresPull: false, pullsRequired: 1 }).valid
    ).toBe(true);
  });

  it("rejects a non-boolean requiresPull", () => {
    expect(
      validateAutoGmPullCheck({ requiresPull: "yes", pullsRequired: 1 }).valid
    ).toBe(false);
  });

  it("rejects a non-integer pullsRequired", () => {
    expect(
      validateAutoGmPullCheck({ requiresPull: true, pullsRequired: 1.5 }).valid
    ).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateAutoGmPullCheck(null).valid).toBe(false);
  });
});

describe("autoGmCampaignNotesConsolidationSchema.validate", () => {
  const validConsolidation = [
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
  ];

  it("accepts a fully-formed consolidated list", () => {
    expect(
      validateAutoGmCampaignNotesConsolidation(validConsolidation)
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts an empty list", () => {
    expect(validateAutoGmCampaignNotesConsolidation([]).valid).toBe(true);
  });

  it("accepts a section with an empty items array", () => {
    expect(
      validateAutoGmCampaignNotesConsolidation([
        { name: "Locations", items: [] },
      ]).valid
    ).toBe(true);
  });

  it("rejects a non-array seenBy", () => {
    const result = validateAutoGmCampaignNotesConsolidation([
      {
        name: "Locations",
        items: [
          {
            text: "Old Mill",
            description: "",
            seenBy: "Alice",
            takenBy: "",
          },
        ],
      },
    ]);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-string takenBy", () => {
    const result = validateAutoGmCampaignNotesConsolidation([
      {
        name: "Locations",
        items: [
          { text: "Old Mill", description: "", seenBy: [], takenBy: null },
        ],
      },
    ]);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-array top level", () => {
    expect(validateAutoGmCampaignNotesConsolidation(null).valid).toBe(false);
    expect(validateAutoGmCampaignNotesConsolidation({}).valid).toBe(false);
  });
});
