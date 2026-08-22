import { describe, it, expect } from "vitest";
import {
  computeDangerProbability,
  getWheelWedges,
  WEDGE_PAIRS,
} from "../helpers";

describe("computeDangerProbability", () => {
  it("is low early on, not linear-per-pull", () => {
    const p = computeDangerProbability(0, 0, 25);
    expect(p).toBeLessThan(0.05);
  });

  it("crosses 50% at the S-curve's midpoint fraction of towerSize", () => {
    // midpoint fraction is 0.6, so pullsSinceReset = 0.6 * towerSize
    const p = computeDangerProbability(15, 0, 25);
    expect(p).toBeCloseTo(0.5, 5);
  });

  it("is monotonically non-decreasing as pullsSinceReset increases", () => {
    let previous = -Infinity;
    for (let pulls = 0; pulls <= 30; pulls++) {
      const p = computeDangerProbability(pulls, 0, 25);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });

  it("rises faster than a flat linear curve near the midpoint (S-curve, not linear)", () => {
    const towerSize = 25;
    const linearAt = (pulls) => pulls / towerSize;
    // Well before the midpoint, the S-curve should trail a straight line...
    const early = computeDangerProbability(5, 0, towerSize);
    expect(early).toBeLessThan(linearAt(5));
    // ...and near/after the midpoint it should have overtaken it.
    const late = computeDangerProbability(20, 0, towerSize);
    expect(late).toBeGreaterThan(linearAt(20));
  });

  it("folds charactersRemoved in as extra virtual pulls (Dread's +3-per-character re-stack rule)", () => {
    // BLOCKS_PER_REMOVED_CHARACTER is 3, so 1 character removed should behave
    // exactly like starting 3 pulls further into the same curve.
    const withOffset = computeDangerProbability(0, 1, 25);
    const equivalentPulls = computeDangerProbability(3, 0, 25);
    expect(withOffset).toBe(equivalentPulls);
  });

  it("escalates cumulatively across multiple collapses, never resetting to the easiest state", () => {
    const afterOne = computeDangerProbability(0, 1, 25);
    const afterTwo = computeDangerProbability(0, 2, 25);
    expect(afterTwo).toBeGreaterThan(afterOne);
  });

  it("stays strictly within (0, 1) even well past towerSize, with no hard cap needed", () => {
    const p = computeDangerProbability(100, 0, 25);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    expect(p).toBeGreaterThan(0.99);
  });
});

describe("getWheelWedges", () => {
  it("returns 2 * wedgePairs wedges, alternating success/death, defaulting to WEDGE_PAIRS", () => {
    const wedges = getWheelWedges(0.5);
    expect(wedges).toHaveLength(2 * WEDGE_PAIRS);
    wedges.forEach((wedge, i) => {
      expect(wedge.type).toBe(i % 2 === 0 ? "success" : "death");
    });
  });

  it("splits each type's total angular share evenly among its own wedges", () => {
    const dangerProbability = 0.3;
    const wedges = getWheelWedges(dangerProbability, 4);

    const deathTotal = wedges
      .filter((w) => w.type === "death")
      .reduce((sum, w) => sum + w.angleFraction, 0);
    const successTotal = wedges
      .filter((w) => w.type === "success")
      .reduce((sum, w) => sum + w.angleFraction, 0);

    expect(deathTotal).toBeCloseTo(dangerProbability, 10);
    expect(successTotal).toBeCloseTo(1 - dangerProbability, 10);
  });

  it("grows the death share and shrinks the success share as dangerProbability rises", () => {
    const low = getWheelWedges(0.1, 3);
    const high = getWheelWedges(0.8, 3);

    expect(high[1].angleFraction).toBeGreaterThan(low[1].angleFraction); // death wedge
    expect(high[0].angleFraction).toBeLessThan(low[0].angleFraction); // success wedge
  });

  it("respects a custom wedgePairs count", () => {
    const wedges = getWheelWedges(0.5, 2);
    expect(wedges).toHaveLength(4);
  });
});
