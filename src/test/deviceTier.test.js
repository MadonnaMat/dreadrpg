import { describe, it, expect } from "vitest";
import {
  getRawCapabilitySignals,
  recommendTier,
} from "../ai/device/deviceTier";
import { MODEL_TIERS } from "../constants/aiModels";

describe("recommendTier", () => {
  it("returns UNSUPPORTED when the browser has no navigator.gpu at all", () => {
    expect(
      recommendTier({
        hasWebGpu: false,
        adapterAvailable: false,
        deviceMemoryGB: 16,
        hardwareConcurrency: 16,
      })
    ).toBe(MODEL_TIERS.UNSUPPORTED);
  });

  it("returns UNSUPPORTED when navigator.gpu exists but requestAdapter() resolved null", () => {
    expect(
      recommendTier({
        hasWebGpu: true,
        adapterAvailable: false,
        deviceMemoryGB: 16,
        hardwareConcurrency: 16,
      })
    ).toBe(MODEL_TIERS.UNSUPPORTED);
  });

  it("returns SMALL for a low-memory device", () => {
    expect(
      recommendTier({
        hasWebGpu: true,
        adapterAvailable: true,
        deviceMemoryGB: 4,
        hardwareConcurrency: 4,
      })
    ).toBe(MODEL_TIERS.SMALL);
  });

  it("returns LARGE only when both memory and core-count signals are strong", () => {
    expect(
      recommendTier({
        hasWebGpu: true,
        adapterAvailable: true,
        deviceMemoryGB: 8,
        hardwareConcurrency: 8,
      })
    ).toBe(MODEL_TIERS.LARGE);
  });

  it("defaults to MEDIUM rather than LARGE when memory/cores are unknown (null)", () => {
    expect(
      recommendTier({
        hasWebGpu: true,
        adapterAvailable: true,
        deviceMemoryGB: null,
        hardwareConcurrency: null,
      })
    ).toBe(MODEL_TIERS.MEDIUM);
  });

  it("defaults to MEDIUM for a mid-range device that clears WebGPU but not the LARGE bar", () => {
    expect(
      recommendTier({
        hasWebGpu: true,
        adapterAvailable: true,
        deviceMemoryGB: 8,
        hardwareConcurrency: 4,
      })
    ).toBe(MODEL_TIERS.MEDIUM);
  });
});

describe("getRawCapabilitySignals", () => {
  it("resolves without throwing and returns the expected shape under happy-dom (no real WebGPU)", async () => {
    const signals = await getRawCapabilitySignals();
    expect(signals).toEqual(
      expect.objectContaining({
        hasWebGpu: expect.any(Boolean),
        adapterAvailable: expect.any(Boolean),
      })
    );
    expect(
      signals.deviceMemoryGB === null ||
        typeof signals.deviceMemoryGB === "number"
    ).toBe(true);
  });
});
