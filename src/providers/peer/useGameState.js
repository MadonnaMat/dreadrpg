import { useState } from "react";

// The shared game-domain state that gets synced across peers via the
// welcome/game-data-sync snapshot (see gameSnapshot.js).
export function useGameState() {
  const [towerSize, setTowerSize] = useState(25);
  const [dangerProbability, setDangerProbability] = useState(0);
  const [awaitingReset, setAwaitingReset] = useState(false);
  const [scenario, setScenario] = useState(null);
  const [characterSheets, setCharacterSheets] = useState({}); // { playerName: { questionIndex: answer } }
  const [questions, setQuestions] = useState(null); // Array of questions
  const [allowPlayersToViewSheets, setAllowPlayersToViewSheets] =
    useState(false);

  return {
    towerSize,
    setTowerSize,
    dangerProbability,
    setDangerProbability,
    awaitingReset,
    setAwaitingReset,
    scenario,
    setScenario,
    characterSheets,
    setCharacterSheets,
    questions,
    setQuestions,
    allowPlayersToViewSheets,
    setAllowPlayersToViewSheets,
  };
}
