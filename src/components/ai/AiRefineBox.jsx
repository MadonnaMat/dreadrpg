import { useState } from "react";

// Small follow-up input shown under an existing AI draft, letting the user
// steer a regeneration ("make it scarier", "shorten this") instead of only
// being able to start over from scratch. Shared across every AI generator
// (Scenario, cast, answer-suggestion) so refinement looks and behaves the
// same everywhere - the parent owns the actual conversation history and
// schema/validate pairing; this component only collects the free-text
// instruction and reports it upward.
export default function AiRefineBox({
  onRefine,
  disabled,
  placeholder = "e.g. make it scarier, shorten this, add a twist",
}) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onRefine(text.trim());
    setText("");
  };

  return (
    <div className="ai-refine-box">
      <input
        type="text"
        className="ai-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      <button
        type="button"
        className="btn-secondary btn-small"
        disabled={disabled || !text.trim()}
        onClick={handleSubmit}
      >
        {disabled ? "Refining…" : "Refine"}
      </button>
    </div>
  );
}
