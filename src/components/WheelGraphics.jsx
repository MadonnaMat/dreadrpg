import { useRef, useEffect } from "react";
import { useTick } from "@pixi/react";

export function WheelGraphics({
  wheelState,
  spinning,
  spinAngle,
  pointerIdx,
  setSpinAngle,
  setSpinning,
  setPointerIdx,
  spinStartRef,
  spinTargetAngleRef,
  spinResultIdxRef,
  onSpinEnd,
  conn,
  isGM,
  peerId,
}) {
  const wedgeRefs = useRef([]);
  // Ensure animation runs when spinning is set to true
  useEffect(() => {
    if (spinning && spinStartRef.current == null) {
      spinStartRef.current = performance.now();
    }
  }, [spinning]);

  useTick(() => {
    if (!spinning) return;
    const duration = 5; // seconds
    // Ensure spinStartRef.current is set
    if (!spinStartRef.current) {
      spinStartRef.current = performance.now();
    }
    const now = performance.now();
    const elapsed = (now - spinStartRef.current) / 1000;
    if (elapsed >= duration) {
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
      if (onSpinEnd) onSpinEnd(selectedIdx, wheelState.length);
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
  const wedges = wheelState.length;
  const angle = (2 * Math.PI) / wedges;
  return (
    <>
      {/* Draw each wedge as a separate pixiGraphics */}
      {wheelState.map((state, i) => (
        <pixiGraphics
          key={i}
          ref={(el) => (wedgeRefs.current[i] = el)}
          x={150}
          y={150}
          pivot={{ x: 150, y: 150 }}
          rotation={spinAngle}
          draw={(g) => {
            g.clear();
            g.beginFill(state === "death" ? 0xcc0000 : 0x00cc00);
            g.moveTo(150, 150);
            g.arc(150, 150, 140, angle * i, angle * (i + 1));
            g.lineTo(150, 150);
            g.endFill();
            g.lineStyle(4, 0x000000);
            g.drawCircle(150, 150, 140);
          }}
        />
      ))}
      {/* Pointer indicator */}
      <pixiGraphics
        x={150}
        y={20}
        draw={(g) => {
          g.clear();
          g.beginFill(0xffd700);
          g.moveTo(0, 0);
          g.lineTo(-15, -30);
          g.lineTo(15, -30);
          g.lineTo(0, 0);
          g.endFill();
        }}
      />
    </>
  );
}
