// Array of { name, questions[] } drafts - matches what
// CharacterSheet.jsx's extended handleCreateCharacter needs directly, one
// CHARACTER_CREATE per accepted draft.
export const castSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    properties: {
      name: { type: "string" },
      questions: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
      },
    },
    required: ["name", "questions"],
    additionalProperties: false,
  },
};

function validateCharacterDraft(entry, index) {
  const errors = [];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return [`Character ${index}: expected an object.`];
  }
  if (typeof entry.name !== "string" || !entry.name.trim()) {
    errors.push(`Character ${index}: "name" must be a non-empty string.`);
  }
  if (!Array.isArray(entry.questions) || entry.questions.length === 0) {
    errors.push(
      `Character ${index}: "questions" must be a non-empty array of strings.`
    );
  } else if (
    !entry.questions.every((q) => typeof q === "string" && q.trim())
  ) {
    errors.push(`Character ${index}: every question must be a non-empty string.`);
  }
  return errors;
}

export function validate(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      valid: false,
      errors: ["Expected a non-empty array of characters."],
    };
  }

  const errors = data.flatMap((entry, index) =>
    validateCharacterDraft(entry, index)
  );

  return { valid: errors.length === 0, errors };
}
