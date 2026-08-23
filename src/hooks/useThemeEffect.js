import { useEffect } from "react";
import { usePeer } from "./usePeer";
import { THEME_TOKENS } from "../constants/themes";

// Applies the game's chosen theme to the document root. Built-in presets
// are pure CSS ([data-theme="..."] blocks in src/styles/themes.css) - this
// just sets the attribute. "custom" has no CSS block of its own; its colors
// come from inline custom properties instead, which beat any stylesheet
// rule regardless of specificity.
export function useThemeEffect() {
  const { theme, customColors } = usePeer();

  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== "default") {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }

    if (theme === "custom" && customColors) {
      THEME_TOKENS.forEach((token) => {
        if (customColors[token])
          root.style.setProperty(token, customColors[token]);
      });
    } else {
      THEME_TOKENS.forEach((token) => root.style.removeProperty(token));
    }
  }, [theme, customColors]);
}
