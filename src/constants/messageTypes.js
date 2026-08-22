// Network message `type` values used across the PeerJS protocol (see
// CLAUDE.md's "PeerJS message protocol" section). Centralized so a typo in
// one file's sender/receiver can't silently break a match in another.
export const MESSAGE_TYPES = {
  JOIN: "join",
  JOIN_REJECTED: "join-rejected",
  WELCOME: "welcome",
  USER_LIST_UPDATE: "user-list-update",
  REFETCH_REQUEST: "refetch-request",
  GAME_DATA_SYNC: "game-data-sync",
  PING: "ping",
  PONG: "pong",
  CHAT: "chat",
  SCENARIO_UPDATE: "scenario-update",
  CHARACTER_CREATE: "character-create",
  CHARACTER_CLONE: "character-clone",
  CHARACTER_UPDATE: "character-update",
  CHARACTER_DELETE: "character-delete",
  SHEET_VISIBILITY_UPDATE: "sheet-visibility-update",
  SPIN_REQUEST: "spin-request",
  SPIN_START: "spin-start",
  SPIN: "spin",
  SPIN_FINAL: "spin-final",
  WHEEL_RESET: "wheel-reset",
  GAME_STARTED: "game-started",
  GAME_NAME_UPDATE: "game-name-update",
  TOWER_SIZE_UPDATE: "tower-size-update",
  THEME_UPDATE: "theme-update",
};
