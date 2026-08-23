import { useState } from "react";
import { useAi } from "../../hooks/useAi";
import AiRefineBox from "../ai/AiRefineBox";
import CampaignNoteItemRow from "./CampaignNoteItemRow";

function generateDraftId(index) {
  return `notes-draft-${Date.now()}-${index}`;
}

// Drafts a batch of campaign-notes sections (name + list of entries each)
// via AI for the GM to review, edit, and accept one at a time. Each
// accepted draft becomes a real section through the parent's
// onAcceptSection - mirrors CastAiGenerator.jsx's identical draft/accept
// flow for characters.
//
// `conversation` tracks the whole batch's own conversation (not per-draft) -
// a follow-up refinement ("add a section for the cult's rituals") regenerates
// the full array in one continued exchange, replacing whatever drafts
// haven't been accepted/discarded yet.
export default function CampaignNotesAiGenerator({
  scenario,
  onAcceptSection,
}) {
  const { generateCampaignNotes, refineCampaignNotes } = useAi();
  const [notesDescription, setNotesDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [conversation, setConversation] = useState(null);

  const applyResult = (result) => {
    setGenerating(false);
    if (result.valid) {
      setErrors([]);
      setConversation(result.messages);
      setDrafts(
        result.parsed.map((draft, index) => ({
          ...draft,
          _draftId: generateDraftId(index),
        }))
      );
    } else {
      setErrors(
        result.errors.length
          ? result.errors
          : ["The AI didn't return usable campaign notes. Try again."]
      );
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    applyResult(await generateCampaignNotes({ notesDescription, scenario }));
  };

  const handleRefine = async (refinementText) => {
    setGenerating(true);
    applyResult(
      await refineCampaignNotes({ history: conversation, refinementText })
    );
  };

  const updateDraft = (draftId, patch) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId ? { ...draft, ...patch } : draft
      )
    );
  };

  const updateDraftItem = (draftId, itemIndex, patch) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? {
              ...draft,
              items: draft.items.map((item, i) =>
                i === itemIndex ? { ...item, ...patch } : item
              ),
            }
          : draft
      )
    );
  };

  const addDraftItem = (draftId) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? { ...draft, items: [...draft.items, { text: "", description: "" }] }
          : draft
      )
    );
  };

  const removeDraftItem = (draftId, itemIndex) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? {
              ...draft,
              items: draft.items.filter((_, i) => i !== itemIndex),
            }
          : draft
      )
    );
  };

  const acceptDraft = (draftId) => {
    const draft = drafts.find((d) => d._draftId === draftId);
    if (!draft) return;
    onAcceptSection({ name: draft.name, items: draft.items });
    setDrafts((prev) => prev.filter((d) => d._draftId !== draftId));
  };

  const discardDraft = (draftId) => {
    setDrafts((prev) => prev.filter((d) => d._draftId !== draftId));
  };

  return (
    <div className="ai-generate-section">
      <label>
        Anything specific you want tracked? (optional)
        <textarea
          className="ai-textarea"
          value={notesDescription}
          onChange={(e) => setNotesDescription(e.target.value)}
          rows={2}
          placeholder="e.g. focus on the lighthouse keeper's journal and the tide schedule"
        />
      </label>
      <button
        type="button"
        className="btn-secondary"
        disabled={generating}
        onClick={handleGenerate}
      >
        {generating
          ? "Generating…"
          : conversation
            ? "Start Over with AI"
            : "Generate Campaign Notes with AI"}
      </button>
      {errors.length > 0 && (
        <ul className="ai-error-message">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {conversation && drafts.length > 0 && (
        <AiRefineBox
          onRefine={handleRefine}
          disabled={generating}
          placeholder="e.g. add a section for the cult's rituals, make the win scenarios harder"
        />
      )}

      {drafts.map((draft) => (
        <div key={draft._draftId} className="ai-cast-draft">
          <input
            type="text"
            className="pregame-input"
            value={draft.name}
            onChange={(e) =>
              updateDraft(draft._draftId, { name: e.target.value })
            }
          />
          {draft.items.map((item, itemIndex) => (
            <CampaignNoteItemRow
              key={itemIndex}
              item={item}
              onTextChange={(text) =>
                updateDraftItem(draft._draftId, itemIndex, { text })
              }
              onDescriptionChange={(description) =>
                updateDraftItem(draft._draftId, itemIndex, { description })
              }
              onRemove={() => removeDraftItem(draft._draftId, itemIndex)}
              removeDisabled={draft.items.length <= 1}
            />
          ))}
          <div className="question-editor-buttons">
            <button
              onClick={() => addDraftItem(draft._draftId)}
              className="btn-secondary"
            >
              Add Item
            </button>
            <button
              onClick={() => acceptDraft(draft._draftId)}
              className="btn-success"
            >
              Accept Section
            </button>
            <button
              onClick={() => discardDraft(draft._draftId)}
              className="btn-danger"
            >
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
