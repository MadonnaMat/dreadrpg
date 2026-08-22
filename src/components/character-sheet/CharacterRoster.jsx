import { useState } from "react";

// GM-facing character roster: create/clone/rename/delete characters and
// select one to view its assignment + answers or edit its questionnaire.
// Replaces the old PlayerSheetSelector, which picked a *player* out of
// `users` against one shared questionnaire - characters are now first-class
// entities the GM authors independently of who (if anyone) has claimed one.
export default function CharacterRoster({
  characters,
  selectedCharacterId,
  setSelectedCharacterId,
  onClone,
  onRename,
  onDelete,
  onEditQuestions,
}) {
  const [renamingId, setRenamingId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");

  const characterList = Object.values(characters);
  const selected = characters[selectedCharacterId];

  const startRename = (character) => {
    setRenamingId(character.id);
    setRenameDraft(character.name);
  };

  const commitRename = (id) => {
    if (renameDraft.trim()) onRename(id, renameDraft.trim());
    setRenamingId("");
  };

  return (
    <div className="character-roster-section">
      <h3>Characters</h3>
      {characterList.length === 0 && (
        <p className="no-character-assigned">
          No characters yet - click "New Character" to create one.
        </p>
      )}
      <ul className="character-roster-list">
        {characterList.map((character) => (
          <li
            key={character.id}
            className={`character-roster-row ${
              character.id === selectedCharacterId ? "selected" : ""
            }`}
          >
            {renamingId === character.id ? (
              <input
                type="text"
                value={renameDraft}
                autoFocus
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => commitRename(character.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(character.id);
                }}
              />
            ) : (
              <button
                className="character-roster-name"
                onClick={() => setSelectedCharacterId(character.id)}
              >
                {character.name}
                {character.assignedTo ? ` (${character.assignedTo})` : ""}
              </button>
            )}
            <button
              className="btn-secondary btn-small"
              onClick={() => startRename(character)}
            >
              Rename
            </button>
            <button
              className="btn-secondary btn-small"
              onClick={() => onClone(character.id)}
            >
              Clone
            </button>
            <button
              className="btn-danger-small"
              onClick={() => onDelete(character.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="player-sheet-display">
          <h4>{selected.name}</h4>
          <button
            className="btn-primary"
            onClick={() => onEditQuestions(selected.id)}
          >
            Edit Questions
          </button>
          {selected.questions.map((question, index) => (
            <div key={index} className="character-answer-display">
              <label className="question-label">{question}</label>
              <div className="answer-display">
                {(selected.answers && selected.answers[index]) || (
                  <em>No answer provided</em>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
