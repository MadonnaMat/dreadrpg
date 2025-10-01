import { Application } from "@pixi/react";
import { WheelGraphics } from "./WheelGraphics";
import Chat from "./Chat";
import { usePeer } from "../providers/PeerProvider";
import { useWheel } from "../providers/WheelProvider";
import { useEffect, useState } from "react";

export default function GameLoaded() {
  const { peerId, isGM, conn } = usePeer();
  const {
    wheelState,
    result,
    spinning,
    spinAngle,
    pointerIdx,
    setSpinAngle,
    setSpinning,
    setPointerIdx,
    spinStartRef,
    spinTargetAngleRef,
    spinResultIdxRef,
    handleSpin,
    handleSpinEnd,
  } = useWheel();

  const [internalWheelState, setInternalWheelState] = useState(wheelState);
  useEffect(() => {
    setTimeout(() => {
      setInternalWheelState(wheelState);
    }, 10);
  }, [wheelState]);

  return (
    <div className="App">
      <h1>Dread RPG</h1>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <div id="wheel-section">
          <Application width={300} height={300} backgroundAlpha={0}>
            <WheelGraphics
              wheelState={internalWheelState}
              spinning={spinning}
              spinAngle={spinAngle}
              pointerIdx={pointerIdx}
              setSpinAngle={setSpinAngle}
              setSpinning={setSpinning}
              setPointerIdx={setPointerIdx}
              spinStartRef={spinStartRef}
              spinTargetAngleRef={spinTargetAngleRef}
              spinResultIdxRef={spinResultIdxRef}
              onSpinEnd={handleSpinEnd}
              conn={conn}
              isGM={isGM}
              peerId={peerId}
            />
          </Application>
          <button id="spin-btn" onClick={handleSpin} disabled={spinning}>
            Spin the Wheel!
          </button>
          <div id="result">{result}</div>
        </div>
        <Chat />
      </div>
    </div>
  );
}
