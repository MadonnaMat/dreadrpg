import { Application } from "@pixi/react";
import { WheelGraphics } from "./WheelGraphics";
import Chat from "./Chat";
import Scenario from "./Scenario";
import CharacterSheet from "./CharacterSheet";
import { usePeer } from "../providers/PeerProvider";
import { useWheel } from "../providers/WheelProvider";
import { useEffect, useState } from "react";

export default function GameLoaded() {
  const { peerId, isGM, conn, sendToPeers } = usePeer();
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
  const [activeTab, setActiveTab] = useState("game");

  useEffect(() => {
    setTimeout(() => {
      setInternalWheelState(wheelState);
    }, 10);
  }, [wheelState]);

  const [sendOnce, setSendOnce] = useState(false);

  // Send refetch message 100ms after game loads (for non-GM clients)
  useEffect(() => {
    if (!isGM && conn && !sendOnce) {
      setSendOnce(true);
      const timer = setTimeout(() => {
        sendToPeers({
          type: "refetch-request",
          peerId: peerId,
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isGM, conn, sendToPeers, peerId, sendOnce]);

  return (
    <div className="App">
      <h1>Dread RPG</h1>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "game" ? "active" : ""}`}
          onClick={() => setActiveTab("game")}
        >
          Game
        </button>
        <button
          className={`tab-button ${activeTab === "scenario" ? "active" : ""}`}
          onClick={() => setActiveTab("scenario")}
        >
          Scenario
        </button>
        <button
          className={`tab-button ${activeTab === "characters" ? "active" : ""}`}
          onClick={() => setActiveTab("characters")}
        >
          Characters
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "game" && (
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
        )}

        {activeTab === "scenario" && <Scenario />}
        {activeTab === "characters" && <CharacterSheet />}
      </div>
    </div>
  );
}
