// Builds a player's personal rejoin link: the same `?gameId=` URL PreGame.jsx
// already prefills the join form from, plus `&userName=` so their own name
// is prefilled too and they don't have to retype anything to get back in.
export function buildRejoinUrl(gameId, userName) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ gameId, userName });
  return `${base}?${params.toString()}`;
}
