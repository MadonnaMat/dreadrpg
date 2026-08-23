// Persists the GM's full game state to localStorage, keyed by gameId *and*
// hostName - same reasoning as wheelPersistence.js's key scheme: keying on
// gameId alone would let two browser tabs simulating different identities
// against the same game clobber the same entry. Also maintains a small
// separate index ("my games") of every game this browser's GM has created,
// so the homepage can list them for Resume/Delete. Pure, side-effecting
// only via localStorage - trivially unit-testable.
const STATE_KEY_PREFIX = "dread-rpg-game-state-";
const MY_GAMES_KEY = "dread-rpg-my-games";

function stateKey(gameId, hostName) {
  return `${STATE_KEY_PREFIX}${gameId}-${hostName}`;
}

export function saveGameState(gameId, hostName, state) {
  try {
    localStorage.setItem(stateKey(gameId, hostName), JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - non-fatal
  }
}

export function loadGameState(gameId, hostName) {
  try {
    const raw = localStorage.getItem(stateKey(gameId, hostName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadMyGames() {
  try {
    const raw = localStorage.getItem(MY_GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMyGames(games) {
  try {
    localStorage.setItem(MY_GAMES_KEY, JSON.stringify(games));
  } catch {
    // non-fatal
  }
}

// Adds or updates this game's entry (matched by gameId+hostName) with the
// current campaign name and a fresh lastPlayed timestamp.
export function upsertMyGame(gameId, hostName, gameName) {
  const games = loadMyGames().filter(
    (g) => !(g.gameId === gameId && g.hostName === hostName)
  );
  games.push({ gameId, hostName, gameName, lastPlayed: Date.now() });
  saveMyGames(games);
}

// Removes both the saved game-state blob and its "my games" entry - used
// when the GM deletes a game from the homepage list.
export function deleteGameState(gameId, hostName) {
  try {
    localStorage.removeItem(stateKey(gameId, hostName));
  } catch {
    // non-fatal
  }
  saveMyGames(
    loadMyGames().filter(
      (g) => !(g.gameId === gameId && g.hostName === hostName)
    )
  );
}
