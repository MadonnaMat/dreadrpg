// A small, single-purpose classification schema: decide only whether a
// player's just-declared action requires a Dread "pull," run BEFORE the
// main autogm-turn prompt (see autoGmTurnSchema.js). Kept deliberately
// minimal - a small local model reliably answering one narrow yes/no
// question is far more dependable than the same model reliably deciding
// it as one field among many inside a longer creative-writing response.
export const autoGmPullCheckSchema = {
  type: "object",
  properties: {
    requiresPull: { type: "boolean" },
    pullsRequired: { type: "integer" },
  },
  required: ["requiresPull", "pullsRequired"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  const errors = [];
  if (typeof data.requiresPull !== "boolean") {
    errors.push('Field "requiresPull" must be a boolean.');
  }
  if (!Number.isInteger(data.pullsRequired)) {
    errors.push('Field "pullsRequired" must be an integer.');
  }
  return { valid: errors.length === 0, errors };
}
