import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { DEFAULT_QUESTIONS } from "../constants/questions";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { isCharacterAlive } from "../helpers/characters";
import QuestionEditor from "./character-sheet/QuestionEditor";
import CharacterRoster from "./character-sheet/CharacterRoster";
import CharacterPicker from "./character-sheet/CharacterPicker";
import MyCharacterSheet from "./character-sheet/MyCharacterSheet";
import OtherPlayersSheets from "./character-sheet/OtherPlayersSheets";

function generateCharacterId() {
  return `char-${Math.random().toString(36).slice(2, 10)}`;
}

// Applies the same "preserve answers by index" remap the old shared-question
// save flow used, scoped to one character's own questions/answers instead of
// every player's sheet at once.
function remapAnswersToQuestions(oldAnswers, newQuestions) {
  const remapped = {};
  newQuestions.forEach((_, index) => {
    remapped[index] = (oldAnswers && oldAnswers[index]) || {
      text: "",
      approved: false,
    };
  });
  return remapped;
}

export default function CharacterSheet() {
  const {
    isGM,
    userName,
    sendToPeers,
    characters,
    setCharacters,
    allowPlayersToViewSheets,
    setAllowPlayersToViewSheets,
  } = usePeer();

  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const [editQuestions, setEditQuestions] = useState(DEFAULT_QUESTIONS);

  const selectedCharacter = characters?.[selectedCharacterId];
  const myDeadCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === userName && !isCharacterAlive(c)
  );
  const myCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === userName && isCharacterAlive(c)
  );

  // Keep the question-editor draft in sync with whichever character is
  // currently selected, unless the GM is actively editing it.
  useEffect(() => {
    if (!isEditingQuestions) {
      setEditQuestions(selectedCharacter?.questions || DEFAULT_QUESTIONS);
    }
  }, [selectedCharacter, isEditingQuestions]);

  const handleCreateCharacter = () => {
    const id = generateCharacterId();
    const character = {
      id,
      name: "New Character",
      defaultName: "New Character",
      assignedTo: null,
      alive: true,
      questions: [...DEFAULT_QUESTIONS],
      answers: {},
    };
    setCharacters((prev) => ({ ...prev, [id]: character }));
    sendToPeers({ type: MESSAGE_TYPES.CHARACTER_CREATE, character });
    setSelectedCharacterId(id);
  };

  const handleCloneCharacter = (sourceId) => {
    const source = characters?.[sourceId];
    if (!source) return;
    const id = generateCharacterId();
    const clone = {
      ...source,
      id,
      name: `${source.name} (copy)`,
      defaultName: `${source.defaultName} (copy)`,
      assignedTo: null,
      alive: true,
      answers: {},
    };
    setCharacters((prev) => ({ ...prev, [id]: clone }));
    sendToPeers({ type: MESSAGE_TYPES.CHARACTER_CLONE, character: clone });
  };

  const handleRenameCharacter = (id, name) => {
    setCharacters((prev) => ({ ...prev, [id]: { ...prev[id], name } }));
    sendToPeers({ type: MESSAGE_TYPES.CHARACTER_UPDATE, id, name });
  };

  const handleDeleteCharacter = (id) => {
    setCharacters((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    sendToPeers({ type: MESSAGE_TYPES.CHARACTER_DELETE, id });
    if (selectedCharacterId === id) setSelectedCharacterId("");
  };

  // A newly-typed answer always reverts to unapproved - the GM has to
  // explicitly re-approve it (see handleApproveAnswer), even if it was
  // previously approved before the player changed it.
  const handleAnswerChange = (characterId, questionIndex, value) => {
    const character = characters?.[characterId];
    if (!character) return;
    const answers = {
      ...(character.answers || {}),
      [questionIndex]: { text: value, approved: false },
    };
    setCharacters((prev) => ({
      ...prev,
      [characterId]: { ...prev[characterId], answers },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id: characterId,
      answers,
    });
  };

  // GM only: marks one answer as officially approved, making it visible to
  // other players once sheet visibility is on (see OtherPlayersSheets).
  const handleApproveAnswer = (characterId, questionIndex) => {
    const character = characters?.[characterId];
    const existing = character?.answers?.[questionIndex];
    if (!existing) return;
    const answers = {
      ...character.answers,
      [questionIndex]: { ...existing, approved: true },
    };
    setCharacters((prev) => ({
      ...prev,
      [characterId]: { ...prev[characterId], answers },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id: characterId,
      answers,
    });
  };

  const handleSaveQuestions = () => {
    if (!selectedCharacterId) return;
    const answers = remapAnswersToQuestions(
      selectedCharacter?.answers,
      editQuestions
    );
    const patch = { questions: editQuestions, answers };
    setCharacters((prev) => ({
      ...prev,
      [selectedCharacterId]: { ...prev[selectedCharacterId], ...patch },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id: selectedCharacterId,
      ...patch,
    });
    setIsEditingQuestions(false);
  };

  const handleCancelEditQuestions = () => {
    setEditQuestions(selectedCharacter?.questions || DEFAULT_QUESTIONS);
    setIsEditingQuestions(false);
  };

  const handleAddQuestion = () => {
    setEditQuestions([...editQuestions, ""]);
  };

  const handleRemoveQuestion = (index) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, value) => {
    const updated = [...editQuestions];
    updated[index] = value;
    setEditQuestions(updated);
  };

  const toggleSheetVisibility = () => {
    const newVisibility = !allowPlayersToViewSheets;
    setAllowPlayersToViewSheets(newVisibility);
    sendToPeers({
      type: MESSAGE_TYPES.SHEET_VISIBILITY_UPDATE,
      allowPlayersToViewSheets: newVisibility,
    });
  };

  return (
    <div className="character-sheet-container">
      {isGM ? (
        <GMCharacterPanel
          characters={characters || {}}
          selectedCharacterId={selectedCharacterId}
          setSelectedCharacterId={setSelectedCharacterId}
          selectedCharacter={selectedCharacter}
          allowPlayersToViewSheets={allowPlayersToViewSheets}
          isEditingQuestions={isEditingQuestions}
          setIsEditingQuestions={setIsEditingQuestions}
          editQuestions={editQuestions}
          onCreate={handleCreateCharacter}
          onClone={handleCloneCharacter}
          onRename={handleRenameCharacter}
          onDelete={handleDeleteCharacter}
          onToggleVisibility={toggleSheetVisibility}
          onQuestionChange={handleQuestionChange}
          onAddQuestion={handleAddQuestion}
          onRemoveQuestion={handleRemoveQuestion}
          onSaveQuestions={handleSaveQuestions}
          onCancelEditQuestions={handleCancelEditQuestions}
          onApproveAnswer={handleApproveAnswer}
        />
      ) : (
        <PlayerCharacterPanel
          myCharacter={myCharacter}
          myDeadCharacter={myDeadCharacter}
          characters={characters || {}}
          allowPlayersToViewSheets={allowPlayersToViewSheets}
          onAnswerChange={handleAnswerChange}
        />
      )}
    </div>
  );
}

function GMCharacterPanel({
  characters,
  selectedCharacterId,
  setSelectedCharacterId,
  selectedCharacter,
  allowPlayersToViewSheets,
  isEditingQuestions,
  setIsEditingQuestions,
  editQuestions,
  onCreate,
  onClone,
  onRename,
  onDelete,
  onToggleVisibility,
  onQuestionChange,
  onAddQuestion,
  onRemoveQuestion,
  onSaveQuestions,
  onCancelEditQuestions,
  onApproveAnswer,
}) {
  return (
    <div className="gm-controls">
      <h2>GM Character Management</h2>

      <div className="gm-section">
        <div className="gm-buttons">
          <button onClick={onCreate} className="btn-primary">
            New Character
          </button>
          <button
            onClick={onToggleVisibility}
            className={`btn-toggle ${allowPlayersToViewSheets ? "active" : ""}`}
          >
            {allowPlayersToViewSheets ? "Hide" : "Show"} Sheets to Players
          </button>
        </div>
      </div>

      <CharacterRoster
        characters={characters}
        selectedCharacterId={selectedCharacterId}
        setSelectedCharacterId={setSelectedCharacterId}
        onClone={onClone}
        onRename={onRename}
        onDelete={onDelete}
        onEditQuestions={() => setIsEditingQuestions(true)}
        onApproveAnswer={onApproveAnswer}
      />

      {isEditingQuestions && selectedCharacter && (
        <QuestionEditor
          questions={editQuestions}
          onQuestionChange={onQuestionChange}
          onAddQuestion={onAddQuestion}
          onRemoveQuestion={onRemoveQuestion}
          onSave={onSaveQuestions}
          onCancel={onCancelEditQuestions}
        />
      )}
    </div>
  );
}

function PlayerCharacterPanel({
  myCharacter,
  myDeadCharacter,
  characters,
  allowPlayersToViewSheets,
  onAnswerChange,
}) {
  return (
    <>
      {myCharacter ? (
        <MyCharacterSheet
          questions={myCharacter.questions}
          answers={myCharacter.answers || {}}
          onAnswerChange={(index, value) =>
            onAnswerChange(myCharacter.id, index, value)
          }
        />
      ) : (
        <>
          {myDeadCharacter && (
            <p className="character-died-notice">
              Your character, <strong>{myDeadCharacter.name}</strong>, has died.
              Choose a new character to keep playing.
            </p>
          )}
          <CharacterPicker />
        </>
      )}

      {allowPlayersToViewSheets && (
        <OtherPlayersSheets
          characters={characters}
          excludeCharacterId={myCharacter?.id}
        />
      )}
    </>
  );
}
