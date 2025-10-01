import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import Peer from "peerjs";

const PeerContext = createContext();

// Normalize IDs by stripping '-' and trimming whitespace
function normalizedId(id) {
  return `dread-rpg-game-${(id || "").replace(/-/g, "").trim()}`;
}

export const PeerProvider = ({ children }) => {
  const [gameId, setGameId] = useState("");
  const [userName, setUserName] = useState("");
  const [hostName, setHostName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isGM, setIsGM] = useState(false);
  const [conn, setConn] = useState(null);
  const [users, setUsers] = useState({}); // { peerId: userName }
  const [numWedges, setNumWedges] = useState(25);
  const [initialWheelState, setInitialWheelState] = useState(
    Array(numWedges).fill("success")
  );
  const peerRef = useRef(null);
  const wheelEventHandlerRef = useRef(null); // callback for wheel events
  const chatEventHandlerRef = useRef(null); // callback for chat events

  // Register wheel event handler
  const registerWheelEventHandler = (handler) => {
    wheelEventHandlerRef.current = handler;
  };
  // Register chat event handler
  const registerChatEventHandler = (handler) => {
    chatEventHandlerRef.current = handler;
  };

  // Store all connections for GM
  const connectionsRef = useRef([]);

  // Method for sending messages
  const sendToPeers = (msg) => {
    if (isGM) {
      // GM: broadcast to all connections
      connectionsRef.current.forEach((c) => {
        c.send(msg);
      });
    } else if (conn) {
      // Player: send to GM
      conn.send(msg);
    }
  };

  // Host: create game
  const createGame = (newGameId, hostName, numWedgesArg = 25) => {
    setGameId(newGameId);
    setHostName(hostName);
    setIsGM(true);
    setNumWedges(numWedgesArg);
    setInitialWheelState(Array(numWedgesArg).fill("success"));
    setConnectionStatus("Waiting for players...");
    const peer = new Peer(normalizedId(newGameId)); // use normalized for PeerJS
    peerRef.current = peer;
    setUsers({});
    connectionsRef.current = [];
    peer.on("open", (pid) => {
      setConnectionStatus(`Game created! Game ID: ${newGameId}`); // display original
    });
    peer.on("connection", (c) => {
      // Add to GM's connections
      if (!connectionsRef.current.includes(c)) {
        connectionsRef.current.push(c);
      }
      c.on("data", (data) => {
        // All connection-based actions are handled here
        if (data && data.type === "join" && data.peerId && data.userName) {
          setUsers((prev) => ({
            ...prev,
            [normalizedId(data.peerId)]: data.userName,
          }));
          c.send({
            type: "welcome",
            hostName,
            users: { ...users, [normalizedId(data.peerId)]: data.userName },
            numWedges: numWedgesArg,
            wheelState: Array(numWedgesArg).fill("success"),
          });
        }
        // Forward wheel-related actions to WheelProvider
        if (wheelEventHandlerRef.current) {
          wheelEventHandlerRef.current(data, c);
        }
        // Forward chat-related actions to Chat
        if (chatEventHandlerRef.current && data.type === "chat") {
          chatEventHandlerRef.current(data, c);
        }
      });
      c.on("open", () => {
        setConn(c);
      });
    });
  };

  // Player: join game
  const joinGame = (gameId, peerId, userName) => {
    setGameId(gameId);
    setUserName(userName);
    setConnectionStatus("Connecting to game...");
    const peer = new Peer(normalizedId(peerId));
    peerRef.current = peer;
    peer.on("open", (pid) => {
      setConnectionStatus(`Connected as ${userName} (${pid})`);
      const connection = peer.connect(normalizedId(gameId));
      connection.on("open", () => {
        setConn(connection);
        connection.send({ type: "join", peerId: pid, userName });
      });
      connection.on("data", (data) => {
        // Forward wheel-related actions to WheelProvider
        if (wheelEventHandlerRef.current) {
          wheelEventHandlerRef.current(data, connection);
        }
        // Forward chat-related actions to Chat
        if (chatEventHandlerRef.current && data.type === "chat") {
          chatEventHandlerRef.current(data, connection);
        }
        if (data && data.type === "welcome" && data.users) {
          setConnectionStatus(
            `Welcome! Players: ${Object.values(data.users).join(", ")}`
          );
        }
        // Sync spinner state from host
        if (data && data.type === "welcome" && data.numWedges) {
          setNumWedges(data.numWedges);
          setInitialWheelState(
            data.wheelState || Array(data.numWedges).fill("success")
          );
        }
      });
    });
  };

  return (
    <PeerContext.Provider
      value={{
        gameId,
        setGameId,
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
        peerRef,
        createGame,
        joinGame,
        registerWheelEventHandler,
        registerChatEventHandler,
        sendToPeers,
        numWedges,
        setNumWedges,
        initialWheelState,
        setInitialWheelState,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};

export function usePeer() {
  return useContext(PeerContext);
}
