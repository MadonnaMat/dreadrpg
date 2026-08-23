import { useCallback, useEffect, useRef, useState } from "react";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { AutoGmContext } from "../contexts/AutoGmContext";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { autoApproveAnswers } from "../helpers/characters";
import {
  loadAutoGmState,
  saveAutoGmState,
} from "./autogm/autogmStoryPersistence";

// Runs the AutoGM mode: an AI-driven GM that narrates and adjudicates play
// live through the existing Chat, instead of a human running the GM role.
// Deliberately crosses the network/AI trust boundary AiProvider avoids (see
// docs/autogm-requirements.md) - this provider is the one place in the app
// where an AI-drafted result is acted on directly instead of only being
// placed into a human's local form state for manual review/send.
//
// Everything here only ever runs meaningfully on the GM's own browser - the
// LLM call, the self-play UI, and the Admin Panel toggle are all GM-only
// concerns, so `autoGmEnabled` is deliberately GM-local state, never synced
// through PeerProvider's game snapshot. Players only ever see AutoGM's
// *effects* (bot-attributed chat messages, already-approved answers), plus
// a plain chat announcement when it's toggled.
export function AutoGmProvider({ children }) {
  const {
    isGM,
    gameId,
    hostName,
    characters,
    setCharacters,
    sendToPeers,
    sendSystemChatMessage,
  } = usePeer();
  const { aiEnabled } = useAi();

  const [autoGmEnabled, setAutoGmEnabled] = useState(false);
  const [autoGmError, setAutoGmError] = useState(null);
  // Rolling compacted summary + the uncompacted tail of raw chat turns -
  // rebuilt into every turn's prompt context rather than chained through
  // runStructuredPrompt's `history` (see AutoGmProvider's turn loop, added
  // once real LLM calls are wired in).
  const [storySummary, setStorySummary] = useState("");
  const [rawHistory, setRawHistory] = useState([]);
  const restoredForGameRef = useRef(null);

  // GM only: restore a previous session's AutoGM state on refresh instead of
  // silently starting fresh (mirrors WheelProvider.jsx's restore effect).
  useEffect(() => {
    if (
      !isGM ||
      !gameId ||
      !hostName ||
      restoredForGameRef.current === gameId
    ) {
      return;
    }
    restoredForGameRef.current = gameId;
    const saved = loadAutoGmState(gameId, hostName);
    if (!saved) return;
    setAutoGmEnabled(saved.enabled ?? false);
    setStorySummary(saved.storySummary ?? "");
    setRawHistory(saved.rawHistory ?? []);
  }, [isGM, gameId, hostName]);

  // GM only: persist AutoGM state so a refresh can restore it above.
  useEffect(() => {
    if (!isGM || !gameId || !hostName) return;
    saveAutoGmState(gameId, hostName, {
      enabled: autoGmEnabled,
      storySummary,
      rawHistory,
    });
  }, [isGM, gameId, hostName, autoGmEnabled, storySummary, rawHistory]);

  const enableAutoGm = useCallback(() => {
    if (!isGM || !aiEnabled) return;
    setAutoGmEnabled(true);
    setAutoGmError(null);
    sendSystemChatMessage("AutoGM is now running this game.", {
      from: "GM",
      fromBot: true,
    });
  }, [isGM, aiEnabled, sendSystemChatMessage]);

  const disableAutoGm = useCallback(() => {
    if (!isGM) return;
    setAutoGmEnabled(false);
    sendSystemChatMessage("AutoGM has been disabled for this game.", {
      from: "GM",
      fromBot: true,
    });
  }, [isGM, sendSystemChatMessage]);

  // The AI engine can go away out from under AutoGM (the GM disables the AI
  // assistant entirely, or it errors out) - AutoGM can't run without it, so
  // follow it down rather than silently failing every turn afterward.
  useEffect(() => {
    if (autoGmEnabled && !aiEnabled) {
      setAutoGmEnabled(false);
    }
  }, [autoGmEnabled, aiEnabled]);

  // GM only, while AutoGM is enabled: auto-approve any answer that has text
  // but hasn't been approved yet, the same patch shape CharacterSheet.jsx's
  // manual approval button sends - just applied automatically instead of
  // waiting for a GM click. Self-converging: once `approved` flips true the
  // condition is false on the next pass, so this can't loop.
  useEffect(() => {
    if (!isGM || !autoGmEnabled) return;
    Object.entries(characters || {}).forEach(([charId, character]) => {
      const patched = autoApproveAnswers(character.answers);
      if (patched) {
        setCharacters((prev) => ({
          ...prev,
          [charId]: { ...prev[charId], answers: patched },
        }));
        sendToPeers({
          type: MESSAGE_TYPES.CHARACTER_UPDATE,
          id: charId,
          answers: patched,
        });
      }
    });
  }, [isGM, autoGmEnabled, characters, setCharacters, sendToPeers]);

  return (
    <AutoGmContext.Provider
      value={{
        autoGmEnabled,
        enableAutoGm,
        disableAutoGm,
        autoGmError,
        storySummary,
        rawHistory,
      }}
    >
      {children}
    </AutoGmContext.Provider>
  );
}
