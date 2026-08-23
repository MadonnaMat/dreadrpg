import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import {
  THEME_PRESETS,
  THEME_TOKENS,
  THEME_WHEEL_COLORS,
  getWheelColors,
} from "../constants/themes";

const themesCssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../styles/themes.css"
);
const themesCss = readFileSync(themesCssPath, "utf-8");

// "default" and "custom" are handled in JS (no data-theme attribute at all,
// and inline custom properties, respectively) - only the true built-in
// presets need their own CSS block.
const cssBlockPresets = THEME_PRESETS.filter(
  (preset) => preset !== "default" && preset !== "custom"
);

describe("theme presets", () => {
  it("includes default and custom as non-CSS-block presets", () => {
    expect(THEME_PRESETS).toContain("default");
    expect(THEME_PRESETS).toContain("custom");
  });

  it("has at least one built-in CSS preset besides default/custom", () => {
    expect(cssBlockPresets.length).toBeGreaterThan(0);
  });

  it.each(cssBlockPresets)(
    'defines a [data-theme="%s"] CSS block in themes.css',
    (preset) => {
      expect(themesCss).toContain(`[data-theme="${preset}"]`);
    }
  );

  it.each(cssBlockPresets)(
    "%s's CSS block sets every theme token",
    (preset) => {
      const block = themesCss.match(
        new RegExp(`\\[data-theme="${preset}"\\]\\s*{([^}]*)}`)
      );
      expect(block).not.toBeNull();
      THEME_TOKENS.forEach((token) => {
        expect(block[1]).toContain(token);
      });
    }
  );
});

describe("getWheelColors", () => {
  it("keeps the classic green/red for the default theme, ignoring --color-accent/-danger", () => {
    expect(getWheelColors("default", null)).toEqual({
      success: "#00cc00",
      death: "#cc0000",
    });
  });

  it.each(Object.keys(THEME_WHEEL_COLORS))(
    "uses %s's own accent/danger colors for the wheel",
    (preset) => {
      expect(getWheelColors(preset, null)).toEqual(THEME_WHEEL_COLORS[preset]);
    }
  );

  it("uses the GM's live custom colors for a custom theme", () => {
    expect(
      getWheelColors("custom", {
        "--color-accent": "#123456",
        "--color-danger": "#abcdef",
      })
    ).toEqual({ success: "#123456", death: "#abcdef" });
  });

  it("falls back to classic colors for a custom theme with no colors set yet", () => {
    expect(getWheelColors("custom", null)).toEqual({
      success: "#00cc00",
      death: "#cc0000",
    });
  });
});
