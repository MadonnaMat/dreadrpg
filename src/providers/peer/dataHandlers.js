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
      const newUsers = {
        ...currentStateRef.current.users,
        [normalizedId(data.peerId)]: data.userName,
      };
      setUsers(newUsers);
      c.send(buildGameSnapshot(MESSAGE_TYPES.WELCOME, currentStateRef));

      // Broadcast updated user list to everyone except the new joiner, who
      // already got the welcome message.
      sendToPeers(
        { type: MESSAGE_TYPES.USER_LIST_UPDATE, users: newUsers },
        { excludePeerId: c.peer }
      );
    }
    if (data && data.type === MESSAGE_TYPES.REFETCH_REQUEST) {
      c.send(buildGameSnapshot(MESSAGE_TYPES.GAME_DATA_SYNC, currentStateRef));
    }
    dispatchToRegisteredHandlers(data, c, handlerRefs);
  };
}

// Applies a full welcome/game-data-sync snapshot to player-side state.
// Extracted out of createPlayerDataHandler purely to keep that function's
// branching complexity down - each field is independently optional.
function applySnapshotToPlayerState(data, setters) {
  const {
    setUsers,
    setConnectionStatus,
    setTowerSize,
    setDangerProbability,
    setAwaitingReset,
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
  if (data.towerSize !== undefined) setTowerSize(data.towerSize);
  if (data.dangerProbability !== undefined) {
    setDangerProbability(data.dangerProbability);
  }
  if (data.awaitingReset !== undefined) setAwaitingReset(data.awaitingReset);
  if (data.gameStarted !== undefined) setGameStarted(data.gameStarted);
  if (data.scenario) setScenario(data.scenario);
  if (data.characters) setCharacters(data.characters);
  if (data.allowPlayersToViewSheets !== undefined) {
    setAllowPlayersToViewSheets(data.allowPlayersToViewSheets);
  }
}

// Player side: handle an inbound message on the single connection to the GM
// - full-state snapshots (welcome/game-data-sync), user-list updates, and
// forwarding everything else to whichever component registered interest.
export function createPlayerDataHandler(setters) {
  const { handlerRefs, setUsers, setConnectionStatus } = setters;

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
  };
}
