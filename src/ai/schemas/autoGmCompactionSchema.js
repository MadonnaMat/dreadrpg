export const autoGmCompactionSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
  },
  required: ["summary"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  if (typeof data.summary !== "string" || !data.summary.trim()) {
    return {
      valid: false,
      errors: ['Field "summary" must be a non-empty string.'],
    };
  }
  return { valid: true, errors: [] };
}
