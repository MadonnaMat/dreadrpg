import { useEffect, useState } from "react";
import { useAi } from "../../hooks/useAi";
import {
  MODEL_TIERS,
  TIER_MODEL_CONFIG,
  ENGINE_STATUS,
} from "../../constants/aiModels";

const TIER_ORDER = [MODEL_TIERS.SMALL, MODEL_TIERS.MEDIUM, MODEL_TIERS.LARGE];

export default function AiSettingsPanel() {
  const {
    engineStatus,
    downloadProgress,
    modelTier,
    errorMessage,
    savedPreference,
    enableAi,
    disableAi,
    detectRecommendedTier,
  } = useAi();

  const [recommendedTier, setRecommendedTier] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  // Detect once on mount only - picking a different tier afterward is an
  // explicit user override the UI must respect, not something a later
  // re-detection should silently overwrite.
  useEffect(() => {
    let cancelled = false;
    detectRecommendedTier().then((tier) => {
      if (cancelled) return;
      setRecommendedTier(tier);
      setSelectedTier(
        savedPreference?.tier ||
          (tier !== MODEL_TIERS.UNSUPPORTED ? tier : null)
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (engineStatus === ENGINE_STATUS.READY) {
    return (
      <div className="ai-settings-panel">
        <p>AI assistance is enabled ({TIER_MODEL_CONFIG[modelTier]?.label}).</p>
        <button className="btn-danger" onClick={disableAi}>
          Disable AI Assistance
        </button>
      </div>
    );
  }

  if (recommendedTier === MODEL_TIERS.UNSUPPORTED) {
    return (
      <div className="ai-settings-panel">
        <p className="ai-unsupported-message">
          AI assistance isn&apos;t supported on this browser or device (no
          WebGPU detected). Try a recent version of Chrome or Edge on a desktop
          device.
        </p>
      </div>
    );
  }

  const isBusy =
    engineStatus === ENGINE_STATUS.DETECTING ||
    engineStatus === ENGINE_STATUS.DOWNLOADING;

  return (
    <div className="ai-settings-panel">
      <p>
        Opt in to a local AI assistant that can help draft scenarios, character
        questionnaires, and answer suggestions. Nothing downloads until you
        enable it below, and everything it drafts here is only a suggestion for
        you to review before saving. (The separate AutoGM mode, available to the
        GM from the Admin Panel once this is on, goes further and lets the AI
        narrate and run the game live through chat on its own.)
      </p>

      {recommendedTier === null ? (
        <p>Checking your device&hellip;</p>
      ) : (
        <div className="ai-tier-selector">
          {TIER_ORDER.map((tier) => {
            const config = TIER_MODEL_CONFIG[tier];
            return (
              <label key={tier} className="ai-tier-option">
                <div>
                  <input
                    type="radio"
                    name="ai-tier"
                    value={tier}
                    checked={selectedTier === tier}
                    onChange={() => setSelectedTier(tier)}
                  />
                  {config.label}
                  {tier === recommendedTier ? " (recommended)" : ""} - ~
                  {config.approxDownloadSizeGB} GB
                </div>
                <span className="ai-tier-description">
                  {config.description}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {engineStatus === ENGINE_STATUS.DOWNLOADING && (
        <div className="ai-download-progress">
          <progress value={downloadProgress?.progress} max={1} />
          <span>{downloadProgress?.text || "Starting download…"}</span>
        </div>
      )}

      {engineStatus === ENGINE_STATUS.ERROR && errorMessage && (
        <p className="ai-error-message">{errorMessage}</p>
      )}

      <button
        className="btn-primary"
        disabled={!selectedTier || isBusy}
        onClick={() => enableAi(selectedTier)}
      >
        Enable AI Assistance
      </button>
    </div>
  );
}
