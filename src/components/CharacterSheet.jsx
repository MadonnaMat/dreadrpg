import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { DEFAULT_QUESTIONS } from "../constants/questions";
import QuestionEditor from "./character-sheet/QuestionEditor";
import PlayerSheetSelector from "./character-sheet/PlayerSheetSelector";
import MyCharacterSheet from "./character-sheet/MyCharacterSheet";
import OtherPlayersSheets from "./character-sheet/OtherPlayersSheets";

export default function CharacterSheet() {
  const {
    isGM,
    userName,
    hostName,
    sendToPeers,
    registerCharacterSheetEventHandler,
    characterSheets,
    setCharacterSheets,
    questions,
    setQuestions,
    allowPlayersToViewSheets,
    setAllowPlayersToViewSheets,
    users,
  } = usePeer();

  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const [editQuestions, setEditQuestions] = useState(
    questions || DEFAULT_QUESTIONS
  );
  const [mySheet, setMySheet] = useState({});
  const [selectedPlayerSheet, setSelectedPlayerSheet] = useState("");

  // Initialize questions (only for GM when starting new game)
  useEffect(() => {
    if (isGM && (!questions || questions.length === 0)) {
      setQuestions(DEFAULT_QUESTIONS);
    }
  }, [isGM, setQuestions]); // Removed questions from deps to avoid overriding

  // Update editQuestions when questions change
  useEffect(() => {
    if (questions && questions.length > 0) {
      setEditQuestions(questions);
    } else if (isGM) {
      setEditQuestions(DEFAULT_QUESTIONS);
    }
  }, [questions, isGM]);

  // Separate effect for character sheet initialization
  useEffect(() => {
    if (userName && characterSheets && characterSheets[userName]) {
      setMySheet(characterSheets[userName]);
    } else if (userName && questions) {
      const initialSheet = {};
      questions.forEach((question, index) => {
        initialSheet[index] = "";
      });
      setMySheet(initialSheet);
    }
  }, [questions, characterSheets, userName]);

  // Update editQuestions when questions change (for GM)
  useEffect(() => {
    if (questions && !isEditingQuestions) {
      setEditQuestions(questions);
    }
  }, [questions, isEditingQuestions]);

  // Register character sheet event handler
  useEffect(() => {
    registerCharacterSheetEventHandler((data) => {
      if (data.type === "character-sheet-update") {
        setCharacterSheets((prev) => ({
          ...prev,
          [data.playerName]: data.sheet,
        }));
      } else if (data.type === "questions-update") {
        setQuestions(data.questions);
        // Update my character sheet structure to match new questions
        if (userName) {
          const newSheet = {};
          data.questions.forEach((question, index) => {
            // Preserve existing answers if they exist
            newSheet[index] = mySheet[index] || "";
          });
          setMySheet(newSheet);

          // Send updated sheet structure to other players
          sendToPeers({
            type: "character-sheet-update",
            playerName: userName,
            sheet: newSheet,
          });
        }
      } else if (data.type === "sheet-visibility-update") {
        setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
      } else if (data.type === "character-sheets-broadcast") {
        setCharacterSheets(data.characterSheets);
      }
    });
  }, [
    registerCharacterSheetEventHandler,
    setCharacterSheets,
    setQuestions,
    setAllowPlayersToViewSheets,
    userName,
    mySheet,
    sendToPeers,
  ]);

  const handleAnswerChange = (questionIndex, value) => {
    const updatedSheet = { ...mySheet, [questionIndex]: value };
    setMySheet(updatedSheet);

    // Send update to GM and other players
    sendToPeers({
      type: "character-sheet-update",
      playerName: userName,
      sheet: updatedSheet,
    });
  };

  const handleSaveQuestions = () => {
    setQuestions(editQuestions);
    setIsEditingQuestions(false);

    // Restructure all existing character sheets to match new questions
    const updatedCharacterSheets = {};
    Object.keys(characterSheets || {}).forEach((playerName) => {
      const existingSheet = characterSheets[playerName];
      const newSheet = {};
      editQuestions.forEach((question, index) => {
        // Preserve existing answers if they exist
        newSheet[index] = existingSheet[index] || "";
      });
      updatedCharacterSheets[playerName] = newSheet;
    });

    // Update local character sheets
    setCharacterSheets(updatedCharacterSheets);

    // Send updated questions to all players
    sendToPeers({
      type: "questions-update",
      questions: editQuestions,
    });

    // Send updated character sheets structure to all players
    sendToPeers({
      type: "character-sheets-broadcast",
      characterSheets: updatedCharacterSheets,
    });
  };

  const handleCancelEditQuestions = () => {
    setEditQuestions(questions || DEFAULT_QUESTIONS);
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

    // Send visibility update to all players
    sendToPeers({
      type: "sheet-visibility-update",
      allowPlayersToViewSheets: newVisibility,
    });

    // When enabling sheet visibility, also broadcast all character sheets
    // so players can immediately see each other's sheets
    if (newVisibility && characterSheets) {
      sendToPeers({
        type: "character-sheets-broadcast",
        characterSheets: characterSheets,
      });
    }
  };

  const currentQuestions =
    questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS;

  return (
    <div className="character-sheet-container">
      {isGM && (
        <div className="gm-controls">
          <h2>GM Character Sheet Management</h2>

          <div className="gm-section">
            <div className="gm-buttons">
              <button
                onClick={() => setIsEditingQuestions(true)}
                className="btn-primary"
                disabled={isEditingQuestions}
              >
                Edit Questions
              </button>
              <button
                onClick={toggleSheetVisibility}
                className={`btn-toggle ${
                  allowPlayersToViewSheets ? "active" : ""
                }`}
              >
                {allowPlayersToViewSheets ? "Hide" : "Show"} Sheets to Players
              </button>
            </div>
          </div>

          {isEditingQuestions && (
            <QuestionEditor
              questions={editQuestions}
              onQuestionChange={handleQuestionChange}
              onAddQuestion={handleAddQuestion}
              onRemoveQuestion={handleRemoveQuestion}
              onSave={handleSaveQuestions}
              onCancel={handleCancelEditQuestions}
            />
          )}

          <PlayerSheetSelector
            users={users}
            hostName={hostName}
            selectedPlayerSheet={selectedPlayerSheet}
            setSelectedPlayerSheet={setSelectedPlayerSheet}
            characterSheets={characterSheets}
            questions={currentQuestions}
          />
        </div>
      )}

      {!isGM && (
        <MyCharacterSheet
          questions={currentQuestions}
          mySheet={mySheet}
          onAnswerChange={handleAnswerChange}
        />
      )}

      {!isGM && allowPlayersToViewSheets && (
        <OtherPlayersSheets
          users={users}
          userName={userName}
          hostName={hostName}
          characterSheets={characterSheets}
          questions={currentQuestions}
        />
      )}
    </div>
  );
}
