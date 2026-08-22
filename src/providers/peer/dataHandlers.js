// The two per-role "onData" handlers wired into the connection managers -
// these are the actual game-protocol logic (join handshake, snapshot
// requests, full-state sync), as opposed to connectionManager.js which only
// deals with transport-level connection lifecycle.
import {
  buildGameSnapshot,
  dispatchToRegisteredHandlers,
} from "./gameSnapshot";
import { normalizedId } from "./connectionManager";
import { MESSAGE_TYPES } from "../../constants/messageTypes";

// GM side: handle an inbound message on one player's connection - the join
// handshake, a refetch-request, and forwarding everything else to whichever
// component registered interest in it.
export function createHostDataHandler({
  currentStateRef,
  setUsers,
  setPresence,
  handlerRefs,
  sendToPeers, // the host connection manager's sendToPeers(msg, { excludePeerId })
}) {
  return (data, c) => {
    if (
      data &&
      data.type === MESSAGE_TYPES.JOIN &&
      data.peerId &&
      data.userName
    ) {
      const joiningPeerId = normalizedId(data.peerId);
      // A name is only unavailable while its presence entry says
      // "connected" - a disconnected name is free to reclaim (see
      // docs/rules/compliance-fix-plan.md item 8).
      if (currentStateRef.current.presence[data.userName]?.connected) {
        c.send({
          type: MESSAGE_TYPES.JOIN_REJECTED,
          reason: "name-in-use",
        });
        return;
      }

      const newUsers = {
        ...currentStateRef.current.users,
        [joiningPeerId]: data.userName,
      };
      setUsers(newUsers);
      const newPresence = {
        ...currentStateRef.current.presence,
        [data.userName]: { connected: true },
      };
      setPresence(newPresence);
      c.send(buildGameSnapshot(MESSAGE_TYPES.WELCOME, currentStateRef));

      // Broadcast updated user list/presence to everyone except the new
      // joiner, who already got the welcome message.
      sendToPeers(
        { type: MESSAGE_TYPES.USER_LIST_UPDATE, users: newUsers },
        { excludePeerId: c.peer }
      );
      sendToPeers(
        { type: MESSAGE_TYPES.PRESENCE_UPDATE, presence: newPresence },
        { excludePeerId: c.peer }
      );
    }
    if (data && data.type === MESSAGE_TYPES.REFETCH_REQUEST) {
      c.send(buildGameSnapshot(MESSAGE_TYPES.GAME_DATA_SYNC, currentStateRef));
    }
    dispatchToRegisteredHandlers(data, c, handlerRefs);
  };
}

// The Admin Panel's own settings (campaign name/tower size/theme/death
// narration) - extracted purely to keep applySnapshotToPlayerState's own
// branching complexity down; each field is independently optional.
function applyAdminSettings(data, setters) {
  const {
    setGameName,
    setTowerSize,
    setTheme,
    setCustomColors,
    setDeathFlavorText,
  } = setters;

  if (data.gameName !== undefined) setGameName(data.gameName);
  if (data.towerSize !== undefined) setTowerSize(data.towerSize);
  if (data.theme !== undefined) setTheme(data.theme);
  if (data.customColors !== undefined) setCustomColors(data.customColors);
  if (data.deathFlavorText !== undefined) {
    setDeathFlavorText(data.deathFlavorText);
  }
}

// Applies a full welcome/game-data-sync snapshot to player-side state.
// Extracted out of createPlayerDataHandler purely to keep that function's
// branching complexity down - each field is independently optional.
function applySnapshotToPlayerState(data, setters) {
  const {
    setUsers,
    setPresence,
    setConnectionStatus,
    setDangerProbability,
    setAwaitingReset,
    setDesignatedSpinner,
    setGameStarted,
    setScenario,
    setCharacters,
    setAllowPlayersToViewSheets,
  } = setters;

  if (data.users) {
    setUsers(data.users);
    setConnectionStatus(
      data.type === MESSAGE_TYPES.WELCOME
        ? `Welcome! Players: ${Object.values(data.users).join(", ")}`
        : `Synced! Players: ${Object.values(data.users).join(", ")}`
    );
  }
  if (data.presence) setPresence(data.presence);
  if (data.dangerProbability !== undefined) {
    setDangerProbability(data.dangerProbability);
  }
  if (data.awaitingReset !== undefined) setAwaitingReset(data.awaitingReset);
  if (data.designatedSpinner !== undefined) {
    setDesignatedSpinner(data.designatedSpinner);
  }
  if (data.gameStarted !== undefined) setGameStarted(data.gameStarted);
  if (data.scenario) setScenario(data.scenario);
  if (data.characters) setCharacters(data.characters);
  if (data.allowPlayersToViewSheets !== undefined) {
    setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
  }
  applyAdminSettings(data, setters);
}

// GAME_NAME_UPDATE/TOWER_SIZE_UPDATE/THEME_UPDATE only ever originate from
// the GM's Admin Panel - no equivalent GM-side handling is needed since the
// GM never receives its own broadcast back. Table-driven so adding another
// single-field live update later doesn't grow createPlayerDataHandler's own
// branching complexity.
const LIVE_UPDATE_HANDLERS = {
  [MESSAGE_TYPES.GAME_NAME_UPDATE]: (data, { setGameName }) =>
    setGameName(data.gameName),
  [MESSAGE_TYPES.TOWER_SIZE_UPDATE]: (data, { setTowerSize }) =>
    setTowerSize(data.towerSize),
  [MESSAGE_TYPES.THEME_UPDATE]: (data, { setTheme, setCustomColors }) => {
    setTheme(data.theme);
    setCustomColors(data.customColors ?? null);
  },
  [MESSAGE_TYPES.PRESENCE_UPDATE]: (data, { setPresence }) =>
    setPresence(data.presence),
  [MESSAGE_TYPES.DEATH_FLAVOR_TEXT_UPDATE]: (data, { setDeathFlavorText }) =>
    setDeathFlavorText(data.deathFlavorText),
};

// Player side: handle an inbound message on the single connection to the GM
// - full-state snapshots (welcome/game-data-sync), user-list updates, and
// forwarding everything else to whichever component registered interest.
export function createPlayerDataHandler(setters) {
  const { handlerRefs, setUsers, setConnectionStatus, setConn, setJoinError } =
    setters;

  return (data, connection) => {
    dispatchToRegisteredHandlers(data, connection, handlerRefs);

    if (
      data &&
      (data.type === MESSAGE_TYPES.GAME_DATA_SYNC ||
        data.type === MESSAGE_TYPES.WELCOME)
    ) {
      applySnapshotToPlayerState(data, setters);
    }
    if (data && data.type === MESSAGE_TYPES.USER_LIST_UPDATE) {
      setUsers(data.users);
      setConnectionStatus(
        `Users updated! Players: ${Object.values(data.users).join(", ")}`
      );
    }
    if (data && data.type === MESSAGE_TYPES.JOIN_REJECTED) {
      setJoinError(
        "That name is already in use in this game - pick another one."
      );
      setConnectionStatus("");
      setConn(null);
    }
    const applyLiveUpdate = data && LIVE_UPDATE_HANDLERS[data.type];
    if (applyLiveUpdate) applyLiveUpdate(data, setters);
  };
}
