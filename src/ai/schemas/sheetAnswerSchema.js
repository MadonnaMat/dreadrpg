export const sheetAnswerSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
  },
  required: ["answer"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  if (typeof data.answer !== "string" || !data.answer.trim()) {
    return {
      valid: false,
      errors: ['Field "answer" must be a non-empty string.'],
    };
  }
  return { valid: true, errors: [] };
}
