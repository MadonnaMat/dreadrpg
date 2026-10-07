// "keyBeats" are the hard, durable facts the compacted stretch established,
// kept verbatim as pinned campaign notes instead of only inside "summary" -
// prose gets re-summarized every compaction, which blurs exactly the
// specifics ("Marcus set the fire") a horror game can least afford to lose.
export const autoGmCompactionSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    keyBeats: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "keyBeats"],
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
  // Listed in the schema's "required" above so constrained generation asks
  // for it, but deliberately tolerated as absent here: a stretch can
  // legitimately establish no beats, and failing the whole compaction (which
  // would throw away the summary too) over a missing array is worse than
  // treating it as none.
  if (
    data.keyBeats !== undefined &&
    (!Array.isArray(data.keyBeats) ||
      !data.keyBeats.every((beat) => typeof beat === "string"))
  ) {
    return {
      valid: false,
      errors: ['Field "keyBeats" must be an array of strings.'],
    };
  }
  return { valid: true, errors: [] };
}
