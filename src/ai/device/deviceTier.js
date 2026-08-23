import { MODEL_TIERS } from "../../constants/aiModels";

// Raw, unopinionated capability signals read straight from the browser.
// Kept separate from recommendTier() below so the actual decision logic
// stays pure and unit-testable without touching navigator/WebGPU at all.
export async function getRawCapabilitySignals() {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  let adapterAvailable = false;
  if (hasWebGpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      adapterAvailable = Boolean(adapter);
    } catch {
      // Some browsers expose navigator.gpu but fail/reject here - treat
      // exactly like "no adapter", not an error.
      adapterAvailable = false;
    }
  }
  return {
    hasWebGpu,
    adapterAvailable,
    // Chrome caps this at 8 for fingerprinting resistance and other
    // browsers don't implement it at all - treat as a coarse, optional
    // hint, never the sole signal.
    deviceMemoryGB:
      typeof navigator !== "undefined" && navigator.deviceMemory
        ? navigator.deviceMemory
        : null,
    hardwareConcurrency:
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : null,
  };
}

// Pure decision table: signals in, a MODEL_TIERS value out. Deliberately
// conservative - ambiguous or missing signals never resolve to LARGE, since
// downloading a multi-gigabyte model onto a device that can't run it well
// is a much worse failure mode than under-recommending a smaller one the
// user can manually upgrade from in the settings UI.
export function recommendTier(signals) {
  if (!signals?.hasWebGpu || !signals?.adapterAvailable) {
    return MODEL_TIERS.UNSUPPORTED;
  }

  const { deviceMemoryGB, hardwareConcurrency } = signals;

  if (deviceMemoryGB !== null && deviceMemoryGB <= 4) {
    return MODEL_TIERS.SMALL;
  }

  if (
    deviceMemoryGB !== null &&
    deviceMemoryGB >= 8 &&
    hardwareConcurrency !== null &&
    hardwareConcurrency >= 8
  ) {
    return MODEL_TIERS.LARGE;
  }

  return MODEL_TIERS.MEDIUM;
}
