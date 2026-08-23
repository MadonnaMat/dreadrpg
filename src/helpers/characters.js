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
// might be the GM's own entry rather than a player's - the GM never has an
// assigned character, so without this they'd just show as a bare name while
// every player shows "<CharacterName>". Pass the game's hostName so the GM's
// own row (matched by name === hostName) can be told apart from a player
// row reliably - a player can never actually hold that name themselves, since
// the join handshake rejects any name matching a currently-connected
// presence entry, and the host's own presence entry is always seeded first.
export function formatNameForList(characters, name, hostName) {
  if (!name) return name;
  if (name === hostName) return `${name} <GM>`;
  return formatUserWithCharacter(characters, name);
}
