import { useCallback, useEffect, useRef, useState } from "react";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useAi } from "../hooks/useAi";
import { AutoGmContext } from "../contexts/AutoGmContext";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import {
  autoApproveAnswers,
  getActivePullTargets,
} from "../helpers/characters";
import { applyCampaignNoteUpdates } from "../helpers/campaignNotes";
import { latest } from "../prompts/index";
import { buildAutoGmTurnContext } from "../ai/promptContexts";
import {
  autoGmTurnSchema,
  validate as validateAutoGmTurn,
} from "../ai/schemas/autoGmTurnSchema";
import {
  loadAutoGmState,
  saveAutoGmState,
} from "./autogm/autogmStoryPersistence";

// Newest-first, capped at this many entries - a live debugging aid (see the
// upcoming AutoGmDebugPanel), not part of the story's actual memory, so it
// deliberately never persists.
const TURN_LOG_LIMIT = 20;

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
    registerAutoGmChatEventHandler,
    scenario,
    campaignNotes,
    setCampaignNotes,
    presence,
  } = usePeer();
  const {
    awaitingReset,
    dangerProbability,
    designatedSpinner,
    assignSpinner,
    handleRestack,
  } = useWheel();
  const { aiEnabled, runPrompt } = useAi();

  const [autoGmEnabled, setAutoGmEnabled] = useState(false);
  const [autoGmError, setAutoGmError] = useState(null);
  // Rolling compacted summary + the uncompacted tail of raw chat turns -
  // rebuilt into every turn's prompt context rather than chained through
  // runStructuredPrompt's `history`, so persistence stays plain
  // strings/arrays and every turn's facts come from the single source of
  // truth (usePeer()/useWheel()) rather than from what the LLM said earlier.
  const [storySummary, setStorySummary] = useState("");
  const [rawHistory, setRawHistory] = useState([]);
  // Live feed of recent turns for the AutoGM debug panel - see TURN_LOG_LIMIT.
  const [turnLog, setTurnLog] = useState([]);
  const restoredForGameRef = useRef(null);
  // Mirrors rawHistory but read/written synchronously, so a turn triggered
  // mid-render-cycle always sees the message that triggered it (state alone
  // is subject to React's async batching).
  const historyRef = useRef([]);
  // Serializes turn processing so overlapping LLM calls (multiple chat
  // messages arriving close together) never race each other.
  const queueRef = useRef(Promise.resolve());

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
    const history = saved.rawHistory ?? [];
    setRawHistory(history);
    historyRef.current = history;
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

  const pushTurnLogEntry = useCallback((entry) => {
    setTurnLog((prev) =>
      [
        {
          id: `turn-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          ...entry,
        },
        ...prev,
      ].slice(0, TURN_LOG_LIMIT)
    );
  }, []);

  // Runs one AutoGM turn: asks the model to react to the given history
  // (ending with the message that just triggered this turn), then acts on
  // whatever it decides - posting narration, calling for a pull, restacking
  // a frozen tower, and/or noting new campaign facts. Every fact fed into
  // the prompt is read live from usePeer()/useWheel() rather than trusted
  // from earlier turns, so a turn is always grounded in the actual current
  // game state.
  const runTurn = useCallback(
    async (history, trigger) => {
      const context = buildAutoGmTurnContext({
        scenario,
        characters,
        storySummary,
        rawHistory: history,
        dangerProbability,
        awaitingReset,
        designatedSpinner,
        campaignNotes,
        presence,
      });
      const result = await runPrompt({
        systemPromptText: latest("autogmTurn").text,
        userContent: context,
        schema: autoGmTurnSchema,
        validate: validateAutoGmTurn,
      });

      if (!result.valid) {
        setAutoGmError("AutoGM couldn't generate a response.");
        return;
      }
      setAutoGmError(null);

      const {
        narration,
        callForPull,
        targetPlayerName,
        pullsRequired,
        readyToRestack,
        campaignNoteUpdates,
      } = result.parsed;

      if (narration) {
        sendSystemChatMessage(narration, { from: "GM", fromBot: true });
      }

      let pullSkippedReason = null;
      if (callForPull && targetPlayerName) {
        const activeTargets = getActivePullTargets({ characters, presence });
        if (awaitingReset) {
          pullSkippedReason = "tower is frozen";
        } else if (!activeTargets.includes(targetPlayerName)) {
          pullSkippedReason = "target not an active player";
        } else {
          assignSpinner(targetPlayerName, pullsRequired || 1);
        }
      }

      if (readyToRestack && awaitingReset) {
        handleRestack();
      }

      if (campaignNoteUpdates?.length) {
        setCampaignNotes((prev) =>
          applyCampaignNoteUpdates(prev, campaignNoteUpdates)
        );
      }

      pushTurnLogEntry({
        kind: "turn",
        trigger,
        draftNarration: narration,
        finalNarration: narration,
        reasoning: null,
        consistent: null,
        callForPull,
        targetPlayerName,
        pullsRequired,
        readyToRestack,
        campaignNoteUpdates,
        pullSkippedReason,
      });
    },
    [
      scenario,
      characters,
      storySummary,
      dangerProbability,
      awaitingReset,
      designatedSpinner,
      campaignNotes,
      presence,
      runPrompt,
      sendSystemChatMessage,
      assignSpinner,
      handleRestack,
      setCampaignNotes,
      pushTurnLogEntry,
    ]
  );

  // Every human-authored chat message (inbound over the network, or the
  // GM's own local send via notifyAutoGmChat - see PeerProvider.jsx) lands
  // here. AutoGM's own narration is sent via sendSystemChatMessage, which
  // never invokes this handler, so there's no feedback-loop risk.
  const processIncomingChat = useCallback(
    (data) => {
      if (!isGM || !autoGmEnabled) return;
      const trigger = { from: data.from, text: data.text };
      const history = [...historyRef.current, trigger];
      historyRef.current = history;
      setRawHistory(history);
      return runTurn(history, trigger);
    },
    [isGM, autoGmEnabled, runTurn]
  );

  useEffect(() => {
    registerAutoGmChatEventHandler((data) => {
      queueRef.current = queueRef.current
        .then(() => processIncomingChat(data))
        .catch(() => {});
    });
  }, [registerAutoGmChatEventHandler, processIncomingChat]);

  return (
    <AutoGmContext.Provider
      value={{
        autoGmEnabled,
        enableAutoGm,
        disableAutoGm,
        autoGmError,
        storySummary,
        rawHistory,
        turnLog,
      }}
    >
      {children}
    </AutoGmContext.Provider>
  );
}
