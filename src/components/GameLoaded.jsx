import { Application } from "@pixi/react";
import { WheelGraphics } from "./WheelGraphics";
import Chat from "./Chat";
import Scenario from "./Scenario";
import CharacterSheet from "./CharacterSheet";
import AdminPanel from "./AdminPanel";
import CampaignNotes from "./CampaignNotes";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useAutoGm } from "../hooks/useAutoGm";
import {
  characterNameFor,
  formatNameForList,
  isCharacterAlive,
} from "../helpers/characters";
import { buildRejoinUrl } from "../helpers/rejoinLink";
import { getWheelColors } from "../constants/themes";
import { useEffect, useRef, useState } from "react";
import { MESSAGE_TYPES } from "../constants/messageTypes";

// The GM's "who spins next" picker, split out of SpinControls purely to
// keep that component's own branching complexity down. Never shown once
// AutoGM is enabled - it decides when a pull is warranted itself (see
// AutoGmProvider.jsx's turn loop); disabling AutoGM (Admin Panel) is the
// intended way for a human GM to take manual control back.
function SpinAssignForm({ users, characters, hostName, assignSpinner }) {
  const [selectedName, setSelectedName] = useState("");
  const [requiredPulls, setRequiredPulls] = useState(1);

  // A dead character can't be asked to spin again - but a player can end up
  // with *multiple* assigned characters over a game (a dead one, kept as a
  // historical record, plus whatever they picked afterward via
  // CharacterPicker), so this has to check whether *any* of their
  // assignments is still alive, not just the first one found. Someone with
  // no character assigned at all remains selectable too.
  const eligibleNames = Object.values(users || {}).filter((name) => {
    const assignedCharacters = Object.values(characters || {}).filter(
      (c) => c.assignedTo === name
    );
    return (
      assignedCharacters.length === 0 ||
      assignedCharacters.some(isCharacterAlive)
    );
  });

  return (
    <div id="spin-assign-section">
      <select
        className="pregame-input"
        value={selectedName}
        onChange={(e) => setSelectedName(e.target.value)}
      >
        <option value="">Choose a player...</option>
        {eligibleNames.map((name) => (
          <option key={name} value={name}>
            {formatNameForList(characters, name, hostName)}
          </option>
        ))}
      </select>
      <input
        id="pulls-required-input"
        className="pregame-input"
        type="number"
        min={1}
        max={10}
        value={requiredPulls}
        onChange={(e) => setRequiredPulls(Number(e.target.value) || 1)}
        title="Pulls required for this action"
      />
      <button
        id="request-pull-btn"
        onClick={() => {
          assignSpinner(selectedName, requiredPulls);
          setSelectedName("");
          setRequiredPulls(1);
        }}
        disabled={!selectedName}
      >
        Request Pull
      </button>
    </div>
  );
}

// The actual Spin/Decline buttons for whoever is currently designated -
// split out of SpinControls purely to keep that component's own branching
// complexity down.
function SpinMyTurnControls({
  handleSpin,
  handleDecline,
  spinning,
  pullsRequired,
  pullsRemaining,
  spinDisabledByThinking,
}) {
  return (
    <>
      <button
        id="spin-btn"
        onClick={handleSpin}
        disabled={spinning || spinDisabledByThinking}
      >
        Spin the Wheel!
      </button>
      <button id="decline-btn" onClick={handleDecline} disabled={spinning}>
        Decline
      </button>
      {pullsRequired > 1 && (
        <p>
          Step {pullsRequired - pullsRemaining + 1} of {pullsRequired}
        </p>
      )}
      {spinDisabledByThinking && (
        <p className="no-character-assigned">
          Waiting for the GM to react to the last pull...
        </p>
      )}
    </>
  );
}

// GM's assign-pull form plus the Spin/Decline buttons, shown only to
// whoever is currently designated - split out of GameLoaded purely to keep
// that component's own branching complexity down.
function SpinControls({
  isGM,
  users,
  characters,
  myName,
  hostName,
  designatedSpinner,
  assignSpinner,
  pullsRequired,
  pullsRemaining,
  handleSpin,
  handleDecline,
  spinning,
  awaitingReset,
  autoGmEnabled,
  autoGmThinking,
}) {
  const isMyTurn = designatedSpinner && myName === designatedSpinner;

  // Once AutoGM is running the GM role, it's the one deciding when a pull
  // is warranted (see AutoGmProvider.jsx's turn loop) - a human GM manually
  // requesting one at the same time would fight with that. Disabling AutoGM
  // (Admin Panel) is the intended way to take manual control back.
  const spinDisabledByThinking = autoGmThinking && pullsRequired > 1;

  return (
    <div id="spin-controls">
      {isGM && !autoGmEnabled && !awaitingReset && !designatedSpinner && (
        <SpinAssignForm
          users={users}
          characters={characters}
          hostName={hostName}
          assignSpinner={assignSpinner}
        />
      )}
      {isGM && !awaitingReset && designatedSpinner && !isMyTurn && (
        <p>
          Waiting on {characterNameFor(characters, designatedSpinner)} to spin
          or decline...
          {pullsRequired > 1 &&
            ` (step ${pullsRequired - pullsRemaining + 1} of ${pullsRequired})`}
        </p>
      )}
      {!awaitingReset && isMyTurn && (
        <SpinMyTurnControls
          handleSpin={handleSpin}
          handleDecline={handleDecline}
          spinning={spinning}
          pullsRequired={pullsRequired}
          pullsRemaining={pullsRemaining}
          spinDisabledByThinking={spinDisabledByThinking}
        />
      )}
    </div>
  );
}

// Lets a joined player (never the GM, who resumes via the homepage list
// instead - see gamePersistence.js) copy a link that logs them back in as
// themselves. Split out purely to keep GameLoaded's own complexity down.
function RejoinLinkButton({ isGM, gameId, userName }) {
  if (isGM) return null;
  return (
    <button
      className="btn-secondary btn-small rejoin-link-btn"
      onClick={() =>
        navigator.clipboard.writeText(buildRejoinUrl(gameId, userName))
      }
    >
      Copy my rejoin link
    </button>
  );
}

// The two GM-only tab buttons (Admin, Campaign Notes) - both self-contained
// on the isGM check (like RejoinLinkButton above) purely to keep
// GameLoaded's own branching complexity down.
function GmOnlyTabButtons({ isGM, activeTab, setActiveTab }) {
  if (!isGM) return null;
  return (
    <>
      <button
        className={`tab-button ${activeTab === "admin" ? "active" : ""}`}
        onClick={() => setActiveTab("admin")}
      >
        Admin
      </button>
      <button
        className={`tab-button ${activeTab === "campaign-notes" ? "active" : ""}`}
        onClick={() => setActiveTab("campaign-notes")}
      >
        Campaign Notes
      </button>
    </>
  );
}

// The two GM-only tab panels (Admin, Campaign Notes) - mirrors
// GmOnlyTabButtons above.
function GmOnlyTabPanels({ isGM, activeTab }) {
  if (!isGM) return null;
  return (
    <>
      <div style={{ display: activeTab === "admin" ? "block" : "none" }}>
        <AdminPanel />
      </div>
      <div
        style={{
          display: activeTab === "campaign-notes" ? "block" : "none",
        }}
      >
        <CampaignNotes />
      </div>
    </>
  );
}

export default function GameLoaded() {
  const {
    peerId,
    isGM,
    conn,
    sendToPeers,
    gameName,
    gameId,
    userName,
    hostName,
    users,
    characters,
    theme,
    customColors,
    autoGmThinking,
  } = usePeer();
  const { autoGmEnabled } = useAutoGm();
  const { success: successColor, death: deathColor } = getWheelColors(
    theme,
    customColors
  );
  const {
    wedges,
    dangerProbability,
    awaitingReset,
    designatedSpinner,
    assignSpinner,
    pullsRequired,
    pullsRemaining,
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
    handleDecline,
    handleSpinEnd,
    handleRestack,
  } = useWheel();
  const myName = userName || hostName;

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
      <RejoinLinkButton isGM={isGM} gameId={gameId} userName={userName} />

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
        <GmOnlyTabButtons
          isGM={isGM}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
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
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: "24px",
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
                successColor={successColor}
                deathColor={deathColor}
              />
            </Application>
            <SpinControls
              isGM={isGM}
              users={users}
              characters={characters}
              myName={myName}
              hostName={hostName}
              designatedSpinner={designatedSpinner}
              assignSpinner={assignSpinner}
              pullsRequired={pullsRequired}
              pullsRemaining={pullsRemaining}
              handleSpin={handleSpin}
              handleDecline={handleDecline}
              spinning={spinning}
              awaitingReset={awaitingReset}
              autoGmEnabled={autoGmEnabled}
              autoGmThinking={autoGmThinking}
            />
            {isGM && !autoGmEnabled && awaitingReset && (
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
        <GmOnlyTabPanels isGM={isGM} activeTab={activeTab} />
      </div>
    </div>
  );
}
