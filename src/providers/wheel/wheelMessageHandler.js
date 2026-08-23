// Extracted from WheelProvider's registerWheelEventHandler callback: maps an
// inbound network message to local wheel state. Independently testable
// without mounting the whole provider tree.
import { MESSAGE_TYPES } from "../../constants/messageTypes";

// A "spin" broadcast's fields are all independently optional - extracted out
// purely to keep handlePlayerMessage's own branching complexity down.
function applySpinMessage(data, setters) {
  const {
    setDangerProbability,
    setAwaitingReset,
    setDesignatedSpinner,
    setPullsRemaining,
    setResult,
  } = setters;

  if (data.dangerProbability !== undefined) {
    setDangerProbability(data.dangerProbability);
  }
  if (data.awaitingReset !== undefined) setAwaitingReset(data.awaitingReset);
  if (data.designatedSpinner !== undefined) {
    setDesignatedSpinner(data.designatedSpinner);
  }
  if (data.pullsRemaining !== undefined) {
    setPullsRemaining(data.pullsRemaining);
  }
  // The GM is the sole authority on the outcome, including its display text
  // (it needs the spinner's character name) - a player never resolves or
  // renders its own result locally (see handleSpinEnd's isGM gate).
  if (data.resultText !== undefined) setResult(data.resultText);
}

// A late joiner's welcome/game-data-sync snapshot only needs to seed the two
// fields that don't already flow through PeerProvider's own snapshot
// hydration (see useGameState.js) - dangerProbability/awaitingReset/
// gameStarted are mirrored into local wheel state independently.
function applySnapshotMessage(data, setters) {
  const { setDangerProbability, setAwaitingReset, setShowWheel } = setters;

  if (data.dangerProbability !== undefined) {
    setDangerProbability(data.dangerProbability);
  }
  if (data.awaitingReset !== undefined) setAwaitingReset(data.awaitingReset);
  if (data.gameStarted) setShowWheel(true);
}

// Player-side handling of the GM's authoritative broadcasts - extracted out
// of createWheelMessageHandler purely to keep that function's branching
// complexity down; each message type is an independent case.
function handlePlayerMessage(data, setters) {
  const {
    spinStartRef,
    spinTargetAngleRef,
    setSpinning,
    setResult,
    setPointerIdx,
    setSpinAngle,
    setDangerProbability,
    setAwaitingReset,
    setDesignatedSpinner,
    setPullsRequired,
    setPullsRemaining,
    setShowWheel,
  } = setters;

  if (data.type === MESSAGE_TYPES.SPIN_START) {
    spinStartRef.currentAngle = data.currentAngle;
    spinTargetAngleRef.current = data.targetAngle;
    spinStartRef.current = performance.now();
    setSpinning(true);
    setResult("");
    setPointerIdx(null);
  }
  if (data.type === MESSAGE_TYPES.SPIN) applySpinMessage(data, setters);
  if (data.type === MESSAGE_TYPES.SPIN_ASSIGN) {
    setDesignatedSpinner(data.targetUserName);
    const pullsRequired = data.pullsRequired ?? 1;
    setPullsRequired(pullsRequired);
    setPullsRemaining(data.targetUserName ? pullsRequired : 0);
  }
  if (data.type === MESSAGE_TYPES.SPIN_FINAL) {
    setSpinAngle(data.finalAngle);
    setSpinning(false);
  }
  if (data.type === MESSAGE_TYPES.WHEEL_RESET) {
    setDangerProbability(data.dangerProbability);
    setAwaitingReset(data.awaitingReset);
  }
  if (data.type === MESSAGE_TYPES.GAME_STARTED) {
    setShowWheel(true);
    // Carries the danger curve recomputed from the actual joined player
    // count (item 11) - already-connected players learn the harder
    // starting probability immediately, not just at the next spin.
    if (data.dangerProbability !== undefined) {
      setDangerProbability(data.dangerProbability);
    }
  }
  if (
    data.type === MESSAGE_TYPES.WELCOME ||
    data.type === MESSAGE_TYPES.GAME_DATA_SYNC
  ) {
    applySnapshotMessage(data, setters);
  }
}

export function createWheelMessageHandler({
  isGM,
  handleHostSpin,
  handleHostDecline,
  ...setters
}) {
  return (data, connection) => {
    if (isGM) {
      if (data.type === MESSAGE_TYPES.SPIN_REQUEST) {
        handleHostSpin(connection);
      }
      if (data.type === MESSAGE_TYPES.SPIN_DECLINE) {
        handleHostDecline(connection);
      }
    } else {
      handlePlayerMessage(data, setters);
    }
  };
}
