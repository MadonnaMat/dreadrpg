import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWheelMessageHandler } from "../providers/wheel/wheelMessageHandler";

function makeSetters() {
  return {
    handleHostSpin: vi.fn(),
    spinStartRef: {},
    spinTargetAngleRef: {},
    setSpinning: vi.fn(),
    setResult: vi.fn(),
    setPointerIdx: vi.fn(),
    setSpinAngle: vi.fn(),
    setDangerProbability: vi.fn(),
    setAwaitingReset: vi.fn(),
    setShowWheel: vi.fn(),
  };
}

describe("createWheelMessageHandler", () => {
  let setters;

  beforeEach(() => {
    setters = makeSetters();
  });

  it("GM: forwards a spin-request to handleHostSpin", () => {
    const handler = createWheelMessageHandler({ isGM: true, ...setters });
    handler({ type: "spin-request", peerId: "abc" });

    expect(setters.handleHostSpin).toHaveBeenCalledWith("abc");
    expect(setters.setShowWheel).toHaveBeenCalledWith(true);
  });

  it("GM: ignores non spin-request messages", () => {
    const handler = createWheelMessageHandler({ isGM: true, ...setters });
    handler({ type: "spin", result: "death" });

    expect(setters.handleHostSpin).not.toHaveBeenCalled();
  });

  it("player: spin-start primes the local animation refs and clears the result", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "spin-start", currentAngle: 1, targetAngle: 5 });

    expect(setters.spinTargetAngleRef.current).toBe(5);
    expect(setters.spinStartRef.currentAngle).toBe(1);
    expect(setters.setSpinning).toHaveBeenCalledWith(true);
    expect(setters.setResult).toHaveBeenCalledWith("");
    expect(setters.setPointerIdx).toHaveBeenCalledWith(null);
  });

  it("player: a death spin broadcast sets dangerProbability, awaitingReset, and result text", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({
      type: "spin",
      result: "death",
      awaitingReset: true,
    });

    expect(setters.setAwaitingReset).toHaveBeenCalledWith(true);
    expect(setters.setResult).toHaveBeenCalledWith("You Died!");
  });

  it("player: a success spin broadcast sets dangerProbability and result text", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({
      type: "spin",
      result: "success",
      dangerProbability: 0.42,
    });

    expect(setters.setDangerProbability).toHaveBeenCalledWith(0.42);
    expect(setters.setResult).toHaveBeenCalledWith("Success!");
  });

  it("player: spin-final snaps the angle and stops spinning", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "spin-final", finalAngle: 12.5 });

    expect(setters.setSpinAngle).toHaveBeenCalledWith(12.5);
    expect(setters.setSpinning).toHaveBeenCalledWith(false);
  });

  it("player: wheel-reset applies the restacked danger state", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({
      type: "wheel-reset",
      dangerProbability: 0,
      awaitingReset: false,
    });

    expect(setters.setDangerProbability).toHaveBeenCalledWith(0);
    expect(setters.setAwaitingReset).toHaveBeenCalledWith(false);
  });

  it("player: a welcome/game-data-sync snapshot syncs danger state only", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "welcome", dangerProbability: 0.3, awaitingReset: true });

    expect(setters.setDangerProbability).toHaveBeenCalledWith(0.3);
    expect(setters.setAwaitingReset).toHaveBeenCalledWith(true);
    expect(setters.setResult).not.toHaveBeenCalled();
  });
});
