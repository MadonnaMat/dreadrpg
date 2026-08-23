// Pure functions turning plain app data into the user-turn message text
// sent alongside a system prompt (src/prompts/*.md). No engine/network
// involvement here, so these are cheaply unit-testable on their own.

// Formats every non-empty scenario field (not just `description`) into a
// labeled block - a question like "what is your biggest fear?" benefits
// from `threats`, an occupation question from `setting`, etc., not just
// the one-paragraph overview. `lastUpdated` is a timestamp, not content,
// so it's deliberately excluded. Returns "" when there's nothing to add,
// so callers can splice it in unconditionally.
const SCENARIO_FIELD_LABELS = [
  ["title", "Title"],
  ["description", "Description"],
  ["setting", "Setting"],
  ["characters", "Characters & Roles"],
  ["goals", "Goals & Objectives"],
  ["threats", "Threats & Dangers"],
  ["rules", "Special Rules & Notes"],
];

function formatScenarioContext(scenario) {
  if (!scenario) return "";

  const lines = SCENARIO_FIELD_LABELS.filter(([field]) => scenario[field]).map(
    ([field, label]) => `${label}: ${scenario[field]}`
  );

  return lines.length ? `\n\nScenario:\n${lines.join("\n")}` : "";
}

export function buildScenarioGenerationContext({ premise }) {
  return `Generate a Dread RPG scenario based on this premise:\n\n${premise}`;
}

export function buildCastGenerationContext({ castDescription, scenario }) {
  return `Generate a cast of characters for this Dread RPG game. The GM described the cast as:\n\n${castDescription}${formatScenarioContext(scenario)}`;
}

export function buildSheetAnswerContext({ question, otherAnswers, scenario }) {
  const answeredSoFar = Object.values(otherAnswers || {})
    .filter((answer) => answer?.text)
    .map((answer) => `- ${answer.text}`)
    .join("\n");
  const priorAnswers = answeredSoFar
    ? `\n\nThis character's other answers so far:\n${answeredSoFar}`
    : "";
  return `Suggest an answer to this character questionnaire question:\n\n"${question}"${priorAnswers}${formatScenarioContext(scenario)}`;
}
