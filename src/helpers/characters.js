// The display name of whichever character is assigned to a userName, falling
// back to the userName itself if they haven't claimed one, or a generic
// placeholder if there's no userName at all (shouldn't normally happen once
// a spin is actually resolved, but keeps narration text sane rather than
// showing a literal "null" if it ever does). Shared between WheelProvider
// (chat narration, death/spin messages) and GameLoaded (the GM's
// spin-assign UI) so both show the same name.
export function characterNameFor(characters, targetUserName) {
  if (!targetUserName) return "The character";
  const character = Object.values(characters || {}).find(
    (c) => c.assignedTo === targetUserName
  );
  return character?.name || targetUserName;
}

// "<userName> <CharacterName>" when the user has claimed a character, else
// just the userName - the exact format Chat.jsx's message transcript already
// uses for a sender's name, reused here so the spin-assign dropdown and the
// chat "Players:" roster show the same identity a message from that person
// would.
export function formatUserWithCharacter(characters, targetUserName) {
  if (!targetUserName) return targetUserName;
  const character = Object.values(characters || {}).find(
    (c) => c.assignedTo === targetUserName
  );
  return character ? `${targetUserName} <${character.name}>` : targetUserName;
}

// A character is eligible to spin (or be freshly assigned to a player) only
// while it's alive - `alive` defaults to true for any character predating
// this field, so `!== false` is the correct "is this one still in play"
// check everywhere, not `=== true`.
export function isCharacterAlive(character) {
  return character?.alive !== false;
}
