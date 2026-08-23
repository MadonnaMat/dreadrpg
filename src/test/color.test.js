import { describe, it, expect } from "vitest";
import { hexToPixiColor } from "../helpers/color";

describe("hexToPixiColor", () => {
  it("converts a #rrggbb string to the equivalent 0xrrggbb number", () => {
    expect(hexToPixiColor("#00cc00", 0)).toBe(0x00cc00);
    expect(hexToPixiColor("#6a3fb5", 0)).toBe(0x6a3fb5);
  });

  it("falls back for a non-string value", () => {
    expect(hexToPixiColor(undefined, 0x123456)).toBe(0x123456);
    expect(hexToPixiColor(null, 0x123456)).toBe(0x123456);
  });

  it("falls back for a malformed hex string", () => {
    expect(hexToPixiColor("not-a-color", 0x123456)).toBe(0x123456);
  });
});
