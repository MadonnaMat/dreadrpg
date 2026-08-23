// A character is eligible to spin (or be freshly assigned to a player) only
// while it's alive - `alive` defaults to true for any character predating
// this field, so `!== false` is the correct "is this one still in play"
// check everywhere, not `=== true`.
export function isCharacterAlive(character) {
  return character?.alive !== false;
}

// Builds the updated `answers` map for one character after a single
// question's answer changes. A fresh edit always resets `approved` to
// false, even if it was previously approved - the GM must re-approve
// edited content, the same rule whether the edit happens mid-game
// (CharacterSheet.jsx) or during the pregame lobby (PlayerLobby.jsx).
export function withUpdatedAnswer(character, questionIndex, value) {
  return {
    ...(character.answers || {}),
    [questionIndex]: { text: value, approved: false },
  };
}

// Finds the character a userName should currently be represented by - their
// alive assignment, if they have one. A player can end up with *multiple*
// characters assigned to them over a game (a dead one, kept around as a
// historical record - see WheelProvider's death handling - plus whatever
// they picked afterward via CharacterPicker), so this must specifically
// prefer an alive match rather than just the first one found; picking
// arbitrarily was the bug that left a player who'd already replaced their
// dead character still excluded from the GM's spin-assign dropdown.
function currentCharacterFor(characters, targetUserName) {
  return Object.values(characters || {}).find(
    (c) => c.assignedTo === targetUserName && isCharacterAlive(c)
  );
}

// The display name of whichever character is assigned to a userName, falling
// back to the userName itself if they haven't claimed one (or only have a
// dead one), or a generic placeholder if there's no userName at all
// (shouldn't normally happen once a spin is actually resolved, but keeps
// narration text sane rather than showing a literal "null" if it ever does).
// Shared between WheelProvider (chat narration, death/spin messages) and
// GameLoaded (the GM's spin-assign UI) so both show the same name.
export function characterNameFor(characters, targetUserName) {
  if (!targetUserName) return "The character";
  const character = currentCharacterFor(characters, targetUserName);
  return character?.name || targetUserName;
}

// "<userName> <CharacterName>" when the user has claimed a (living)
// character, else just the userName - the exact format Chat.jsx's message
// transcript already uses for a sender's name, reused here so the
// spin-assign dropdown and the chat "Players:" roster show the same
// identity a message from that person would.
export function formatUserWithCharacter(characters, targetUserName) {
  if (!targetUserName) return targetUserName;
  const character = currentCharacterFor(characters, targetUserName);
  return character ? `${targetUserName} <${character.name}>` : targetUserName;
}

// Same "<name> <...>" bracket convention, but for a roster/list row that
// might be the GM's own entry rather than a player's. A GM playing a
// character (AutoGM mode) should show "<CharacterName>" just like a player
// would, so the character lookup is tried first; only a GM with no claimed
// character falls back to the "<GM>" placeholder. Pass the game's hostName
// so the GM's own row (matched by name === hostName) can be told apart from
// a player row reliably - a player can never actually hold that name
// themselves, since the join handshake rejects any name matching a
// currently-connected presence entry, and the host's own presence entry is
// always seeded first.
export function formatNameForList(characters, name, hostName) {
  if (!name) return name;
  if (name === hostName) {
    const character = currentCharacterFor(characters, hostName);
    return character ? `${name} <${character.name}>` : `${name} <GM>`;
  }
  return formatUserWithCharacter(characters, name);
}

// The GM has no `userName` of their own - only players get one via
// joinGame - so `hostName` is the GM's stable "who am I" identity wherever
// a player would use `userName` (claiming a character, sending chat, etc).
export function myIdentity({ isGM, hostName, userName }) {
  return isGM ? hostName : userName;
}

// GM-only: marks one answer as officially approved, making it visible to
// other players once sheet visibility is on. Shared by the manual
// CharacterSheet.jsx approval button and AutoGM's auto-approve effect.
export function approveAnswer(character, questionIndex) {
  const existing = character?.answers?.[questionIndex];
  if (!existing) return null;
  return {
    ...character.answers,
    [questionIndex]: { ...existing, approved: true },
  };
}

// Auto-approves every answer that has text but hasn't been approved yet.
// Returns null when nothing changed, so callers can skip a no-op update.
export function autoApproveAnswers(answers) {
  if (!answers) return null;
  let changed = false;
  const patched = {};
  Object.entries(answers).forEach(([index, answer]) => {
    if (answer?.text && !answer.approved) {
      patched[index] = { ...answer, approved: true };
      changed = true;
    } else {
      patched[index] = answer;
    }
  });
  return changed ? patched : null;
}

// The userNames AutoGM may ever call for a pull: a currently-alive
// character's player, who is also currently connected. Excludes NPCs/
// unclaimed characters (no assignedTo) and any player who's gone offline,
// even if they still hold a live character.
export function getActivePullTargets({ characters, presence }) {
  const names = new Set();
  Object.values(characters || {}).forEach((character) => {
    if (
      character.assignedTo &&
      isCharacterAlive(character) &&
      presence?.[character.assignedTo]?.connected
    ) {
      names.add(character.assignedTo);
    }
  });
  return Array.from(names);
}
