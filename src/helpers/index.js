// Helper for wheel danger-probability calculation and wedge geometry.
import { WEDGE_TYPES } from "../constants/wheelOutcomes";

// Dread's rule for re-stacking the tower after it collapses: "three
// additional blocks for every character removed from the game." A collapse
// must never make the next tower easier than the last one, so a restack is
// modeled as extra "virtual" pulls already spent before play resumes.
// See docs/rules/quick-reference.md.
const BLOCKS_PER_REMOVED_CHARACTER = 3;

// A real Jenga tower stays comfortably stable through most of its pulls and
// then gets sharply, suddenly dangerous near the end - not a flat linear
// climb. These two constants shape that S-curve: danger crosses 50% once
// virtualPulls reaches HAZARD_MIDPOINT_FRACTION of towerSize, and
// HAZARD_STEEPNESS controls how sharp the rise around that point is.
const HAZARD_MIDPOINT_FRACTION = 0.6;
const HAZARD_STEEPNESS = 8;

// Fixed number of alternating success/death wedge pairs drawn on the wheel
// (a "pinwheel"). Each type's total angular share always equals its
// probability, split evenly among that type's wedges - so the wheel still
// reads as multiple distinct blocks instead of one fused slice.
export const WEDGE_PAIRS = 6;

export function computeDangerProbability(
  pullsSinceReset,
  charactersRemoved,
  towerSize
) {
  const virtualPulls =
    pullsSinceReset + BLOCKS_PER_REMOVED_CHARACTER * charactersRemoved;
  const x = virtualPulls / towerSize;
  return 1 / (1 + Math.exp(-HAZARD_STEEPNESS * (x - HAZARD_MIDPOINT_FRACTION)));
}

export function getWheelWedges(dangerProbability, wedgePairs = WEDGE_PAIRS) {
  const deathShare = dangerProbability / wedgePairs;
  const successShare = (1 - dangerProbability) / wedgePairs;
  const wedges = [];
  for (let i = 0; i < wedgePairs; i++) {
    wedges.push({ type: WEDGE_TYPES.SUCCESS, angleFraction: successShare });
    wedges.push({ type: WEDGE_TYPES.DEATH, angleFraction: deathShare });
  }
  return wedges;
}
