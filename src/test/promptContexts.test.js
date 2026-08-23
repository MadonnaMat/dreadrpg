import { describe, it, expect } from "vitest";
import {
  buildScenarioGenerationContext,
  buildCastGenerationContext,
  buildSheetAnswerContext,
} from "../ai/promptContexts";

describe("buildScenarioGenerationContext", () => {
  it("includes the given premise", () => {
    const context = buildScenarioGenerationContext({
      premise: "A lighthouse keeper vanishes.",
    });
    expect(context).toContain("A lighthouse keeper vanishes.");
  });
});

describe("buildCastGenerationContext", () => {
  it("includes the cast description", () => {
    const context = buildCastGenerationContext({
      castDescription: "A ship's crew of six.",
      scenario: null,
    });
    expect(context).toContain("A ship's crew of six.");
  });

  it("includes scenario description when provided", () => {
    const context = buildCastGenerationContext({
      castDescription: "A ship's crew.",
      scenario: { description: "Adrift at sea." },
    });
    expect(context).toContain("Adrift at sea.");
  });

  it("includes other scenario fields beyond just description", () => {
    const context = buildCastGenerationContext({
      castDescription: "A ship's crew.",
      scenario: {
        description: "Adrift at sea.",
        setting: "A sinking freighter, 1930s.",
        threats: "Something in the cargo hold.",
      },
    });
    expect(context).toContain("A sinking freighter, 1930s.");
    expect(context).toContain("Something in the cargo hold.");
  });

  it("omits scenario context entirely when no scenario is given", () => {
    const context = buildCastGenerationContext({
      castDescription: "A ship's crew.",
      scenario: null,
    });
    expect(context).not.toContain("Scenario:");
  });

  it("omits scenario context when the scenario has no non-empty fields", () => {
    const context = buildCastGenerationContext({
      castDescription: "A ship's crew.",
      scenario: { title: "", description: "" },
    });
    expect(context).not.toContain("Scenario:");
  });
});

describe("buildSheetAnswerContext", () => {
  it("includes the question", () => {
    const context = buildSheetAnswerContext({
      question: "What is your name?",
      otherAnswers: {},
      scenario: null,
    });
    expect(context).toContain("What is your name?");
  });

  it("includes only answered (non-empty) prior answers", () => {
    const context = buildSheetAnswerContext({
      question: "What do you fear?",
      otherAnswers: {
        0: { text: "The dark.", approved: false },
        1: { text: "", approved: false },
      },
      scenario: null,
    });
    expect(context).toContain("The dark.");
  });

  it("includes scenario description when provided", () => {
    const context = buildSheetAnswerContext({
      question: "What do you fear?",
      otherAnswers: {},
      scenario: { description: "A haunted ship." },
    });
    expect(context).toContain("A haunted ship.");
  });

  it("includes other scenario fields beyond just description, e.g. threats for a fear question", () => {
    const context = buildSheetAnswerContext({
      question: "What do you fear?",
      otherAnswers: {},
      scenario: {
        description: "A haunted ship.",
        threats: "Whatever is knocking from inside the walls.",
      },
    });
    expect(context).toContain("Whatever is knocking from inside the walls.");
  });

  it("omits scenario context entirely when no scenario is given", () => {
    const context = buildSheetAnswerContext({
      question: "What do you fear?",
      otherAnswers: {},
      scenario: null,
    });
    expect(context).not.toContain("Scenario:");
  });
});
