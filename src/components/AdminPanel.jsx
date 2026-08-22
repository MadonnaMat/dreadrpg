import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import {
  THEME_PRESETS,
  THEME_TOKENS,
  THEME_LABELS,
  THEME_TOKEN_LABELS,
  DEFAULT_CUSTOM_COLORS,
} from "../constants/themes";
import CharacterSheet from "./CharacterSheet";

// GM-only theme picker: built-in presets are pure CSS (see
// src/styles/themes.css); "custom" broadcasts per-token colors applied
// inline instead (see useThemeEffect.js).
function ThemeSection() {
  const { theme, setTheme, customColors, setCustomColors, sendToPeers } =
    usePeer();
  const colors = customColors || DEFAULT_CUSTOM_COLORS;

  const chooseTheme = (newTheme) => {
    setTheme(newTheme);
    const payload = { type: MESSAGE_TYPES.THEME_UPDATE, theme: newTheme };
    if (newTheme === "custom") {
      const initialColors = customColors || DEFAULT_CUSTOM_COLORS;
      setCustomColors(initialColors);
      payload.customColors = initialColors;
    }
    sendToPeers(payload);
  };

  const updateColor = (token, value) => {
    const nextColors = { ...colors, [token]: value };
    setCustomColors(nextColors);
    sendToPeers({
      type: MESSAGE_TYPES.THEME_UPDATE,
      theme: "custom",
      customColors: nextColors,
    });
  };

  return (
    <div className="admin-field">
      <label htmlFor="admin-theme">Theme</label>
      <select
        id="admin-theme"
        className="pregame-input"
        value={theme}
        onChange={(e) => chooseTheme(e.target.value)}
      >
        {THEME_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {THEME_LABELS[preset]}
          </option>
        ))}
      </select>

      {theme === "custom" && (
        <div className="theme-custom-colors">
          {THEME_TOKENS.map((token) => (
            <label key={token} className="theme-color-field">
              {THEME_TOKEN_LABELS[token]}
              <input
                type="color"
                value={colors[token] || "#000000"}
                onChange={(e) => updateColor(token, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

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

      <ThemeSection />

      {!gameStarted && (
        <button id="start-game-btn" onClick={startGame}>
          Start Game
        </button>
      )}

      {showRoster && <CharacterSheet />}
    </div>
  );
}
