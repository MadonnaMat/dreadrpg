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
