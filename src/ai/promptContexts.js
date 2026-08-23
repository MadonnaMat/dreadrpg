// Pure functions turning plain app data into the user-turn message text
// sent alongside a system prompt (src/prompts/*.md). No engine/network
// involvement here, so these are cheaply unit-testable on their own.

export function buildScenarioGenerationContext({ premise }) {
  return `Generate a Dread RPG scenario based on this premise:\n\n${premise}`;
}

export function buildCastGenerationContext({ castDescription, scenario }) {
  const scenarioContext = scenario?.description
    ? `\n\nScenario context:\n${scenario.description}`
    : "";
  return `Generate a cast of characters for this Dread RPG game. The GM described the cast as:\n\n${castDescription}${scenarioContext}`;
}

export function buildSheetAnswerContext({ question, otherAnswers, scenario }) {
  const answeredSoFar = Object.values(otherAnswers || {})
    .filter((answer) => answer?.text)
    .map((answer) => `- ${answer.text}`)
    .join("\n");
  const priorAnswers = answeredSoFar
    ? `\n\nThis character's other answers so far:\n${answeredSoFar}`
    : "";
  const scenarioContext = scenario?.description
    ? `\n\nScenario:\n${scenario.description}`
    : "";
  return `Suggest an answer to this character questionnaire question:\n\n"${question}"${priorAnswers}${scenarioContext}`;
}
