// Canned test inputs for the dev-only prompt-testing harness
// (src/components/dev/PromptTestHarness.jsx) - lets someone iterating on
// src/prompts/*.md wording try a few representative inputs without having
// to play through the whole app to reach each flow.
export const DEV_FIXTURES = {
  scenarioGeneration: [
    {
      label: "Haunted lighthouse",
      input: {
        premise:
          "A remote lighthouse keeper stops responding to radio contact.",
      },
    },
    {
      label: "Derelict ship",
      input: {
        premise:
          "A salvage crew boards a ship found adrift with no crew aboard.",
      },
    },
  ],
  castGeneration: [
    {
      label: "Coast Guard team (with scenario context)",
      input: {
        castDescription:
          "A four-person Coast Guard team sent to investigate a silent lighthouse.",
        scenario: {
          description:
            "A remote lighthouse keeper stops responding to radio contact.",
        },
      },
    },
    {
      label: "Camping trip (no scenario context)",
      input: {
        castDescription: "Six college friends on a camping trip.",
        scenario: null,
      },
    },
  ],
  sheetAnswerAssist: [
    {
      label: "Fear question, no prior answers",
      input: {
        question: "What is your biggest fear?",
        otherAnswers: {},
        scenario: null,
      },
    },
    {
      label: "Name question, with prior context",
      input: {
        question: "What is your name?",
        otherAnswers: {
          0: { text: "I used to work in a hospital.", approved: false },
        },
        scenario: {
          description:
            "A remote lighthouse keeper stops responding to radio contact.",
        },
      },
    },
  ],
};
