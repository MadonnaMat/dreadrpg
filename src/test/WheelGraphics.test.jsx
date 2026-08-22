import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { WheelGraphics } from "../components/WheelGraphics";

let tickCallback;

vi.mock("@pixi/react", () => ({
  useTick: vi.fn((cb) => {
    tickCallback = cb;
  }),
}));

function renderWheel(overrides = {}) {
  const props = {
    wedges: [
      { type: "success", angleFraction: 0.5 },
      { type: "death", angleFraction: 0.2 },
      { type: "success", angleFraction: 0.3 },
    ],
    dangerProbability: 0.2,
    spinning: false,
    spinAngle: 0,
    setSpinAngle: vi.fn(),
    setSpinning: vi.fn(),
    setPointerIdx: vi.fn(),
    spinStartRef: { current: null },
    spinTargetAngleRef: { current: 0 },
    onSpinEnd: vi.fn(),
    result: "",
    awaitingReset: false,
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

  it("does nothing on tick while not spinning and no result change", () => {
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
    expect(props.onSpinEnd).toHaveBeenCalledWith(null, props.wedges.length);
  });

  it("does not touch the main spin state while playing a post-success shake", () => {
    const { rerender, props } = renderWheel({ result: "" });

    act(() => {
      rerender(<WheelGraphics {...props} result="Success!" spinning={false} />);
    });
    act(() => {
      tickCallback();
    });

    // The shake is a purely local visual effect on top of the idle wheel -
    // it must never call the main spin-state setters.
    expect(props.setSpinAngle).not.toHaveBeenCalled();
    expect(props.setSpinning).not.toHaveBeenCalled();
  });

  it("does not touch the main spin state while holding the death overlay", () => {
    const { rerender, props } = renderWheel({ result: "" });

    act(() => {
      rerender(
        <WheelGraphics
          {...props}
          result="You Died!"
          awaitingReset={true}
          spinning={false}
        />
      );
    });
    act(() => {
      tickCallback();
    });

    expect(props.setSpinAngle).not.toHaveBeenCalled();
    expect(props.setSpinning).not.toHaveBeenCalled();
  });

  it("tolerates repeated ticks across a full death -> re-stack cycle without throwing", () => {
    const { rerender, props } = renderWheel({ result: "" });

    act(() => {
      rerender(
        <WheelGraphics {...props} result="You Died!" awaitingReset={true} />
      );
    });
    expect(() => act(() => tickCallback())).not.toThrow();

    act(() => {
      rerender(
        <WheelGraphics {...props} result="You Died!" awaitingReset={false} />
      );
    });
    expect(() => act(() => tickCallback())).not.toThrow();
  });
});
