import { useAutoGm } from "../../hooks/useAutoGm";

// GM-only live view into what AutoGM is tracking: its rolling summary, the
// uncompacted chat tail feeding the model, and a feed of recent turns
// (including its own self-check reasoning) - all plain context state, so
// this updates in real time with no polling as new turns land. Nothing
// here persists (see AutoGmProvider's turnLog comment) - it's a debugging
// aid, not part of the story's actual memory.
export default function AutoGmDebugPanel() {
  const { autoGmError, storySummary, rawHistory, turnLog } = useAutoGm();

  return (
    <div className="autogm-debug-panel">
      <h3>AutoGM Debug</h3>
      {autoGmError && <p className="ai-error-message">{autoGmError}</p>}

      <div className="autogm-debug-section">
        <strong>Story summary</strong>
        <p className="autogm-debug-summary">
          {storySummary || "No summary yet."}
        </p>
      </div>

      <div className="autogm-debug-section">
        <strong>Recent history ({rawHistory.length})</strong>
        {rawHistory.length === 0 ? (
          <p className="no-character-assigned">No messages yet.</p>
        ) : (
          <ul className="autogm-debug-history">
            {rawHistory.map((message, index) => (
              <li key={index}>
                <strong>{message.from}:</strong> {message.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="autogm-debug-section">
        <strong>Recent turns</strong>
        {turnLog.length === 0 ? (
          <p className="no-character-assigned">No turns yet.</p>
        ) : (
          <ul className="autogm-debug-turn-log">
            {turnLog.map((entry) => (
              <AutoGmDebugTurn key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AutoGmDebugDecisions({ entry }) {
  return (
    <div className="autogm-debug-decisions">
      {entry.callForPull && (
        <span>
          Called for a pull: {entry.targetPlayerName || "(none)"}
          {entry.pullsRequired > 1 ? ` (${entry.pullsRequired} pulls)` : ""}
          {entry.pullSkippedReason && ` — skipped: ${entry.pullSkippedReason}`}
        </span>
      )}
      {entry.readyToRestack && entry.awaitingResetAtTurn && (
        <span>Signaled ready to restack</span>
      )}
      {entry.campaignNoteUpdates?.length > 0 && (
        <span>
          Campaign notes:{" "}
          {entry.campaignNoteUpdates
            .map((update) => update.itemText)
            .join(", ")}
        </span>
      )}
    </div>
  );
}

function AutoGmDebugTurn({ entry }) {
  const wasRevised =
    entry.draftNarration && entry.finalNarration !== entry.draftNarration;

  return (
    <li className="autogm-debug-turn">
      {entry.trigger && (
        <div className="autogm-debug-trigger">
          <strong>{entry.trigger.from}:</strong> {entry.trigger.text}
        </div>
      )}

      {entry.kind === "error" && (
        <div className="autogm-debug-error">
          <em>Failed:</em> {entry.error || "No details returned by the model."}
        </div>
      )}

      {entry.finalNarration && (
        <div className="autogm-debug-narration">
          <em>
            {entry.kind === "removal" ? "Removal narration" : "Narration"}:
          </em>{" "}
          {entry.finalNarration}
        </div>
      )}

      {wasRevised && (
        <div className="autogm-debug-revision">
          <div>
            <em>Original draft:</em> {entry.draftNarration}
          </div>
          {entry.reasoning && (
            <div>
              <em>Reasoning:</em> {entry.reasoning}
            </div>
          )}
        </div>
      )}

      <AutoGmDebugDecisions entry={entry} />
    </li>
  );
}
