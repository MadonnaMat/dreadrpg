// Picks the slice of campaign state worth spending a turn's prompt on.
//
// AutoGM runs on small local models (1B-3B tiers, see constants/aiModels.js),
// and every turn used to restate the entire roster and every campaign note
// regardless of what the turn was actually about. That costs quality as much
// as latency: the more irrelevant text surrounds the question, the less of
// its attention a small model spends on the part that matters.
//
// Deliberately keyword scoring rather than embeddings. The corpus is ~64
// short items at most (campaignNotes is hard-capped), where overlap scoring
// and a real retrieval index pick the same handful of items - and an
// embedding model would compete for the same device memory the WebLLM model
// already strains, which is the cost this filtering exists to cut.
//
// Nothing here mutates state or decides what is *true*; it only decides what
// gets mentioned this turn. Pinned canon is exempt (see campaignNotes.js), so
// a fact the GM or compaction marked as load-bearing is never filtered out
// just because this turn's wording didn't happen to match it.

// Tuned by hand against real turn logs rather than derived - raise these
// first if AutoGM starts forgetting things mid-scene.
const MAX_RELEVANT_NOTE_ITEMS = 12;
const QUERY_HISTORY_LOOKBACK = 3;
// Single characters and most two-letter words carry no signal, and "it"/"he"
// matching everything would flatten the scores.
const MIN_TOKEN_LENGTH = 3;
// An item some character has already seen or taken is established in play, so
// it outranks a cold match at the same overlap - but only once it matches at
// all, or everything already seen would come along every turn.
const ESTABLISHED_BONUS = 1;
// What the player just said is stronger evidence of what this turn is about
// than the lines around it, so its words count for more.
const TRIGGER_TOKEN_WEIGHT = 2;
const HISTORY_TOKEN_WEIGHT = 1;
// One word in common is usually coincidence, not relevance ("cut open from
// the inside" matching "look inside"), and letting those through was enough
// to keep most of the notes on every turn. Set to the trigger weight, this
// reads as: either one word the player actually just said, or two from the
// surrounding chatter.
const MIN_RELEVANCE_SCORE = TRIGGER_TOKEN_WEIGHT;

const STOPWORDS = new Set([
  "the",
  "and",
  "but",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "that",
  "this",
  "these",
  "those",
  "there",
  "their",
  "then",
  "than",
  "they",
  "them",
  "was",
  "were",
  "are",
  "has",
  "have",
  "had",
  "not",
  "out",
  "off",
  "its",
  "his",
  "her",
  "she",
  "him",
  "you",
  "your",
  "our",
  "all",
  "any",
  "can",
  "will",
  "just",
  "who",
  "what",
  "when",
  "where",
  "how",
  "why",
  "does",
  "did",
  "doing",
  "done",
  "get",
  "got",
  "going",
  "goes",
  "one",
  "two",
  "now",
  "some",
  "very",
  "about",
  "over",
  "down",
  "back",
  "here",
  "would",
  "could",
  "should",
  "like",
  "look",
  "looks",
  "says",
  "said",
]);

function tokenSet(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token)
    );
  return new Set(tokens);
}

function overlap(queryTokens, candidateTokens) {
  let score = 0;
  candidateTokens.forEach((token) => {
    if (queryTokens.has(token)) score += 1;
  });
  return score;
}

// Exported for its own unit tests and for callers that only have raw strings;
// internally the set-based overlap above is reused so a query is tokenized
// once per turn rather than once per candidate.
export function scoreKeywordOverlap(queryText, candidateText) {
  return overlap(tokenSet(queryText), tokenSet(candidateText));
}

// What "relevant to this turn" is measured against: what was just said, and
// the couple of lines immediately before it.
//
// Deliberately NOT the rolling story summary. The summary describes the
// whole game so far, so it name-drops most of the notes by construction -
// folding it in made nearly everything match and turned the filtering into
// a no-op (a pure small-talk turn scored the same notes as one about the
// furnace). Relevance has to be anchored to what is happening *now*. The
// summary isn't lost by this: it's sent to the model as its own block in
// the turn prompt regardless - it just doesn't get to pick the notes.
export function buildRelevanceQuery({ trigger, rawHistory }) {
  return {
    trigger: trigger?.text || "",
    recent: (rawHistory || [])
      .slice(-QUERY_HISTORY_LOOKBACK)
      .map((message) => `${message.from} ${message.text}`)
      .join(" "),
  };
}

// Token -> weight for one turn's query. Also accepts a plain string, which
// is treated as trigger text, so callers with nothing but words to match on
// (and the unit tests) don't have to build the split shape.
function queryWeights(query) {
  const { trigger, recent } =
    typeof query === "string" ? { trigger: query, recent: "" } : query || {};
  const weights = new Map();
  tokenSet(recent).forEach((token) => weights.set(token, HISTORY_TOKEN_WEIGHT));
  // Set second, so a word in both counts at the higher trigger weight.
  tokenSet(trigger).forEach((token) =>
    weights.set(token, TRIGGER_TOKEN_WEIGHT)
  );
  return weights;
}

function weightedOverlap(weights, candidateTokens) {
  let score = 0;
  candidateTokens.forEach((token) => {
    score += weights.get(token) || 0;
  });
  return score;
}

// The character roster is deliberately NOT filtered. It costs one short line
// per character in the turn prompt (name, who plays them, alive or removed -
// see promptContexts.js's formatCharacterRosterContext; the question/answer
// sheets never go near this prompt), so narrowing it would save almost
// nothing while risking the GM forgetting a character exists. Campaign notes
// are where the context actually goes.

// The campaign notes worth restating this turn. Pinned items always survive;
// everything else has to earn its place by overlapping the turn's own words,
// and an item that matches nothing is left out entirely rather than included
// at low priority. Sections are preserved in their original order (and
// dropped once empty) so the result reads like the notes, not a ranking.
export function selectRelevantCampaignNotes({
  campaignNotes,
  query,
  maxItems = MAX_RELEVANT_NOTE_ITEMS,
}) {
  const sections = campaignNotes || [];
  const weights = queryWeights(query);
  const keep = new Set();
  const candidates = [];

  sections.forEach((section, sectionIdx) => {
    (section.items || []).forEach((item, itemIdx) => {
      const key = `${sectionIdx}:${itemIdx}`;
      if (item?.pinned) {
        keep.add(key);
        return;
      }
      const score = weightedOverlap(
        weights,
        tokenSet(`${item?.text || ""} ${item?.description || ""}`)
      );
      if (score < MIN_RELEVANCE_SCORE) return;
      const established = Boolean(item?.seenBy?.length || item?.takenBy);
      candidates.push({
        key,
        score: score + (established ? ESTABLISHED_BONUS : 0),
      });
    });
  });

  candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxItems))
    .forEach((candidate) => keep.add(candidate.key));

  return sections
    .map((section, sectionIdx) => ({
      ...section,
      items: (section.items || []).filter((_item, itemIdx) =>
        keep.has(`${sectionIdx}:${itemIdx}`)
      ),
    }))
    .filter((section) => section.items.length);
}

// Flat counts for the AutoGM debug panel, so the GM can see how much the
// filtering actually saved on a given turn without dumping the text itself.
export function countNoteItems(campaignNotes) {
  return (campaignNotes || []).reduce(
    (total, section) => total + (section.items || []).length,
    0
  );
}

export function countPinnedNoteItems(campaignNotes) {
  return (campaignNotes || []).reduce(
    (total, section) =>
      total + (section.items || []).filter((item) => item?.pinned).length,
    0
  );
}
