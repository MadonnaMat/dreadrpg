// The CSS custom properties every built-in preset defines in its own
// [data-theme="..."] block (see themes.css) - bg/text/accent/danger drive
// real CSS rules throughout the app.
export const CSS_PRESET_TOKENS = [
  "--color-bg",
  "--color-text",
  "--color-accent",
  "--color-danger",
];

// The full set of tokens a *Custom* theme lets the GM pick, and what
// useThemeEffect.js applies inline for "custom". Adds two wheel-only
// tokens on top of CSS_PRESET_TOKENS: --color-wheel-success/-death are
// deliberately separate from --color-accent/--color-danger (not reused) so
// a Custom theme's wheel can be set independently of its button/UI colors.
// Built-in presets don't need these in CSS at all - the wheel is a Pixi
// canvas, not CSS, and reads their colors from THEME_WHEEL_COLORS below
// instead - so they're excluded from CSS_PRESET_TOKENS above.
export const THEME_TOKENS = [
  ...CSS_PRESET_TOKENS,
  "--color-wheel-success",
  "--color-wheel-death",
];

// Built-in presets are pure CSS ([data-theme="..."] blocks in themes.css) -
// this is just the list of valid preset keys, plus "custom" for GM-supplied
// colors applied inline instead. "default" means "don't set data-theme at
// all", preserving the app's existing OS-light/dark-only look.
export const THEME_PRESETS = [
  "default",
  "scifi",
  "slasher",
  "halloween",
  "cosmic",
  "gothic",
  "custom",
];

export const DEFAULT_CUSTOM_COLORS = {
  "--color-bg": "#242424",
  "--color-text": "#ffffff",
  "--color-accent": "#2196f3",
  "--color-danger": "#f44336",
  // Defaults to the wheel's own classic green/red, not the accent/danger
  // colors above, precisely so those two stay independent from the start -
  // a GM who never touches the wheel swatches keeps the familiar look.
  "--color-wheel-success": "#00cc00",
  "--color-wheel-death": "#cc0000",
};

export const THEME_LABELS = {
  default: "Default",
  scifi: "Sci-Fi",
  slasher: "Slasher",
  halloween: "Halloween",
  cosmic: "Cosmic Horror",
  gothic: "Gothic",
  custom: "Custom",
};

export const THEME_TOKEN_LABELS = {
  "--color-bg": "Background",
  "--color-text": "Text",
  "--color-accent": "Accent",
  "--color-danger": "Danger",
  "--color-wheel-success": "Wheel Success",
  "--color-wheel-death": "Wheel Death",
};

// Every non-default preset's own wheel wedge colors, duplicated here from
// themes.css (same "must stay in sync" relationship as THEME_TOKENS above)
// so the wheel - a Pixi canvas, not CSS, so it can't just read the
// stylesheet - can pick up a theme-appropriate look. "default" is
// deliberately excluded: it means "don't touch anything from the original
// look" (see themes.css), so the wheel keeps its classic green/red
// regardless of theme tokens - only an actual theme choice changes it.
// "custom" isn't listed here either, since its colors come from the GM's
// own live customColors instead - see getWheelColors.
export const THEME_WHEEL_COLORS = {
  scifi: { success: "#00e5ff", death: "#ff2b5e" },
  slasher: { success: "#8b0000", death: "#ff0000" },
  halloween: { success: "#ff7518", death: "#39ff14" },
  cosmic: { success: "#6a3fb5", death: "#00e6a8" },
  gothic: { success: "#b8860b", death: "#8b0020" },
};

// The wedge fill colors the wheel should use for the current game's theme -
// looked up by preset for a built-in theme, or read straight from the GM's
// own dedicated --color-wheel-success/-death custom colors (independent of
// --color-accent/--color-danger, which only drive buttons/UI). Falls back
// to the classic green/red for "default" or any unrecognized theme value.
const CLASSIC_WHEEL_COLORS = { success: "#00cc00", death: "#cc0000" };

export function getWheelColors(theme, customColors) {
  if (theme === "custom") {
    return {
      success:
        customColors?.["--color-wheel-success"] || CLASSIC_WHEEL_COLORS.success,
      death:
        customColors?.["--color-wheel-death"] || CLASSIC_WHEEL_COLORS.death,
    };
  }
  return THEME_WHEEL_COLORS[theme] || CLASSIC_WHEEL_COLORS;
}
