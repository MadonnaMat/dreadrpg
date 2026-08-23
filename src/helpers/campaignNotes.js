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
function nextItemState(
  existing,
  { itemText, description, seenByCharacter, takenByCharacter }
) {
  const seenBy = new Set(existing?.seenBy || []);
  if (seenByCharacter) seenBy.add(seenByCharacter);
  return {
    text: existing ? existing.text : itemText,
    description:
      truncateDescription(description) || existing?.description || "",
    seenBy: Array.from(seenBy),
    takenBy: takenByCharacter || existing?.takenBy || null,
  };
}

// Same FIFO-oldest-first eviction as the incremental upsert below, applied
// to an already-built list instead of one insert at a time - shared by
// both paths so campaignNotes can never grow past these caps regardless of
// which one produced the result.
function capNotes(notes) {
  const limitedSections =
    notes.length > MAX_SECTIONS
      ? notes.slice(notes.length - MAX_SECTIONS)
      : notes;
  return limitedSections.map((section) => ({
    ...section,
    items:
      section.items.length > MAX_ITEMS_PER_SECTION
        ? section.items.slice(section.items.length - MAX_ITEMS_PER_SECTION)
        : section.items,
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
    })),
  }));
  return capNotes(normalized).map((section) => {
    const match = prevSections.find(
      (prev) => normalize(prev.name) === normalize(section.name)
    );
    return { id: match ? match.id : generateSectionId(), ...section };
  });
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
      const newSection = {
        id: generateSectionId(),
        name: sectionName,
        items: [nextItemState(null, update)],
      };
      const withNewSection = [...next, newSection];
      next =
        withNewSection.length > MAX_SECTIONS
          ? withNewSection.slice(withNewSection.length - MAX_SECTIONS)
          : withNewSection;
      return;
    }

    const section = next[sectionIndex];
    const itemIndex = (section.items || []).findIndex(
      (item) => normalize(item.text) === normalizedItemText
    );
    let items;
    if (itemIndex === -1) {
      const withNewItem = [
        ...(section.items || []),
        nextItemState(null, update),
      ];
      items =
        withNewItem.length > MAX_ITEMS_PER_SECTION
          ? withNewItem.slice(withNewItem.length - MAX_ITEMS_PER_SECTION)
          : withNewItem;
    } else {
      items = section.items.map((item, idx) =>
        idx === itemIndex ? nextItemState(item, update) : item
      );
    }
    next = next.map((s, idx) => (idx === sectionIndex ? { ...s, items } : s));
  });
  return next;
}
