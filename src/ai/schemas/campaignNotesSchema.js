// Array of { name, items[] } drafts - matches what CampaignNotes.jsx's
// section-accept flow needs directly, one new section per accepted draft.
// Each item is { text, description } - description is where the AI should
// put concrete details (where an item is located, where a monster is
// located/how to beat it, what a location connects to, etc), always
// required so the GM never gets a bare, undetailed entry back.
export const campaignNotesSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    properties: {
      name: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            description: { type: "string" },
          },
          required: ["text", "description"],
          additionalProperties: false,
        },
        minItems: 1,
      },
    },
    required: ["name", "items"],
    additionalProperties: false,
  },
};

function validateItem(item, sectionIndex, itemIndex) {
  const errors = [];
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return [`Section ${sectionIndex}, item ${itemIndex}: expected an object.`];
  }
  if (typeof item.text !== "string" || !item.text.trim()) {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "text" must be a non-empty string.`
    );
  }
  if (typeof item.description !== "string" || !item.description.trim()) {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "description" must be a non-empty string.`
    );
  }
  return errors;
}

function validateSectionDraft(entry, index) {
  const errors = [];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return [`Section ${index}: expected an object.`];
  }
  if (typeof entry.name !== "string" || !entry.name.trim()) {
    errors.push(`Section ${index}: "name" must be a non-empty string.`);
  }
  if (!Array.isArray(entry.items) || entry.items.length === 0) {
    errors.push(`Section ${index}: "items" must be a non-empty array.`);
  } else {
    errors.push(
      ...entry.items.flatMap((item, itemIndex) =>
        validateItem(item, index, itemIndex)
      )
    );
  }
  return errors;
}

export function validate(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      valid: false,
      errors: ["Expected a non-empty array of sections."],
    };
  }

  const errors = data.flatMap((entry, index) =>
    validateSectionDraft(entry, index)
  );

  return { valid: errors.length === 0, errors };
}
