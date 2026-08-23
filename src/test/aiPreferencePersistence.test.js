import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAiPreference,
  loadAiPreference,
} from "../providers/ai/aiPreferencePersistence";

describe("aiPreferencePersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved", () => {
    expect(loadAiPreference()).toBeNull();
  });

  it("round-trips a saved preference", () => {
    saveAiPreference({ optedIn: true, tier: "medium" });
    expect(loadAiPreference()).toEqual({ optedIn: true, tier: "medium" });
  });

  it("overwrites a previously saved preference", () => {
    saveAiPreference({ optedIn: true, tier: "small" });
    saveAiPreference({ optedIn: false, tier: "small" });
    expect(loadAiPreference()).toEqual({ optedIn: false, tier: "small" });
  });

  it("returns null instead of throwing on corrupted stored JSON", () => {
    localStorage.setItem("dread-rpg-ai-preference", "{not valid json");
    expect(loadAiPreference()).toBeNull();
  });
});
