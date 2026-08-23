import { useState } from "react";
import { DEFAULT_DEATH_FLAVOR_TEXT } from "../../constants/wheelOutcomes";

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
  // GM-editable death narration template (a {name} placeholder gets
  // substituted with the designated spinner's character name) - see
  // docs/rules/compliance-fix-plan.md item 11b.
  const [deathFlavorText, setDeathFlavorText] = useState(
    DEFAULT_DEATH_FLAVOR_TEXT
  );
  // GM-only campaign-prep notes: Array<{ id, name, items: string[] }>.
  // Deliberately never crosses the PeerJS wire (see PeerProvider.jsx) - only
  // the GM ever sees or edits this, so it's just local state persisted to
  // localStorage like theme/deathFlavorText, not part of the
  // welcome/game-data-sync snapshot.
  const [campaignNotes, setCampaignNotes] = useState([]);
  // `false` when idle, or one of AUTOGM_STATUS's status strings while
  // AutoGM has an in-flight LLM call (turn, pull-check, self-check,
  // compaction, note consolidation, or removal narration) - broadcast so
  // every player sees what it's currently doing in Chat, not just the GM's
  // own browser. Ephemeral: deliberately absent from
  // buildGameSnapshot/deriveGameDefaults, so a late joiner just starts at
  // the safe `false` default rather than syncing whatever transient value
  // happened to be current.
  const [autoGmThinking, setAutoGmThinking] = useState(false);

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
    deathFlavorText,
    setDeathFlavorText,
    campaignNotes,
    setCampaignNotes,
    autoGmThinking,
    setAutoGmThinking,
  };
}
