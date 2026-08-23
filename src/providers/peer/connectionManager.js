// Framework-agnostic PeerJS connection lifecycle management, shared by the
// GM (host) and player roles. Kept free of React so it can be unit tested
// directly and so PeerProvider.jsx never has to touch a Peer/DataConnection
// object itself.
import Peer from "peerjs";
import { MESSAGE_TYPES } from "../../constants/messageTypes";

const PING_INTERVAL_MS = 5000;
const PONG_TIMEOUT_MS = 15000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000];

// Normalize IDs by stripping '-' and trimming whitespace
export function normalizedId(id) {
  return `dread-rpg-game-${(id || "").replace(/-/g, "").trim()}`;
}

function trySend(connection, msg) {
  try {
    if (connection.open) {
      connection.send(msg);
    }
  } catch {
    // A single bad send shouldn't abort the caller - the heartbeat/close
    // listeners are responsible for eventually pruning a dead connection.
  }
}

// Periodically pings each tracked connection and reports ones that haven't
// ponged back within PONG_TIMEOUT_MS - catches a WebRTC channel that reports
// itself "open" while the underlying transport has actually died.
function startHeartbeat(getEntries, onDead) {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const entry of getEntries()) {
      if (now - entry.lastPongAt > PONG_TIMEOUT_MS) {
        onDead(entry);
      } else {
        trySend(entry.connection, { type: MESSAGE_TYPES.PING });
      }
    }
  }, PING_INTERVAL_MS);
  return () => clearInterval(interval);
}

// GM side: owns one Peer accepting connections from every player. Connections
// are keyed by the remote peer's own id (PeerJS's DataConnection.peer), so a
// reconnecting player's fresh connection replaces its stale predecessor
// instead of both ending up in the broadcast list.
export function createHostConnectionManager({
  gameId,
  onPeerOpen,
  onConnectionOpen,
  onData,
  onConnectionClosed,
}) {
  const peer = new Peer(normalizedId(gameId));
  const connections = new Map(); // peerId -> { connection, lastPongAt }

  function pruneConnection(peerId, entry) {
    if (connections.get(peerId) === entry) {
      connections.delete(peerId);
      onConnectionClosed?.(peerId);
    }
  }

  function registerConnection(c) {
    const existing = connections.get(c.peer);
    if (existing) {
      try {
        existing.connection.close();
      } catch {
        // already dead, nothing to clean up
      }
    }
    const entry = { connection: c, lastPongAt: Date.now() };
    connections.set(c.peer, entry);

    c.on("data", (data) => {
      if (data?.type === MESSAGE_TYPES.PING) {
        trySend(c, { type: MESSAGE_TYPES.PONG });
        return;
      }
      if (data?.type === MESSAGE_TYPES.PONG) {
        entry.lastPongAt = Date.now();
        return;
      }
      onData(data, c);
    });
    c.on("open", () => onConnectionOpen?.(c));
    c.on("close", () => pruneConnection(c.peer, entry));
    c.on("error", () => pruneConnection(c.peer, entry));
  }

  peer.on("open", (id) => onPeerOpen(id));
  peer.on("connection", registerConnection);

  const stopHeartbeat = startHeartbeat(
    () => connections.values(),
    (entry) => {
      try {
        entry.connection.close();
      } catch {
        // no-op - the close handler above prunes it
      }
    }
  );

  function sendToPeers(msg, { excludePeerId } = {}) {
    for (const [peerId, { connection }] of connections) {
      if (peerId === excludePeerId) continue;
      trySend(connection, msg);
    }
  }

  // Targets a single connected player by their (normalized) peerId - used
  // for a GM-triggered presence ping, which only makes sense addressed to
  // one specific player rather than broadcast to everyone.
  function sendToOne(peerId, msg) {
    const entry = connections.get(peerId);
    if (entry) trySend(entry.connection, msg);
  }

  function destroy() {
    stopHeartbeat();
    peer.destroy();
  }

  return { peer, sendToPeers, sendToOne, destroy };
}

// Player side: owns the Peer used to dial the GM, and reconnects with a
// bounded backoff if the connection or the underlying peer drops.
export function createPlayerConnectionManager({
  gameId,
  peerId,
  onPeerOpen,
  onOpen,
  onData,
  onStatusChange,
}) {
  const peer = new Peer(normalizedId(peerId));
  let connection = null;
  let hasConnectedBefore = false;
  let reconnectAttempt = 0;
  let stopHeartbeat = null;
  let lastPongAt = Date.now();

  function connectToHost() {
    connection = peer.connect(normalizedId(gameId));
    wireConnection(connection);
  }

  function wireConnection(c) {
    c.on("open", () => {
      reconnectAttempt = 0;
      lastPongAt = Date.now();
      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;
      stopHeartbeat?.();
      stopHeartbeat = startHeartbeat(
        () => [{ connection: c, lastPongAt }],
        () => scheduleReconnect()
      );
      onOpen(c, { isReconnect });
    });
    c.on("data", (data) => {
      if (data?.type === MESSAGE_TYPES.PING) {
        trySend(c, { type: MESSAGE_TYPES.PONG });
        return;
      }
      if (data?.type === MESSAGE_TYPES.PONG) {
        lastPongAt = Date.now();
        return;
      }
      onData(data, c);
    });
    c.on("close", scheduleReconnect);
    c.on("error", scheduleReconnect);
  }

  function scheduleReconnect() {
    stopHeartbeat?.();
    if (reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      onStatusChange("Connection lost. Please rejoin the game.");
      return;
    }
    const delay = RECONNECT_DELAYS_MS[reconnectAttempt++];
    onStatusChange("Reconnecting...");
    setTimeout(() => {
      if (peer.disconnected) {
        peer.reconnect();
      } else {
        connectToHost();
      }
    }, delay);
  }

  peer.on("open", (id) => {
    onPeerOpen?.(id);
    connectToHost();
  });
  peer.on("disconnected", scheduleReconnect);
  peer.on("error", scheduleReconnect);

  function sendToPeers(msg) {
    if (connection) trySend(connection, msg);
  }

  function destroy() {
    stopHeartbeat?.();
    peer.destroy();
  }

  return { peer, sendToPeers, destroy };
}
