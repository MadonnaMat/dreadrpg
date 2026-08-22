// Extracted from WheelProvider's registerWheelEventHandler callback: maps an
// inbound network message to local wheel state. Independently testable
// without mounting the whole provider tree.
import { MESSAGE_TYPES } from "../../constants/messageTypes";
import { WEDGE_TYPES, RESULT_TEXT } from "../../constants/wheelOutcomes";

export function createWheelMessageHandler({
  isGM,
  handleHostSpin,
  spinStartRef,
  spinTargetAngleRef,
  setSpinning,
  setResult,
  setPointerIdx,
  setSpinAngle,
  setDangerProbability,
  setAwaitingReset,
  setShowWheel,
}) {
  return (data) => {
    if (isGM) {
      if (data.type === MESSAGE_TYPES.SPIN_REQUEST) {
        handleHostSpin(data.peerId);
      }
      // Host can also receive other wheel-related actions if needed
    } else {
      // Player: handle host broadcasts
      if (data.type === MESSAGE_TYPES.SPIN_START) {
        spinStartRef.currentAngle = data.currentAngle;
        spinTargetAngleRef.current = data.targetAngle;
        spinStartRef.current = performance.now();
        setSpinning(true);
        setResult("");
        setPointerIdx(null);
      }
      if (data.type === MESSAGE_TYPES.SPIN) {
        if (data.dangerProbability !== undefined) {
          setDangerProbability(data.dangerProbability);
        }
        if (data.awaitingReset !== undefined) {
          setAwaitingReset(data.awaitingReset);
        }
        // The GM is the sole authority on the outcome - a player never
        // resolves its own result locally (see handleSpinEnd's isGM gate).
        if (data.result !== undefined) {
          setResult(
            data.result === WEDGE_TYPES.DEATH
              ? RESULT_TEXT.DEATH
              : RESULT_TEXT.SUCCESS
          );
        }
      }
      if (data.type === MESSAGE_TYPES.SPIN_FINAL) {
        setSpinAngle(data.finalAngle);
        setSpinning(false);
      }
      if (data.type === MESSAGE_TYPES.WHEEL_RESET) {
        setDangerProbability(data.dangerProbability);
        setAwaitingReset(data.awaitingReset);
      }
      // Sync from a welcome/game-data-sync snapshot
      if (
        data.type === MESSAGE_TYPES.WELCOME ||
        data.type === MESSAGE_TYPES.GAME_DATA_SYNC
      ) {
        if (data.dangerProbability !== undefined) {
          setDangerProbability(data.dangerProbability);
        }
        if (data.awaitingReset !== undefined) {
          setAwaitingReset(data.awaitingReset);
        }
      }
    }
    // Show wheel when any wheel event is received
    setShowWheel(true);
  };
}
