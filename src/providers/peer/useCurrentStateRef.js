import { useRef, useEffect } from "react";

// Keeps a ref mirror of state that's read from inside PeerJS event-handler
// closures set up once at connect time (join/refetch-request handling in
// PeerProvider) - reading through this ref rather than the state values
// directly means those closures always see current values instead of
// whatever the state was on the render that created them.
export function useCurrentStateRef({
  scenario,
  gameName,
  characters,
  allowPlayersToViewSheets,
  users,
  hostName,
  towerSize,
  isGM,
  dangerProbability,
  awaitingReset,
  gameStarted,
}) {
  const currentStateRef = useRef({
    scenario: null,
    gameName: "",
    characters: {},
    allowPlayersToViewSheets: false,
    users: {},
    hostName: "",
    towerSize: 25,
    isGM: false,
    dangerProbability: 0,
    awaitingReset: false,
    gameStarted: false,
  });

  useEffect(() => {
    currentStateRef.current = {
      scenario,
      gameName,
      characters,
      allowPlayersToViewSheets,
      users,
      hostName,
      towerSize,
      isGM,
      dangerProbability,
      awaitingReset,
      gameStarted,
    };
  }, [
    scenario,
    gameName,
    characters,
    allowPlayersToViewSheets,
    users,
    hostName,
    towerSize,
    isGM,
    dangerProbability,
    awaitingReset,
    gameStarted,
  ]);

  return currentStateRef;
}
