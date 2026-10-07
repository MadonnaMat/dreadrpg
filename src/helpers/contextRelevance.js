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

// What "relevant to this turn" is measured against: what was just said, the
// couple of lines before it, and the running summary. Weighted only by
// repetition - a word that shows up in both the trigger and the summary
// naturally counts twice in the token set's favor.
export function buildRelevanceQuery({ trigger, storySummary, rawHistory }) {
  const tail = (rawHistory || [])
    .slice(-QUERY_HISTORY_LOOKBACK)
    .map((message) => `${message.from} ${message.text}`)
    .join(" ");
  return [trigger?.text || "", tail, storySummary || ""]
    .filter(Boolean)
    .join(" ");
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
  const queryTokens = tokenSet(query);
  const keep = new Set();
  const candidates = [];

  sections.forEach((section, sectionIdx) => {
    (section.items || []).forEach((item, itemIdx) => {
      const key = `${sectionIdx}:${itemIdx}`;
      if (item?.pinned) {
        keep.add(key);
        return;
      }
      const score = overlap(
        queryTokens,
        tokenSet(`${item?.text || ""} ${item?.description || ""}`)
      );
      if (!score) return;
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
