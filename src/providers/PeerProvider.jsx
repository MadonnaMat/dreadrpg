import React, { useCallback, useRef } from "react";
import { PeerContext } from "../contexts/PeerContext";
import {
  createHostConnectionManager,
  createPlayerConnectionManager,
} from "./peer/connectionManager";
import {
  createHostDataHandler,
  createPlayerDataHandler,
} from "./peer/dataHandlers";
import { useVisibilityResync } from "./peer/useVisibilityResync";
import { usePeerSession } from "./peer/usePeerSession";
import { useGameState } from "./peer/useGameState";
import { useRegisteredHandlers } from "./peer/useRegisteredHandlers";
import { useCurrentStateRef } from "./peer/useCurrentStateRef";
import { MESSAGE_TYPES } from "../constants/messageTypes";

export const PeerProvider = ({ children }) => {
  const session = usePeerSession();
  const gameState = useGameState();
  const handlers = useRegisteredHandlers();

  const currentStateRef = useCurrentStateRef({
    scenario: gameState.scenario,
    characterSheets: gameState.characterSheets,
    questions: gameState.questions,
    allowPlayersToViewSheets: gameState.allowPlayersToViewSheets,
    users: session.users,
    hostName: session.hostName,
    towerSize: gameState.towerSize,
    isGM: session.isGM,
    dangerProbability: gameState.dangerProbability,
    awaitingReset: gameState.awaitingReset,
    gameStarted: gameState.gameStarted,
  });

  const peerRef = useRef(null);
  const managerRef = useRef(null);

  // Method for sending messages - delegates to whichever connection manager
  // (host or player) is currently active. Reads managerRef.current at call
  // time, so it never needs to change identity - stabilizing it with
  // useCallback matters beyond just satisfying exhaustive-deps: consumers
  // like GameLoaded.jsx's one-shot refetch-request effect list sendToPeers
  // as a dependency, and an unstable reference there kept clearing and
  // rescheduling that effect's setTimeout on every render churn around
  // join-time, sometimes preventing it from ever firing.
  const sendToPeers = useCallback((msg) => {
    managerRef.current?.sendToPeers(msg);
  }, []);

  // Non-GM clients re-request a full snapshot whenever their tab becomes
  // visible again, on top of GameLoaded's one-shot mount-time refetch.
  useVisibilityResync({
    isGM: session.isGM,
    conn: session.conn,
    sendToPeers,
    peerId: session.peerId,
  });

  // Host: create game
  const createGame = (newGameId, hostNameArg, towerSizeArg = 25) => {
    session.setGameId(newGameId);
    session.setHostName(hostNameArg);
    session.setIsGM(true);
    gameState.setTowerSize(towerSizeArg);
    gameState.setDangerProbability(0);
    gameState.setAwaitingReset(false);
    gameState.setGameStarted(false); // New game always starts back in the lobby
    gameState.setScenario(null); // Reset scenario for new game
    gameState.setCharacterSheets({}); // Reset character sheets for new game
    gameState.setQuestions(null); // Reset questions for new game
    gameState.setAllowPlayersToViewSheets(false); // Reset sheet visibility for new game
    session.setConnectionStatus("Waiting for players...");
    session.setUsers({});

    // `manager` is referenced inside these callbacks before it's assigned
    // below - safe because none of them run until after createGame returns
    // and the connection manager starts firing async events.
    let manager;
    const onData = createHostDataHandler({
      currentStateRef,
      setUsers: session.setUsers,
      handlerRefs: handlers.handlerRefs,
      sendToPeers: (msg, opts) => manager.sendToPeers(msg, opts),
    });

    manager = createHostConnectionManager({
      gameId: newGameId,
      onPeerOpen: (id) => {
        session.setPeerId(id);
        const gmUsers = { [id]: hostNameArg || "GM" };
        session.setUsers(gmUsers);
        session.setConnectionStatus(`Game created! Game ID: ${newGameId}`); // display original
      },
      onConnectionOpen: (c) => session.setConn(c),
      onData,
      onConnectionClosed: (droppedPeerId) => {
        session.setUsers((prev) => {
          if (!(droppedPeerId in prev)) return prev;
          const next = { ...prev };
          delete next[droppedPeerId];
          manager.sendToPeers({
            type: MESSAGE_TYPES.USER_LIST_UPDATE,
            users: next,
          });
          return next;
        });
      },
    });
    managerRef.current = manager;
    peerRef.current = manager.peer;
  };

  // Player: join game
  const joinGame = (gameIdArg, peerIdArg, userNameArg) => {
    session.setGameId(gameIdArg);
    session.setUserName(userNameArg);
    session.setConnectionStatus("Connecting to game...");
    let resolvedPeerId = peerIdArg;

    const manager = createPlayerConnectionManager({
      gameId: gameIdArg,
      peerId: peerIdArg,
      onPeerOpen: (id) => {
        resolvedPeerId = id;
        session.setPeerId(id);
      },
      onOpen: (connection, { isReconnect }) => {
        session.setConn(connection);
        if (!isReconnect) {
          session.setConnectionStatus(
            `Connected as ${userNameArg} (${resolvedPeerId})`
          );
          connection.send({
            type: MESSAGE_TYPES.JOIN,
            peerId: resolvedPeerId,
            userName: userNameArg,
          });
        } else {
          session.setConnectionStatus(`Reconnected as ${userNameArg}`);
          connection.send({
            type: MESSAGE_TYPES.REFETCH_REQUEST,
            peerId: resolvedPeerId,
          });
        }
      },
      onData: createPlayerDataHandler({
        handlerRefs: handlers.handlerRefs,
        setUsers: session.setUsers,
        setConnectionStatus: session.setConnectionStatus,
        setTowerSize: gameState.setTowerSize,
        setDangerProbability: gameState.setDangerProbability,
        setAwaitingReset: gameState.setAwaitingReset,
        setGameStarted: gameState.setGameStarted,
        setScenario: gameState.setScenario,
        setCharacterSheets: gameState.setCharacterSheets,
        setQuestions: gameState.setQuestions,
        setAllowPlayersToViewSheets: gameState.setAllowPlayersToViewSheets,
      }),
      onStatusChange: (status) => session.setConnectionStatus(status),
    });
    managerRef.current = manager;
    peerRef.current = manager.peer;
  };

  return (
    <PeerContext.Provider
      value={{
        ...session,
        ...gameState,
        peerRef,
        createGame,
        joinGame,
        registerWheelEventHandler: handlers.registerWheelEventHandler,
        registerChatEventHandler: handlers.registerChatEventHandler,
        registerScenarioEventHandler: handlers.registerScenarioEventHandler,
        registerCharacterSheetEventHandler:
          handlers.registerCharacterSheetEventHandler,
        sendToPeers,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
