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
  custom: "Custom",
};

export const THEME_TOKEN_LABELS = {
  "--color-bg": "Background",
  "--color-text": "Text",
  "--color-accent": "Accent",
  "--color-danger": "Danger",
};
