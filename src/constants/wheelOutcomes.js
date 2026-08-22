// Wedge/spin-outcome literals - distinct from MESSAGE_TYPES (see
// messageTypes.js), since these describe the *result* of a spin rather than
// a network message envelope.
export const WEDGE_TYPES = {
  SUCCESS: "success",
  DEATH: "death",
};

// Display text shown for a resolved spin result. The GM computes the death
// text once (it needs the designated spinner's character name) and sends it
// as part of the "spin" message's `resultText` field - see
// WheelProvider.jsx's handleSpinEnd - rather than each client re-deriving it
// locally from `result` the way SUCCESS_TEXT still is.
export const SUCCESS_TEXT = "Success!";

export function deathText(characterName) {
  return `${characterName} Died!`;
}
