import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWheelMessageHandler } from "../providers/wheel/wheelMessageHandler";

function makeSetters() {
  return {
    handleHostSpin: vi.fn(),
    handleHostDecline: vi.fn(),
    spinStartRef: {},
    spinTargetAngleRef: {},
    setSpinning: vi.fn(),
    setResult: vi.fn(),
    setPointerIdx: vi.fn(),
    setSpinAngle: vi.fn(),
    setDangerProbability: vi.fn(),
    setAwaitingReset: vi.fn(),
    setDesignatedSpinner: vi.fn(),
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
  });

  it("GM: ignores non spin-request/spin-decline messages", () => {
    const handler = createWheelMessageHandler({ isGM: true, ...setters });
    handler({ type: "spin", result: "death" });

    expect(setters.handleHostSpin).not.toHaveBeenCalled();
    expect(setters.handleHostDecline).not.toHaveBeenCalled();
  });

  it("GM: forwards a spin-decline to handleHostDecline", () => {
    const handler = createWheelMessageHandler({ isGM: true, ...setters });
    handler({ type: "spin-decline" });

    expect(setters.handleHostDecline).toHaveBeenCalled();
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
      resultText: "Alice Died!",
      awaitingReset: true,
      designatedSpinner: null,
    });

    expect(setters.setAwaitingReset).toHaveBeenCalledWith(true);
    expect(setters.setResult).toHaveBeenCalledWith("Alice Died!");
    expect(setters.setDesignatedSpinner).toHaveBeenCalledWith(null);
  });

  it("player: a success spin broadcast sets dangerProbability and result text", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({
      type: "spin",
      result: "success",
      resultText: "Success!",
      dangerProbability: 0.42,
    });

    expect(setters.setDangerProbability).toHaveBeenCalledWith(0.42);
    expect(setters.setResult).toHaveBeenCalledWith("Success!");
  });

  it("player: a spin-assign broadcast sets the designated spinner", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "spin-assign", targetUserName: "Alice" });

    expect(setters.setDesignatedSpinner).toHaveBeenCalledWith("Alice");
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
    expect(setters.setShowWheel).not.toHaveBeenCalled();
  });

  it("player: a game-started broadcast reveals the wheel", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "game-started" });

    expect(setters.setShowWheel).toHaveBeenCalledWith(true);
  });

  it("player: a welcome/game-data-sync snapshot with gameStarted reveals the wheel", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "game-data-sync", gameStarted: true });

    expect(setters.setShowWheel).toHaveBeenCalledWith(true);
  });

  it("player: a snapshot without gameStarted does not reveal the wheel", () => {
    const handler = createWheelMessageHandler({ isGM: false, ...setters });
    handler({ type: "game-data-sync", gameStarted: false });

    expect(setters.setShowWheel).not.toHaveBeenCalled();
  });
});
