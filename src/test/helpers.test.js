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

  it("should pre-set 3 death wedges per character removed when resetting (Dread's re-stack rule)", () => {
    const wheelState = Array(25).fill("success");
    wheelState[10] = "death";

    const result = getNewWheelStateOnSpin(10, wheelState, 1);

    expect(result).toHaveLength(25);
    expect(result.filter((wedge) => wedge === "death")).toHaveLength(3);
  });

  it("should escalate danger cumulatively across multiple collapses", () => {
    const wheelState = Array(25).fill("success");
    wheelState[0] = "death";

    const afterOne = getNewWheelStateOnSpin(0, wheelState, 1);
    expect(afterOne.filter((wedge) => wedge === "death")).toHaveLength(3);

    const afterTwo = getNewWheelStateOnSpin(0, wheelState, 2);
    expect(afterTwo.filter((wedge) => wedge === "death")).toHaveLength(6);
  });

  it("should never exceed the wheel size even with many characters removed", () => {
    const wheelState = ["success", "death", "success", "death"];

    const result = getNewWheelStateOnSpin(1, wheelState, 10);

    expect(result).toHaveLength(4);
    expect(result.filter((wedge) => wedge === "death")).toHaveLength(4);
  });

  it("should default to a full reset (0 removed characters) when the count is omitted", () => {
    const wheelState = ["success", "death", "success", "death"];

    const result = getNewWheelStateOnSpin(1, wheelState);

    expect(result.every((wedge) => wedge === "success")).toBe(true);
  });
});
