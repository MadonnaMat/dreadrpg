// Network message `type` values used across the PeerJS protocol (see
// CLAUDE.md's "PeerJS message protocol" section). Centralized so a typo in
// one file's sender/receiver can't silently break a match in another.
export const MESSAGE_TYPES = {
  JOIN: "join",
  WELCOME: "welcome",
  USER_LIST_UPDATE: "user-list-update",
  REFETCH_REQUEST: "refetch-request",
  GAME_DATA_SYNC: "game-data-sync",
  PING: "ping",
  PONG: "pong",
  CHAT: "chat",
  SCENARIO_UPDATE: "scenario-update",
  CHARACTER_SHEET_UPDATE: "character-sheet-update",
  QUESTIONS_UPDATE: "questions-update",
  SHEET_VISIBILITY_UPDATE: "sheet-visibility-update",
  CHARACTER_SHEETS_BROADCAST: "character-sheets-broadcast",
  SPIN_REQUEST: "spin-request",
  SPIN_START: "spin-start",
  SPIN: "spin",
  SPIN_FINAL: "spin-final",
  WHEEL_RESET: "wheel-reset",
  GAME_STARTED: "game-started",
};
