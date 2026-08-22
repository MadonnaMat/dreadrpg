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
    gameName: currentStateRef.current.gameName,
    users: currentStateRef.current.users,
    towerSize: currentStateRef.current.towerSize,
    dangerProbability: currentStateRef.current.dangerProbability,
    awaitingReset: currentStateRef.current.awaitingReset,
    gameStarted: currentStateRef.current.gameStarted,
    scenario: currentStateRef.current.scenario,
    characters: currentStateRef.current.characters,
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
  const characterSheetTypes = [
    MESSAGE_TYPES.CHARACTER_CREATE,
    MESSAGE_TYPES.CHARACTER_CLONE,
    MESSAGE_TYPES.CHARACTER_UPDATE,
    MESSAGE_TYPES.CHARACTER_DELETE,
    MESSAGE_TYPES.SHEET_VISIBILITY_UPDATE,
  ];
  if (
    handlerRefs.characterSheet.current &&
    characterSheetTypes.includes(data.type)
  ) {
    handlerRefs.characterSheet.current(data, connection);
  }
}
