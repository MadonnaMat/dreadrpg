import React, { useState, useRef, useEffect } from "react";
import Peer from "peerjs";
import { PeerContext } from "../contexts/PeerContext";
import { DEFAULT_QUESTIONS } from "../constants/questions";

// Normalize IDs by stripping '-' and trimming whitespace
function normalizedId(id) {
  return `dread-rpg-game-${(id || "").replace(/-/g, "").trim()}`;
}

export const PeerProvider = ({ children }) => {
  const [gameId, setGameId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [userName, setUserName] = useState("");
  const [hostName, setHostName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isGM, setIsGM] = useState(false);
  const [conn, setConn] = useState(null);
  const [users, setUsers] = useState({}); // { peerId: userName }
  const [towerSize, setTowerSize] = useState(25);
  const [dangerProbability, setDangerProbability] = useState(0);
  const [awaitingReset, setAwaitingReset] = useState(false);
  const [scenario, setScenario] = useState(null);
  const [characterSheets, setCharacterSheets] = useState({}); // { playerName: { questionIndex: answer } }
  const [questions, setQuestions] = useState(null); // Array of questions
  const [allowPlayersToViewSheets, setAllowPlayersToViewSheets] =
    useState(false);
  const peerRef = useRef(null);
  const wheelEventHandlerRef = useRef(null); // callback for wheel events
  const chatEventHandlerRef = useRef(null); // callback for chat events
  const scenarioEventHandlerRef = useRef(null); // callback for scenario events
  const characterSheetEventHandlerRef = useRef(null); // callback for character sheet events

  // Refs to store current state for closures
  const currentStateRef = useRef({
    scenario: null,
    characterSheets: {},
    questions: null,
    allowPlayersToViewSheets: false,
    users: {},
    hostName: "",
    towerSize: 25,
    isGM: false,
    dangerProbability: 0,
    awaitingReset: false,
  });

  // Register wheel event handler
  const registerWheelEventHandler = (handler) => {
    wheelEventHandlerRef.current = handler;
  };
  // Register chat event handler
  const registerChatEventHandler = (handler) => {
    chatEventHandlerRef.current = handler;
  };
  // Register scenario event handler
  const registerScenarioEventHandler = (handler) => {
    scenarioEventHandlerRef.current = handler;
  };
  // Register character sheet event handler
  const registerCharacterSheetEventHandler = (handler) => {
    characterSheetEventHandlerRef.current = handler;
  };

  // Keep refs updated with current state
  useEffect(() => {
    currentStateRef.current = {
      scenario,
      characterSheets,
      questions: questions || DEFAULT_QUESTIONS,
      allowPlayersToViewSheets,
      users,
      hostName,
      towerSize,
      isGM,
      dangerProbability,
      awaitingReset,
    };
  }, [
    scenario,
    characterSheets,
    questions,
    allowPlayersToViewSheets,
    users,
    hostName,
    towerSize,
    isGM,
    dangerProbability,
    awaitingReset,
  ]);

  // Store all connections for GM
  const connectionsRef = useRef([]);

  // Method for sending messages
  const sendToPeers = (msg) => {
    const currentIsGM = currentStateRef.current.isGM;
    if (currentIsGM) {
      // GM: broadcast to all connections
      connectionsRef.current.forEach((c) => {
        c.send(msg);
      });
    } else if (conn) {
      // Player: send to GM
      conn.send(msg);
    }
  };

  // Forward a message to whichever component registered interest in its type.
  // Shared by both the GM's per-connection data handler and the player's
  // single connection data handler.
  const dispatchToRegisteredHandlers = (data, connection) => {
    if (wheelEventHandlerRef.current) {
      wheelEventHandlerRef.current(data, connection);
    }
    if (chatEventHandlerRef.current && data.type === "chat") {
      chatEventHandlerRef.current(data, connection);
    }
    if (scenarioEventHandlerRef.current && data.type === "scenario-update") {
      scenarioEventHandlerRef.current(data, connection);
    }
    if (
      characterSheetEventHandlerRef.current &&
      (data.type === "character-sheet-update" ||
        data.type === "questions-update" ||
        data.type === "sheet-visibility-update" ||
        data.type === "character-sheets-broadcast")
    ) {
      characterSheetEventHandlerRef.current(data, connection);
    }
  };

  // Build the full game-state snapshot sent to players via "welcome"/"game-data-sync"
  const buildGameSnapshot = (type) => ({
    type,
    hostName: currentStateRef.current.hostName,
    users: currentStateRef.current.users,
    towerSize: currentStateRef.current.towerSize,
    dangerProbability: currentStateRef.current.dangerProbability,
    awaitingReset: currentStateRef.current.awaitingReset,
    scenario: currentStateRef.current.scenario,
    characterSheets: currentStateRef.current.characterSheets,
    questions: currentStateRef.current.questions,
    allowPlayersToViewSheets: currentStateRef.current.allowPlayersToViewSheets,
  });

  // Host: create game
  const createGame = (newGameId, hostName, towerSizeArg = 25) => {
    setGameId(newGameId);
    setHostName(hostName);
    setIsGM(true);
    setTowerSize(towerSizeArg);
    setDangerProbability(0);
    setAwaitingReset(false);
    setScenario(null); // Reset scenario for new game
    setCharacterSheets({}); // Reset character sheets for new game
    setQuestions(null); // Reset questions for new game
    setAllowPlayersToViewSheets(false); // Reset sheet visibility for new game
    setConnectionStatus("Waiting for players...");
    const peer = new Peer(normalizedId(newGameId)); // use normalized for PeerJS
    peerRef.current = peer;
    setUsers({});
    connectionsRef.current = [];
    peer.on("open", (id) => {
      setPeerId(id);
      // Add GM to users list
      const gmUsers = { [id]: hostName || "GM" };
      setUsers(gmUsers);
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
          const newUsers = {
            ...currentStateRef.current.users,
            [normalizedId(data.peerId)]: data.userName,
          };
          setUsers(newUsers);
          c.send(buildGameSnapshot("welcome"));

          // Broadcast updated user list to all existing connections
          const userUpdateMsg = {
            type: "user-list-update",
            users: newUsers,
          };
          connectionsRef.current.forEach((conn) => {
            if (conn !== c) {
              // Don't send to the new user, they already got the welcome message
              conn.send(userUpdateMsg);
            }
          });
        }
        // Handle refetch requests from clients
        if (data && data.type === "refetch-request") {
          c.send(buildGameSnapshot("game-data-sync"));
        }
        dispatchToRegisteredHandlers(data, c);
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
      setPeerId(pid);
      setConnectionStatus(`Connected as ${userName} (${pid})`);
      const connection = peer.connect(normalizedId(gameId));
      connection.on("open", () => {
        setConn(connection);
        connection.send({ type: "join", peerId: pid, userName });
      });
      connection.on("data", (data) => {
        dispatchToRegisteredHandlers(data, connection);

        // Handle game data sync / welcome snapshots from the host
        if (
          data &&
          (data.type === "game-data-sync" || data.type === "welcome")
        ) {
          if (data.users) {
            setUsers(data.users);
            setConnectionStatus(
              data.type === "welcome"
                ? `Welcome! Players: ${Object.values(data.users).join(", ")}`
                : `Synced! Players: ${Object.values(data.users).join(", ")}`
            );
          }
          if (data.towerSize !== undefined) {
            setTowerSize(data.towerSize);
          }
          if (data.dangerProbability !== undefined) {
            setDangerProbability(data.dangerProbability);
          }
          if (data.awaitingReset !== undefined) {
            setAwaitingReset(data.awaitingReset);
          }
          if (data.scenario) {
            setScenario(data.scenario);
          }
          if (data.characterSheets) {
            setCharacterSheets(data.characterSheets);
          }
          if (data.questions) {
            setQuestions(data.questions);
          }
          if (data.allowPlayersToViewSheets !== undefined) {
            setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
          }
        }
        // Handle user list updates from host
        if (data && data.type === "user-list-update") {
          setUsers(data.users);
          setConnectionStatus(
            `Users updated! Players: ${Object.values(data.users).join(", ")}`
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
        peerId,
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
        towerSize,
        setTowerSize,
        dangerProbability,
        setDangerProbability,
        awaitingReset,
        setAwaitingReset,
        scenario,
        setScenario,
        registerScenarioEventHandler,
        characterSheets,
        setCharacterSheets,
        questions,
        setQuestions,
        allowPlayersToViewSheets,
        setAllowPlayersToViewSheets,
        registerCharacterSheetEventHandler,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
