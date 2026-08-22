// Pure helpers for building the full game-state snapshot ("welcome"/
// "game-data-sync") and fanning an inbound message out to whichever
// component registered interest in its type. Extracted out of
// PeerProvider.jsx so they don't need to be recreated on every render and so
// they're testable as plain functions.
import { MESSAGE_TYPES } from "../../constants/messageTypes";

// Build the full game-state snapshot sent to players via "welcome"/"game-data-sync"
export function buildGameSnapshot(type, currentStateRef) {
  return {
    type,
    hostName: currentStateRef.current.hostName,
    users: currentStateRef.current.users,
    towerSize: currentStateRef.current.towerSize,
    dangerProbability: currentStateRef.current.dangerProbability,
    awaitingReset: currentStateRef.current.awaitingReset,
    scenario: currentStateRef.current.scenario,
    characterSheets: currentStateRef.current.characterSheets,
    questions: currentStateRef.current.questions,
    allowPlayersToViewSheets: currentStateRef.current.allowPlayersToViewSheets,
  };
}

// Forward a message to whichever component registered interest in its type.
// Shared by both the GM's per-connection data handler and the player's
// single connection data handler. `handlerRefs` is
// { wheel, chat, scenario, characterSheet } refs owned by PeerProvider.
export function dispatchToRegisteredHandlers(data, connection, handlerRefs) {
  if (handlerRefs.wheel.current) {
    handlerRefs.wheel.current(data, connection);
  }
  if (handlerRefs.chat.current && data.type === MESSAGE_TYPES.CHAT) {
    handlerRefs.chat.current(data, connection);
  }
  if (
    handlerRefs.scenario.current &&
    data.type === MESSAGE_TYPES.SCENARIO_UPDATE
  ) {
    handlerRefs.scenario.current(data, connection);
  }
  if (
    handlerRefs.characterSheet.current &&
    (data.type === MESSAGE_TYPES.CHARACTER_SHEET_UPDATE ||
      data.type === MESSAGE_TYPES.QUESTIONS_UPDATE ||
      data.type === MESSAGE_TYPES.SHEET_VISIBILITY_UPDATE ||
      data.type === MESSAGE_TYPES.CHARACTER_SHEETS_BROADCAST)
  ) {
    handlerRefs.characterSheet.current(data, connection);
  }
}
