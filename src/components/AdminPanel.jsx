import { useState, useEffect, useRef } from "react";
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
import { buildShareUrl } from "../helpers/rejoinLink";

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

// GM-only player roster: shows every known player's online/offline status
// (see docs/rules/compliance-fix-plan.md item 8) and lets the GM remove a
// disconnected player outright - freeing any character they held, since
// otherwise that character would stay permanently assigned to someone
// who's never coming back. Not offered for a currently-connected player.
// How long to wait for a PRESENCE_PONG reply before telling the GM the
// player didn't respond - generous enough to tolerate a slow connection
// without making the GM wait too long for an answer.
const PING_TIMEOUT_MS = 4000;

function PlayerPresenceSection() {
  const {
    presence,
    setPresence,
    characters,
    setCharacters,
    sendToPeers,
    pingUser,
    registerPingEventHandler,
    hostName,
  } = usePeer();
  const entries = Object.entries(presence || {});

  // GM-local, ephemeral: which players have an in-flight or just-resolved
  // ping check, and the result. Never synced - this is purely a "check now"
  // affordance for whoever's looking at the Admin Panel, not shared state.
  const [pingResults, setPingResults] = useState({});
  const timeoutsRef = useRef({});

  useEffect(() => {
    registerPingEventHandler((data) => {
      clearTimeout(timeoutsRef.current[data.userName]);
      setPingResults((prev) => ({
        ...prev,
        [data.userName]: {
          status: "online",
          latencyMs: Date.now() - data.sentAt,
        },
      }));
    });
  }, [registerPingEventHandler]);

  // Clear any pending timeouts on unmount so a stale one can't fire setState
  // after the Admin Panel (and this section) is gone.
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  // A ping that goes unanswered is the strongest signal we have that a
  // player's presence is stale (see docs on the pagehide fix - most real
  // disconnects now self-correct near-instantly, but this covers whatever
  // still slips through, e.g. a genuinely stalled connection that never
  // fires a close event at all) - so a timeout doesn't just report "no
  // response", it actually flips their presence to offline too, the same
  // way a detected disconnect already does.
  const markOffline = (playerName) => {
    setPresence((prev) => {
      if (!prev[playerName]?.connected) return prev;
      const nextPresence = { ...prev, [playerName]: { connected: false } };
      sendToPeers({
        type: MESSAGE_TYPES.PRESENCE_UPDATE,
        presence: nextPresence,
      });
      return nextPresence;
    });
  };

  const ping = (playerName) => {
    setPingResults((prev) => ({
      ...prev,
      [playerName]: { status: "pinging" },
    }));
    pingUser(playerName);
    clearTimeout(timeoutsRef.current[playerName]);
    timeoutsRef.current[playerName] = setTimeout(() => {
      setPingResults((prev) => {
        if (prev[playerName]?.status !== "pinging") return prev;
        markOffline(playerName);
        return { ...prev, [playerName]: { status: "timeout" } };
      });
    }, PING_TIMEOUT_MS);
  };

  const pingStatusLabel = (playerName) => {
    const result = pingResults[playerName];
    if (!result) return null;
    if (result.status === "pinging") return "Pinging...";
    if (result.status === "online")
      return `Confirmed online (${result.latencyMs}ms)`;
    if (result.status === "timeout") return "No response - may be offline";
    return null;
  };

  const removePlayer = (playerName) => {
    const nextPresence = { ...presence };
    delete nextPresence[playerName];
    setPresence(nextPresence);
    sendToPeers({
      type: MESSAGE_TYPES.PRESENCE_UPDATE,
      presence: nextPresence,
    });

    const character = Object.values(characters || {}).find(
      (c) => c.assignedTo === playerName
    );
    if (character) {
      setCharacters((prev) => ({
        ...prev,
        [character.id]: { ...prev[character.id], assignedTo: null },
      }));
      sendToPeers({
        type: MESSAGE_TYPES.CHARACTER_UPDATE,
        id: character.id,
        assignedTo: null,
      });
    }
  };

  return (
    <div className="admin-field">
      <label>Players</label>
      {entries.length === 0 && (
        <p className="no-character-assigned">No players have joined yet.</p>
      )}
      <ul className="character-roster-list">
        {entries.map(([playerName, info]) => (
          <li key={playerName} className="character-roster-row">
            <span className="character-roster-name">
              {playerName} ({info.connected ? "online" : "offline"})
              {pingStatusLabel(playerName) && (
                <span className="ping-status">
                  {" "}
                  - {pingStatusLabel(playerName)}
                </span>
              )}
            </span>
            {info.connected && playerName !== hostName && (
              <button
                className="btn-secondary btn-small"
                onClick={() => ping(playerName)}
                disabled={pingResults[playerName]?.status === "pinging"}
              >
                Ping
              </button>
            )}
            {!info.connected && (
              <button
                className="btn-danger-small"
                onClick={() => removePlayer(playerName)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// GM-only death narration editor - closes the "ways to remove a character"
// gap (docs/rules/compliance-fix-plan.md item 11b) without copying the
// rulebook's own copyrighted flavor-text list: the GM writes their own,
// with a {name} placeholder for the designated spinner's character name.
function DeathFlavorTextSection() {
  const { deathFlavorText, setDeathFlavorText, sendToPeers } = usePeer();
  const [draft, setDraft] = useState(deathFlavorText);

  useEffect(() => setDraft(deathFlavorText), [deathFlavorText]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === deathFlavorText) return;
    setDeathFlavorText(trimmed);
    sendToPeers({
      type: MESSAGE_TYPES.DEATH_FLAVOR_TEXT_UPDATE,
      deathFlavorText: trimmed,
    });
  };

  return (
    <div className="admin-field">
      <label htmlFor="admin-death-flavor-text">
        Death Narration (use {"{name}"} for the character's name)
      </label>
      <textarea
        id="admin-death-flavor-text"
        className="pregame-input"
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
      />
    </div>
  );
}

// GM-only game ID / invite link - previously only shown pre-game (in
// PreGame.jsx's Lobby tab), which meant it vanished the moment the GM
// started the game, even though a GM might still want to invite someone
// (or remind a disconnected player of it) well into a session.
function ShareLinkSection({ gameId }) {
  const shareUrl = buildShareUrl(gameId);
  return (
    <div className="admin-field">
      <label>Game ID</label>
      <div>{gameId}</div>
      <label>Sharable URL</label>
      <div className="url-input-container">
        <input
          type="text"
          value={shareUrl}
          readOnly
          onClick={(e) => e.target.select()}
        />
        <button onClick={() => navigator.clipboard.writeText(shareUrl)}>
          Copy
        </button>
      </div>
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
    gameId,
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

      <ShareLinkSection gameId={gameId} />

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

      <DeathFlavorTextSection />

      <PlayerPresenceSection />

      {!gameStarted && (
        <button id="start-game-btn" onClick={startGame}>
          Start Game
        </button>
      )}

      {showRoster && <CharacterSheet />}
    </div>
  );
}
