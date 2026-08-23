import { useState } from "react";
import { usePeer } from "../../hooks/usePeer";
import { useAi } from "../../hooks/useAi";

export default function MyCharacterSheet({
  questions,
  answers,
  onAnswerChange,
}) {
  const { scenario } = usePeer();
  const { aiEnabled, suggestAnswer } = useAi();
  const [suggestions, setSuggestions] = useState({});

  // Drafts a suggested answer for one question into local preview state -
  // never touches `answers` directly, so it's Accept/Discard that decides
  // whether onAnswerChange (the existing send path) ever fires.
  const handleSuggest = async (index, question) => {
    setSuggestions((prev) => ({
      ...prev,
      [index]: { loading: true, text: null, errors: [] },
    }));
    const result = await suggestAnswer({
      question,
      otherAnswers: answers,
      scenario,
    });
    setSuggestions((prev) => ({
      ...prev,
      [index]: result.valid
        ? { loading: false, text: result.parsed.answer, errors: [] }
        : {
            loading: false,
            text: null,
            errors: result.errors.length
              ? result.errors
              : ["The AI didn't return a usable answer. Try again."],
          },
    }));
  };

  const acceptSuggestion = (index) => {
    const suggestion = suggestions[index];
    if (!suggestion?.text) return;
    onAnswerChange(index, suggestion.text);
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const discardSuggestion = (index) => {
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  return (
    <div className="player-sheet-section">
      <h2>Character Sheet</h2>
      <div className="character-sheet-form">
        {questions.map((question, index) => {
          const answer = answers[index] || {};
          const suggestion = suggestions[index] || {};
          const suggestionErrors = suggestion.errors || [];
          const answerText = answer.text || "";
          return (
            <div key={index} className="character-field">
              <label className="question-label">{question}</label>
              <textarea
                value={answerText}
                onChange={(e) => onAnswerChange(index, e.target.value)}
                placeholder="Enter your answer..."
                rows={question.includes("weaknesses") ? 4 : 2}
                className="character-answer"
              />
              {answerText && (
                <span
                  className={
                    answer.approved
                      ? "answer-approved-badge"
                      : "answer-pending-badge"
                  }
                >
                  {answer.approved ? "Approved by GM" : "Pending GM approval"}
                </span>
              )}

              {aiEnabled && (
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  disabled={suggestion.loading}
                  onClick={() => handleSuggest(index, question)}
                >
                  {suggestion.loading ? "Suggesting…" : "Suggest an answer"}
                </button>
              )}

              {suggestionErrors.length > 0 && (
                <ul className="ai-error-message">
                  {suggestionErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}

              {suggestion.text && (
                <div className="ai-suggestion-preview">
                  <p>{suggestion.text}</p>
                  <button
                    type="button"
                    className="btn-success btn-small"
                    onClick={() => acceptSuggestion(index)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-small"
                    onClick={() => discardSuggestion(index)}
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
