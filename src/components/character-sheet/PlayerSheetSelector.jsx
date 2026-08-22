export default function PlayerSheetSelector({
  users,
  hostName,
  selectedPlayerSheet,
  setSelectedPlayerSheet,
  characterSheets,
  questions,
}) {
  const selectedSheet =
    selectedPlayerSheet &&
    characterSheets &&
    characterSheets[selectedPlayerSheet];

  return (
    <div className="player-sheets-section">
      <h3>Player Character Sheets</h3>
      <div className="player-sheet-selector">
        <select
          value={selectedPlayerSheet}
          onChange={(e) => setSelectedPlayerSheet(e.target.value)}
          className="player-select"
        >
          <option value="">Select a player...</option>
          {Object.keys(users)
            .filter((peerId) => users[peerId] !== (hostName || "GM"))
            .map((peerId) => (
              <option key={peerId} value={users[peerId]}>
                {users[peerId]}
              </option>
            ))}
        </select>
      </div>

      {selectedSheet && (
        <div className="player-sheet-display">
          <h4>{selectedPlayerSheet}'s Character Sheet</h4>
          {questions.map((question, index) => (
            <div key={index} className="character-answer-display">
              <label className="question-label">{question}</label>
              <div className="answer-display">
                {selectedSheet[index] || <em>No answer provided</em>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
