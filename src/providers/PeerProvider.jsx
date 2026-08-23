import React, { useCallback, useEffect, useRef } from "react";
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
import { applyCharacterEvent } from "./peer/characterEvents";
import {
  saveGameState,
  loadGameState,
  upsertMyGame,
} from "./peer/gamePersistence";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { DEFAULT_DEATH_FLAVOR_TEXT } from "../constants/wheelOutcomes";

// Resolves the values createGame should seed its state with: a previously
// saved game's fields when resuming, or the plain new-game defaults
// otherwise. Pulled out of createGame itself purely to keep that function's
// cyclomatic complexity within lint's limit - each `??` below is one branch.
function deriveGameDefaults(restoredState, towerSizeArg, gameNameArg) {
  const saved = restoredState || {};
  return {
    gameName: saved.gameName ?? gameNameArg,
    towerSize: saved.towerSize ?? towerSizeArg,
    gameStarted: saved.gameStarted ?? false,
    scenario: saved.scenario ?? null,
    characters: saved.characters ?? {},
    allowPlayersToViewSheets: saved.allowPlayersToViewSheets ?? false,
    theme: saved.theme ?? "default",
    customColors: saved.customColors ?? null,
    deathFlavorText: saved.deathFlavorText ?? DEFAULT_DEATH_FLAVOR_TEXT,
    campaignNotes: saved.campaignNotes ?? [],
  };
}

export const PeerProvider = ({ children }) => {
  const session = usePeerSession();
  const gameState = useGameState();
  const handlers = useRegisteredHandlers();

  const currentStateRef = useCurrentStateRef({
    scenario: gameState.scenario,
    gameName: gameState.gameName,
    characters: gameState.characters,
    allowPlayersToViewSheets: gameState.allowPlayersToViewSheets,
    users: session.users,
    hostName: session.hostName,
    towerSize: gameState.towerSize,
    isGM: session.isGM,
    dangerProbability: gameState.dangerProbability,
    awaitingReset: gameState.awaitingReset,
    designatedSpinner: gameState.designatedSpinner,
    gameStarted: gameState.gameStarted,
    presence: gameState.presence,
    theme: gameState.theme,
    customColors: gameState.customColors,
    deathFlavorText: gameState.deathFlavorText,
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

  // Explicitly tear down the current peer/connection when the tab is
  // actually going away (close, refresh, navigate). Without this, a plain
  // browser refresh just kills the page mid-flight - the PeerJS cloud
  // signaling server doesn't necessarily notice right away, which causes
  // two different problems downstream: (1) whoever's on the other end of
  // that connection has to wait out the full heartbeat timeout
  // (connectionManager.js, ~15-20s) before their presence flips to
  // offline, and (2) if it's the GM refreshing, a same-gameId peer ID they
  // try to reclaim a moment later (e.g. via "Resume") can still be held by
  // the stale registration, so the new Peer never actually opens and
  // `users`/`presence` stay stuck at their empty just-mounted defaults
  // (nobody - not even the GM - shows up anywhere). `pagehide` fires more
  // reliably than `beforeunload` across browsers (notably mobile Safari),
  // including on the *other* participant's side too, so both host and
  // player benefit from the earlier signal.
  useEffect(() => {
    const handlePageHide = () => {
      managerRef.current?.destroy?.();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  // Lets any component (e.g. WheelProvider narrating a spin/decline, or
  // AutoGmProvider posting AI narration) inject a system- or bot-authored
  // chat message without needing direct access to Chat.jsx's own local
  // `messages` state. Invoking the registered chat handler directly - the
  // same function Chat.jsx registers to process an inbound network message -
  // reuses its existing append-locally-and-(if GM)-forward-to-everyone-else
  // logic exactly, rather than duplicating it here. `fromBot` lets Chat.jsx
  // style AutoGM's own narration distinctly from the "System" mechanical
  // narration WheelProvider posts today.
  //
  // `notifyAutoGm` additionally forwards this same message to AutoGM's own
  // `autoGmChat` observer - used by WheelProvider for spin outcomes (a
  // decline, or a successful pull) so AutoGM always reacts to what just
  // happened, not only to a player's next typed message. AutoGM's own
  // narration (posted via this same function) never sets this flag, so it
  // can never re-trigger itself.
  const { handlerRefs } = handlers;
  const sendSystemChatMessage = useCallback(
    (text, { from = "System", fromBot = false, notifyAutoGm = false } = {}) => {
      const data = { type: MESSAGE_TYPES.CHAT, from, text, fromBot };
      handlerRefs.chat.current?.(data);
      if (notifyAutoGm) {
        handlerRefs.autoGmChat.current?.(data);
      }
    },
    [handlerRefs]
  );

  // The GM's own outbound chat message never reaches any handler today -
  // Chat.jsx's handleSend only network-sends (sendToPeers), it never invokes
  // its own registered handler, since there's normally nothing locally
  // listening besides Chat.jsx itself. Once the GM plays a character
  // (AutoGM mode), their own chat needs to reach AutoGmProvider's
  // `autoGmChat` observer too - Chat.jsx calls this unconditionally from
  // handleSend for both GM and player sends; it's a harmless no-op unless
  // something has actually registered on autoGmChat.
  const notifyAutoGmChat = useCallback(
    (data) => {
      handlerRefs.autoGmChat.current?.(data);
    },
    [handlerRefs]
  );

  // Non-GM clients re-request a full snapshot whenever their tab becomes
  // visible again, on top of GameLoaded's one-shot mount-time refetch.
  useVisibilityResync({
    isGM: session.isGM,
    conn: session.conn,
    sendToPeers,
    peerId: session.peerId,
  });

  // Character events are registered here (always active for the whole app
  // session) rather than from whichever component currently renders
  // character UI - a player claiming a character in the pre-game lobby, or
  // another player answering questions, needs to be applied and (GM only)
  // forwarded on to everyone else even when nobody has a character-related
  // tab open. Mirrors Chat.jsx's forwarding pattern since the GM is the only
  // hub every player is connected to.
  const { registerCharacterSheetEventHandler } = handlers;
  useEffect(() => {
    registerCharacterSheetEventHandler((data) => {
      applyCharacterEvent(
        data,
        gameState.setCharacters,
        gameState.setAllowPlayersToViewSheets
      );
      if (session.isGM) sendToPeers(data);
    });
  }, [
    registerCharacterSheetEventHandler,
    gameState.setCharacters,
    gameState.setAllowPlayersToViewSheets,
    session.isGM,
    sendToPeers,
  ]);

  // Host: create game. `restoredState` (from gamePersistence.js), when
  // present, seeds fields from a previously-saved game instead of the
  // hard-coded new-game defaults - used by resumeGame below.
  const createGame = (
    newGameId,
    hostNameArg,
    towerSizeArg = 25,
    gameNameArg = "Untitled Campaign",
    restoredState = null
  ) => {
    const defaults = deriveGameDefaults(
      restoredState,
      towerSizeArg,
      gameNameArg
    );
    session.setGameId(newGameId);
    session.setHostName(hostNameArg);
    session.setIsGM(true);
    gameState.setGameName(defaults.gameName);
    gameState.setTowerSize(defaults.towerSize);
    gameState.setDangerProbability(0);
    gameState.setAwaitingReset(false);
    gameState.setDesignatedSpinner(null);
    gameState.setGameStarted(defaults.gameStarted);
    gameState.setScenario(defaults.scenario);
    gameState.setCharacters(defaults.characters);
    gameState.setAllowPlayersToViewSheets(defaults.allowPlayersToViewSheets);
    gameState.setTheme(defaults.theme);
    gameState.setCustomColors(defaults.customColors);
    gameState.setDeathFlavorText(defaults.deathFlavorText);
    gameState.setCampaignNotes(defaults.campaignNotes);
    // The GM never goes through the JOIN handshake that normally creates a
    // presence entry, so seed their own here - otherwise they'd never show
    // up in the online/offline roster at all. A resumed game's saved
    // presence map is stale (everyone was disconnected when it was saved),
    // so always start fresh with just the GM online.
    gameState.setPresence({ [hostNameArg]: { connected: true } });
    session.setConnectionStatus("Waiting for players...");
    session.setUsers({});

    // `manager` is referenced inside these callbacks before it's assigned
    // below - safe because none of them run until after createGame returns
    // and the connection manager starts firing async events.
    let manager;
    const onData = createHostDataHandler({
      currentStateRef,
      setUsers: session.setUsers,
      setPresence: gameState.setPresence,
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
          const droppedUserName = prev[droppedPeerId];
          const next = { ...prev };
          delete next[droppedPeerId];
          manager.sendToPeers({
            type: MESSAGE_TYPES.USER_LIST_UPDATE,
            users: next,
          });
          // Mark presence disconnected rather than deleting it - the name
          // stays visible in the roster (as offline) and reclaimable by the
          // same player reconnecting, instead of just vanishing.
          gameState.setPresence((prevPresence) => {
            const nextPresence = {
              ...prevPresence,
              [droppedUserName]: { connected: false },
            };
            manager.sendToPeers({
              type: MESSAGE_TYPES.PRESENCE_UPDATE,
              presence: nextPresence,
            });
            return nextPresence;
          });
          return next;
        });
      },
    });
    managerRef.current = manager;
    peerRef.current = manager.peer;
  };

  // Host: resume a previously-created game from its saved localStorage
  // state. Reuses createGame with the same gameId, which reproduces the
  // same PeerJS pairing code (see connectionManager.js), plus the saved
  // blob as `restoredState`.
  const resumeGame = (gameIdArg, hostNameArg) => {
    const saved = loadGameState(gameIdArg, hostNameArg);
    createGame(
      gameIdArg,
      hostNameArg,
      saved?.towerSize,
      saved?.gameName,
      saved
    );
  };

  // Player: join game
  const joinGame = (gameIdArg, peerIdArg, userNameArg) => {
    session.setGameId(gameIdArg);
    session.setUserName(userNameArg);
    session.setConnectionStatus("Connecting to game...");
    session.setJoinError(null);
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
        setPresence: gameState.setPresence,
        setConnectionStatus: session.setConnectionStatus,
        setConn: session.setConn,
        setJoinError: session.setJoinError,
        setGameName: gameState.setGameName,
        setTowerSize: gameState.setTowerSize,
        setDangerProbability: gameState.setDangerProbability,
        setAwaitingReset: gameState.setAwaitingReset,
        setDesignatedSpinner: gameState.setDesignatedSpinner,
        setGameStarted: gameState.setGameStarted,
        setScenario: gameState.setScenario,
        setCharacters: gameState.setCharacters,
        setAllowPlayersToViewSheets: gameState.setAllowPlayersToViewSheets,
        setTheme: gameState.setTheme,
        setCustomColors: gameState.setCustomColors,
        setDeathFlavorText: gameState.setDeathFlavorText,
        setAutoGmThinking: gameState.setAutoGmThinking,
        userName: userNameArg,
      }),
      onStatusChange: (status) => session.setConnectionStatus(status),
    });
    managerRef.current = manager;
    peerRef.current = manager.peer;
  };

  // GM only: actively checks whether a specific player's connection is
  // really alive, rather than waiting on the passive heartbeat's own
  // ~15-20s detection window (connectionManager.js) to eventually notice
  // and update presence - useful when the GM wants an immediate answer
  // (e.g. presence still says "online" and they want to confirm it isn't
  // just lagging). Silently does nothing if the userName isn't currently
  // in the GM's own users map (already offline, or never existed).
  const pingUser = (targetUserName) => {
    const peerId = Object.keys(session.users || {}).find(
      (id) => session.users[id] === targetUserName
    );
    if (!peerId) return;
    managerRef.current?.sendToOne?.(peerId, {
      type: MESSAGE_TYPES.PRESENCE_PING,
      sentAt: Date.now(),
    });
  };

  // Keep the GM's saved game state up to date as the game progresses, so a
  // page refresh or homepage "Resume" picks up where things left off. Only
  // the GM persists - a player's own state is always derived from the GM's
  // broadcasts, so there's nothing distinct to save on their side.
  useEffect(() => {
    if (!session.isGM || !session.gameId || !session.hostName) return;
    saveGameState(session.gameId, session.hostName, {
      gameName: gameState.gameName,
      towerSize: gameState.towerSize,
      scenario: gameState.scenario,
      characters: gameState.characters,
      allowPlayersToViewSheets: gameState.allowPlayersToViewSheets,
      theme: gameState.theme,
      customColors: gameState.customColors,
      deathFlavorText: gameState.deathFlavorText,
      gameStarted: gameState.gameStarted,
      campaignNotes: gameState.campaignNotes,
    });
    upsertMyGame(session.gameId, session.hostName, gameState.gameName);
  }, [
    session.isGM,
    session.gameId,
    session.hostName,
    gameState.gameName,
    gameState.towerSize,
    gameState.scenario,
    gameState.characters,
    gameState.allowPlayersToViewSheets,
    gameState.theme,
    gameState.customColors,
    gameState.deathFlavorText,
    gameState.gameStarted,
    gameState.campaignNotes,
  ]);

  return (
    <PeerContext.Provider
      value={{
        ...session,
        ...gameState,
        peerRef,
        createGame,
        resumeGame,
        joinGame,
        registerWheelEventHandler: handlers.registerWheelEventHandler,
        registerChatEventHandler: handlers.registerChatEventHandler,
        registerScenarioEventHandler: handlers.registerScenarioEventHandler,
        registerPingEventHandler: handlers.registerPingEventHandler,
        registerAutoGmChatEventHandler: handlers.registerAutoGmChatEventHandler,
        sendToPeers,
        sendSystemChatMessage,
        notifyAutoGmChat,
        pingUser,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
