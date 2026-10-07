// A small, single-purpose classification schema: decide only what KIND of
// move the scene wants next, run alongside the pull check and BEFORE the
// main autogm-turn prompt (see autoGmTurnSchema.js). Same reasoning as
// autoGmPullCheckSchema.js - a small local model answering one narrow
// multiple-choice question is far more dependable than the same model
// weighing pacing implicitly while also writing prose.
//
// Advisory only: the turn prompt still decides the narration and the final
// call for a pull. This just tells it what the moment calls for, so it
// isn't inferring pacing from scratch every turn.
export const PACING_MOVES = [
  "continue",
  "escalate",
  "call_for_pull",
  "wrap_scene",
];

export const autoGmScenePacingSchema = {
  type: "object",
  properties: {
    pacingMove: { type: "string", enum: PACING_MOVES },
    // Unlike the pull check, this carries a short rationale - the whole
    // point of the step is making pacing visible in the debug panel, which
    // needs something human-readable to show.
    reasoning: { type: "string" },
  },
  required: ["pacingMove", "reasoning"],
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }
  const errors = [];
  // The schema's `enum` guides constrained generation but isn't enforced at
  // runtime (there's no schema-validator dependency here), so check it.
  if (!PACING_MOVES.includes(data.pacingMove)) {
    errors.push(
      `Field "pacingMove" must be one of: ${PACING_MOVES.join(", ")}.`
    );
  }
  if (typeof data.reasoning !== "string") {
    errors.push('Field "reasoning" must be a string.');
  }
  return { valid: errors.length === 0, errors };
}
