// Last-line defenses on text that goes straight to players as the GM's
// voice. Both failures below are things the prompts already forbid in
// plain words and that the 1B tier does anyway - the same reason
// checkForPull exists as code rather than as a line in the turn prompt.
// Deliberately conservative: a false positive costs a slightly worse
// narration, while a false negative puts the model's stage directions in
// front of the table.

// The self-check pass is asked for corrected narration and sometimes
// returns an account of its own edit instead ("I revise the draft to make
// it consistent... I remove the reference to X"), which then gets posted
// verbatim as if the GM said it.
const COMMENTARY_PATTERNS = [
  // Authorial edit verbs in the first person, at the very start.
  /^\s*(i|we)\s+(revis|remov|chang|edit|rewr|correct|updat|add|made|make|fix)/i,
  // Talking about the text rather than the story.
  /\b(the|this|my)\s+(draft|revised|original|corrected)\s+(narration|version|text|line)\b/i,
  /\brevised narration\b/i,
  // "I make sure to describe..." / "I also make sure the scene advances".
  /\bi\s+(also\s+)?(make sure|ensure|want to make)\b/i,
  // Explicitly narrating the act of adding story text.
  /\bi\s+add(ed)?\s+the following\b/i,
];

// Talking about the table's situation rather than the fiction. The
// self-check pass in particular likes to append a status report to its
// "corrected" narration.
const META_PATTERNS = [
  /\bthe players are (stuck|waiting)\b/i,
  /\bthe game is waiting\b/i,
  /\bwaiting for (them|the players) to (make a move|act|respond)\b/i,
  /\b(this|the) (scene|turn|response) (needs|should|must)\b/i,
];

export function looksLikeCommentary(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return [...COMMENTARY_PATTERNS, ...META_PATTERNS].some((pattern) =>
    pattern.test(value)
  );
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// How much of a sentence has to overlap an earlier one before it counts as
// the same sentence reworded. The loop rarely repeats verbatim - it swaps a
// noun and keeps the rest ("The foundry is dimly lit, with the only sound
// being the creaking of old wooden beams." then "The sub-level is dimly
// lit, with the only sound being...") - so exact matching missed most of it.
const SENTENCE_OVERLAP_LIMIT = 0.6;
// Below this many content words, two sentences can overlap heavily by
// coincidence ("The door opens." / "The hatch opens.") and are left alone.
const MIN_SENTENCE_TOKENS = 6;

function contentTokens(sentence) {
  return new Set(normalize(sentence).split(" ").filter(Boolean));
}

function overlapRatio(a, b) {
  let shared = 0;
  a.forEach((token) => {
    if (b.has(token)) shared += 1;
  });
  return shared / (a.size + b.size - shared);
}

// Small models fall into loops, emitting the same sentence - or the same
// sentence with one word changed - several times in one response. It is
// never deliberate, and no prompt wording reliably prevents it, so collapse
// it on the way out.
// How many of the GM's own recent lines a new one is checked against. Two
// is enough for the failure in play - answering a player by restating the
// turn before - without reaching so far back that a deliberate callback to
// something established earlier gets suppressed.
const GM_LOOKBACK_LINES = 2;

// AutoGM appends its own narration to the raw history (see AutoGmProvider),
// so the history is also the record of what it has already said.
export function recentGmNarration(rawHistory) {
  return (rawHistory || [])
    .filter((message) => message?.from === "GM" && message.text)
    .slice(-GM_LOOKBACK_LINES)
    .map((message) => message.text)
    .join(" ");
}

function sentencesOf(text) {
  // Keep the delimiter with its sentence so punctuation and spacing survive.
  return String(text || "").match(/[^.!?]+[.!?]*\s*/g) || [];
}

// `alreadySaid` seeds the comparison with narration from earlier turns, so
// the same check that catches a loop inside one response also catches the
// GM answering a player by repeating what it said last turn - the form the
// loop actually takes in play, since each response is individually fine.
// Those sentences are only ever compared against, never emitted.
export function collapseRepeatedSentences(text, alreadySaid = "") {
  const value = String(text || "").trim();
  if (!value) return value;
  const parts = sentencesOf(value);
  const prior = sentencesOf(alreadySaid)
    .map(contentTokens)
    .filter((tokens) => tokens.size);
  if (parts.length < 2 && !prior.length) return value;

  const keptTokens = [...prior];
  const kept = parts.filter((part) => {
    const tokens = contentTokens(part);
    if (!tokens.size) return true;
    const duplicate = keptTokens.some(
      (earlier) =>
        (earlier.size >= MIN_SENTENCE_TOKENS &&
          tokens.size >= MIN_SENTENCE_TOKENS &&
          overlapRatio(tokens, earlier) >= SENTENCE_OVERLAP_LIMIT) ||
        overlapRatio(tokens, earlier) === 1
    );
    if (duplicate) return false;
    keptTokens.push(tokens);
    return true;
  });
  return kept.length === parts.length ? value : kept.join("").trim();
}

// How much longer than the draft a "correction" may be before we stop
// believing it is one. The self-check is told to change as little as
// possible for a factual fix, and to replace repetition with something new
// - neither justifies several times the length, which in practice meant it
// had appended its own commentary or restated the prompt back.
const MAX_REVISION_GROWTH = 2.5;

export function revisionIsPlausible(revision, draft) {
  const revised = String(revision || "").trim();
  const original = String(draft || "").trim();
  if (!revised) return false;
  if (looksLikeCommentary(revised)) return false;
  if (!original) return true;
  return revised.length <= original.length * MAX_REVISION_GROWTH;
}

// The model frequently opens its narration by restating the player's own
// message word for word before continuing - which reads as the GM speaking
// in the player's first person and deciding their action for them, the one
// thing the turn prompt is most emphatic about. The continuation after it
// is usually fine, so drop the echo instead of losing the whole turn.
export function stripEchoedPlayerAction(narration, triggerText) {
  const text = String(narration || "").trim();
  const trigger = String(triggerText || "").trim();
  if (!text || !trigger) return text;

  const normalizedTrigger = normalize(trigger);
  if (normalizedTrigger.length < 12) return text;
  if (!normalize(text).startsWith(normalizedTrigger)) return text;

  // Walk the raw text to the end of the echoed span, so the remainder keeps
  // its original punctuation and capitalization.
  let consumed = 0;
  let matched = 0;
  for (const char of text) {
    consumed += 1;
    if (/[a-z0-9]/i.test(char)) {
      matched += 1;
      if (matched >= normalizedTrigger.replace(/\s/g, "").length) break;
    }
  }
  // \p{Pd} so em/en dashes are stripped too, not just hyphen-minus.
  const remainder = text.slice(consumed).replace(/^[\s.,;:!?\p{Pd}]+/u, "");
  // If stripping leaves nothing meaningful, the echo *was* the whole
  // response - keep the original rather than posting an empty line.
  return remainder.length >= 20 ? remainder : text;
}
