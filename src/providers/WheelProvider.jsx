import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  computeDangerProbability,
  getWheelWedges,
  initialVirtualPullsForPlayerCount,
} from "../helpers";
import { characterNameFor } from "../helpers/characters";
import { usePeer } from "../hooks/usePeer";
import { WheelContext } from "../contexts/WheelContext";
import { createWheelMessageHandler } from "./wheel/wheelMessageHandler";
import { loadWheelState, saveWheelState } from "./wheel/wheelPersistence";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import {
  WEDGE_TYPES,
  SUCCESS_TEXT,
  deathText,
} from "../constants/wheelOutcomes";

export const WheelProvider = ({ children }) => {
  const {
    isGM,
    gameId,
    userName,
    hostName,
    users,
    characters,
    setCharacters,
    registerWheelEventHandler,
    sendToPeers,
    sendSystemChatMessage,
    towerSize,
    deathFlavorText,
    dangerProbability: peerDangerProbability,
    awaitingReset: peerAwaitingReset,
    designatedSpinner: peerDesignatedSpinner,
    gameStarted: peerGameStarted,
    setDangerProbability: setPeerDangerProbability,
    setAwaitingReset: setPeerAwaitingReset,
    setDesignatedSpinner: setPeerDesignatedSpinner,
    setGameStarted: setPeerGameStarted,
  } = usePeer();
  const myName = userName || hostName;
  const [dangerProbability, setDangerProbability] = useState(
    peerDangerProbability ?? 0
  );
  const [awaitingReset, setAwaitingReset] = useState(
    peerAwaitingReset ?? false
  );
  const [designatedSpinner, setDesignatedSpinner] = useState(
    peerDesignatedSpinner ?? null
  );
  // How many pulls the current assignment needs in total, and how many are
  // still outstanding - a complex/difficult action can require more than
  // one success before it's actually done (see
  // docs/rules/compliance-fix-plan.md item 9). Local only (not peer-synced
  // via useGameState): only the GM ever reads or decrements these, and
  // everyone else just sees designatedSpinner stay set across every step
  // plus the GM's own "Step X of N" chat narration.
  const [pullsRequired, setPullsRequired] = useState(1);
  const [pullsRemaining, setPullsRemaining] = useState(0);
  // Pulls since the tower was last (re-)stacked; only meaningful for the GM,
  // who is the only one who ever computes the next dangerProbability.
  const [pullsSinceReset, setPullsSinceReset] = useState(0);
  // Extra virtual pulls baked in at startGame() from the actual joined
  // player count ("pre-pull 3 blocks per player under 5") - GM-local, same
  // reasoning as pullsRequired/pullsRemaining above: only the GM's own
  // computeDangerProbability calls ever need it.
  const [initialVirtualPulls, setInitialVirtualPulls] = useState(0);
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

  useEffect(() => {
    setDesignatedSpinner(peerDesignatedSpinner ?? null);
  }, [peerDesignatedSpinner]);

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
    if (!isGM || !gameId || !hostName || restoredForGameRef.current === gameId)
      return;
    restoredForGameRef.current = gameId;
    const saved = loadWheelState(gameId, hostName);
    if (!saved) return;
    setPullsSinceReset(saved.pullsSinceReset ?? 0);
    setCharactersRemoved(saved.charactersRemoved ?? 0);
    setDangerProbability(saved.dangerProbability ?? 0);
    setPeerDangerProbability(saved.dangerProbability ?? 0);
    setAwaitingReset(saved.awaitingReset ?? false);
    setPeerAwaitingReset(saved.awaitingReset ?? false);
  }, [isGM, gameId, hostName, setPeerDangerProbability, setPeerAwaitingReset]);

  // GM only: persist danger-state so a refresh can restore it above.
  useEffect(() => {
    if (!isGM || !gameId || !hostName) return;
    saveWheelState(gameId, hostName, {
      pullsSinceReset,
      charactersRemoved,
      dangerProbability,
      awaitingReset,
    });
  }, [
    isGM,
    gameId,
    hostName,
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

  // GM only: clears the current assignment, broadcasts it, and narrates why
  // in chat. Shared by the GM's own Decline click and by a remote player's
  // decline message arriving via handleHostDecline below.
  const clearAssignment = useCallback(
    (chatText) => {
      setDesignatedSpinner(null);
      setPeerDesignatedSpinner(null);
      setPullsRequired(1);
      setPullsRemaining(0);
      sendToPeers({ type: MESSAGE_TYPES.SPIN_ASSIGN, targetUserName: null });
      if (chatText) {
        sendSystemChatMessage(chatText, { notifyAutoGm: true });
      }
    },
    [sendToPeers, setPeerDesignatedSpinner, sendSystemChatMessage]
  );

  // GM only: designate who spins next, optionally requiring more than one
  // successful pull to complete a complex/difficult action.
  const assignSpinner = useCallback(
    (targetUserName, requiredPulls = 1) => {
      if (!isGM || !targetUserName) return;
      const pullsNeeded = Math.max(1, requiredPulls);
      setDesignatedSpinner(targetUserName);
      setPeerDesignatedSpinner(targetUserName);
      setPullsRequired(pullsNeeded);
      setPullsRemaining(pullsNeeded);
      sendToPeers({
        type: MESSAGE_TYPES.SPIN_ASSIGN,
        targetUserName,
        pullsRequired: pullsNeeded,
      });
      const characterName = characterNameFor(characters, targetUserName);
      sendSystemChatMessage(
        pullsNeeded > 1
          ? `${characterName} is asked to spin the wheel (${pullsNeeded} pulls needed).`
          : `${characterName} is asked to spin the wheel.`
      );
    },
    [
      isGM,
      sendToPeers,
      setPeerDesignatedSpinner,
      sendSystemChatMessage,
      characters,
    ]
  );

  // GM only: apply a remote player's decline (received via SPIN_DECLINE).
  const handleHostDecline = useCallback(() => {
    clearAssignment(
      `${characterNameFor(characters, designatedSpinner)} declines the pull.`
    );
  }, [characters, designatedSpinner, clearAssignment]);

  // Register wheel event handler with PeerProvider
  useEffect(() => {
    registerWheelEventHandler(
      createWheelMessageHandler({
        isGM,
        handleHostSpin,
        handleHostDecline,
        spinStartRef,
        spinTargetAngleRef,
        setSpinning,
        setResult,
        setPointerIdx,
        setSpinAngle,
        setDangerProbability,
        setAwaitingReset,
        setDesignatedSpinner,
        setPullsRequired,
        setPullsRemaining,
        setShowWheel,
      })
    );
  }, [isGM, registerWheelEventHandler, handleHostSpin, handleHostDecline]);

  // GM only: explicitly move everyone from the lobby into the game. Replaces
  // the old behavior where the first player connecting silently flipped
  // showWheel for everyone - see docs/rules/compliance-fix-plan.md item 1.
  // Also seeds the initial danger curve from the actual joined player count
  // (item 11) - a table with fewer than 5 players starts harder, per
  // Dread's own pre-pull-scaling rule.
  const startGame = useCallback(() => {
    if (!isGM) return;
    const joinedPlayerCount = Object.keys(users || {}).length;
    const virtualPulls = initialVirtualPullsForPlayerCount(joinedPlayerCount);
    const nextDangerProbability = computeDangerProbability(
      pullsSinceReset,
      charactersRemoved,
      towerSize,
      virtualPulls
    );
    setInitialVirtualPulls(virtualPulls);
    setDangerProbability(nextDangerProbability);
    setPeerDangerProbability(nextDangerProbability);
    setShowWheel(true);
    setPeerGameStarted(true);
    sendToPeers({
      type: MESSAGE_TYPES.GAME_STARTED,
      dangerProbability: nextDangerProbability,
    });
  }, [
    isGM,
    users,
    pullsSinceReset,
    charactersRemoved,
    towerSize,
    sendToPeers,
    setPeerDangerProbability,
    setPeerGameStarted,
  ]);

  // Player (or GM if self-assigned): request the spin they've been assigned.
  // Elective, ask-anyone-anytime spinning is deliberately gone (see
  // compliance-fix-plan.md item 7) - only the currently designated spinner
  // may act, everyone else's Spin button isn't even rendered (GameLoaded.jsx).
  const handleSpin = () => {
    if (spinning || awaitingReset) return;
    if (myName !== designatedSpinner) return;
    if (isGM) {
      handleHostSpin();
    } else {
      sendToPeers({ type: MESSAGE_TYPES.SPIN_REQUEST });
    }
  };

  // Decline the current assignment instead of spinning.
  const handleDecline = () => {
    if (myName !== designatedSpinner) return;
    if (isGM) {
      clearAssignment(
        `${characterNameFor(characters, designatedSpinner)} declines the pull.`
      );
    } else {
      sendToPeers({ type: MESSAGE_TYPES.SPIN_DECLINE });
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
    const spinnerCharacterName = characterNameFor(
      characters,
      designatedSpinner
    );
    const resultText = isDeath
      ? deathText(deathFlavorText, spinnerCharacterName)
      : SUCCESS_TEXT;
    setResult(resultText);

    if (isDeath) {
      // Death ends a multi-pull action early, no matter how many successful
      // pulls came before it - the character is removed either way, and is
      // marked no-longer-alive so it can't be selected to spin again (see
      // GameLoaded.jsx's SpinControls) and its player can pick a new
      // character (see CharacterPicker).
      const deadCharacter = Object.values(characters || {}).find(
        (c) => c.assignedTo === designatedSpinner && c.alive !== false
      );
      if (deadCharacter) {
        setCharacters((prev) => ({
          ...prev,
          [deadCharacter.id]: { ...prev[deadCharacter.id], alive: false },
        }));
        sendToPeers({
          type: MESSAGE_TYPES.CHARACTER_UPDATE,
          id: deadCharacter.id,
          alive: false,
        });
      }
      sendSystemChatMessage(resultText);
      setDesignatedSpinner(null);
      setPeerDesignatedSpinner(null);
      setPullsRequired(1);
      setPullsRemaining(0);
      setCharactersRemoved((c) => c + 1);
      setAwaitingReset(true);
      setPeerAwaitingReset(true);
      sendToPeers({
        type: MESSAGE_TYPES.SPIN,
        result: spinResult,
        resultText,
        awaitingReset: true,
        designatedSpinner: null,
        pullsRemaining: 0,
      });
    } else {
      const nextPullsSinceReset = pullsSinceReset + 1;
      const nextDangerProbability = computeDangerProbability(
        nextPullsSinceReset,
        charactersRemoved,
        towerSize,
        initialVirtualPulls
      );
      setPullsSinceReset(nextPullsSinceReset);
      setDangerProbability(nextDangerProbability);
      setPeerDangerProbability(nextDangerProbability);

      const remaining = Math.max(0, pullsRemaining - 1);
      const stepNumber = pullsRequired - remaining;
      const actionComplete = remaining === 0;
      sendSystemChatMessage(
        pullsRequired > 1
          ? `${spinnerCharacterName} succeeds (step ${stepNumber} of ${pullsRequired})${
              actionComplete ? " - action complete!" : "."
            }`
          : `${spinnerCharacterName} survives.`,
        { notifyAutoGm: true }
      );
      setPullsRemaining(remaining);

      const spinPayload = {
        type: MESSAGE_TYPES.SPIN,
        result: spinResult,
        resultText,
        dangerProbability: nextDangerProbability,
        pullsRemaining: remaining,
      };
      if (actionComplete) {
        // Only clear the assignment once every required pull has succeeded -
        // otherwise the same player stays designated for their next pull.
        setDesignatedSpinner(null);
        setPeerDesignatedSpinner(null);
        setPullsRequired(1);
        spinPayload.designatedSpinner = null;
      }
      sendToPeers(spinPayload);
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
      towerSize,
      initialVirtualPulls
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
        designatedSpinner,
        assignSpinner,
        pullsRequired,
        pullsRemaining,
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
        handleDecline,
        handleSpinEnd,
        handleRestack,
      }}
    >
      {children}
    </WheelContext.Provider>
  );
};
