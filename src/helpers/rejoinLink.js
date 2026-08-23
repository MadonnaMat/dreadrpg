// Builds a player's personal rejoin link: the same `?gameId=` URL PreGame.jsx
// already prefills the join form from, plus `&userName=` so their own name
// is prefilled too and they don't have to retype anything to get back in.
export function buildRejoinUrl(gameId, userName) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ gameId, userName });
  return `${base}?${params.toString()}`;
}

// The GM's own "invite a player" link - just `?gameId=`, no userName, since
// whoever opens it hasn't picked a name yet. Shared between PreGame.jsx's
// pre-game Lobby tab and AdminPanel.jsx (so it's still reachable mid-game,
// not just before Start Game) rather than each recomputing it inline.
export function buildShareUrl(gameId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?gameId=${gameId}`;
}
