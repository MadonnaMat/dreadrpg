// The full, rebuilt campaign-notes list the consolidation prompt returns -
// same array-of-sections shape as the app's real campaignNotes state, plus
// each item's seenBy/takenBy tracking (see helpers/campaignNotes.js's
// reconcileConsolidatedNotes, which converts this back into the app's
// actual shape). "takenBy" uses "" for not-taken rather than null, matching
// every other optional-string field in this app's structured schemas.
export const autoGmCampaignNotesConsolidationSchema = {
  type: "array",
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
            seenBy: { type: "array", items: { type: "string" } },
            takenBy: { type: "string" },
          },
          required: ["text", "description", "seenBy", "takenBy"],
          additionalProperties: false,
        },
      },
    },
    required: ["name", "items"],
    additionalProperties: false,
  },
};

function validateItem(item, sectionIndex, itemIndex) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return [`Section ${sectionIndex}, item ${itemIndex}: expected an object.`];
  }
  const errors = [];
  if (typeof item.text !== "string" || !item.text.trim()) {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "text" must be a non-empty string.`
    );
  }
  if (typeof item.description !== "string") {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "description" must be a string.`
    );
  }
  if (
    !Array.isArray(item.seenBy) ||
    !item.seenBy.every((name) => typeof name === "string")
  ) {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "seenBy" must be an array of strings.`
    );
  }
  if (typeof item.takenBy !== "string") {
    errors.push(
      `Section ${sectionIndex}, item ${itemIndex}: "takenBy" must be a string.`
    );
  }
  return errors;
}

function validateSection(entry, index) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return [`Section ${index}: expected an object.`];
  }
  const errors = [];
  if (typeof entry.name !== "string" || !entry.name.trim()) {
    errors.push(`Section ${index}: "name" must be a non-empty string.`);
  }
  if (!Array.isArray(entry.items)) {
    errors.push(`Section ${index}: "items" must be an array.`);
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
  if (!Array.isArray(data)) {
    return { valid: false, errors: ["Expected an array of sections."] };
  }
  const errors = data.flatMap((entry, index) => validateSection(entry, index));
  return { valid: errors.length === 0, errors };
}
