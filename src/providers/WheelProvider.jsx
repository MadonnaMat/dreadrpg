import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { computeDangerProbability, getWheelWedges } from "../helpers";
import { usePeer } from "../hooks/usePeer";
import { WheelContext } from "../contexts/WheelContext";
import { createWheelMessageHandler } from "./wheel/wheelMessageHandler";
import { loadWheelState, saveWheelState } from "./wheel/wheelPersistence";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { WEDGE_TYPES, RESULT_TEXT } from "../constants/wheelOutcomes";

export const WheelProvider = ({ children }) => {
  const {
    isGM,
    gameId,
    registerWheelEventHandler,
    sendToPeers,
    towerSize,
    dangerProbability: peerDangerProbability,
    awaitingReset: peerAwaitingReset,
    gameStarted: peerGameStarted,
    setDangerProbability: setPeerDangerProbability,
    setAwaitingReset: setPeerAwaitingReset,
    setGameStarted: setPeerGameStarted,
  } = usePeer();
  const [dangerProbability, setDangerProbability] = useState(
    peerDangerProbability ?? 0
  );
  const [awaitingReset, setAwaitingReset] = useState(
    peerAwaitingReset ?? false
  );
  // Pulls since the tower was last (re-)stacked; only meaningful for the GM,
  // who is the only one who ever computes the next dangerProbability.
  const [pullsSinceReset, setPullsSinceReset] = useState(0);
  // Cumulative count of "death" spins this session, so each re-stack of the
  // wheel is escalated per Dread's re-stacking rule (see helpers/index.js).
  const [charactersRemoved, setCharactersRemoved] = useState(0);
  const [result, setResult] = useState("");
  const [showWheel, setShowWheel] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [pointerIdx, setPointerIdx] = useState(null);
  const spinStartRef = useRef(null);
  const spinTargetAngleRef = useRef(null);
  const spinResultIdxRef = useRef(null);
  const restoredForGameRef = useRef(null);

  // Mirror spinning/spinAngle into refs, updated inline during render (not
  // an effect - this needs to be current *before* handleHostSpin might read
  // it, and a ref write during render never triggers a re-render itself).
  // handleHostSpin reads through these instead of the state directly so its
  // own identity can stay stable via useCallback (see below) without also
  // needing to change every time spinAngle updates mid-animation.
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;
  const spinAngleRef = useRef(spinAngle);
  spinAngleRef.current = spinAngle;

  const wedges = useMemo(
    () => getWheelWedges(dangerProbability),
    [dangerProbability]
  );

  // Sync local danger state when the peer-synced snapshot changes (e.g. on
  // join/reconnect via welcome/game-data-sync, handled in PeerProvider).
  useEffect(() => {
    setDangerProbability(peerDangerProbability ?? 0);
  }, [peerDangerProbability]);

  useEffect(() => {
    setAwaitingReset(peerAwaitingReset ?? false);
  }, [peerAwaitingReset]);

  // A late joiner's welcome/game-data-sync snapshot may already say the game
  // started (see PeerProvider's buildGameSnapshot) - skip the lobby in that
  // case instead of waiting for a live "game-started" broadcast that already
  // happened before this client connected.
  useEffect(() => {
    if (peerGameStarted) setShowWheel(true);
  }, [peerGameStarted]);

  // GM only: restore a previous session's danger-state on refresh instead of
  // silently resetting tower danger to a fresh tower.
  useEffect(() => {
    if (!isGM || !gameId || restoredForGameRef.current === gameId) return;
    restoredForGameRef.current = gameId;
    const saved = loadWheelState(gameId);
    if (!saved) return;
    setPullsSinceReset(saved.pullsSinceReset ?? 0);
    setCharactersRemoved(saved.charactersRemoved ?? 0);
    setDangerProbability(saved.dangerProbability ?? 0);
    setPeerDangerProbability(saved.dangerProbability ?? 0);
    setAwaitingReset(saved.awaitingReset ?? false);
    setPeerAwaitingReset(saved.awaitingReset ?? false);
  }, [isGM, gameId, setPeerDangerProbability, setPeerAwaitingReset]);

  // GM only: persist danger-state so a refresh can restore it above.
  useEffect(() => {
    if (!isGM || !gameId) return;
    saveWheelState(gameId, {
      pullsSinceReset,
      charactersRemoved,
      dangerProbability,
      awaitingReset,
    });
  }, [
    isGM,
    gameId,
    pullsSinceReset,
    charactersRemoved,
    dangerProbability,
    awaitingReset,
  ]);

  // Host: handle spin request from player. Wrapped in useCallback with a
  // stable dependency (sendToPeers) so its own identity never changes -
  // reading spinning/spinAngle through the refs above instead of closing
  // over the state directly is what makes that safe to do.
  const handleHostSpin = useCallback(() => {
    if (spinningRef.current) return;
    const currentAngle = spinAngleRef.current;
    spinStartRef.currentAngle = currentAngle;
    const minSpins = 3;
    const maxSpins = 6;
    const spins = Math.random() * (maxSpins - minSpins) + minSpins;
    const randomOffset = Math.random() * 2 * Math.PI;
    const targetAngle = currentAngle + spins * 2 * Math.PI + randomOffset;
    spinTargetAngleRef.current = targetAngle;
    spinStartRef.current = performance.now();
    setSpinning(true);
    setResult("");
    setPointerIdx(null);
    // Use PeerProvider to send
    sendToPeers({ type: MESSAGE_TYPES.SPIN_START, currentAngle, targetAngle });
  }, [sendToPeers]);

  // Register wheel event handler with PeerProvider
  useEffect(() => {
    registerWheelEventHandler(
      createWheelMessageHandler({
        isGM,
        handleHostSpin,
        spinStartRef,
        spinTargetAngleRef,
        setSpinning,
        setResult,
        setPointerIdx,
        setSpinAngle,
        setDangerProbability,
        setAwaitingReset,
        setShowWheel,
      })
    );
  }, [isGM, registerWheelEventHandler, handleHostSpin]);

  // GM only: explicitly move everyone from the lobby into the game. Replaces
  // the old behavior where the first player connecting silently flipped
  // showWheel for everyone - see docs/rules/compliance-fix-plan.md item 1.
  const startGame = useCallback(() => {
    if (!isGM) return;
    setShowWheel(true);
    setPeerGameStarted(true);
    sendToPeers({ type: MESSAGE_TYPES.GAME_STARTED });
  }, [isGM, sendToPeers, setPeerGameStarted]);

  // Player: request spin from host
  const handleSpin = () => {
    if (spinning || awaitingReset) return;
    if (isGM) {
      // Host spins directly
      handleHostSpin("host");
    } else {
      // Player requests spin from host
      sendToPeers({ type: MESSAGE_TYPES.SPIN_REQUEST, peerId: "player" });
    }
  };

  // Host: resolve the spin outcome and broadcast the authoritative result.
  // Gated to the GM: every client's own WheelGraphics runs its own animation
  // and calls this via onSpinEnd, but only the GM's resolution is trusted -
  // players receive the true outcome via the "spin"/"spin-final" broadcasts
  // instead of computing (and possibly mis-computing, e.g. after a
  // backgrounded-tab timing skew) their own.
  const handleSpinEnd = (selectedIdx) => {
    if (!isGM) return;
    if (selectedIdx == null) return;
    const spinResult = wedges[selectedIdx]?.type;
    if (!spinResult) return;
    const isDeath = spinResult === WEDGE_TYPES.DEATH;
    setResult(isDeath ? RESULT_TEXT.DEATH : RESULT_TEXT.SUCCESS);

    if (isDeath) {
      setCharactersRemoved((c) => c + 1);
      setAwaitingReset(true);
      setPeerAwaitingReset(true);
      sendToPeers({
        type: MESSAGE_TYPES.SPIN,
        result: spinResult,
        awaitingReset: true,
      });
    } else {
      const nextPullsSinceReset = pullsSinceReset + 1;
      const nextDangerProbability = computeDangerProbability(
        nextPullsSinceReset,
        charactersRemoved,
        towerSize
      );
      setPullsSinceReset(nextPullsSinceReset);
      setDangerProbability(nextDangerProbability);
      setPeerDangerProbability(nextDangerProbability);
      sendToPeers({
        type: MESSAGE_TYPES.SPIN,
        result: spinResult,
        dangerProbability: nextDangerProbability,
      });
    }
    sendToPeers({
      type: MESSAGE_TYPES.SPIN_FINAL,
      finalAngle: spinTargetAngleRef.current,
    });
  };

  // GM: re-stack the tower after a collapse, escalating per Dread's rule
  const handleRestack = () => {
    if (!awaitingReset) return;
    setPullsSinceReset(0);
    const nextDangerProbability = computeDangerProbability(
      0,
      charactersRemoved,
      towerSize
    );
    setDangerProbability(nextDangerProbability);
    setPeerDangerProbability(nextDangerProbability);
    setAwaitingReset(false);
    setPeerAwaitingReset(false);
    sendToPeers({
      type: MESSAGE_TYPES.WHEEL_RESET,
      dangerProbability: nextDangerProbability,
      awaitingReset: false,
    });
  };

  return (
    <WheelContext.Provider
      value={{
        wedges,
        dangerProbability,
        awaitingReset,
        result,
        setResult,
        showWheel,
        setShowWheel,
        startGame,
        spinning,
        setSpinning,
        spinAngle,
        setSpinAngle,
        pointerIdx,
        setPointerIdx,
        spinStartRef,
        spinTargetAngleRef,
        spinResultIdxRef,
        handleSpin,
        handleSpinEnd,
        handleRestack,
      }}
    >
      {children}
    </WheelContext.Provider>
  );
};
