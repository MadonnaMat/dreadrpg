import { useRef, useEffect } from "react";
import { DEFAULT_QUESTIONS } from "../../constants/questions";

// Keeps a ref mirror of state that's read from inside PeerJS event-handler
// closures set up once at connect time (join/refetch-request handling in
// PeerProvider) - reading through this ref rather than the state values
// directly means those closures always see current values instead of
// whatever the state was on the render that created them.
export function useCurrentStateRef({
  scenario,
  characterSheets,
  questions,
  allowPlayersToViewSheets,
  users,
  hostName,
  towerSize,
  isGM,
  dangerProbability,
  awaitingReset,
}) {
  const currentStateRef = useRef({
    scenario: null,
    characterSheets: {},
    questions: null,
    allowPlayersToViewSheets: false,
    users: {},
    hostName: "",
    towerSize: 25,
    isGM: false,
    dangerProbability: 0,
    awaitingReset: false,
  });

  useEffect(() => {
    currentStateRef.current = {
      scenario,
      characterSheets,
      questions: questions || DEFAULT_QUESTIONS,
      allowPlayersToViewSheets,
      users,
      hostName,
      towerSize,
      isGM,
      dangerProbability,
      awaitingReset,
    };
  }, [
    scenario,
    characterSheets,
    questions,
    allowPlayersToViewSheets,
    users,
    hostName,
    towerSize,
    isGM,
    dangerProbability,
    awaitingReset,
  ]);

  return currentStateRef;
}
