// Shared between CampaignNotes.jsx's manual "add section" flow and
// AutoGmProvider's automatic campaignNoteUpdates application, so both ever
// create a section id the same way.
export function generateSectionId() {
  return `note-${Math.random().toString(36).slice(2, 10)}`;
}

// Applies AutoGM's parsed `campaignNoteUpdates` (each
// `{sectionName, itemText, description}`) onto the current campaignNotes
// array: upserts an item into a matching section (by name, case-
// insensitive), creating the section if none matches. Pure - the caller is
// responsible for actually calling setCampaignNotes with the result.
export function applyCampaignNoteUpdates(campaignNotes, updates) {
  if (!updates?.length) return campaignNotes;
  let next = campaignNotes || [];
  updates.forEach(({ sectionName, itemText, description }) => {
    const sectionIndex = next.findIndex(
      (section) => section.name.toLowerCase() === sectionName.toLowerCase()
    );
    if (sectionIndex === -1) {
      next = [
        ...next,
        {
          id: generateSectionId(),
          name: sectionName,
          items: [{ text: itemText, description }],
        },
      ];
      return;
    }
    const section = next[sectionIndex];
    const itemIndex = (section.items || []).findIndex(
      (item) => item.text.toLowerCase() === itemText.toLowerCase()
    );
    const items =
      itemIndex === -1
        ? [...(section.items || []), { text: itemText, description }]
        : section.items.map((item, idx) =>
            idx === itemIndex ? { ...item, description } : item
          );
    next = next.map((s, idx) => (idx === sectionIndex ? { ...s, items } : s));
  });
  return next;
}
