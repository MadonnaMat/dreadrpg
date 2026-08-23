// "#rrggbb" -> the 0xrrggbb number Pixi's fill()/stroke() expect. Falls back
// to `fallback` for anything that isn't a well-formed hex string, so a
// missing/malformed theme color can't leave the wheel undrawable.
export function hexToPixiColor(hex, fallback) {
  if (typeof hex !== "string") return fallback;
  const parsed = parseInt(hex.replace("#", ""), 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}
