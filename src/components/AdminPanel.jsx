import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import CharacterSheet from "./CharacterSheet";

// GM-only settings hub: campaign name, tower size, and Start Game -
// previously scattered (tower size was a one-shot PreGame input, campaign
// name didn't exist, and Start Game lived alone in the Lobby tab). Also
// hosts the character roster (via CharacterSheet) when `showRoster` is set,
// so PreGame doesn't need a separate "Setup Characters" tab any more -
// GameLoaded, which already has its own dedicated Characters tab, passes
// showRoster={false} to avoid mounting CharacterSheet a second time.
export default function AdminPanel({ showRoster = true }) {
  const {
    gameName,
    setGameName,
    towerSize,
    setTowerSize,
    sendToPeers,
    gameStarted,
  } = usePeer();
  const { startGame } = useWheel();
  const [nameDraft, setNameDraft] = useState(gameName);
  const [sizeDraft, setSizeDraft] = useState(towerSize);

  useEffect(() => setNameDraft(gameName), [gameName]);
  useEffect(() => setSizeDraft(towerSize), [towerSize]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === gameName) return;
    setGameName(trimmed);
    sendToPeers({ type: MESSAGE_TYPES.GAME_NAME_UPDATE, gameName: trimmed });
  };

  const saveTowerSize = () => {
    const size = Number(sizeDraft) || towerSize;
    if (size === towerSize) return;
    setTowerSize(size);
    sendToPeers({ type: MESSAGE_TYPES.TOWER_SIZE_UPDATE, towerSize: size });
  };

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>

      <div className="admin-field">
        <label htmlFor="admin-game-name">Campaign Name</label>
        <input
          id="admin-game-name"
          className="pregame-input"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="admin-tower-size">Tower Size</label>
        <input
          id="admin-tower-size"
          className="pregame-input"
          type="number"
          min={1}
          max={100}
          value={sizeDraft}
          onChange={(e) => setSizeDraft(e.target.value)}
          onBlur={saveTowerSize}
        />
      </div>

      {!gameStarted && (
        <button id="start-game-btn" onClick={startGame}>
          Start Game
        </button>
      )}

      {showRoster && <CharacterSheet />}
    </div>
  );
}
