// Helper for wheel state management
export function getNewWheelStateOnSpin(selectedIdx, wheelState) {
  const wedges = wheelState.length;
  let newWheelState;
  if (wheelState[selectedIdx] === "success") {
    newWheelState = [...wheelState];
    newWheelState[selectedIdx] = "death";
  } else {
    newWheelState = Array(wedges).fill("success");
  }
  return newWheelState;
}
