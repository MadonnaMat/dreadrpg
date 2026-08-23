import { describe, it, expect } from "vitest";
import { AUTOGM_STATUS, describeAutoGmStatus } from "../constants/autoGm";

describe("describeAutoGmStatus", () => {
  it("returns a label for each known status", () => {
    Object.values(AUTOGM_STATUS).forEach((status) => {
      expect(describeAutoGmStatus(status)).toEqual(expect.any(String));
      expect(describeAutoGmStatus(status).length).toBeGreaterThan(0);
    });
  });

  it("falls back to a generic label for an unrecognized status", () => {
    expect(describeAutoGmStatus("something-unexpected")).toBe("is thinking");
  });

  it("falls back to a generic label for a legacy boolean true", () => {
    expect(describeAutoGmStatus(true)).toBe("is thinking");
  });
});
