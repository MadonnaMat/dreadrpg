// Persists the GM's danger-state counters to localStorage keyed by gameId
// *and* the GM's own hostName, so a GM tab refresh restores tower danger
// instead of silently resetting it to a fresh tower. The hostName half of
// the key matters for local testing: opening several browser tabs against
// the same gameId (e.g. testing as multiple GMs, or a GM re-creating a game
// under a different name) would otherwise share - and clobber - one
// localStorage entry, since gameId alone repeats across those tabs. Pure,
// side-effecting only via localStorage - trivially unit-testable.
const STORAGE_KEY_PREFIX = "dread-rpg-wheel-state-";

function storageKey(gameId, hostName) {
  return `${STORAGE_KEY_PREFIX}${gameId}-${hostName}`;
}

export function saveWheelState(gameId, hostName, state) {
  try {
    localStorage.setItem(storageKey(gameId, hostName), JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - non-fatal
  }
}

export function loadWheelState(gameId, hostName) {
  try {
    const raw = localStorage.getItem(storageKey(gameId, hostName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
