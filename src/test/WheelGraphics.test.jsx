import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { WheelGraphics } from "../components/WheelGraphics";

let tickCallback;

vi.mock("@pixi/react", () => ({
  useTick: vi.fn((cb) => {
    tickCallback = cb;
  }),
}));

function renderWheel(overrides = {}) {
  const props = {
    wheelState: ["success", "death", "success"],
    spinning: false,
    spinAngle: 0,
    setSpinAngle: vi.fn(),
    setSpinning: vi.fn(),
    setPointerIdx: vi.fn(),
    spinStartRef: { current: null },
    spinTargetAngleRef: { current: 0 },
    onSpinEnd: vi.fn(),
    ...overrides,
  };
  const utils = render(<WheelGraphics {...props} />);
  return { ...utils, props };
}

describe("WheelGraphics Component", () => {
  beforeEach(() => {
    tickCallback = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a tick callback via useTick", () => {
    renderWheel();
    expect(tickCallback).toBeInstanceOf(Function);
  });

  it("does nothing on tick while not spinning", () => {
    const { props } = renderWheel({ spinning: false });

    tickCallback();

    expect(props.setSpinAngle).not.toHaveBeenCalled();
    expect(props.setSpinning).not.toHaveBeenCalled();
  });

  it("animates spinAngle towards the target while spinning", () => {
    const start = 1000;
    vi.spyOn(performance, "now").mockReturnValue(start + 500); // 0.5s elapsed

    const { props } = renderWheel({
      spinning: true,
      spinStartRef: { current: start },
      spinTargetAngleRef: { current: Math.PI },
    });

    tickCallback();

    expect(props.setSpinAngle).toHaveBeenCalled();
    expect(props.setSpinning).not.toHaveBeenCalled();
  });

  it("finishes the spin, snaps to the target angle, and reports a result once the duration elapses", () => {
    const start = 1000;
    vi.spyOn(performance, "now").mockReturnValue(start + 5000); // 5s elapsed (duration)

    const targetAngle = Math.PI / 2;
    const { props } = renderWheel({
      spinning: true,
      spinStartRef: { current: start },
      spinTargetAngleRef: { current: targetAngle },
    });

    tickCallback();

    expect(props.setSpinning).toHaveBeenCalledWith(false);
    expect(props.setSpinAngle).toHaveBeenCalledWith(targetAngle);
    expect(props.setPointerIdx).toHaveBeenCalled();
    // The test refs are plain DOM nodes with no `containsPoint`, so hit-testing
    // never finds a wedge and onSpinEnd is called with a null selection.
    expect(props.onSpinEnd).toHaveBeenCalledWith(null, props.wheelState.length);
  });
});
