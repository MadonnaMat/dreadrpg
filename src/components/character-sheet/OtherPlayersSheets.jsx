export default function OtherPlayersSheets({
  users,
  userName,
  hostName,
  characterSheets,
  questions,
}) {
  return (
    <div className="other-players-section">
      <h2>Other Players' Character Sheets</h2>
      {Object.keys(users)
        .filter(
          (peerId) =>
            users[peerId] !== userName && users[peerId] !== (hostName || "GM")
        )
        .map((peerId) => {
          const playerName = users[peerId];
          const playerSheet = characterSheets && characterSheets[playerName];

          return (
            <div key={peerId} className="other-player-sheet">
              <h3>{playerName}'s Character Sheet</h3>
              {playerSheet ? (
                questions.map((question, index) => (
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
  );
}
