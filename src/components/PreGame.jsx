import { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import Scenario from "./Scenario";
import AdminPanel from "./AdminPanel";
import PlayerLobby from "./PlayerLobby";
import { loadMyGames, deleteGameState } from "../providers/peer/gamePersistence";

function generateGameId() {
  return Array(3)
    .fill(0)
    .map(() => Math.random().toString(36).substring(2, 5))
    .join("-");
}

function generatePeerId() {
  return Math.random().toString(36).substring(2, 10);
}

function CreateSection({
  gameId,
  setGameId,
  hostName,
  setHostName,
  createGame,
  connectionStatus,
}) {
  const [towerSize, setTowerSize] = useState(25);
  const [gameName, setGameName] = useState("");
  return (
    <div id="create-game">
      <input
        className="pregame-input"
        placeholder="Campaign Name"
        value={gameName}
        onChange={(e) => setGameName(e.target.value)}
      />
      <input
        className="pregame-input"
        placeholder="Your Name"
        value={hostName}
        onChange={(e) => setHostName(e.target.value)}
      />
      <input
        className="pregame-input"
        type="number"
        min={1}
        max={100}
        placeholder="Tower Size"
        value={towerSize}
        onChange={(e) => setTowerSize(Number(e.target.value) || 25)}
      />
      <button
        onClick={() => {
          const newGameId = generateGameId();
          setGameId(newGameId);
          createGame(
            newGameId,
            hostName || "Host",
            towerSize,
            gameName || "Untitled Campaign"
          );
        }}
        disabled={!hostName || !gameName}
      >
        Create
      </button>
      {gameId && (
        <div>
          <strong>Game ID:</strong> {gameId}
          <br />
          <span>Share this ID with players to join.</span>
        </div>
      )}
      <div id="connection-status">{connectionStatus}</div>
    </div>
  );
}

function HostLobbyPanel({ gameId, connectionStatus, users, getShareUrl }) {
  const [activeTab, setActiveTab] = useState("lobby");

  return (
    <>
      <div className="tab-navigation">
        {[
          ["lobby", "Lobby"],
          ["scenario", "Setup Scenario"],
          ["admin", "Admin"],
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === "lobby" && (
          <div>
            <div className="lobby-info">
              <div style={{ marginBottom: 12 }}>
                <strong>Game ID:</strong> {gameId}
                <br />
                <span>Share this ID with players to join.</span>
              </div>
              <div>
                <strong>Sharable URL:</strong>
                <div className="url-input-container">
                  <input
                    type="text"
                    value={getShareUrl()}
                    readOnly
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(getShareUrl())}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div
              id="connection-status"
              style={{ padding: 8, fontWeight: "bold" }}
            >
              {connectionStatus}
            </div>
            <div className="lobby-tip">
              <p>
                <strong>Tip:</strong> While waiting for players to join, you can
                use the "Setup Scenario" tab to prepare your Dread RPG scenario.
                This will help you get the session ready and will be
                automatically shared with players when they join.
              </p>
            </div>
            <div style={{ marginTop: 16 }}>
              <strong>Players joined:</strong>{" "}
              {Math.max(0, Object.keys(users || {}).length - 1)}
            </div>
          </div>
        )}
        {activeTab === "scenario" && <Scenario />}
        {activeTab === "admin" && <AdminPanel />}
      </div>
    </>
  );
}

function HomepageGamesList({ resumeGame, onResume }) {
  const [games, setGames] = useState(() => loadMyGames());

  if (games.length === 0) return null;

  const handleResume = (game) => {
    resumeGame(game.gameId, game.hostName);
    onResume();
  };

  const handleDelete = (game) => {
    deleteGameState(game.gameId, game.hostName);
    setGames(loadMyGames());
  };

  return (
    <div id="my-games-list">
      <h3>Your Games</h3>
      <ul>
        {[...games]
          .sort((a, b) => b.lastPlayed - a.lastPlayed)
          .map((game) => (
            <li key={`${game.gameId}-${game.hostName}`}>
              <span>{game.gameName}</span>
              <button onClick={() => handleResume(game)}>Resume</button>
              <button onClick={() => handleDelete(game)}>Delete</button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function JoinSection({
  inputGameId,
  setInputGameId,
  userName,
  setUserName,
  joinGame,
  connectionStatus,
  joinError,
}) {
  return (
    <div id="join-game">
      <input
        className="pregame-input"
        placeholder="Game ID"
        value={inputGameId}
        onChange={(e) => setInputGameId(e.target.value)}
      />
      <input
        className="pregame-input"
        placeholder="Your Name"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />
      <button
        onClick={() => {
          const newPeerId = generatePeerId();
          joinGame(inputGameId, newPeerId, userName || "Player");
        }}
        disabled={!inputGameId || !userName}
      >
        Join
      </button>
      {joinError && <div className="join-error">{joinError}</div>}
      <div id="connection-status">{connectionStatus}</div>
    </div>
  );
}

export default function PreGame() {
  const {
    connectionStatus,
    createGame,
    resumeGame,
    joinGame,
    gameId,
    setGameId,
    userName,
    setUserName,
    hostName,
    setHostName,
    isGM,
    users,
    conn,
    joinError,
  } = usePeer();
  const [mode, setMode] = useState("");
  const [inputGameId, setInputGameId] = useState("");

  // On mount, check for gameId/userName in query params - the latter comes
  // from a player's own "Copy my rejoin link" (see GameLoaded.jsx/
  // PlayerLobby.jsx), letting them rejoin without retyping their name.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get("gameId");
    const urlUserName = params.get("userName");
    if (urlGameId) {
      setMode("join");
      setInputGameId(urlGameId);
    }
    if (urlUserName) {
      setUserName(urlUserName);
    }
  }, [setUserName]);

  // Helper for sharable URL
  const getShareUrl = () => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?gameId=${gameId}`;
  };

  return (
    <div className="App">
      <h1>Dread RPG</h1>

      {/* About Dread RPG */}
      <div className="dread-info">
        <p>
          <strong>Dread</strong> is a horror tabletop RPG that uses a Jenga
          tower instead of dice. Players pull blocks to attempt actions,
          creating escalating tension as the tower becomes more unstable. When
          the tower falls, something terrible happens to your character.
        </p>
        <p>
          <strong>This digital version</strong> simulates the Jenga tower
          mechanic using a spinning wheel. Each spin represents pulling a block
          - successful spins keep you safe, but landing on a "death" wedge means
          something terrible happens to your character, just like when the tower
          falls.
        </p>
        <p>
          Learn more about Dread at the{" "}
          <a
            href="https://www.tiltingatwindmills.net/games/dread/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2196f3", textDecoration: "underline" }}
          >
            official website
          </a>
          .
        </p>
      </div>

      <div id="pregame-section">
        {!mode && (
          <>
            <button onClick={() => setMode("create")}>Create Game</button>
            <button onClick={() => setMode("join")}>Join Game</button>
            <HomepageGamesList
              resumeGame={resumeGame}
              onResume={() => setMode("create")}
            />
          </>
        )}
        {mode === "create" && !gameId && (
          <CreateSection
            gameId={gameId}
            setGameId={setGameId}
            hostName={hostName}
            setHostName={setHostName}
            createGame={createGame}
            connectionStatus={connectionStatus}
          />
        )}
        {mode === "create" && gameId && isGM && (
          <HostLobbyPanel
            gameId={gameId}
            connectionStatus={connectionStatus}
            users={users}
            getShareUrl={getShareUrl}
          />
        )}
        {mode === "join" && !conn && (
          <JoinSection
            inputGameId={inputGameId}
            setInputGameId={setInputGameId}
            userName={userName}
            setUserName={setUserName}
            joinGame={joinGame}
            connectionStatus={connectionStatus}
            joinError={joinError}
          />
        )}
        {mode === "join" && conn && <PlayerLobby />}
      </div>
    </div>
  );
}
