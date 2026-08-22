export default function QuestionEditor({
  questions,
  onQuestionChange,
  onAddQuestion,
  onRemoveQuestion,
  onSave,
  onCancel,
}) {
  return (
    <div className="question-editor">
      <h3>Edit Questionnaire</h3>
      {questions.map((question, index) => (
        <div key={index} className="question-edit-row">
          <input
            type="text"
            value={question}
            onChange={(e) => onQuestionChange(index, e.target.value)}
            placeholder={`Question ${index + 1}`}
            className="question-input"
          />
          <button
            onClick={() => onRemoveQuestion(index)}
            className="btn-danger-small"
            disabled={questions.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="question-editor-buttons">
        <button onClick={onAddQuestion} className="btn-secondary">
          Add Question
        </button>
        <button onClick={onSave} className="btn-success">
          Save Questions
        </button>
        <button onClick={onCancel} className="btn-danger">
          Cancel
        </button>
      </div>
    </div>
  );
}
