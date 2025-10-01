import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import Peer from "peerjs";

const DEFAULT_QUESTIONS = [
  "What is your name?",
  "What do you look like?",
  "What is your occupation?",
  "Why did you choose to go on this adventure?",
  "What are your interests and hobbies?",
  "What is your biggest fear?",
  "What are you most proud of?",
  "What secret would you never share with anyone?",
  "What gives you courage?",
  "Tell me 3 of your weaknesses",
];

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
    numWedges: 25,
    isGM: false,
    initialWheelState: [],
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
      numWedges,
      isGM,
      initialWheelState,
    };
  }, [
    scenario,
    characterSheets,
    questions,
    allowPlayersToViewSheets,
    users,
    hostName,
    numWedges,
    isGM,
    initialWheelState,
  ]);

  // Store all connections for GM
  const connectionsRef = useRef([]);

  // Method for sending messages
  const sendToPeers = (msg) => {
    const currentIsGM = currentStateRef.current.isGM;
    console.log(
      `[${currentIsGM ? "GM" : "Player"}] Broadcasting:`,
      msg.type,
      msg
    );
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

  // Host: create game
  const createGame = (newGameId, hostName, numWedgesArg = 25) => {
    setGameId(newGameId);
    setHostName(hostName);
    setIsGM(true);
    setNumWedges(numWedgesArg);
    setInitialWheelState(Array(numWedgesArg).fill("success"));
    setScenario(null); // Reset scenario for new game
    setCharacterSheets({}); // Reset character sheets for new game
    console.log("Creating game, resetting questions to default.");
    setQuestions(null); // Reset questions for new game
    setAllowPlayersToViewSheets(false); // Reset sheet visibility for new game
    setConnectionStatus("Waiting for players...");
    const peer = new Peer(normalizedId(newGameId)); // use normalized for PeerJS
    peerRef.current = peer;
    setUsers({});
    connectionsRef.current = [];
    peer.on("open", () => {
      // Add GM to users list
      const gmUsers = { [normalizedId(newGameId)]: hostName || "GM" };
      setUsers(gmUsers);
      setConnectionStatus(`Game created! Game ID: ${newGameId}`); // display original
    });
    peer.on("connection", (c) => {
      // Add to GM's connections
      if (!connectionsRef.current.includes(c)) {
        connectionsRef.current.push(c);
      }
      c.on("data", (data) => {
        console.log("[GM] Received message:", data.type, data);
        // All connection-based actions are handled here
        if (data && data.type === "join" && data.peerId && data.userName) {
          const newUsers = {
            ...currentStateRef.current.users,
            [normalizedId(data.peerId)]: data.userName,
          };
          setUsers(newUsers);
          const welcomeMsg = {
            type: "welcome",
            hostName: currentStateRef.current.hostName,
            users: newUsers,
            numWedges: currentStateRef.current.numWedges,
            wheelState: Array(currentStateRef.current.numWedges).fill(
              "success"
            ),
            scenario: currentStateRef.current.scenario,
            characterSheets: currentStateRef.current.characterSheets,
            questions: currentStateRef.current.questions,
            allowPlayersToViewSheets:
              currentStateRef.current.allowPlayersToViewSheets,
          };
          console.log("[GM] Sending welcome message:", welcomeMsg);
          c.send(welcomeMsg);

          // Broadcast updated user list to all existing connections
          const userUpdateMsg = {
            type: "user-list-update",
            users: newUsers,
          };
          console.log("[GM] Broadcasting user list update:", userUpdateMsg);
          connectionsRef.current.forEach((conn) => {
            if (conn !== c) {
              // Don't send to the new user, they already got the welcome message
              conn.send(userUpdateMsg);
            }
          });
        }
        // Handle refetch requests from clients
        if (data && data.type === "refetch-request") {
          const syncMsg = {
            type: "game-data-sync",
            hostName: currentStateRef.current.hostName,
            users: currentStateRef.current.users,
            numWedges: currentStateRef.current.numWedges,
            wheelState: Array(currentStateRef.current.numWedges).fill(
              "success"
            ),
            scenario: currentStateRef.current.scenario,
            characterSheets: currentStateRef.current.characterSheets,
            questions: currentStateRef.current.questions,
            allowPlayersToViewSheets:
              currentStateRef.current.allowPlayersToViewSheets,
          };
          console.log("[GM] Sending game-data-sync:", syncMsg);
          c.send(syncMsg);
        }
        // Forward wheel-related actions to WheelProvider
        if (wheelEventHandlerRef.current) {
          wheelEventHandlerRef.current(data, c);
        }
        // Forward chat-related actions to Chat
        if (chatEventHandlerRef.current && data.type === "chat") {
          chatEventHandlerRef.current(data, c);
        }
        // Forward scenario-related actions to Scenario
        if (
          scenarioEventHandlerRef.current &&
          data.type === "scenario-update"
        ) {
          scenarioEventHandlerRef.current(data, c);
        }
        // Forward character sheet-related actions to CharacterSheet
        if (
          characterSheetEventHandlerRef.current &&
          (data.type === "character-sheet-update" ||
            data.type === "questions-update" ||
            data.type === "sheet-visibility-update" ||
            data.type === "character-sheets-broadcast")
        ) {
          characterSheetEventHandlerRef.current(data, c);
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
        const joinMsg = { type: "join", peerId: pid, userName };
        console.log("[Player] Sending join message:", joinMsg);
        connection.send(joinMsg);
      });
      connection.on("data", (data) => {
        console.log("[Player] Received message:", data.type, data);
        // Forward wheel-related actions to WheelProvider
        if (wheelEventHandlerRef.current) {
          wheelEventHandlerRef.current(data, connection);
        }
        // Forward chat-related actions to Chat
        if (chatEventHandlerRef.current && data.type === "chat") {
          chatEventHandlerRef.current(data, connection);
        }
        // Forward scenario-related actions to Scenario
        if (
          scenarioEventHandlerRef.current &&
          data.type === "scenario-update"
        ) {
          scenarioEventHandlerRef.current(data, connection);
        }
        // Forward character sheet-related actions to CharacterSheet
        if (
          characterSheetEventHandlerRef.current &&
          (data.type === "character-sheet-update" ||
            data.type === "questions-update" ||
            data.type === "sheet-visibility-update" ||
            data.type === "character-sheets-broadcast")
        ) {
          characterSheetEventHandlerRef.current(data, connection);
        }
        // Handle game data sync from host
        if (data && data.type === "game-data-sync") {
          if (data.users) {
            setUsers(data.users);
            setConnectionStatus(
              `Synced! Players: ${Object.values(data.users).join(", ")}`
            );
          }
          if (data.numWedges) {
            setNumWedges(data.numWedges);
            setInitialWheelState(
              data.wheelState || Array(data.numWedges).fill("success")
            );
          }
          if (data.scenario) {
            setScenario(data.scenario);
          }
          if (data.characterSheets) {
            setCharacterSheets(data.characterSheets);
          }
          if (data.questions) {
            console.log(
              "Setting questions from game-data-sync:",
              data.questions
            );
            setQuestions(data.questions);
          }
          if (data.allowPlayersToViewSheets !== undefined) {
            setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
          }
        }
        if (data && data.type === "welcome" && data.users) {
          setUsers(data.users);
          setConnectionStatus(
            `Welcome! Players: ${Object.values(data.users).join(", ")}`
          );
        }
        // Handle user list updates from host
        if (data && data.type === "user-list-update") {
          setUsers(data.users);
          setConnectionStatus(
            `Users updated! Players: ${Object.values(data.users).join(", ")}`
          );
        }
        // Sync spinner state from host
        if (data && data.type === "welcome" && data.numWedges) {
          setNumWedges(data.numWedges);
          setInitialWheelState(
            data.wheelState || Array(data.numWedges).fill("success")
          );
          // Sync scenario from host
          if (data.scenario) {
            setScenario(data.scenario);
          }
          // Sync character sheet data from host
          if (data.characterSheets) {
            setCharacterSheets(data.characterSheets);
          }
          if (data.questions) {
            console.log("Setting questions from welcome:", data.questions);
            setQuestions(data.questions);
          }

          if (data.allowPlayersToViewSheets !== undefined) {
            setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
          }
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

export function usePeer() {
  return useContext(PeerContext);
}
