import { Application } from "@pixi/react";
import { WheelGraphics } from "./WheelGraphics";
import Chat from "./Chat";
import Scenario from "./Scenario";
import CharacterSheet from "./CharacterSheet";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useEffect, useState } from "react";

export default function GameLoaded() {
  const { peerId, isGM, conn, sendToPeers } = usePeer();
  const {
    wedges,
    dangerProbability,
    awaitingReset,
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
    handleRestack,
  } = useWheel();

  const [internalWedges, setInternalWedges] = useState(wedges);
  const [activeTab, setActiveTab] = useState("game");

  useEffect(() => {
    setTimeout(() => {
      setInternalWedges(wedges);
    }, 10);
  }, [wedges]);

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
                  wedges={internalWedges}
                  dangerProbability={dangerProbability}
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
                  result={result}
                  awaitingReset={awaitingReset}
                  conn={conn}
                  isGM={isGM}
                  peerId={peerId}
                />
              </Application>
              {!awaitingReset && (
                <button id="spin-btn" onClick={handleSpin} disabled={spinning}>
                  Spin the Wheel!
                </button>
              )}
              {isGM && awaitingReset && (
                <button id="restack-btn" onClick={handleRestack}>
                  Re-stack Tower
                </button>
              )}
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
