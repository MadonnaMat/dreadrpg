// Helper for wheel state management

// Dread's rule for re-stacking the tower after it collapses: "three
// additional blocks for every character removed from the game." Each
// collapse (a "death" wedge here) must be at least as dangerous as the
// last, never resetting back to the easiest starting difficulty.
// See docs/rules/quick-reference.md.
const BLOCKS_PER_REMOVED_CHARACTER = 3;

export function getNewWheelStateOnSpin(
  selectedIdx,
  wheelState,
  charactersRemoved = 0
) {
  const wedges = wheelState.length;

  if (wheelState[selectedIdx] === "success") {
    const newWheelState = [...wheelState];
    newWheelState[selectedIdx] = "death";
    return newWheelState;
  }

  // Landing on "death" represents the tower collapsing: re-stack the wheel,
  // but pre-set some wedges to "death" so the escalation is cumulative.
  const dangerWedges = Math.min(
    wedges,
    charactersRemoved * BLOCKS_PER_REMOVED_CHARACTER
  );
  const newWheelState = Array(wedges).fill("success");
  const indices = [...newWheelState.keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < dangerWedges; i++) {
    newWheelState[indices[i]] = "death";
  }
  return newWheelState;
}
