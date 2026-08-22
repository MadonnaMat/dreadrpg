import { Application } from "@pixi/react";
import { WheelGraphics } from "./WheelGraphics";
import Chat from "./Chat";
import Scenario from "./Scenario";
import CharacterSheet from "./CharacterSheet";
import AdminPanel from "./AdminPanel";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useEffect, useRef, useState } from "react";
import { MESSAGE_TYPES } from "../constants/messageTypes";

export default function GameLoaded() {
  const { peerId, isGM, conn, sendToPeers, gameName } = usePeer();
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

  // Tracks whether the mount-time refetch has actually fired - set only
  // inside the timeout callback itself, never at schedule time. This is
  // deliberate: StrictMode's dev-only mount -> cleanup -> mount replay (and
  // any other rapid remount) cancels a merely-scheduled timer via this
  // effect's own cleanup before its 100ms elapses; if the guard were set at
  // schedule time (or lived in state, forcing a re-render that re-triggers
  // this same effect and its cleanup), that cancelled first attempt would
  // permanently block the surviving remount's attempt too, and the refetch
  // would never fire at all. Marking "sent" only on actual completion means
  // a cancelled attempt leaves the guard untouched, so whichever mount
  // survives long enough to reach 100ms is the one that gets to send it.
  const sentRefetchRef = useRef(false);

  // Send refetch message 100ms after game loads (for non-GM clients)
  useEffect(() => {
    if (isGM || !conn || sentRefetchRef.current) return;
    const timer = setTimeout(() => {
      sentRefetchRef.current = true;
      sendToPeers({
        type: MESSAGE_TYPES.REFETCH_REQUEST,
        peerId: peerId,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isGM, conn, sendToPeers, peerId]);

  return (
    <div className="App">
      <h1>Dread RPG</h1>
      {gameName && <h2>{gameName}</h2>}

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
        {isGM && (
          <button
            className={`tab-button ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            Admin
          </button>
        )}
      </div>

      {/* Tab Content - all panels stay mounted regardless of which tab is
          active, only visibility toggles. Scenario/CharacterSheet/Chat each
          register a handler for their own live network messages only while
          mounted; unmounting on every tab switch would silently drop any
          broadcast that arrives while a player isn't looking at that tab. */}
      <div className="tab-content">
        <div
          style={{
            display: activeTab === "game" ? "flex" : "none",
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

        <div style={{ display: activeTab === "scenario" ? "block" : "none" }}>
          <Scenario />
        </div>
        <div style={{ display: activeTab === "characters" ? "block" : "none" }}>
          <CharacterSheet />
        </div>
        {isGM && (
          <div style={{ display: activeTab === "admin" ? "block" : "none" }}>
            <AdminPanel showRoster={false} />
          </div>
        )}
      </div>
    </div>
  );
}
