export default function MyCharacterSheet({
  questions,
  mySheet,
  onAnswerChange,
}) {
  return (
    <div className="player-sheet-section">
      <h2>Character Sheet</h2>
      <div className="character-sheet-form">
        {questions.map((question, index) => (
          <div key={index} className="character-field">
            <label className="question-label">{question}</label>
            <textarea
              value={mySheet[index] || ""}
              onChange={(e) => onAnswerChange(index, e.target.value)}
              placeholder="Enter your answer..."
              rows={question.includes("weaknesses") ? 4 : 2}
              className="character-answer"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
