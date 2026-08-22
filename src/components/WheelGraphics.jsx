import { useRef, useEffect, useState } from "react";
import { useTick } from "@pixi/react";
import { WEDGE_TYPES, SUCCESS_TEXT } from "../constants/wheelOutcomes";

const CENTER = 150;
const RADIUS = 140;
const SHAKE_DURATION = 0.5; // seconds
const SHAKE_MAX_AMPLITUDE = 10; // pixels, at dangerProbability === 1
const DEATH_FLASH_DURATION = 1.2; // seconds, flicker window before holding solid
const DEATH_FLASH_CYCLES = 4;

// Lerp an RGB color from neutral white towards red as danger rises.
function dangerTintColor(dangerProbability) {
  const t = Math.max(0, Math.min(1, dangerProbability));
  const g = Math.round(0xff * (1 - t));
  const b = Math.round(0xff * (1 - t));
  return (0xff << 16) | (g << 8) | b;
}

export function WheelGraphics({
  wedges,
  dangerProbability = 0,
  spinning,
  spinAngle,
  setSpinAngle,
  setSpinning,
  setPointerIdx,
  spinStartRef,
  spinTargetAngleRef,
  onSpinEnd,
  result,
  awaitingReset,
}) {
  const wedgeRefs = useRef([]);
  const lastResultRef = useRef(result);
  const shakeStartRef = useRef(null);
  const shakeOffsetRef = useRef({ x: 0, y: 0 });
  const deathFlashStartRef = useRef(null);
  // These two only exist to force a re-render on frames where the shake or
  // death-flash overlay needs to visually update; their value is unused.
  const [, forceShakeRerender] = useState(0);
  const [, forceFlashRerender] = useState(0);

  // Ensure animation runs when spinning is set to true
  useEffect(() => {
    if (spinning && spinStartRef.current == null) {
      spinStartRef.current = performance.now();
    }
  }, [spinning, spinStartRef]);

  // Trigger a shake whenever a fresh "Success!" result comes in, and a
  // death-flash sequence for any other (non-empty) result - death text is
  // now a per-character message ("<name> Died!"), not a fixed string, so
  // "anything but success" is the only reliable death check here.
  useEffect(() => {
    if (result && result !== lastResultRef.current) {
      if (result === SUCCESS_TEXT) {
        shakeStartRef.current = performance.now();
      } else {
        deathFlashStartRef.current = performance.now();
      }
    }
    lastResultRef.current = result;
  }, [result]);

  useTick(() => {
    if (shakeStartRef.current != null) {
      const shakeElapsed = (performance.now() - shakeStartRef.current) / 1000;
      if (shakeElapsed >= SHAKE_DURATION) {
        shakeStartRef.current = null;
        shakeOffsetRef.current = { x: 0, y: 0 };
      } else {
        const decay = 1 - shakeElapsed / SHAKE_DURATION;
        const amplitude = SHAKE_MAX_AMPLITUDE * dangerProbability * decay;
        const wobble = shakeElapsed * 40;
        shakeOffsetRef.current = {
          x: Math.sin(wobble) * amplitude,
          y: Math.cos(wobble * 1.3) * amplitude,
        };
      }
      forceShakeRerender((n) => n + 1);
    }

    if (deathFlashStartRef.current != null) {
      const flashElapsed =
        (performance.now() - deathFlashStartRef.current) / 1000;
      if (flashElapsed >= DEATH_FLASH_DURATION) {
        // Flicker window is over; the overlay now just tracks awaitingReset
        // directly (a normal prop), so no more forced re-renders are needed.
        deathFlashStartRef.current = null;
      }
      forceFlashRerender((n) => n + 1);
    }

    if (!spinning) return;
    const duration = 5; // seconds
    // Ensure spinStartRef.current is set
    if (!spinStartRef.current) {
      spinStartRef.current = performance.now();
    }
    const now = performance.now();
    const elapsed = (now - spinStartRef.current) / 1000;
    if (elapsed >= duration) {
      // Null this out immediately: the ticker can fire again on the very
      // next animation frame before React commits setSpinning(false), and
      // without this guard that second tick would re-enter this branch and
      // call onSpinEnd a second time for the same spin.
      spinStartRef.current = null;
      setSpinning(false);
      setSpinAngle(spinTargetAngleRef.current);
      // Use PixiJS hit testing to find which wedge contains the pointer
      const pointer = { x: 150, y: 20 };
      let selectedIdx = null;
      for (let i = 0; i < wedgeRefs.current.length; i++) {
        const wedge = wedgeRefs.current[i];
        if (wedge && wedge.containsPoint) {
          // Transform pointer to wheel's local coordinates
          const local = {
            x: pointer.x - 150,
            y: pointer.y - 150,
          };
          // Rotate local point by -spinAngle
          const cos = Math.cos(-spinAngle);
          const sin = Math.sin(-spinAngle);
          const rx = local.x * cos - local.y * sin + 150;
          const ry = local.x * sin + local.y * cos + 150;
          if (wedge.containsPoint({ x: rx, y: ry })) {
            selectedIdx = i;
            break;
          }
        }
      }
      setPointerIdx(selectedIdx);
      if (onSpinEnd) onSpinEnd(selectedIdx, wedges.length);
      return;
    }
    // Ease out cubic
    const t = elapsed / duration;
    const ease = 1 - Math.pow(1 - t, 3);
    // Animate from current angle to target angle
    const currentAngle = spinStartRef.currentAngle || 0;
    const target = spinTargetAngleRef.current;
    setSpinAngle(currentAngle * (1 - ease) + target * ease);
  });

  // Cumulative start angle for each wedge, built from its own angleFraction
  // rather than an equal division - this is what makes death wedges visibly
  // grow/shrink in place as dangerProbability changes.
  const wedgeAngles = [];
  let cursor = 0;
  for (const wedge of wedges) {
    const start = cursor;
    const end = cursor + wedge.angleFraction * 2 * Math.PI;
    wedgeAngles.push({ start, end });
    cursor = end;
  }

  const ringColor = dangerTintColor(dangerProbability);
  const shakeOffset = shakeOffsetRef.current;

  let deathFlashOn = false;
  if (awaitingReset) {
    if (deathFlashStartRef.current == null) {
      deathFlashOn = true; // flicker window finished, hold solid
    } else {
      const flashElapsed =
        (performance.now() - deathFlashStartRef.current) / 1000;
      const cyclePos =
        (flashElapsed / DEATH_FLASH_DURATION) * DEATH_FLASH_CYCLES;
      deathFlashOn = Math.floor(cyclePos) % 2 === 0;
    }
  }

  return (
    <>
      {/* Draw each wedge as a separate pixiGraphics */}
      {wedges.map((wedge, i) => (
        <pixiGraphics
          key={i}
          ref={(el) => (wedgeRefs.current[i] = el)}
          x={CENTER + shakeOffset.x}
          y={CENTER + shakeOffset.y}
          pivot={{ x: CENTER, y: CENTER }}
          rotation={spinAngle}
          draw={(g) => {
            g.clear();
            const { start, end } = wedgeAngles[i];
            g.moveTo(CENTER, CENTER);
            g.arc(CENTER, CENTER, RADIUS, start, end);
            g.lineTo(CENTER, CENTER);
            g.fill(wedge.type === WEDGE_TYPES.DEATH ? 0xcc0000 : 0x00cc00);
            g.moveTo(CENTER, CENTER);
            g.arc(CENTER, CENTER, RADIUS, start, end);
            g.lineTo(CENTER, CENTER);
            g.stroke({ color: 0xffffff, width: 1 });
            g.circle(CENTER, CENTER, RADIUS);
            g.stroke({ color: ringColor, width: 4 });
          }}
        />
      ))}
      {/* Death-collapse overlay: flickers, then holds until the GM re-stacks */}
      {deathFlashOn && (
        <pixiGraphics
          x={CENTER + shakeOffset.x}
          y={CENTER + shakeOffset.y}
          draw={(g) => {
            g.clear();
            g.circle(0, 0, RADIUS);
            g.fill({ color: 0x990000, alpha: 0.55 });
          }}
        />
      )}
      {/* Pointer indicator */}
      <pixiGraphics
        x={150}
        y={20}
        draw={(g) => {
          g.clear();
          g.moveTo(0, 0);
          g.lineTo(-15, -30);
          g.lineTo(15, -30);
          g.lineTo(0, 0);
          g.fill(0xffd700);
        }}
      />
    </>
  );
}
