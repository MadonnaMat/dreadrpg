import CampaignNoteRow from "./CampaignNoteRow";

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
    </CampaignNoteRow>
  );
}
