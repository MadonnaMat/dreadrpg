import { describe, it, expect } from "vitest";
import { validate as validateScenario } from "../ai/schemas/scenarioSchema";
import { validate as validateCast } from "../ai/schemas/castSchema";
import { validate as validateSheetAnswer } from "../ai/schemas/sheetAnswerSchema";
import { validate as validateCampaignNotes } from "../ai/schemas/campaignNotesSchema";

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
    const { valid, errors } = validateCampaignNotes([
      { name: "X", items: [] },
    ]);
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
