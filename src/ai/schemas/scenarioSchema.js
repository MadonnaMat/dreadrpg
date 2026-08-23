// Matches Scenario.jsx's existing 7-field shape exactly - no shape change,
// so an AI draft can be spread directly into editScenario.
const REQUIRED_FIELDS = [
  "title",
  "description",
  "setting",
  "characters",
  "goals",
  "threats",
  "rules",
];

export const scenarioSchema = {
  type: "object",
  properties: Object.fromEntries(
    REQUIRED_FIELDS.map((field) => [field, { type: "string" }])
  ),
  required: REQUIRED_FIELDS,
  additionalProperties: false,
};

export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, errors: ["Expected a JSON object."] };
  }

  const errors = REQUIRED_FIELDS.filter(
    (field) => typeof data[field] !== "string"
  ).map((field) => `Field "${field}" must be a string.`);

  return { valid: errors.length === 0, errors };
}
