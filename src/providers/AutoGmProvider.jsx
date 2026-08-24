import { useCallback, useEffect, useRef, useState } from "react";
import { usePeer } from "../hooks/usePeer";
import { useWheel } from "../hooks/useWheel";
import { useAi } from "../hooks/useAi";
import { AutoGmContext } from "../contexts/AutoGmContext";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { AUTOGM_STATUS } from "../constants/autoGm";
import {
  autoApproveAnswers,
  getActivePullTargets,
  characterNameFor,
} from "../helpers/characters";
import {
  applyCampaignNoteUpdates,
  reconcileConsolidatedNotes,
} from "../helpers/campaignNotes";
import { latest } from "../prompts/index";
import {
  buildAutoGmTurnContext,
  buildAutoGmCompactionContext,
  buildAutoGmRemovalNarrationContext,
  buildAutoGmSelfCheckContext,
  buildAutoGmPullCheckContext,
  buildAutoGmCampaignNotesConsolidationContext,
} from "../ai/promptContexts";
import {
  autoGmTurnSchema,
  validate as validateAutoGmTurn,
} from "../ai/schemas/autoGmTurnSchema";
import {
  autoGmPullCheckSchema,
  validate as validateAutoGmPullCheck,
} from "../ai/schemas/autoGmPullCheckSchema";
import {
  autoGmCampaignNotesConsolidationSchema,
  validate as validateAutoGmCampaignNotesConsolidation,
} from "../ai/schemas/autoGmCampaignNotesConsolidationSchema";
import {
  autoGmCompactionSchema,
  validate as validateAutoGmCompaction,
} from "../ai/schemas/autoGmCompactionSchema";
import {
  autoGmRemovalNarrationSchema,
  validate as validateAutoGmRemovalNarration,
} from "../ai/schemas/autoGmRemovalNarrationSchema";
import {
  autoGmSelfCheckSchema,
  validate as validateAutoGmSelfCheck,
} from "../ai/schemas/autoGmSelfCheckSchema";
import {
  loadAutoGmState,
  saveAutoGmState,
} from "./autogm/autogmStoryPersistence";

// Newest-first, capped at this many entries - a live debugging aid (see the
// upcoming AutoGmDebugPanel), not part of the story's actual memory, so it
// deliberately never persists.
const TURN_LOG_LIMIT = 20;
// Once the uncompacted raw-history window exceeds this many messages, it's
// folded into storySummary and reset - keeps context bounded without
// losing track of the story (see docs/autogm-requirements.md).
const RAW_HISTORY_COMPACTION_THRESHOLD = 20;
// Every runPrompt call is raced against this timeout. Local in-browser
// inference has no engine-level timeout anywhere in the promptRunner/
// webllmEngine stack - if a single call ever genuinely hangs (a crashed
// worker, lost GPU context, a backgrounded tab throttled by the browser)
// rather than rejecting, every future chat message would otherwise wait
// forever behind it in queueRef's promise chain, since a `.then()` chained
// onto a promise that never settles never fires either. Racing against a
// timeout guarantees the queue always eventually unblocks, even in the
// worst case.
const RUN_PROMPT_TIMEOUT_MS = 60000;

// Turns runStructuredPrompt's own `errors` (JSON-parse failures, schema
// validation messages, or the timeout wrapper's own message above) into one
// readable line for the debug panel - "AutoGM couldn't generate a
// response" alone gives no way to tell a timeout apart from a schema
// mismatch apart from a completely garbled response.
function describePromptFailure(result) {
  const errors = (result?.errors ?? []).filter(Boolean);
  return errors.length
    ? errors.join(" | ")
    : "No details returned by the model.";
}

// The dedicated pull-check pass (checkForPull, run before the main turn
// prompt) already decided and applied a pull for the acting player's own
// action, if warranted - that takes precedence. The main prompt's own
// callForPull is only honored as a fallback when the classifier found
// nothing to do (e.g. it can still call for a pull for a DIFFERENT player,
// such as a PvP dare), so a single action never gets double-assigned.
function resolveMainPromptPull({
  classifierPull,
  callForPull,
  targetPlayerName,
  pullsRequired,
  characters,
  presence,
  awaitingReset,
  assignSpinner,
}) {
  if (classifierPull) {
    return {
      callForPull: true,
      targetPlayerName: classifierPull.targetPlayerName,
      pullsRequired: classifierPull.pullsRequired,
      pullSkippedReason: null,
    };
  }
  if (!callForPull || !targetPlayerName) {
    return {
      callForPull: false,
      targetPlayerName: "",
      pullsRequired: 1,
      pullSkippedReason: null,
    };
  }
  const activeTargets = getActivePullTargets({ characters, presence });
  let pullSkippedReason = null;
  if (awaitingReset) {
    pullSkippedReason = "tower is frozen";
  } else if (!activeTargets.includes(targetPlayerName)) {
    pullSkippedReason = "target not an active player";
  } else {
    // Same bound as checkForPull's own clamp below - the model's
    // self-reported pullsRequired is otherwise unbounded, and a hallucinated
    // large value would soft-lock the target player's turn.
    const clampedPullsRequired = Math.min(10, Math.max(1, pullsRequired || 1));
    assignSpinner(targetPlayerName, clampedPullsRequired);
  }
  return {
    callForPull: true,
    targetPlayerName,
    pullsRequired,
    pullSkippedReason,
  };
}

function runPromptWithTimeout(runPrompt, args) {
  return Promise.race([
    runPrompt(args),
    new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            raw: "",
            parsed: null,
            valid: false,
            errors: ["AutoGM's model call timed out."],
            attempts: 0,
            latencyMs: RUN_PROMPT_TIMEOUT_MS,
          }),
        RUN_PROMPT_TIMEOUT_MS
      );
    }),
  ]);
}

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
    gameStarted,
    characters,
    setCharacters,
    sendToPeers,
    sendSystemChatMessage,
    registerAutoGmChatEventHandler,
    setAutoGmThinking,
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
  // Whether the one-time opening-scene narration has already run for this
  // game - persisted so it doesn't re-fire after a reload, but not reset by
  // disabling/re-enabling AutoGM mid-game (it's a once-per-game beat, not a
  // once-per-enable one).
  const [openingNarrationDone, setOpeningNarrationDone] = useState(false);
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
  // Detect the awaitingReset false->true transition (a death just
  // happened) and which character it was, for removal narration below.
  const prevAwaitingResetRef = useRef(false);
  const prevCharactersRef = useRef(characters);

  // Gates the persist effect below until the restore effect's own setState
  // calls have actually landed. Both effects share the same isGM/gameId/
  // hostName guard, so without this they'd both fire in the very first
  // eligible commit - the persist effect would read the pre-restore default
  // state (still in scope via closure) and immediately overwrite the entry
  // the restore effect just read, before React had re-rendered with the
  // restored values. Flipping this via its own setState batches together
  // with the restore effect's other setState calls, so it only becomes true
  // in the same render that already reflects the restored state.
  const [restoreComplete, setRestoreComplete] = useState(false);

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
    if (saved) {
      setAutoGmEnabled(saved.enabled ?? false);
      setStorySummary(saved.storySummary ?? "");
      setOpeningNarrationDone(saved.openingNarrationDone ?? false);
      // Guard against a corrupted/malformed localStorage entry: a
      // non-array rawHistory would otherwise throw the first time it's
      // spread in processIncomingChat, and that throw is swallowed by the
      // queued turn handler's own catch - AutoGM would silently stop
      // responding to every future message with no diagnostic trail.
      const history = Array.isArray(saved.rawHistory) ? saved.rawHistory : [];
      setRawHistory(history);
      historyRef.current = history;
    }
    setRestoreComplete(true);
  }, [isGM, gameId, hostName]);

  // GM only: persist AutoGM state so a refresh can restore it above.
  useEffect(() => {
    if (!isGM || !gameId || !hostName || !restoreComplete) return;
    saveAutoGmState(gameId, hostName, {
      enabled: autoGmEnabled,
      storySummary,
      rawHistory,
      openingNarrationDone,
    });
  }, [
    isGM,
    gameId,
    hostName,
    restoreComplete,
    autoGmEnabled,
    storySummary,
    rawHistory,
    openingNarrationDone,
  ]);

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

  // Broadcasts AutoGM's busy/idle state so every player (not just the GM's
  // own browser) can show what it's currently doing - `value` is one of
  // AUTOGM_STATUS's status strings while busy, or `false` once idle. The GM
  // applies it to its own local state directly and separately broadcasts,
  // the same pattern every other GM-only setting update in this app uses
  // (see AdminPanel.jsx).
  const setThinking = useCallback(
    (value) => {
      setAutoGmThinking(value);
      sendToPeers({
        type: MESSAGE_TYPES.AUTOGM_THINKING_UPDATE,
        autoGmThinking: value,
      });
    },
    [setAutoGmThinking, sendToPeers]
  );

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

  // Checks a draft narration line against established story facts before
  // it's ever posted, so AutoGM can catch and correct its own
  // inconsistencies rather than blindly posting a first draft. Fail-soft:
  // if the check itself fails/invalid, the original draft is posted
  // unchanged rather than blocking narration on a second model call
  // succeeding.
  const selfCheckNarration = useCallback(
    async (draftNarration) => {
      const context = buildAutoGmSelfCheckContext({
        draftNarration,
        storySummary,
        rawHistory: historyRef.current,
        campaignNotes,
        characters,
        dangerProbability,
        awaitingReset,
      });
      const result = await runPromptWithTimeout(runPrompt, {
        systemPromptText: latest("autogmSelfCheck").text,
        userContent: context,
        schema: autoGmSelfCheckSchema,
        validate: validateAutoGmSelfCheck,
      });
      if (!result.valid) {
        return {
          finalNarration: draftNarration,
          reasoning: null,
          consistent: null,
        };
      }
      const { consistent, reasoning, revisedNarration } = result.parsed;
      return {
        finalNarration: consistent
          ? draftNarration
          : revisedNarration || draftNarration,
        reasoning,
        consistent,
      };
    },
    [
      storySummary,
      campaignNotes,
      characters,
      dangerProbability,
      awaitingReset,
      runPrompt,
    ]
  );

  // Rebuilds the entire campaignNotes list from scratch after a turn calls
  // out any updates, rather than fuzzy-matching just the new item into the
  // existing list in isolation (applyCampaignNoteUpdates's normalize() only
  // catches leading-article/casing differences - a small local model kept
  // creating real duplicates under genuinely different wording, e.g. "the
  // old furnace" vs "the foundry's furnace"). Giving a dedicated pass the
  // full current list plus the new update(s) and asking it to return the
  // whole de-duplicated list lets it use real judgment instead of a crude
  // string heuristic. Fail-soft: on an invalid/failed result, falls back to
  // the deterministic fuzzy-match merge so an update is never lost outright.
  const consolidateCampaignNotes = useCallback(
    async (updates) => {
      const context = buildAutoGmCampaignNotesConsolidationContext({
        campaignNotes,
        campaignNoteUpdates: updates,
      });
      const result = await runPromptWithTimeout(runPrompt, {
        systemPromptText: latest("autogmCampaignNotesConsolidation").text,
        userContent: context,
        schema: autoGmCampaignNotesConsolidationSchema,
        validate: validateAutoGmCampaignNotesConsolidation,
      });
      if (!result.valid) {
        return applyCampaignNoteUpdates(campaignNotes, updates);
      }
      return reconcileConsolidatedNotes(result.parsed, campaignNotes);
    },
    [campaignNotes, runPrompt]
  );

  // Runs a small, focused classification pass BEFORE the main turn prompt
  // to decide whether the triggering player's own declared action requires
  // a pull, and if so, calls assignSpinner directly - enforced in code
  // rather than left to the same creative-writing prompt that decides
  // narration, which in practice almost never called for a pull even on
  // unambiguous risky actions (kicking down a door, stepping into a
  // furnace). Only ever targets the acting player themselves (never an NPC
  // or a different player - that's still the main turn prompt's job, e.g.
  // for one player provoking another). Returns null when no pull applies
  // (including when the trigger has no identity - a synthetic "System"
  // trigger like the opening narration - or the actor isn't a currently
  // valid pull target).
  const checkForPull = useCallback(
    async (trigger) => {
      if (!trigger?.fromIdentity || awaitingReset) return null;
      const activeTargets = getActivePullTargets({ characters, presence });
      if (!activeTargets.includes(trigger.fromIdentity)) return null;

      setThinking(AUTOGM_STATUS.CHECKING_PULL);
      const context = buildAutoGmPullCheckContext({
        actionText: trigger.text,
        actorName: characterNameFor(characters, trigger.fromIdentity),
        scenario,
      });
      const result = await runPromptWithTimeout(runPrompt, {
        systemPromptText: latest("autogmPullCheck").text,
        userContent: context,
        schema: autoGmPullCheckSchema,
        validate: validateAutoGmPullCheck,
      });
      if (!result.valid || !result.parsed.requiresPull) return null;

      const pullsRequired = Math.min(
        10,
        Math.max(1, result.parsed.pullsRequired || 1)
      );
      assignSpinner(trigger.fromIdentity, pullsRequired);
      return { targetPlayerName: trigger.fromIdentity, pullsRequired };
    },
    [
      awaitingReset,
      characters,
      presence,
      scenario,
      runPrompt,
      assignSpinner,
      setThinking,
    ]
  );

  // Runs one AutoGM turn: asks the model to react to the given history
  // (ending with the message that just triggered this turn), then acts on
  // whatever it decides - posting narration, calling for a pull, restacking
  // a frozen tower, and/or noting new campaign facts. Every fact fed into
  // the prompt is read live from usePeer()/useWheel() rather than trusted
  // from earlier turns, so a turn is always grounded in the actual current
  // game state.
  const runTurn = useCallback(
    async (history, trigger) => {
      const classifierPull = await checkForPull(trigger);

      setThinking(AUTOGM_STATUS.THINKING);
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
        pullJustCalled: classifierPull,
      });
      const result = await runPromptWithTimeout(runPrompt, {
        systemPromptText: latest("autogmTurn").text,
        userContent: context,
        schema: autoGmTurnSchema,
        validate: validateAutoGmTurn,
      });

      if (!result.valid) {
        const reason = describePromptFailure(result);
        setAutoGmError(`AutoGM couldn't generate a response: ${reason}`);
        pushTurnLogEntry({
          kind: "error",
          trigger,
          draftNarration: null,
          finalNarration: null,
          reasoning: null,
          consistent: null,
          callForPull: false,
          targetPlayerName: "",
          pullsRequired: 1,
          readyToRestack: false,
          awaitingResetAtTurn: awaitingReset,
          campaignNoteUpdates: [],
          pullSkippedReason: null,
          error: reason,
        });
        return false;
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

      let finalNarration = narration;
      let reasoning = null;
      let consistent = null;
      if (narration) {
        setThinking(AUTOGM_STATUS.SELF_CHECKING);
        const checked = await selfCheckNarration(narration);
        finalNarration = checked.finalNarration;
        reasoning = checked.reasoning;
        consistent = checked.consistent;
        sendSystemChatMessage(finalNarration, { from: "GM", fromBot: true });
        // AutoGM's own narration otherwise never re-enters rawHistory (it's
        // posted via sendSystemChatMessage, not notifyAutoGmChat) - without
        // this, the model would have no memory of what it itself just said
        // beyond the rolling summary, making it prone to repeating itself or
        // losing continuity turn to turn.
        historyRef.current = [
          ...historyRef.current,
          { from: "GM", text: finalNarration },
        ];
        setRawHistory(historyRef.current);
      }

      const {
        callForPull: finalCallForPull,
        targetPlayerName: finalTargetPlayerName,
        pullsRequired: finalPullsRequired,
        pullSkippedReason,
      } = resolveMainPromptPull({
        classifierPull,
        callForPull,
        targetPlayerName,
        pullsRequired,
        characters,
        presence,
        awaitingReset,
        assignSpinner,
      });

      if (readyToRestack && awaitingReset) {
        handleRestack();
      }

      if (campaignNoteUpdates?.length) {
        setThinking(AUTOGM_STATUS.UPDATING_NOTES);
        setCampaignNotes(await consolidateCampaignNotes(campaignNoteUpdates));
      }

      pushTurnLogEntry({
        kind: "turn",
        trigger,
        draftNarration: narration,
        finalNarration,
        reasoning,
        consistent,
        callForPull: finalCallForPull,
        targetPlayerName: finalTargetPlayerName,
        pullsRequired: finalPullsRequired,
        readyToRestack,
        awaitingResetAtTurn: awaitingReset,
        campaignNoteUpdates,
        pullSkippedReason,
      });
      return true;
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
      checkForPull,
      selfCheckNarration,
      consolidateCampaignNotes,
      sendSystemChatMessage,
      assignSpinner,
      handleRestack,
      setCampaignNotes,
      pushTurnLogEntry,
      setThinking,
    ]
  );

  // Folds the retiring raw-history window into one updated running summary,
  // fail-soft: on any failure, the prior summary is kept rather than losing
  // everything compaction was meant to preserve.
  const compact = useCallback(
    async (history) => {
      const context = buildAutoGmCompactionContext({
        priorSummary: storySummary,
        rawHistory: history,
      });
      const result = await runPromptWithTimeout(runPrompt, {
        systemPromptText: latest("autogmCompaction").text,
        userContent: context,
        schema: autoGmCompactionSchema,
        validate: validateAutoGmCompaction,
      });
      if (!result.valid) {
        setAutoGmError(
          `AutoGM couldn't compact the story summary (kept the prior one): ${describePromptFailure(result)}`
        );
        return storySummary;
      }
      return result.parsed.summary;
    },
    [storySummary, runPrompt]
  );

  // Posts one additional, richer line of narration after a character is
  // removed (the terse, mechanical deathFlavorText line already posted
  // separately from WheelProvider.jsx) - see autogm-removal-narration.v1.md
  // for the copyright/original-content constraints this must follow.
  const runRemovalNarration = useCallback(
    async (characterName) => {
      setThinking(AUTOGM_STATUS.THINKING);
      try {
        const context = buildAutoGmRemovalNarrationContext({
          characterName,
          scenario,
          storySummary,
          rawHistory: historyRef.current,
          campaignNotes,
        });
        const result = await runPromptWithTimeout(runPrompt, {
          systemPromptText: latest("autogmRemovalNarration").text,
          userContent: context,
          schema: autoGmRemovalNarrationSchema,
          validate: validateAutoGmRemovalNarration,
        });

        if (!result.valid) {
          const reason = describePromptFailure(result);
          setAutoGmError(
            `AutoGM couldn't generate removal narration: ${reason}`
          );
          pushTurnLogEntry({
            kind: "error",
            trigger: null,
            draftNarration: null,
            finalNarration: null,
            reasoning: null,
            consistent: null,
            callForPull: false,
            targetPlayerName: "",
            pullsRequired: 1,
            readyToRestack: false,
            awaitingResetAtTurn: awaitingReset,
            campaignNoteUpdates: [],
            pullSkippedReason: null,
            error: reason,
          });
          return;
        }
        setAutoGmError(null);

        const draftNarration = result.parsed.narration;
        setThinking(AUTOGM_STATUS.SELF_CHECKING);
        const { finalNarration, reasoning, consistent } =
          await selfCheckNarration(draftNarration);
        sendSystemChatMessage(finalNarration, { from: "GM", fromBot: true });
        historyRef.current = [
          ...historyRef.current,
          { from: "GM", text: finalNarration },
        ];
        setRawHistory(historyRef.current);

        pushTurnLogEntry({
          kind: "removal",
          trigger: null,
          draftNarration,
          finalNarration,
          reasoning,
          consistent,
          callForPull: false,
          targetPlayerName: "",
          pullsRequired: 1,
          readyToRestack: false,
          awaitingResetAtTurn: awaitingReset,
          campaignNoteUpdates: [],
          pullSkippedReason: null,
        });
      } finally {
        setThinking(false);
      }
    },
    [
      scenario,
      storySummary,
      campaignNotes,
      awaitingReset,
      runPrompt,
      selfCheckNarration,
      sendSystemChatMessage,
      pushTurnLogEntry,
      setThinking,
    ]
  );

  // Detects a death (awaitingReset flipping false->true) and narrates the
  // removal of whichever character's `alive` just flipped to false. Ref
  // updates run unconditionally, before the isGM/autoGmEnabled check, so
  // they can't drift out of sync if AutoGM is toggled mid-session.
  useEffect(() => {
    const wasAwaitingReset = prevAwaitingResetRef.current;
    prevAwaitingResetRef.current = awaitingReset;
    const prevCharacters = prevCharactersRef.current;
    prevCharactersRef.current = characters;

    if (!isGM || !autoGmEnabled) return;
    if (wasAwaitingReset || !awaitingReset) return;

    const removed = Object.values(characters || {}).find((character) => {
      const before = prevCharacters?.[character.id];
      return character.alive === false && before && before.alive !== false;
    });
    if (!removed) return;

    queueRef.current = queueRef.current
      .then(() => runRemovalNarration(removed.name))
      .catch(() => {});
  }, [awaitingReset, characters, isGM, autoGmEnabled, runRemovalNarration]);

  // Folds `history` into storySummary and returns a fresh, single-message
  // window (just the most recent entry) to replace it with - shared by the
  // scheduled compaction below and the failure-recovery path, both of
  // which need the exact same "shrink it down" behavior.
  const compactHistory = useCallback(
    async (history) => {
      const newSummary = await compact(history);
      setStorySummary(newSummary);
      return history.length ? [history[history.length - 1]] : [];
    },
    [compact]
  );

  // Every human-authored chat message (inbound over the network, or the
  // GM's own local send via notifyAutoGmChat - see PeerProvider.jsx) lands
  // here. AutoGM's own narration is sent via sendSystemChatMessage, which
  // never invokes this handler, so there's no feedback-loop risk.
  //
  // Once the raw window grows past RAW_HISTORY_COMPACTION_THRESHOLD
  // messages, it's folded into storySummary and the window resets to just
  // the message that triggered this turn - keeps the context sent to the
  // model bounded without losing track of where the story stands.
  const processIncomingChat = useCallback(
    async (data) => {
      if (!isGM || !autoGmEnabled) return;
      setThinking(AUTOGM_STATUS.THINKING);
      try {
        const trigger = {
          from: data.from,
          text: data.text,
          fromIdentity: data.fromIdentity,
        };
        let history = [...historyRef.current, trigger];
        if (history.length > RAW_HISTORY_COMPACTION_THRESHOLD) {
          setThinking(AUTOGM_STATUS.COMPACTING);
          history = await compactHistory(history);
          historyRef.current = history;
          setRawHistory(history);
        } else {
          historyRef.current = history;
          setRawHistory(history);
        }
        let succeeded = await runTurn(history, trigger);
        if (!succeeded && history.length > 1) {
          // A turn failing to produce valid structured output most likely
          // means the context has grown too large/complex for the model to
          // handle reliably - left alone, the exact same context would be
          // sent again on every future message and fail identically
          // forever, since it otherwise only shrinks at the next scheduled
          // compaction. Proactively fold it down to a clean, minimal window
          // and give the model one immediate extra attempt, so a bad
          // context can't permanently wedge the story.
          setThinking(AUTOGM_STATUS.COMPACTING);
          history = await compactHistory(history);
          historyRef.current = history;
          setRawHistory(history);
          succeeded = await runTurn(history, trigger);
        }
        if (!succeeded) {
          // Both attempts failed even against a freshly-shrunk context -
          // whatever's wrong isn't (just) context size. Post something
          // rather than leaving players staring at total silence with no
          // idea whether AutoGM is still running at all.
          sendSystemChatMessage(
            "The GM pauses for a moment, gathering their thoughts... " +
              "(AutoGM had trouble responding - try continuing, or check " +
              "the Admin Panel's AutoGM debug panel.)",
            { from: "GM", fromBot: true }
          );
        }
      } finally {
        setThinking(false);
      }
    },
    [
      isGM,
      autoGmEnabled,
      compactHistory,
      runTurn,
      setThinking,
      sendSystemChatMessage,
    ]
  );

  useEffect(() => {
    registerAutoGmChatEventHandler((data) => {
      queueRef.current = queueRef.current
        .then(() => processIncomingChat(data))
        .catch(() => {});
    });
  }, [registerAutoGmChatEventHandler, processIncomingChat]);

  // One-time opening beat: as soon as the game has started (in either
  // order relative to enabling AutoGM) and no opening narration has run yet
  // for this game, feed a synthetic "System" trigger through the normal
  // turn pipeline so the model introduces the scenario and describes where
  // each character currently is - the same reasoning/self-check/history
  // bookkeeping as any other turn, just never actually shown to players as
  // a raw instruction (it's not posted to chat, only its resulting
  // narration is).
  useEffect(() => {
    if (!isGM || !autoGmEnabled || !gameStarted || openingNarrationDone) {
      return;
    }
    setOpeningNarrationDone(true);
    queueRef.current = queueRef.current
      .then(() =>
        processIncomingChat({
          from: "System",
          text: "The game has just begun. Introduce the scenario to the players and describe where each character currently is.",
        })
      )
      .catch(() => {});
  }, [
    isGM,
    autoGmEnabled,
    gameStarted,
    openingNarrationDone,
    processIncomingChat,
  ]);

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
