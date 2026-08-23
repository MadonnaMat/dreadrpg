// Persists the user's opt-in choice for the AI assistant to localStorage.
// Unlike src/providers/wheel/wheelPersistence.js and
// src/providers/peer/gamePersistence.js, this is a per-browser device
// preference, not per-game state, so it uses a single fixed key rather
// than one scoped by gameId. Pure, side-effecting only via localStorage -
// trivially unit-testable.
const STORAGE_KEY = "dread-rpg-ai-preference";

export function saveAiPreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - non-fatal
  }
}

export function loadAiPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
