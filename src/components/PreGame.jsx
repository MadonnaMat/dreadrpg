import { useState, useEffect } from "react";
import { usePeer } from "../providers/PeerProvider";
import Scenario from "./Scenario";
import CharacterSheet from "./CharacterSheet";

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
  const [numWedges, setNumWedges] = useState(25);
  return (
    <div id="create-game">
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
        placeholder="Number of Wedges"
        value={numWedges}
        onChange={(e) => setNumWedges(Number(e.target.value) || 25)}
      />
      <button
        onClick={() => {
          const newGameId = generateGameId();
          setGameId(newGameId);
          createGame(newGameId, hostName || "Host", numWedges);
        }}
        disabled={!hostName}
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

function JoinSection({
  inputGameId,
  setInputGameId,
  userName,
  setUserName,
  joinGame,
  connectionStatus,
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
      <div id="connection-status">{connectionStatus}</div>
    </div>
  );
}

export default function PreGame() {
  const {
    connectionStatus,
    createGame,
    joinGame,
    gameId,
    setGameId,
    userName,
    setUserName,
    hostName,
    setHostName,
    isGM,
  } = usePeer();
  const [mode, setMode] = useState("");
  const [inputGameId, setInputGameId] = useState("");
  const [activeTab, setActiveTab] = useState("lobby");

  // On mount, check for gameId in query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get("gameId");
    if (urlGameId) {
      setMode("join");
      setInputGameId(urlGameId);
    }
  }, []);

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
          <>
            {/* Tab Navigation for Host */}
            <div className="tab-navigation">
              <button
                className={`tab-button ${
                  activeTab === "lobby" ? "active" : ""
                }`}
                onClick={() => setActiveTab("lobby")}
              >
                Lobby
              </button>
              <button
                className={`tab-button ${
                  activeTab === "scenario" ? "active" : ""
                }`}
                onClick={() => setActiveTab("scenario")}
              >
                Setup Scenario
              </button>
              <button
                className={`tab-button ${
                  activeTab === "characters" ? "active" : ""
                }`}
                onClick={() => setActiveTab("characters")}
              >
                Setup Characters
              </button>
            </div>

            {/* Tab Content */}
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
                          onClick={() => {
                            navigator.clipboard.writeText(getShareUrl());
                          }}
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
                      <strong>Tip:</strong> While waiting for players to join,
                      you can use the "Setup Scenario" tab to prepare your Dread
                      RPG scenario. This will help you get the session ready and
                      will be automatically shared with players when they join.
                    </p>
                  </div>
                </div>
              )}
              {activeTab === "scenario" && <Scenario />}
              {activeTab === "characters" && <CharacterSheet />}
            </div>
          </>
        )}
        {mode === "join" && (
          <JoinSection
            inputGameId={inputGameId}
            setInputGameId={setInputGameId}
            userName={userName}
            setUserName={setUserName}
            joinGame={joinGame}
            connectionStatus={connectionStatus}
          />
        )}
      </div>
    </div>
  );
}
