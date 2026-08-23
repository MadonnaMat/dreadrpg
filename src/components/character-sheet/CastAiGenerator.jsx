import { useState } from "react";
import { useAi } from "../../hooks/useAi";

function generateDraftId(index) {
  return `draft-${Date.now()}-${index}`;
}

// Drafts a batch of characters (name + bespoke questionnaire each) via AI
// for the GM to review, edit, and accept one at a time. Each accepted draft
// becomes a real character through the parent's onAccept -> the same
// handleCreateCharacter path (and CHARACTER_CREATE message) a manually
// created character already uses, so nothing new crosses the network here.
export default function CastAiGenerator({ scenario, onAccept }) {
  const { generateCast } = useAi();
  const [castDescription, setCastDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const [drafts, setDrafts] = useState([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrors([]);
    const result = await generateCast({ castDescription, scenario });
    setGenerating(false);
    if (result.valid) {
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
          : ["The AI didn't return a usable cast. Try again."]
      );
    }
  };

  const updateDraft = (draftId, patch) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId ? { ...draft, ...patch } : draft
      )
    );
  };

  const updateDraftQuestion = (draftId, qIndex, value) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? {
              ...draft,
              questions: draft.questions.map((q, i) =>
                i === qIndex ? value : q
              ),
            }
          : draft
      )
    );
  };

  const addDraftQuestion = (draftId) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? { ...draft, questions: [...draft.questions, ""] }
          : draft
      )
    );
  };

  const removeDraftQuestion = (draftId, qIndex) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft._draftId === draftId
          ? {
              ...draft,
              questions: draft.questions.filter((_, i) => i !== qIndex),
            }
          : draft
      )
    );
  };

  const acceptDraft = (draftId) => {
    const draft = drafts.find((d) => d._draftId === draftId);
    if (!draft) return;
    onAccept({ name: draft.name, questions: draft.questions });
    setDrafts((prev) => prev.filter((d) => d._draftId !== draftId));
  };

  const discardDraft = (draftId) => {
    setDrafts((prev) => prev.filter((d) => d._draftId !== draftId));
  };

  return (
    <div className="ai-generate-section">
      <label>
        Describe the cast you want (optional):
        <textarea
          value={castDescription}
          onChange={(e) => setCastDescription(e.target.value)}
          rows={2}
          placeholder="e.g. A four-person Coast Guard team sent to investigate a silent lighthouse."
        />
      </label>
      <button
        type="button"
        className="btn-secondary"
        disabled={generating}
        onClick={handleGenerate}
      >
        {generating ? "Generating…" : "Generate Cast with AI"}
      </button>
      {errors.length > 0 && (
        <ul className="ai-error-message">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
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
          {draft.questions.map((question, qIndex) => (
            <div key={qIndex} className="question-edit-row">
              <input
                type="text"
                value={question}
                onChange={(e) =>
                  updateDraftQuestion(draft._draftId, qIndex, e.target.value)
                }
                className="question-input"
              />
              <button
                onClick={() => removeDraftQuestion(draft._draftId, qIndex)}
                className="btn-danger-small"
                disabled={draft.questions.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="question-editor-buttons">
            <button
              onClick={() => addDraftQuestion(draft._draftId)}
              className="btn-secondary"
            >
              Add Question
            </button>
            <button
              onClick={() => acceptDraft(draft._draftId)}
              className="btn-success"
            >
              Create Character
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
