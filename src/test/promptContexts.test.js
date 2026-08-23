import { describe, it, expect } from "vitest";
import {
  buildScenarioGenerationContext,
  buildCastGenerationContext,
  buildSheetAnswerContext,
  buildAutoGmTurnContext,
  buildAutoGmRemovalNarrationContext,
  buildAutoGmCompactionContext,
  buildAutoGmSelfCheckContext,
  buildAutoGmPullCheckContext,
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

const characters = {
  "char-1": {
    id: "char-1",
    name: "The Drifter",
    assignedTo: "Alice",
    alive: true,
  },
  "char-2": {
    id: "char-2",
    name: "The Ghost",
    assignedTo: "Bob",
    alive: false,
  },
  "char-3": { id: "char-3", name: "The Stranger", assignedTo: null },
};

const presence = {
  Alice: { connected: true },
  Bob: { connected: true },
};

describe("buildAutoGmTurnContext", () => {
  it("includes the scenario, character roster, and recent chat", () => {
    const context = buildAutoGmTurnContext({
      scenario: { description: "A haunted ship." },
      characters,
      storySummary: "",
      rawHistory: [{ from: "Alice", text: "I check the hold." }],
      dangerProbability: 0.3,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence,
    });
    expect(context).toContain("A haunted ship.");
    expect(context).toContain("The Drifter (played by Alice) - alive");
    expect(context).toContain(
      "The Ghost (played by Bob) - removed from the story"
    );
    expect(context).toContain("The Stranger (unassigned)");
    expect(context).toContain("I check the hold.");
  });

  it("lists only alive, connected assignments as valid pull targets", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters,
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence,
    });
    expect(context).toContain("Alice (playing The Drifter)");
    expect(context).not.toContain("Bob (playing");
  });

  it("says no one is targetable when the active-targets list is empty", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence: {},
    });
    expect(context).toContain("do not call for a pull right now");
  });

  it("includes the story summary when present", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "The party arrived at dusk.",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence: {},
    });
    expect(context).toContain("The party arrived at dusk.");
  });

  it("includes campaign notes sections and items", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [
        {
          name: "Locations",
          items: [{ text: "Old Mill", description: "Downstream." }],
        },
      ],
      presence: {},
    });
    expect(context).toContain("Old Mill");
    expect(context).toContain("Downstream.");
  });

  it("renders an item's seen-by and taken-by state", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [
        {
          name: "Items",
          items: [
            {
              text: "Rusty Key",
              description: "",
              seenBy: ["Alice", "Bob"],
              takenBy: "Alice",
            },
          ],
        },
      ],
      presence: {},
    });
    expect(context).toContain("seen by: Alice, Bob");
    expect(context).toContain("taken by: Alice");
  });

  it("mentions a pull already called by the dedicated pull-check pass", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence: {},
      pullJustCalled: { targetPlayerName: "Alice", pullsRequired: 2 },
    });
    expect(context).toContain("already been called for Alice");
    expect(context).toContain("2 pulls required");
    expect(context).toContain('do not set "callForPull"');
  });

  it("says nothing about a pull when none was called", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0,
      awaitingReset: false,
      designatedSpinner: null,
      campaignNotes: [],
      presence: {},
      pullJustCalled: null,
    });
    expect(context).not.toContain("already been called");
  });

  it("mentions the frozen tower when awaitingReset is true", () => {
    const context = buildAutoGmTurnContext({
      scenario: null,
      characters: {},
      storySummary: "",
      rawHistory: [],
      dangerProbability: 0.9,
      awaitingReset: true,
      designatedSpinner: null,
      campaignNotes: [],
      presence: {},
    });
    expect(context).toContain("frozen");
  });
});

describe("buildAutoGmRemovalNarrationContext", () => {
  it("includes the removed character's name", () => {
    const context = buildAutoGmRemovalNarrationContext({
      characterName: "Marcus",
      scenario: null,
      storySummary: "",
      rawHistory: [],
      campaignNotes: [],
    });
    expect(context).toContain("Marcus");
  });
});

describe("buildAutoGmCompactionContext", () => {
  it("notes there is no prior summary on the first compaction", () => {
    const context = buildAutoGmCompactionContext({
      priorSummary: "",
      rawHistory: [{ from: "Alice", text: "hi" }],
    });
    expect(context).toContain("no prior summary yet");
  });

  it("includes the prior summary when one exists", () => {
    const context = buildAutoGmCompactionContext({
      priorSummary: "The party reached the mill.",
      rawHistory: [],
    });
    expect(context).toContain("The party reached the mill.");
  });
});

describe("buildAutoGmSelfCheckContext", () => {
  it("includes the draft narration under review", () => {
    const context = buildAutoGmSelfCheckContext({
      draftNarration: "Marcus steps into the dark.",
      storySummary: "",
      rawHistory: [],
      campaignNotes: [],
      characters: {},
      dangerProbability: 0,
      awaitingReset: false,
    });
    expect(context).toContain("Marcus steps into the dark.");
  });
});

describe("buildAutoGmPullCheckContext", () => {
  it("includes the actor and the declared action", () => {
    const context = buildAutoGmPullCheckContext({
      actionText: "I kick down the door.",
      actorName: "The Drifter",
      scenario: null,
    });
    expect(context).toContain("The Drifter");
    expect(context).toContain("I kick down the door.");
  });

  it("includes scenario context when given", () => {
    const context = buildAutoGmPullCheckContext({
      actionText: "I step into the furnace.",
      actorName: "Marcus",
      scenario: { title: "The Foundry" },
    });
    expect(context).toContain("The Foundry");
  });
});
