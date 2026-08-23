import { useState } from "react";

// A clickable "long row" bar - most of it toggles open/closed a collapsible
// content area below it; a pencil icon switches the title into an editable
// input, and a trash icon deletes the row. Shared by CampaignNotes.jsx for
// both item rows and section header bars (and by CampaignNotesAiGenerator's
// item drafts), so this interaction only lives in one place. Always starts
// collapsed by default regardless of whether content already exists
// underneath - a section/item that already has details shouldn't force
// itself open every time the page loads; callers that want a different
// starting state (e.g. a section right after creation) pass
// `defaultExpanded`.
export default function CampaignNoteRow({
  title,
  onTitleChange,
  titlePlaceholder,
  onDelete,
  deleteDisabled,
  deleteAriaLabel,
  editAriaLabel,
  defaultExpanded = false,
  className = "",
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingTitle, setEditingTitle] = useState(false);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div className={`campaign-note-row ${className}`}>
      <div
        className="campaign-note-row-bar"
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <span className="campaign-note-row-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        {editingTitle ? (
          <input
            type="text"
            autoFocus
            className="campaign-note-row-title-input"
            value={title}
            placeholder={titlePlaceholder}
            onChange={(e) => onTitleChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setEditingTitle(false);
            }}
          />
        ) : (
          <span className="campaign-note-row-title">
            {title || titlePlaceholder}
          </span>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={editAriaLabel}
          onClick={(e) => {
            e.stopPropagation();
            setEditingTitle((prev) => !prev);
          }}
        >
          ✎
        </button>
        <button
          type="button"
          className="icon-button icon-button-danger"
          aria-label={deleteAriaLabel}
          disabled={deleteDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          🗑
        </button>
      </div>
      {expanded && (
        <div className="campaign-note-row-content">{children}</div>
      )}
    </div>
  );
}
