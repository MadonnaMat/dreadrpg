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

export function looksLikeCommentary(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return COMMENTARY_PATTERNS.some((pattern) => pattern.test(value));
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
