import { MESSAGE_TYPES } from "../../constants/messageTypes";

// Applies an inbound create/clone/update/delete/visibility message to local
// character state. Registered from PeerProvider itself (not from whichever
// component currently happens to render a character-related UI) so it's
// always active - a player claiming a character in the pre-game lobby, or
// another player answering questions, needs to reach the GM and get
// rebroadcast even when nobody has the character-sheet tab open.
export function applyCharacterEvent(
  data,
  setCharacters,
  setAllowPlayersToViewSheets
) {
  if (
    data.type === MESSAGE_TYPES.CHARACTER_CREATE ||
    data.type === MESSAGE_TYPES.CHARACTER_CLONE
  ) {
    setCharacters((prev) => ({ ...prev, [data.character.id]: data.character }));
  } else if (data.type === MESSAGE_TYPES.CHARACTER_UPDATE) {
    const { type: _type, id, ...patch } = data;
    setCharacters((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  } else if (data.type === MESSAGE_TYPES.CHARACTER_DELETE) {
    setCharacters((prev) => {
      const next = { ...prev };
      delete next[data.id];
      return next;
    });
  } else if (data.type === MESSAGE_TYPES.SHEET_VISIBILITY_UPDATE) {
    setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
  }
}
