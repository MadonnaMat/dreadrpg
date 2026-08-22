// Persists the GM's danger-state counters to localStorage keyed by gameId,
// so a GM tab refresh restores tower danger instead of silently resetting it
// to a fresh tower. Pure, side-effecting only via localStorage - trivially
// unit-testable.
const STORAGE_KEY_PREFIX = "dread-rpg-wheel-state-";

function storageKey(gameId) {
  return `${STORAGE_KEY_PREFIX}${gameId}`;
}

export function saveWheelState(gameId, state) {
  try {
    localStorage.setItem(storageKey(gameId), JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - non-fatal
  }
}

export function loadWheelState(gameId) {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
