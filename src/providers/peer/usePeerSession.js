import { useState } from "react";

// Per-connection session identity: who am I, what game am I in, what's my
// role. Separate from useGameState's shared game-domain data since this
// never gets synced wholesale over the wire the way the game data does.
export function usePeerSession() {
  const [gameId, setGameId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [userName, setUserName] = useState("");
  const [hostName, setHostName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isGM, setIsGM] = useState(false);
  const [conn, setConn] = useState(null);
  const [users, setUsers] = useState({}); // { peerId: userName }
  // Set when the GM rejects a join because the chosen userName is already in
  // active use in this game (see dataHandlers.js's JOIN handling) - cleared
  // at the start of every joinGame() attempt.
  const [joinError, setJoinError] = useState(null);

  return {
    gameId,
    setGameId,
    peerId,
    setPeerId,
    userName,
    setUserName,
    hostName,
    setHostName,
    connectionStatus,
    setConnectionStatus,
    isGM,
    setIsGM,
    conn,
    setConn,
    users,
    setUsers,
    joinError,
    setJoinError,
  };
}
