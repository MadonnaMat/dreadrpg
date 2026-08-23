// The CSS custom properties a theme controls - see src/styles/themes.css for
// the built-in presets' values, and AdminPanel.jsx for the per-token color
// pickers shown when "Custom" is selected.
export const THEME_TOKENS = [
  "--color-bg",
  "--color-text",
  "--color-accent",
  "--color-danger",
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
};

// Every non-default preset's actual --color-accent/--color-danger values,
// duplicated here from themes.css (same "must stay in sync" relationship as
// THEME_TOKENS above) so the wheel - a Pixi canvas, not CSS, so it can't
// just read the stylesheet - can pick up the same success/death colors as
// the rest of the themed UI. "default" is deliberately excluded: it means
// "don't touch anything from the original look" (see themes.css), so the
// wheel keeps its classic green/red regardless of --color-accent/-danger's
// own (blue/red) values - only an actual theme choice changes it. "custom"
// isn't listed here either, since its colors come from the GM's own live
// customColors instead - see getWheelColors.
export const THEME_WHEEL_COLORS = {
  scifi: { success: "#00e5ff", death: "#ff2b5e" },
  slasher: { success: "#8b0000", death: "#ff0000" },
  halloween: { success: "#ff7518", death: "#39ff14" },
  cosmic: { success: "#6a3fb5", death: "#00e6a8" },
  gothic: { success: "#b8860b", death: "#8b0020" },
};

// The wedge fill colors the wheel should use for the current game's theme -
// "<GM-picked accent>" for success, "<GM-picked danger>" for death, whether
// that's a built-in preset (looked up here) or a custom theme (read
// straight from the GM's own customColors). Falls back to the classic
// green/red for "default" or any unrecognized theme value.
const CLASSIC_WHEEL_COLORS = { success: "#00cc00", death: "#cc0000" };

export function getWheelColors(theme, customColors) {
  if (theme === "custom") {
    return {
      success: customColors?.["--color-accent"] || CLASSIC_WHEEL_COLORS.success,
      death: customColors?.["--color-danger"] || CLASSIC_WHEEL_COLORS.death,
    };
  }
  return THEME_WHEEL_COLORS[theme] || CLASSIC_WHEEL_COLORS;
}
