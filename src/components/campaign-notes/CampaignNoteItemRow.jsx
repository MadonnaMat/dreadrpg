import CampaignNoteRow from "./CampaignNoteRow";

// Manual seen/taken tracking, mirroring what AutoGM sets automatically via
// campaignNoteUpdates (see helpers/campaignNotes.js's nextItemState) so a
// human GM running the same game gets the same "don't repeat this to a
// character who's already seen it" / "this was already taken" bookkeeping.
// Only rendered when the caller passes `characterNames` - the AI-draft rows
// in CampaignNotesAiGenerator.jsx don't have characters to track yet.
function ItemTrackingControls({
  item,
  characterNames,
  onToggleSeenBy,
  onSetTakenBy,
}) {
  const seenBy = item.seenBy || [];
  return (
    <div className="campaign-note-item-tracking">
      <div className="campaign-note-item-seen-by">
        <span>Seen by:</span>
        {characterNames.map((name) => (
          <label key={name} className="campaign-note-item-seen-by-option">
            <input
              type="checkbox"
              checked={seenBy.includes(name)}
              onChange={() => onToggleSeenBy(name)}
            />
            {name}
          </label>
        ))}
      </div>
      <label className="campaign-note-item-taken-by">
        <span>Taken by:</span>
        <select
          value={item.takenBy || ""}
          onChange={(e) => onSetTakenBy(e.target.value || null)}
        >
          <option value="">Not taken</option>
          {characterNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// One item row - clicking the bar opens/closes its details textarea (where
// it's located, how to beat it, what it connects to, etc); the pencil icon
// edits the item's title, the trash icon removes it. Shared by
// CampaignNotes.jsx (real items) and CampaignNotesAiGenerator.jsx (AI
// drafts) so this markup only lives in one place.
export default function CampaignNoteItemRow({
  item,
  onTextChange,
  onDescriptionChange,
  onRemove,
  removeDisabled,
  textPlaceholder,
  characterNames,
  onToggleSeenBy,
  onSetTakenBy,
}) {
  return (
    <CampaignNoteRow
      className="campaign-note-item"
      title={item.text}
      titlePlaceholder={textPlaceholder}
      onTitleChange={onTextChange}
      onDelete={onRemove}
      deleteDisabled={removeDisabled}
      deleteAriaLabel="Remove item"
      editAriaLabel="Edit item title"
    >
      <textarea
        className="ai-textarea campaign-note-item-description"
        value={item.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Details - e.g. where it's located, how to beat it, what it connects to"
        rows={2}
      />
      {characterNames?.length > 0 && (
        <ItemTrackingControls
          item={item}
          characterNames={characterNames}
          onToggleSeenBy={onToggleSeenBy}
          onSetTakenBy={onSetTakenBy}
        />
      )}
    </CampaignNoteRow>
  );
}
