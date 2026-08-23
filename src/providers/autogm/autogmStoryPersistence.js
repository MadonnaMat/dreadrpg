// Persists AutoGM's own running story state to localStorage, keyed by
// gameId *and* the GM's own hostName - same rationale as
// wheel/wheelPersistence.js and peer/gamePersistence.js: opening several
// browser tabs against the same gameId (testing as multiple GMs, or a GM
// re-creating a game under a different name) shouldn't share one entry.
// Pure, side-effecting only via localStorage - trivially unit-testable.
const STORAGE_KEY_PREFIX = "dread-rpg-autogm-state-";

function storageKey(gameId, hostName) {
  return `${STORAGE_KEY_PREFIX}${gameId}-${hostName}`;
}

export function saveAutoGmState(gameId, hostName, state) {
  try {
    localStorage.setItem(storageKey(gameId, hostName), JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - non-fatal
  }
}

export function loadAutoGmState(gameId, hostName) {
  try {
    const raw = localStorage.getItem(storageKey(gameId, hostName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
