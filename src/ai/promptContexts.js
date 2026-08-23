// Pure functions turning plain app data into the user-turn message text
// sent alongside a system prompt (src/prompts/*.md). No engine/network
// involvement here, so these are cheaply unit-testable on their own.

import {
  isCharacterAlive,
  characterNameFor,
  getActivePullTargets,
} from "../helpers/characters";

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

export function formatScenarioContext(scenario) {
  if (!scenario) return "";

  const lines = SCENARIO_FIELD_LABELS.filter(([field]) => scenario[field]).map(
    ([field, label]) => `${label}: ${scenario[field]}`
  );

  return lines.length ? `\n\nScenario:\n${lines.join("\n")}` : "";
}

// One line per character: who's playing them (if anyone) and whether
// they're still alive - lets AutoGM's turn/self-check prompts see the full
// roster without needing separate alive/dead or assignment lookups.
function formatCharacterRosterContext(characters) {
  const list = Object.values(characters || {});
  if (!list.length) return "";
  const lines = list.map((character) => {
    const who = character.assignedTo
      ? `played by ${character.assignedTo}`
      : "unassigned";
    const status = isCharacterAlive(character)
      ? "alive"
      : "removed from the story";
    return `- ${character.name} (${who}) - ${status}`;
  });
  return `\n\nCharacters:\n${lines.join("\n")}`;
}

// AutoGM's own private GM prep, in the same shape CampaignNotes.jsx edits -
// deliberately labeled as private so the prompt doesn't treat it as
// player-facing content.
function formatCampaignNotesContext(campaignNotes) {
  const sections = campaignNotes || [];
  if (!sections.length) return "";
  const lines = sections.flatMap((section) => [
    `${section.name}:`,
    ...(section.items || []).map(
      (item) =>
        `  - ${item.text}${item.description ? ` — ${item.description}` : ""}`
    ),
  ]);
  return `\n\nYour private campaign notes (GM prep - don't reveal directly unless the story calls for it):\n${lines.join("\n")}`;
}

function formatRawHistoryContext(rawHistory) {
  const list = rawHistory || [];
  if (!list.length) return "";
  const lines = list.map((message) => `${message.from}: ${message.text}`);
  return `\n\nRecent chat:\n${lines.join("\n")}`;
}

// Only these players are ever valid `targetPlayerName` choices for a pull -
// see helpers/characters.js's getActivePullTargets for the exact rule
// (alive character, currently-connected player).
function formatActivePullTargetsContext(characters, presence) {
  const names = getActivePullTargets({ characters, presence });
  if (!names.length) {
    return "\n\nPlayers you may currently call for a pull: none - do not call for a pull right now.";
  }
  const list = names
    .map((name) => `${name} (playing ${characterNameFor(characters, name)})`)
    .join(", ");
  return `\n\nPlayers you may currently call for a pull: ${list}. No one else - not an NPC, not an unclaimed character, not anyone currently offline - is a valid target.`;
}

function formatTowerStateContext({
  dangerProbability,
  awaitingReset,
  designatedSpinner,
}) {
  const dangerPct = Math.round((dangerProbability ?? 0) * 100);
  const lines = [`Current collapse danger: ${dangerPct}%.`];
  lines.push(
    awaitingReset
      ? "The tower just collapsed and is frozen until the table is ready to continue."
      : "The tower is standing."
  );
  if (designatedSpinner) {
    lines.push(`${designatedSpinner} is currently designated to pull.`);
  }
  return `\n\nTower state:\n${lines.join("\n")}`;
}

function formatStorySummaryContext(storySummary) {
  return storySummary ? `\n\nStory so far:\n${storySummary}` : "";
}

export function buildScenarioGenerationContext({ premise }) {
  return `Generate a Dread RPG scenario based on this premise:\n\n${premise}`;
}

export function buildCastGenerationContext({ castDescription, scenario }) {
  return `Generate a cast of characters for this Dread RPG game. The GM described the cast as:\n\n${castDescription}${formatScenarioContext(scenario)}`;
}

export function buildCampaignNotesGenerationContext({
  notesDescription,
  scenario,
}) {
  const direction = notesDescription
    ? `The GM added this extra direction:\n\n${notesDescription}\n`
    : "";
  return `Generate campaign notes sections for this Dread RPG game.\n${direction}${formatScenarioContext(scenario)}`;
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

export function buildAutoGmTurnContext({
  scenario,
  characters,
  storySummary,
  rawHistory,
  dangerProbability,
  awaitingReset,
  designatedSpinner,
  campaignNotes,
  presence,
}) {
  return `You are running an AutoGM turn for this Dread RPG game.${formatScenarioContext(scenario)}${formatCharacterRosterContext(characters)}${formatCampaignNotesContext(campaignNotes)}${formatStorySummaryContext(storySummary)}${formatTowerStateContext({ dangerProbability, awaitingReset, designatedSpinner })}${formatActivePullTargetsContext(characters, presence)}${formatRawHistoryContext(rawHistory)}`;
}

export function buildAutoGmRemovalNarrationContext({
  characterName,
  scenario,
  storySummary,
  rawHistory,
  campaignNotes,
}) {
  return `Narrate the removal of "${characterName}" from the story.${formatScenarioContext(scenario)}${formatCampaignNotesContext(campaignNotes)}${formatStorySummaryContext(storySummary)}${formatRawHistoryContext(rawHistory)}`;
}

export function buildAutoGmCompactionContext({ priorSummary, rawHistory }) {
  const priorBlock = priorSummary
    ? `\n\nPrior summary:\n${priorSummary}`
    : "\n\nThere is no prior summary yet - this is the first compaction.";
  return `Update the running story summary.${priorBlock}${formatRawHistoryContext(rawHistory)}`;
}

export function buildAutoGmSelfCheckContext({
  draftNarration,
  storySummary,
  rawHistory,
  campaignNotes,
  characters,
  dangerProbability,
  awaitingReset,
}) {
  return `Draft narration to check:\n"${draftNarration}"${formatCharacterRosterContext(characters)}${formatCampaignNotesContext(campaignNotes)}${formatStorySummaryContext(storySummary)}${formatTowerStateContext({ dangerProbability, awaitingReset, designatedSpinner: null })}${formatRawHistoryContext(rawHistory)}`;
}
