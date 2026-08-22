export default function MyCharacterSheet({
  questions,
  answers,
  onAnswerChange,
}) {
  return (
    <div className="player-sheet-section">
      <h2>Character Sheet</h2>
      <div className="character-sheet-form">
        {questions.map((question, index) => {
          const answer = answers[index];
          return (
            <div key={index} className="character-field">
              <label className="question-label">{question}</label>
              <textarea
                value={answer?.text || ""}
                onChange={(e) => onAnswerChange(index, e.target.value)}
                placeholder="Enter your answer..."
                rows={question.includes("weaknesses") ? 4 : 2}
                className="character-answer"
              />
              {answer?.text && (
                <span
                  className={
                    answer.approved
                      ? "answer-approved-badge"
                      : "answer-pending-badge"
                  }
                >
                  {answer.approved ? "Approved by GM" : "Pending GM approval"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
