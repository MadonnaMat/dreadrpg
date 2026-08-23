import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";
import { useThemeEffect } from "../hooks/useThemeEffect";

function TestComponent({ theme, customColors }) {
  const { setTheme, setCustomColors } = usePeer();
  useEffect(() => {
    setTheme(theme);
    setCustomColors(customColors ?? null);
  }, [theme, customColors, setTheme, setCustomColors]);
  useThemeEffect();
  return null;
}

describe("useThemeEffect", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.cssText = "";
  });

  it("does nothing to data-theme for the default theme", () => {
    render(
      <PeerProvider>
        <TestComponent theme="default" />
      </PeerProvider>
    );

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("sets data-theme for a built-in preset", () => {
    render(
      <PeerProvider>
        <TestComponent theme="scifi" />
      </PeerProvider>
    );

    expect(document.documentElement.dataset.theme).toBe("scifi");
  });

  it("applies custom colors as inline custom properties", () => {
    render(
      <PeerProvider>
        <TestComponent
          theme="custom"
          customColors={{ "--color-bg": "#123456" }}
        />
      </PeerProvider>
    );

    expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe(
      "#123456"
    );
  });

  it("clears inline custom properties when switching away from custom", () => {
    const { rerender } = render(
      <PeerProvider>
        <TestComponent
          theme="custom"
          customColors={{ "--color-bg": "#123456" }}
        />
      </PeerProvider>
    );
    expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe(
      "#123456"
    );

    rerender(
      <PeerProvider>
        <TestComponent theme="scifi" />
      </PeerProvider>
    );

    expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe(
      ""
    );
  });
});
