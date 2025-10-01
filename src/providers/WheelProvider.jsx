import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import { getNewWheelStateOnSpin } from "../helpers";
import { usePeer } from "./PeerProvider";

const WheelContext = createContext();

export const WheelProvider = ({ children }) => {
  const {
    conn,
    isGM,
    registerWheelEventHandler,
    sendToPeers,
    numWedges,
    initialWheelState,
    setNumWedges,
    setInitialWheelState,
  } = usePeer();
  const [wheelState, setWheelState] = useState(
    initialWheelState || Array(numWedges || 25).fill("success")
  );
  const [result, setResult] = useState("");
  const [showWheel, setShowWheel] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [pointerIdx, setPointerIdx] = useState(null);
  const spinStartRef = useRef(null);
  const spinTargetAngleRef = useRef(null);
  const spinResultIdxRef = useRef(null);

  // Sync wheel state when initialWheelState or numWedges changes
  useEffect(() => {
    setWheelState(initialWheelState || Array(numWedges || 25).fill("success"));
  }, [initialWheelState, numWedges]);

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
          setWheelState(data.wheelState);
        }
        if (data.type === "spin-final") {
          setSpinAngle(data.finalAngle);
          setSpinning(false);
        }
        // Sync spinner state if host sends numWedges/wheelState
        if (data.numWedges && data.wheelState) {
          setNumWedges(data.numWedges);
          setWheelState(data.wheelState);
          setInitialWheelState(data.wheelState);
        }
      }
      // Show wheel when any wheel event is received
      setShowWheel(true);
    });
    // Show wheel if already connected
    if (conn) setShowWheel(true);
  }, [
    conn,
    isGM,
    registerWheelEventHandler,
    setNumWedges,
    setInitialWheelState,
  ]);

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
    if (spinning) return;
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
    const spinResult = wheelState[selectedIdx];
    setResult(spinResult === "death" ? "You Died!" : "Success!");
    const newWheelState = getNewWheelStateOnSpin(selectedIdx, wheelState);
    setWheelState(newWheelState);
    setInitialWheelState(newWheelState);
    // Use PeerProvider to send spinner sync info
    sendToPeers({
      type: "spin",
      result: spinResult,
      wheelState: newWheelState,
      numWedges: newWheelState.length,
    });
    sendToPeers({ type: "spin-final", finalAngle: spinTargetAngleRef.current });
  };

  return (
    <WheelContext.Provider
      value={{
        wheelState,
        setWheelState,
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
      }}
    >
      {children}
    </WheelContext.Provider>
  );
};

export function useWheel() {
  return useContext(WheelContext);
}
