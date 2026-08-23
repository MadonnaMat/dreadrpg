import { useCallback, useEffect, useRef, useState } from "react";
import { AiContext } from "../contexts/AiContext";
import {
  getRawCapabilitySignals,
  recommendTier,
} from "../ai/device/deviceTier";
import {
  MODEL_TIERS,
  TIER_MODEL_CONFIG,
  ENGINE_STATUS,
} from "../constants/aiModels";
import {
  saveAiPreference,
  loadAiPreference,
} from "./ai/aiPreferencePersistence";
import { runStructuredPrompt } from "../ai/promptRunner";
import { latest } from "../prompts/index";
import {
  buildScenarioGenerationContext,
  buildCastGenerationContext,
  buildSheetAnswerContext,
} from "../ai/promptContexts";
import {
  scenarioSchema,
  validate as validateScenario,
} from "../ai/schemas/scenarioSchema";
import { castSchema, validate as validateCast } from "../ai/schemas/castSchema";
import {
  sheetAnswerSchema,
  validate as validateSheetAnswer,
} from "../ai/schemas/sheetAnswerSchema";

// Local-only AI assistant state - deliberately never imports usePeer()/
// PeerContext. Inference runs entirely client-side per browser; the
// generation functions below only ever return a drafted result for a
// caller to place into local component state, never touch the network
// themselves. See docs/autogm-requirements.md for why a future AutoGM
// mode will need a different trust model than this one.
export function AiProvider({ children }) {
  const [engineStatus, setEngineStatus] = useState(ENGINE_STATUS.IDLE);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [modelTier, setModelTier] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  // A previously-saved opt-in, offered back to the user as a one-tap
  // "re-enable" rather than auto-starting a download on every reload -
  // opt-in has to stay opt-in even across sessions.
  const [savedPreference, setSavedPreference] = useState(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const saved = loadAiPreference();
    if (saved?.optedIn && saved.tier) {
      setSavedPreference(saved);
    }
  }, []);

  const aiEnabled = engineStatus === ENGINE_STATUS.READY;

  const detectRecommendedTier = useCallback(async () => {
    const signals = await getRawCapabilitySignals();
    return recommendTier(signals);
  }, []);

  const enableAi = useCallback(
    async (tierArg) => {
      setEngineStatus(ENGINE_STATUS.DETECTING);
      setErrorMessage(null);

      const tier = tierArg || (await detectRecommendedTier());

      if (tier === MODEL_TIERS.UNSUPPORTED) {
        setEngineStatus(ENGINE_STATUS.UNSUPPORTED);
        return;
      }

      const config = TIER_MODEL_CONFIG[tier];
      setModelTier(tier);
      setEngineStatus(ENGINE_STATUS.DOWNLOADING);
      setDownloadProgress(null);

      try {
        // Dynamically imported so @mlc-ai/web-llm (several MB) is its own
        // chunk, fetched only once someone actually opts in - it must never
        // sit in the app's main bundle for players who never touch AI.
        const { createLlmEngine } = await import("../ai/engine/webllmEngine");
        const engine = await createLlmEngine({
          modelId: config.modelId,
          onProgress: setDownloadProgress,
        });
        engineRef.current = engine;
        setEngineStatus(ENGINE_STATUS.READY);
        saveAiPreference({ optedIn: true, tier });
        setSavedPreference({ optedIn: true, tier });
      } catch (err) {
        setErrorMessage(err.message || "Failed to load the AI model.");
        setEngineStatus(ENGINE_STATUS.ERROR);
      }
    },
    [detectRecommendedTier]
  );

  const disableAi = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setEngineStatus(ENGINE_STATUS.IDLE);
    setDownloadProgress(null);
    const preference = { optedIn: false, tier: modelTier };
    saveAiPreference(preference);
    setSavedPreference(preference);
  }, [modelTier]);

  const runPrompt = useCallback(
    ({ systemPromptText, userContent, schema, validate, maxRetries }) => {
      if (!engineRef.current) {
        return Promise.resolve({
          raw: "",
          parsed: null,
          valid: false,
          errors: ["AI is not enabled."],
          attempts: 0,
          latencyMs: 0,
        });
      }
      return runStructuredPrompt({
        engine: engineRef.current,
        systemPromptText,
        userContent,
        schema,
        validate,
        maxRetries,
      });
    },
    []
  );

  const generateScenario = useCallback(
    (input) =>
      runPrompt({
        systemPromptText: latest("scenarioGeneration").text,
        userContent: buildScenarioGenerationContext(input),
        schema: scenarioSchema,
        validate: validateScenario,
      }),
    [runPrompt]
  );

  const generateCast = useCallback(
    (input) =>
      runPrompt({
        systemPromptText: latest("castGeneration").text,
        userContent: buildCastGenerationContext(input),
        schema: castSchema,
        validate: validateCast,
      }),
    [runPrompt]
  );

  const suggestAnswer = useCallback(
    (input) =>
      runPrompt({
        systemPromptText: latest("sheetAnswerAssist").text,
        userContent: buildSheetAnswerContext(input),
        schema: sheetAnswerSchema,
        validate: validateSheetAnswer,
      }),
    [runPrompt]
  );

  return (
    <AiContext.Provider
      value={{
        aiEnabled,
        engineStatus,
        downloadProgress,
        modelTier,
        errorMessage,
        savedPreference,
        enableAi,
        disableAi,
        detectRecommendedTier,
        generateScenario,
        generateCast,
        suggestAnswer,
        runPrompt,
      }}
    >
      {children}
    </AiContext.Provider>
  );
}
