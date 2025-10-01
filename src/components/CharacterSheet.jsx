import React, { useState, useEffect } from "react";
import { usePeer } from "../providers/PeerProvider";

const DEFAULT_QUESTIONS = [
  "What is your name?",
  "What do you look like?",
  "What is your occupation?",
  "Why did you choose to go on this adventure?",
  "What are your interests and hobbies?",
  "What is your biggest fear?",
  "What are you most proud of?",
  "What secret would you never share with anyone?",
  "What gives you courage?",
  "Tell me 3 of your weaknesses",
];

export default function CharacterSheet() {
  const {
    isGM,
    userName,
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
      console.log("Setting default questions for new game:", DEFAULT_QUESTIONS);
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
      console.log(
        "Loading existing sheet for user:",
        userName,
        characterSheets[userName]
      );
      setMySheet(characterSheets[userName]);
    } else if (userName && questions) {
      const currentQuestions = questions;
      const initialSheet = {};
      currentQuestions.forEach((question, index) => {
        initialSheet[index] = "";
      });
      console.log("Initializing new sheet for user:", userName, initialSheet);
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
        console.log("Setting questions from update:", data.questions);
        setQuestions(data.questions);
        // Update my character sheet structure to match new questions
        if (userName) {
          const newSheet = {};
          data.questions.forEach((question, index) => {
            // Preserve existing answers if they exist
            newSheet[index] = mySheet[index] || "";
          });
          console.log(
            "Updating my sheet structure to match new questions:",
            newSheet
          );
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
    console.log("Updating my sheet:", updatedSheet);
    setMySheet(updatedSheet);

    // Send update to GM and other players
    sendToPeers({
      type: "character-sheet-update",
      playerName: userName,
      sheet: updatedSheet,
    });
  };

  const handleSaveQuestions = () => {
    console.log("Saving questions:", editQuestions);
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
      {/* GM Controls */}
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

          {/* Question Editor */}
          {isEditingQuestions && (
            <div className="question-editor">
              <h3>Edit Questionnaire</h3>
              {editQuestions.map((question, index) => (
                <div key={index} className="question-edit-row">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) =>
                      handleQuestionChange(index, e.target.value)
                    }
                    placeholder={`Question ${index + 1}`}
                    className="question-input"
                  />
                  <button
                    onClick={() => handleRemoveQuestion(index)}
                    className="btn-danger-small"
                    disabled={editQuestions.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="question-editor-buttons">
                <button onClick={handleAddQuestion} className="btn-secondary">
                  Add Question
                </button>
                <button onClick={handleSaveQuestions} className="btn-success">
                  Save Questions
                </button>
                <button
                  onClick={handleCancelEditQuestions}
                  className="btn-danger"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* View Player Sheets */}
          <div className="player-sheets-section">
            <h3>Player Character Sheets</h3>
            <div className="player-sheet-selector">
              <select
                value={selectedPlayerSheet}
                onChange={(e) => setSelectedPlayerSheet(e.target.value)}
                className="player-select"
              >
                <option value="">Select a player...</option>
                {Object.keys(users).map((peerId) => (
                  <option key={peerId} value={users[peerId]}>
                    {users[peerId]}
                  </option>
                ))}
              </select>
            </div>

            {selectedPlayerSheet &&
              characterSheets &&
              characterSheets[selectedPlayerSheet] && (
                <div className="player-sheet-display">
                  <h4>{selectedPlayerSheet}'s Character Sheet</h4>
                  {currentQuestions.map((question, index) => (
                    <div key={index} className="character-answer-display">
                      <label className="question-label">{question}</label>
                      <div className="answer-display">
                        {characterSheets[selectedPlayerSheet][index] || (
                          <em>No answer provided</em>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Player Character Sheet */}
      <div className="player-sheet-section">
        <h2>{isGM ? "Your Character Sheet" : "Character Sheet"}</h2>
        <div className="character-sheet-form">
          {currentQuestions.map((question, index) => (
            <div key={index} className="character-field">
              <label className="question-label">{question}</label>
              <textarea
                value={mySheet[index] || ""}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
                placeholder="Enter your answer..."
                rows={question.includes("weaknesses") ? 4 : 2}
                className="character-answer"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Other Players' Sheets (if GM allows) */}
      {!isGM && allowPlayersToViewSheets && (
        <div className="other-players-section">
          <h2>Other Players' Character Sheets</h2>
          {Object.keys(users)
            .filter((peerId) => users[peerId] !== userName)
            .map((peerId) => {
              const playerName = users[peerId];
              const playerSheet =
                characterSheets && characterSheets[playerName];

              return (
                <div key={peerId} className="other-player-sheet">
                  <h3>{playerName}'s Character Sheet</h3>
                  {playerSheet ? (
                    currentQuestions.map((question, index) => (
                      <div key={index} className="character-answer-display">
                        <label className="question-label">{question}</label>
                        <div className="answer-display">
                          {playerSheet[index] || <em>No answer provided</em>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-sheet">No character sheet available</p>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
