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

function formatScenarioContext(scenario) {
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

// Appended after an item's description so the model can see, at a glance,
// who already knows about it (don't re-describe it to them) and whether
// it's been taken (don't narrate it as still sitting in its original spot).
function formatItemState(item) {
  const tags = [];
  if (item.seenBy?.length) tags.push(`seen by: ${item.seenBy.join(", ")}`);
  tags.push(item.takenBy ? `taken by: ${item.takenBy}` : "not yet taken");
  return ` [${tags.join("; ")}]`;
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
        `  - ${item.text}${item.description ? ` — ${item.description}` : ""}${formatItemState(item)}`
    ),
  ]);
  return `\n\nYour private campaign notes (GM prep - don't reveal directly unless the story calls for it). Each item shows who has already seen it and, for portable items, whether it's already been taken - never re-describe something a character has already seen as if it's new to them, and never narrate a taken item as still sitting in its original spot:\n${lines.join("\n")}`;
}

function noteKey(sectionName, itemText) {
  return `${String(sectionName || "")
    .trim()
    .toLowerCase()}::${String(itemText || "")
    .trim()
    .toLowerCase()}`;
}

// The self-check's job is spotting contradictions, which turns on an item's
// name and on who has seen or taken it - not on its prose description,
// which is most of the bulk. So the pass still sees every item (it can't
// catch a contradiction against something it was never shown) but only
// keeps descriptions for the ones that matter: pinned canon, and whatever
// the turn itself was given. On a full notes set that's the difference
// between fitting the small tier's window and not.
function formatCampaignNotesForCheck(campaignNotes, detailedNotes) {
  const sections = campaignNotes || [];
  if (!sections.length) return "";
  const detailed = new Set();
  (detailedNotes || []).forEach((section) =>
    (section.items || []).forEach((item) =>
      detailed.add(noteKey(section.name, item.text))
    )
  );
  const lines = sections.flatMap((section) => [
    `${section.name}:`,
    ...(section.items || []).map((item) => {
      const keepDescription =
        item.pinned || detailed.has(noteKey(section.name, item.text));
      const description =
        keepDescription && item.description ? ` — ${item.description}` : "";
      return `  - ${item.text}${description}${formatItemState(item)}`;
    }),
  ]);
  return `\n\nEstablished facts from your private campaign notes, with who has seen each one and whether it's been taken:\n${lines.join("\n")}`;
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

// A dedicated pull-check pass (see buildAutoGmPullCheckContext) runs before
// the turn prompt and, when it decides a pull is warranted, calls it in
// code directly rather than trusting this creative-writing prompt to also
// reliably decide it. This tells the turn prompt what already happened so
// it narrates the moment instead of re-deciding or contradicting it.
function formatPullJustCalledContext(pullJustCalled) {
  if (!pullJustCalled) return "";
  const { targetPlayerName, pullsRequired } = pullJustCalled;
  const pullWord = pullsRequired > 1 ? "pulls" : "pull";
  return `\n\nA pull has already been called for ${targetPlayerName} because of the action they just declared (${pullsRequired} ${pullWord} required) - this is already handled, do not set "callForPull" yourself this turn. Just narrate the tension of the moment leading into it; do not narrate the outcome of the pull (success, decline, or collapse) - that will be resolved and narrated separately once it's actually pulled.`;
}

// The scene-pacing pass's read on what the moment calls for (see
// autogm-scene-pacing.v1.md), so the turn prompt isn't inferring pacing from
// scratch while also writing prose. Advisory in both directions: "continue"
// adds nothing at all, and "call_for_pull" is worded as a suggestion rather
// than a decision, since the pull-check pass - not this one - is what
// actually calls pulls (see formatPullJustCalledContext above).
const SCENE_PACING_HINTS = {
  escalate:
    "The scene has been running slack: consider tightening it now with a new complication, a sign the threat is closer, or a cost coming due.",
  wrap_scene:
    "This beat looks like it has given what it has to give: consider moving toward a transition or resolution rather than holding the table in it.",
  call_for_pull:
    'The fiction may have reached real physical stakes. This is a suggestion only, not a pull that has been called - decide for yourself whether to set "callForPull" this turn.',
};

function formatScenePacingContext(pacingMove) {
  const hint = SCENE_PACING_HINTS[pacingMove];
  return hint ? `\n\nPacing read for this moment: ${hint}` : "";
}

// Deliberately far smaller than the turn context: pacing is a read on the
// scene's rhythm, which the recent chat, the summary, and the tower's state
// already carry. The scenario, roster, and campaign notes would just be
// weight on a cheap classification call.
export function buildAutoGmScenePacingContext({
  storySummary,
  rawHistory,
  dangerProbability,
  awaitingReset,
}) {
  return `Judge the pacing of this Dread RPG scene.${formatStorySummaryContext(storySummary)}${formatTowerStateContext({ dangerProbability, awaitingReset, designatedSpinner: null })}${formatRawHistoryContext(rawHistory)}`;
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

// `campaignNotes` is expected to be the relevance-filtered subset for this
// turn (see helpers/contextRelevance.js) rather than the whole list. The
// roster and scenario stay whole: both are a handful of lines that the GM
// needs to stay consistent about, unlike notes, which grow to dozens of
// items of which any one turn concerns almost none.
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
  pullJustCalled,
  pacingMove,
}) {
  return `You are running an AutoGM turn for this Dread RPG game.${formatScenarioContext(scenario)}${formatCharacterRosterContext(characters)}${formatCampaignNotesContext(campaignNotes)}${formatStorySummaryContext(storySummary)}${formatTowerStateContext({ dangerProbability, awaitingReset, designatedSpinner })}${formatActivePullTargetsContext(characters, presence)}${formatPullJustCalledContext(pullJustCalled)}${formatScenePacingContext(pacingMove)}${formatRawHistoryContext(rawHistory)}`;
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

// The consolidation schema requires every item field, and the prompt asks
// the model to copy the pin fields through as given - so they have to
// actually be given. Notes saved before pinning existed don't carry them,
// and a model can't faithfully echo a field that was never in its input, so
// fill the defaults in here rather than letting those turns fail validation.
function withPinFields(campaignNotes) {
  return (campaignNotes || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => ({
      ...item,
      pinned: Boolean(item?.pinned),
      pinnedSource: item?.pinned ? item.pinnedSource || "" : "",
    })),
  }));
}

// Fed as literal JSON rather than prose - this is a structured
// transform (existing notes + an update -> the whole rebuilt list), and a
// small local model reproduces untouched entries far more faithfully when
// it can copy them straight from JSON it was given, rather than
// reconstructing them from a prose summary of the same data.
export function buildAutoGmCampaignNotesConsolidationContext({
  campaignNotes,
  campaignNoteUpdates,
}) {
  const currentJson = JSON.stringify(withPinFields(campaignNotes), null, 2);
  const updatesJson = JSON.stringify(campaignNoteUpdates || [], null, 2);
  return `Current campaign notes (JSON):\n${currentJson}\n\nNew update(s) just called out this turn (JSON):\n${updatesJson}`;
}

export function buildAutoGmPullCheckContext({
  actionText,
  actorName,
  scenario,
}) {
  return `The player controlling ${actorName} just declared:\n\n"${actionText}"${formatScenarioContext(scenario)}`;
}

export function buildAutoGmSelfCheckContext({
  draftNarration,
  storySummary,
  rawHistory,
  campaignNotes,
  detailedNotes,
  characters,
  dangerProbability,
  awaitingReset,
}) {
  return `Draft narration to check:\n"${draftNarration}"${formatCharacterRosterContext(characters)}${formatCampaignNotesForCheck(campaignNotes, detailedNotes)}${formatStorySummaryContext(storySummary)}${formatTowerStateContext({ dangerProbability, awaitingReset, designatedSpinner: null })}${formatRawHistoryContext(rawHistory)}`;
}
