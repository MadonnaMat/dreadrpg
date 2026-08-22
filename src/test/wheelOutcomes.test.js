import { describe, it, expect } from "vitest";
import {
  deathText,
  DEFAULT_DEATH_FLAVOR_TEXT,
} from "../constants/wheelOutcomes";

describe("deathText", () => {
  it("substitutes {name} with the character's name", () => {
    expect(deathText("{name} Died!", "Alice")).toBe("Alice Died!");
  });

  it("substitutes every occurrence of {name}, not just the first", () => {
    expect(deathText("{name} falls. Rest in peace, {name}.", "Bob")).toBe(
      "Bob falls. Rest in peace, Bob."
    );
  });

  it("falls back to the default template when none is given", () => {
    expect(deathText(null, "Alice")).toBe(
      DEFAULT_DEATH_FLAVOR_TEXT.replace("{name}", "Alice")
    );
    expect(deathText(undefined, "Alice")).toBe(
      DEFAULT_DEATH_FLAVOR_TEXT.replace("{name}", "Alice")
    );
    expect(deathText("", "Alice")).toBe(
      DEFAULT_DEATH_FLAVOR_TEXT.replace("{name}", "Alice")
    );
  });

  it("leaves a template with no placeholder unchanged apart from itself", () => {
    expect(deathText("The tower falls silent.", "Alice")).toBe(
      "The tower falls silent."
    );
  });
});
