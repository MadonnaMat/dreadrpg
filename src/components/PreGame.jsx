import { useState, useEffect } from "react";
import { usePeer } from "../providers/PeerProvider";

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
        placeholder="Your Name"
        value={hostName}
        onChange={(e) => setHostName(e.target.value)}
      />
      <input
        type="number"
        min={1}
        max={100}
        placeholder="Number of Wedges"
        value={numWedges}
        onChange={(e) => setNumWedges(Number(e.target.value) || 25)}
        style={{ marginLeft: 8 }}
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
        placeholder="Game ID"
        value={inputGameId}
        onChange={(e) => setInputGameId(e.target.value)}
      />
      <input
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
  } = usePeer();
  const [mode, setMode] = useState("");
  const [inputGameId, setInputGameId] = useState("");

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
      <div id="pregame-section">
        {!mode && (
          <>
            <button onClick={() => setMode("create")}>Create Game</button>
            <button onClick={() => setMode("join")}>Join Game</button>
          </>
        )}
        {mode === "create" && (
          <>
            <CreateSection
              gameId={gameId}
              setGameId={setGameId}
              hostName={hostName}
              setHostName={setHostName}
              createGame={createGame}
              connectionStatus={connectionStatus}
            />
            {gameId && (
              <div style={{ marginTop: 12 }}>
                <strong>Sharable URL:</strong>
                <input
                  type="text"
                  value={getShareUrl()}
                  readOnly
                  style={{ width: "80%", marginLeft: 8 }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    navigator.clipboard.writeText(getShareUrl());
                  }}
                >
                  Copy
                </button>
              </div>
            )}
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
