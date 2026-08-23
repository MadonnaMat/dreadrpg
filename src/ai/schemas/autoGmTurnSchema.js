// One AutoGM turn's structured output. `targetPlayerName`/`pullsRequired`
// only matter when `callForPull` is true - kept as plain required fields
// rather than optional/nullable ones, matching every other schema in this
// app and WebLLM's constrained-JSON mode (see docs on scenarioSchema.js).
export const autoGmTurnSchema = {
  type: "object",
  properties: {
    narration: { type: "string" },
    callForPull: { type: "boolean" },
    targetPlayerName: { type: "string" },
    pullsRequired: { type: "integer" },
    readyToRestack: { type: "boolean" },
    campaignNoteUpdates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionName: { type: "string" },
          itemText: { type: "string" },
          description: { type: "string" },
          seenByCharacter: { type: "string" },
          takenByCharacter: { type: "string" },
        },
        required: [
          "sectionName",
          "itemText",
          "description",
          "seenByCharacter",
          "takenByCharacter",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "narration",
    "callForPull",
    "targetPlayerName",
    "pullsRequired",
    "readyToRestack",
    "campaignNoteUpdates",
  ],
  additionalProperties: false,
};

function validateNoteUpdate(update, index) {
  if (typeof update !== "object" || update === null || Array.isArray(update)) {
    return [`campaignNoteUpdates[${index}]: expected an object.`];
  }
  const errors = [];
  [
    "sectionName",
    "itemText",
    "description",
    "seenByCharacter",
    "takenByCharacter",
  ].forEach((field) => {
    if (typeof update[field] !== "string") {
      errors.push(
        `campaignNoteUpdates[${index}]: "${field}" must be a string.`
      );
    }
  });
  return errors;
}

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  const errors = [];
  if (typeof data.narration !== "string") {
    errors.push('Field "narration" must be a string.');
  }
  if (typeof data.callForPull !== "boolean") {
    errors.push('Field "callForPull" must be a boolean.');
  }
  if (typeof data.targetPlayerName !== "string") {
    errors.push('Field "targetPlayerName" must be a string.');
  }
  if (!Number.isInteger(data.pullsRequired)) {
    errors.push('Field "pullsRequired" must be an integer.');
  }
  if (typeof data.readyToRestack !== "boolean") {
    errors.push('Field "readyToRestack" must be a boolean.');
  }
  if (!Array.isArray(data.campaignNoteUpdates)) {
    errors.push('Field "campaignNoteUpdates" must be an array.');
  } else {
    errors.push(
      ...data.campaignNoteUpdates.flatMap((update, index) =>
        validateNoteUpdate(update, index)
      )
    );
  }
  return { valid: errors.length === 0, errors };
}
