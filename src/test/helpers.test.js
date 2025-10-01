import { describe, it, expect } from "vitest";
import { getNewWheelStateOnSpin } from "../helpers";

describe("getNewWheelStateOnSpin", () => {
  it("should convert success wedge to death wedge when selected", () => {
    const wheelState = ["success", "success", "success", "success"];
    const selectedIdx = 1;

    const result = getNewWheelStateOnSpin(selectedIdx, wheelState);

    expect(result).toEqual(["success", "death", "success", "success"]);
    expect(result).not.toBe(wheelState); // Should return new array
  });

  it("should reset all wedges to success when death wedge is selected", () => {
    const wheelState = ["success", "death", "success", "death"];
    const selectedIdx = 1; // death wedge

    const result = getNewWheelStateOnSpin(selectedIdx, wheelState);

    expect(result).toEqual(["success", "success", "success", "success"]);
  });

  it("should handle single wedge wheel", () => {
    const wheelState = ["success"];
    const selectedIdx = 0;

    const result = getNewWheelStateOnSpin(selectedIdx, wheelState);

    expect(result).toEqual(["death"]);
  });

  it("should handle empty wheel state", () => {
    const wheelState = [];
    const selectedIdx = 0;

    const result = getNewWheelStateOnSpin(selectedIdx, wheelState);

    expect(result).toEqual([]);
  });

  it("should preserve wheel size when resetting after death", () => {
    const wheelState = ["success", "death", "success", "death", "success"];
    const selectedIdx = 3; // death wedge

    const result = getNewWheelStateOnSpin(selectedIdx, wheelState);

    expect(result).toHaveLength(5);
    expect(result.every((wedge) => wedge === "success")).toBe(true);
  });
});
