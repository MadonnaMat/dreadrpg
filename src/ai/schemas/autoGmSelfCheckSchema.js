// `revisedNarration` is a plain required string (not optional/nullable, per
// this app's schema convention) - "" is the "no revision needed" value,
// expected whenever `consistent` is true.
export const autoGmSelfCheckSchema = {
  type: "object",
  properties: {
    consistent: { type: "boolean" },
    reasoning: { type: "string" },
    revisedNarration: { type: "string" },
  },
  required: ["consistent", "reasoning", "revisedNarration"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  const errors = [];
  if (typeof data.consistent !== "boolean") {
    errors.push('Field "consistent" must be a boolean.');
  }
  if (typeof data.reasoning !== "string" || !data.reasoning.trim()) {
    errors.push('Field "reasoning" must be a non-empty string.');
  }
  if (typeof data.revisedNarration !== "string") {
    errors.push('Field "revisedNarration" must be a string.');
  }
  return { valid: errors.length === 0, errors };
}
