// Shared between CampaignNotes.jsx's manual "add section" flow and
// AutoGmProvider's automatic campaignNoteUpdates application, so both ever
// create a section id the same way.
export function generateSectionId() {
  return `note-${Math.random().toString(36).slice(2, 10)}`;
}

// A small local model doesn't reliably reuse the exact same wording for the
// same thing across turns ("Old Mill" vs "The Old Mill" vs "old mill"), and
// campaignNotes has no compaction pass the way rawHistory does - without
// normalizing before comparing, those near-duplicates pile up unbounded and
// eventually make every turn's context too large for the model to produce
// valid output from (see the item/section caps below for the other half of
// that fix).
function normalize(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ");
}

// Hard caps so campaignNotes can never grow large enough to blow out the
// model's context on its own, regardless of how consistently the model
// names things. Eviction is FIFO (oldest first) - a working campaign
// mostly cares about what's currently relevant, not a complete history of
// everything ever mentioned.
const MAX_SECTIONS = 8;
const MAX_ITEMS_PER_SECTION = 8;
const MAX_DESCRIPTION_LENGTH = 240;

// Pinned items are canon the GM (or AutoGM, at compaction) marked as
// must-never-be-forgotten, so FIFO eviction skips them. That exemption is
// itself capped, or pinning everything would quietly defeat the caps above
// and put us back to blowing out the model's context. The budget is spent in
// document order, i.e. the *oldest* pins keep their exemption: recent facts
// are still in rawHistory and the story summary anyway, while early-campaign
// canon is exactly what currently leaks away.
const MAX_PINNED_ITEMS = 10;

function truncateDescription(description) {
  if (!description || description.length <= MAX_DESCRIPTION_LENGTH) {
    return description;
  }
  return `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

// Builds (or updates) one item's state - tracks which characters have seen
// it and, for a portable item, who took it. This is the piece that lets
// AutoGM tell "already introduced this" apart from "haven't mentioned this
// yet" (so it stops re-describing the same discovery every turn), and tell
// "still sitting where it was" apart from "someone already has it" (so it
// stops narrating a taken item as still there for someone else to find).
function nextPinState(existing, { pinned, pinnedSource }) {
  if (!pinned && !existing?.pinned) {
    return { pinned: false, pinnedSource: null };
  }
  // An existing source wins, so AutoGM re-pinning something the GM pinned by
  // hand never relabels it as AutoGM's own.
  return {
    pinned: true,
    pinnedSource: existing?.pinnedSource || pinnedSource || null,
  };
}

function nextItemState(existing, update) {
  const { itemText, description, seenByCharacter, takenByCharacter } = update;
  const seenBy = new Set(existing?.seenBy || []);
  if (seenByCharacter) seenBy.add(seenByCharacter);
  return {
    text: existing ? existing.text : itemText,
    description:
      truncateDescription(description) || existing?.description || "",
    seenBy: Array.from(seenBy),
    takenBy: takenByCharacter || existing?.takenBy || null,
    ...nextPinState(existing, update),
  };
}

// Which pinned items still hold an eviction exemption, as "sectionIdx:itemIdx"
// keys. Spent in document order against MAX_PINNED_ITEMS - see that constant.
function pinnedExemptKeys(notes) {
  const keys = new Set();
  let budget = MAX_PINNED_ITEMS;
  notes.forEach((section, sectionIdx) => {
    (section.items || []).forEach((item, itemIdx) => {
      if (item?.pinned && budget > 0) {
        keys.add(`${sectionIdx}:${itemIdx}`);
        budget -= 1;
      }
    });
  });
  return keys;
}

// FIFO-oldest-first eviction that spares exempt entries, falling back to
// dropping exempt ones only when sparing them all would leave us over the
// limit (an entirely-pinned section still can't exceed its cap).
function evictOldestFirst(entries, limit, isExempt) {
  if (entries.length <= limit) return entries;
  const dropCount = entries.length - limit;
  const dropped = new Set();
  entries.forEach((entry, idx) => {
    if (dropped.size < dropCount && !isExempt(entry, idx)) dropped.add(idx);
  });
  entries.forEach((_entry, idx) => {
    if (dropped.size < dropCount) dropped.add(idx);
  });
  return entries.filter((_entry, idx) => !dropped.has(idx));
}

// Applied to an already-built list rather than one insert at a time, and
// shared by both write paths (the consolidation reconcile above and the
// incremental upsert below) so campaignNotes can never grow past these caps
// regardless of which one produced the result. A section is only droppable
// if it holds no exempt pins, since dropping it would take its canon with it.
function capNotes(notes) {
  const exempt = pinnedExemptKeys(notes);
  const keptSections = evictOldestFirst(
    notes.map((section, idx) => ({ section, idx })),
    MAX_SECTIONS,
    ({ section, idx }) =>
      (section.items || []).some((_item, itemIdx) =>
        exempt.has(`${idx}:${itemIdx}`)
      )
  );
  return keptSections.map(({ section, idx }) => ({
    ...section,
    items: evictOldestFirst(
      section.items || [],
      MAX_ITEMS_PER_SECTION,
      (_item, itemIdx) => exempt.has(`${idx}:${itemIdx}`)
    ),
  }));
}

// Converts the campaign-notes consolidation prompt's plain output (plain
// JSON, "takenBy" as "" for not-taken - see autoGmCampaignNotesConsolidationSchema.js)
// back into the app's actual campaignNotes shape (takenBy: string | null,
// each section keyed by a stable id). Reuses an existing section's id when
// a consolidated section matches one that existed before (by normalized
// name), so edits/deletes already open in the Campaign Notes UI keep
// working across a consolidation; a genuinely new section gets a fresh id.
export function reconcileConsolidatedNotes(consolidated, previous) {
  const prevSections = previous || [];
  const normalized = (consolidated || []).map((section) => ({
    name: section.name,
    items: (section.items || []).map((item) => ({
      text: item.text,
      description: truncateDescription(item.description) || "",
      seenBy: item.seenBy || [],
      takenBy: item.takenBy || null,
      pinned: Boolean(item.pinned),
      pinnedSource: item.pinned ? item.pinnedSource || null : null,
    })),
  }));
  return capNotes(normalized).map((section) => {
    const match = prevSections.find(
      (prev) => normalize(prev.name) === normalize(section.name)
    );
    return { id: match ? match.id : generateSectionId(), ...section };
  });
}

// The consolidation pass used to be handed the entire notes list as JSON,
// twice over (current + updates). At a full 8x8 set that alone exceeds the
// 4096-token window the small tiers run, so the call could not succeed at
// exactly the moment the notes were worth consolidating. It only ever needs
// the sections an update actually targets - everything else it was asked to
// copy through untouched, which is both the bulk of the payload and a thing
// small models do badly.
//
// Returns the sections to send and the set of normalized names they cover,
// which mergeConsolidatedScope needs to put the result back.
export function scopeNotesForConsolidation(campaignNotes, updates) {
  const targeted = new Set(
    (updates || []).map((update) => normalize(update.sectionName))
  );
  const scoped = (campaignNotes || []).filter((section) =>
    targeted.has(normalize(section.name))
  );
  return { scoped, scopedNames: new Set(scoped.map((s) => normalize(s.name))) };
}

// Puts a scoped consolidation back into the full list. Sections that weren't
// sent are kept exactly as they were - which is strictly safer than the old
// whole-list rewrite, where the prompt had to beg the model not to drop or
// reword the entries it wasn't asked to touch.
export function mergeConsolidatedScope({
  consolidated,
  previous,
  scopedNames,
}) {
  const reconciled = reconcileConsolidatedNotes(consolidated, previous);
  const byName = new Map(
    reconciled.map((section) => [normalize(section.name), section])
  );
  const used = new Set();

  const merged = (previous || []).map((section) => {
    const key = normalize(section.name);
    if (!scopedNames.has(key)) return section;
    const next = byName.get(key);
    if (!next) return section; // the pass dropped it; keep what we had
    used.add(key);
    return next;
  });

  // A genuinely new section the pass introduced for an update that matched
  // nothing existing.
  reconciled.forEach((section) => {
    if (!used.has(normalize(section.name))) merged.push(section);
  });

  return capNotes(merged);
}

// Applies AutoGM's parsed `campaignNoteUpdates` (each `{sectionName,
// itemText, description, seenByCharacter, takenByCharacter}`) onto the
// current campaignNotes array: upserts an item into a matching section (by
// normalized name), creating the section if none matches. Pure - the
// caller is responsible for actually calling setCampaignNotes with the
// result.
//
// This fuzzy-match-by-normalized-name approach still lets genuine
// near-duplicates through (the same fact reworded well beyond a leading
// article or casing difference), so AutoGmProvider's primary path is now
// the LLM-driven consolidation pass (reconcileConsolidatedNotes above,
// fed by the autogmCampaignNotesConsolidation prompt) which rebuilds and
// de-duplicates the whole list using real judgment. This function remains
// as that pass's fail-soft fallback when the consolidation call itself
// fails, so an update is never lost outright.
export function applyCampaignNoteUpdates(campaignNotes, updates) {
  if (!updates?.length) return campaignNotes;
  let next = campaignNotes || [];
  updates.forEach((update) => {
    const { sectionName, itemText } = update;
    const normalizedSectionName = normalize(sectionName);
    const normalizedItemText = normalize(itemText);
    const sectionIndex = next.findIndex(
      (section) => normalize(section.name) === normalizedSectionName
    );

    if (sectionIndex === -1) {
      next = [
        ...next,
        {
          id: generateSectionId(),
          name: sectionName,
          items: [nextItemState(null, update)],
        },
      ];
      return;
    }

    const section = next[sectionIndex];
    const itemIndex = (section.items || []).findIndex(
      (item) => normalize(item.text) === normalizedItemText
    );
    const items =
      itemIndex === -1
        ? [...(section.items || []), nextItemState(null, update)]
        : section.items.map((item, idx) =>
            idx === itemIndex ? nextItemState(item, update) : item
          );
    next = next.map((s, idx) => (idx === sectionIndex ? { ...s, items } : s));
  });
  return capNotes(next);
}
