import { describe, it, expect } from "vitest";
import { latest, versionsFor } from "../prompts/index";

describe("prompt registry", () => {
  it("loads .md?raw content as a non-empty string for each registered prompt", () => {
    [
      "scenarioGeneration",
      "castGeneration",
      "sheetAnswerAssist",
      "campaignNotesGeneration",
      "autogmTurn",
      "autogmPullCheck",
      "autogmRemovalNarration",
      "autogmCompaction",
      "autogmSelfCheck",
    ].forEach((name) => {
      const entry = latest(name);
      expect(entry).toBeDefined();
      expect(typeof entry.text).toBe("string");
      expect(entry.text.length).toBeGreaterThan(0);
    });
  });

  it("returns the highest-versioned entry from latest()", () => {
    const versions = versionsFor("scenarioGeneration");
    expect(latest("scenarioGeneration")).toBe(versions[versions.length - 1]);
  });

  it("returns an empty array for an unknown prompt name", () => {
    expect(versionsFor("nonexistent")).toEqual([]);
    expect(latest("nonexistent")).toBeUndefined();
  });
});
