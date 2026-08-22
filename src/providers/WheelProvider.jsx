import React, { useState, useRef, useEffect, useMemo } from "react";
import { computeDangerProbability, getWheelWedges } from "../helpers";
import { usePeer } from "../hooks/usePeer";
import { WheelContext } from "../contexts/WheelContext";

export const WheelProvider = ({ children }) => {
  const {
    conn,
    isGM,
    registerWheelEventHandler,
    sendToPeers,
    towerSize,
    dangerProbability: peerDangerProbability,
    awaitingReset: peerAwaitingReset,
    setDangerProbability: setPeerDangerProbability,
    setAwaitingReset: setPeerAwaitingReset,
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

  // Register wheel event handler with PeerProvider
  useEffect(() => {
    registerWheelEventHandler((data) => {
      // Host: handle spin requests and broadcast
      if (isGM) {
        if (data.type === "spin-request") {
          handleHostSpin(data.peerId);
        }
        // Host can also receive other wheel-related actions if needed
      } else {
        // Player: handle host broadcasts
        if (data.type === "spin-start") {
          spinStartRef.currentAngle = data.currentAngle;
          spinTargetAngleRef.current = data.targetAngle;
          spinStartRef.current = performance.now();
          setSpinning(true);
          setResult("");
          setPointerIdx(null);
        }
        if (data.type === "spin") {
          if (data.dangerProbability !== undefined) {
            setDangerProbability(data.dangerProbability);
          }
          if (data.awaitingReset !== undefined) {
            setAwaitingReset(data.awaitingReset);
          }
        }
        if (data.type === "spin-final") {
          setSpinAngle(data.finalAngle);
          setSpinning(false);
        }
        if (data.type === "wheel-reset") {
          setDangerProbability(data.dangerProbability);
          setAwaitingReset(data.awaitingReset);
        }
        // Sync from a welcome/game-data-sync snapshot
        if (data.type === "welcome" || data.type === "game-data-sync") {
          if (data.dangerProbability !== undefined) {
            setDangerProbability(data.dangerProbability);
          }
          if (data.awaitingReset !== undefined) {
            setAwaitingReset(data.awaitingReset);
          }
        }
      }
      // Show wheel when any wheel event is received
      setShowWheel(true);
    });
    // Show wheel if already connected
    if (conn) setShowWheel(true);
  }, [conn, isGM, registerWheelEventHandler]);

  // Host: handle spin request from player
  const handleHostSpin = () => {
    if (spinning) return;
    const currentAngle = spinAngle;
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
    sendToPeers({ type: "spin-start", currentAngle, targetAngle });
  };

  // Player: request spin from host
  const handleSpin = () => {
    if (spinning || awaitingReset) return;
    if (isGM) {
      // Host spins directly
      handleHostSpin("host");
    } else {
      // Player requests spin from host
      sendToPeers({ type: "spin-request", peerId: "player" });
    }
  };

  // Host: broadcast spin result to all
  const handleSpinEnd = (selectedIdx) => {
    if (selectedIdx == null) return;
    const spinResult = wedges[selectedIdx]?.type;
    if (!spinResult) return;
    const isDeath = spinResult === "death";
    setResult(isDeath ? "You Died!" : "Success!");

    if (isDeath) {
      setCharactersRemoved((c) => c + 1);
      setAwaitingReset(true);
      setPeerAwaitingReset(true);
      sendToPeers({ type: "spin", result: spinResult, awaitingReset: true });
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
        type: "spin",
        result: spinResult,
        dangerProbability: nextDangerProbability,
      });
    }
    sendToPeers({ type: "spin-final", finalAngle: spinTargetAngleRef.current });
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
      type: "wheel-reset",
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
