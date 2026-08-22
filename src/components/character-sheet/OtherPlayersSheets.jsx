export default function OtherPlayersSheets({ characters, excludeCharacterId }) {
  const otherAssignedCharacters = Object.values(characters).filter(
    (character) => character.assignedTo && character.id !== excludeCharacterId
  );

  return (
    <div className="other-players-section">
      <h2>Other Players' Character Sheets</h2>
      {otherAssignedCharacters.length === 0 && (
        <p className="no-sheet">No other character sheets available</p>
      )}
      {otherAssignedCharacters.map((character) => (
        <div key={character.id} className="other-player-sheet">
          <h3>{character.name}'s Character Sheet</h3>
          {character.questions.map((question, index) => (
            <div key={index} className="character-answer-display">
              <label className="question-label">{question}</label>
              <div className="answer-display">
                {(character.answers && character.answers[index]) || (
                  <em>No answer provided</em>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
