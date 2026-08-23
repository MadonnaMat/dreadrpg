export const autoGmRemovalNarrationSchema = {
  type: "object",
  properties: {
    narration: { type: "string" },
  },
  required: ["narration"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  if (typeof data.narration !== "string" || !data.narration.trim()) {
    return {
      valid: false,
      errors: ['Field "narration" must be a non-empty string.'],
    };
  }
  return { valid: true, errors: [] };
}
