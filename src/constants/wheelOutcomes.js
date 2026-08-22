// Wedge/spin-outcome literals - distinct from MESSAGE_TYPES (see
// messageTypes.js), since these describe the *result* of a spin rather than
// a network message envelope.
export const WEDGE_TYPES = {
  SUCCESS: "success",
  DEATH: "death",
};

// Display text shown for a resolved spin result.
export const RESULT_TEXT = {
  SUCCESS: "Success!",
  DEATH: "You Died!",
};
