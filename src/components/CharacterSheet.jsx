import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { useAutoGm } from "../hooks/useAutoGm";
import { DEFAULT_QUESTIONS } from "../constants/questions";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import {
  isCharacterAlive,
  withUpdatedAnswer,
  myIdentity,
  approveAnswer,
} from "../helpers/characters";
import QuestionEditor from "./character-sheet/QuestionEditor";
import CharacterRoster from "./character-sheet/CharacterRoster";
import CharacterPicker from "./character-sheet/CharacterPicker";
import MyCharacterSheet from "./character-sheet/MyCharacterSheet";
import OtherPlayersSheets from "./character-sheet/OtherPlayersSheets";
import CastAiGenerator from "./character-sheet/CastAiGenerator";

function generateCharacterId() {
  return `char-${Math.random().toString(36).slice(2, 10)}`;
}

// Answers are keyed by question index throughout the app, but that index
// shifts under a player's feet whenever the GM edits the question list (e.g.
// removing question 2 of 5 shifts every later index down). Matching by the
// question's own text instead of its position keeps an existing answer (and
// its approved state) attached to the same question even after a removal or
// reorder - it only resets to blank for a genuinely new question.
function remapAnswersToQuestions(oldQuestions, oldAnswers, newQuestions) {
  const answersByText = new Map();
  (oldQuestions || []).forEach((question, index) => {
    if (oldAnswers && oldAnswers[index]) {
      answersByText.set(question, oldAnswers[index]);
    }
  });
  const remapped = {};
  newQuestions.forEach((question, index) => {
    remapped[index] = answersByText.get(question) || {
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
    hostName,
    sendToPeers,
    characters,
    setCharacters,
    allowPlayersToViewSheets,
    setAllowPlayersToViewSheets,
    scenario,
  } = usePeer();
  const { aiEnabled, generateCast } = useAi();
  const { autoGmEnabled } = useAutoGm();
  const identity = myIdentity({ isGM, hostName, userName });

  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const [editQuestions, setEditQuestions] = useState(DEFAULT_QUESTIONS);
  const [suggestingQuestions, setSuggestingQuestions] = useState(false);

  const selectedCharacter = characters?.[selectedCharacterId];
  const myDeadCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === identity && !isCharacterAlive(c)
  );
  const myCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === identity && isCharacterAlive(c)
  );

  // Keep the question-editor draft in sync with whichever character is
  // currently selected, unless the GM is actively editing it.
  useEffect(() => {
    if (!isEditingQuestions) {
      setEditQuestions(selectedCharacter?.questions || DEFAULT_QUESTIONS);
    }
  }, [selectedCharacter, isEditingQuestions]);

  // `overrides` lets an AI-drafted { name, questions } (see
  // CastAiGenerator) seed a new character with a single CHARACTER_CREATE
  // message, identical on the wire to a manually-created one - the "New
  // Character" button below just calls this with no overrides.
  const handleCreateCharacter = (overrides = {}) => {
    const id = generateCharacterId();
    const name = overrides.name || "New Character";
    const character = {
      id,
      name,
      defaultName: name,
      assignedTo: null,
      alive: true,
      questions: overrides.questions?.length
        ? overrides.questions
        : [...DEFAULT_QUESTIONS],
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
    const answers = withUpdatedAnswer(character, questionIndex, value);
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
    const answers = approveAnswer(character, questionIndex);
    if (!answers) return;
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
      selectedCharacter?.questions,
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

  // Reuses the cast-generation prompt/schema (an array of one
  // { name, questions } draft) for a single character rather than adding a
  // fourth prompt just for "a few more questions" - appends only questions
  // not already present into editQuestions, ahead of the existing Save
  // Questions button, so nothing is sent until the GM explicitly saves.
  const handleSuggestMoreQuestions = async () => {
    if (!selectedCharacter) return;
    setSuggestingQuestions(true);
    const result = await generateCast({
      castDescription: `One character named "${selectedCharacter.name}" with these existing questionnaire questions: ${editQuestions.join("; ")}. Suggest 3-5 additional distinct questions for this same character, not overlapping with the existing ones.`,
      scenario,
    });
    setSuggestingQuestions(false);
    const suggested = result.valid ? result.parsed[0]?.questions : null;
    if (suggested?.length) {
      const newQuestions = suggested.filter((q) => !editQuestions.includes(q));
      setEditQuestions([...editQuestions, ...newQuestions]);
    }
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
        <>
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
            aiEnabled={aiEnabled}
            scenario={scenario}
            onSuggestMoreQuestions={handleSuggestMoreQuestions}
            suggestingQuestions={suggestingQuestions}
          />
          {autoGmEnabled && (
            <PlayerCharacterPanel
              myCharacter={myCharacter}
              myDeadCharacter={myDeadCharacter}
              characters={characters || {}}
              allowPlayersToViewSheets={allowPlayersToViewSheets}
              onAnswerChange={handleAnswerChange}
            />
          )}
        </>
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
  aiEnabled,
  scenario,
  onSuggestMoreQuestions,
  suggestingQuestions,
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

      {aiEnabled && <CastAiGenerator scenario={scenario} onAccept={onCreate} />}

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
          onSuggestMoreQuestions={
            aiEnabled ? onSuggestMoreQuestions : undefined
          }
          suggesting={suggestingQuestions}
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
