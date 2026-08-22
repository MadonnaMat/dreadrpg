import { useState } from "react";

// The shared game-domain state that gets synced across peers via the
// welcome/game-data-sync snapshot (see gameSnapshot.js).
export function useGameState() {
  // The campaign's own name (distinct from gameId, the pairing code, and
  // hostName, the GM's personal display name) - set at creation, renamable
  // later from the Admin Panel.
  const [gameName, setGameName] = useState("");
  const [towerSize, setTowerSize] = useState(25);
  const [dangerProbability, setDangerProbability] = useState(0);
  const [awaitingReset, setAwaitingReset] = useState(false);
  // The userName the GM has designated to spin next, or null if nobody is
  // currently assigned (see docs/rules/compliance-fix-plan.md item 7) -
  // only that player sees the Spin/Decline buttons.
  const [designatedSpinner, setDesignatedSpinner] = useState(null);
  // Whether the GM has explicitly started the game yet - drives the
  // lobby -> in-game transition (see WheelProvider's startGame). Synced so a
  // late joiner's welcome/game-data-sync snapshot can skip the lobby.
  const [gameStarted, setGameStarted] = useState(false);
  const [scenario, setScenario] = useState(null);
  // { [characterId]: { id, name, defaultName, assignedTo: userName|null,
  //   questions: string[], answers: { [questionIndex]: string } } } - a
  // character is a first-class entity the GM authors/clones/assigns, not
  // just a per-player questionnaire (see docs/rules/compliance-fix-plan.md
  // item 2).
  const [characters, setCharacters] = useState({});
  // { [userName]: { connected: boolean } } - persists across a disconnect
  // (unlike `users`, which is peerId-keyed and only ever holds currently
  // active connections) so the roster can show who's online vs. offline,
  // and so a rejoin under an existing name can be gated on this explicit
  // status rather than inferred from `users` membership (see
  // docs/rules/compliance-fix-plan.md item 8).
  const [presence, setPresence] = useState({});
  const [allowPlayersToViewSheets, setAllowPlayersToViewSheets] =
    useState(false);
  // "default"|"scifi"|"slasher"|"halloween"|"custom" - see
  // src/constants/themes.js. customColors only matters when theme is
  // "custom": { [cssVariableName]: hexColor }.
  const [theme, setTheme] = useState("default");
  const [customColors, setCustomColors] = useState(null);

  return {
    gameName,
    setGameName,
    towerSize,
    setTowerSize,
    dangerProbability,
    setDangerProbability,
    awaitingReset,
    setAwaitingReset,
    designatedSpinner,
    setDesignatedSpinner,
    gameStarted,
    setGameStarted,
    scenario,
    setScenario,
    characters,
    setCharacters,
    presence,
    setPresence,
    allowPlayersToViewSheets,
    setAllowPlayersToViewSheets,
    theme,
    setTheme,
    customColors,
    setCustomColors,
  };
}
