// Model tiers the opt-in AI assistant can download, keyed by detected
// device capability - see src/ai/device/deviceTier.js for how a tier gets
// picked. Model IDs are WebLLM prebuilt model IDs (verify against the
// installed @mlc-ai/web-llm version's prebuiltAppConfig.model_list before
// changing these - both the IDs and their exact VRAM/RAM needs shift
// between releases).
export const MODEL_TIERS = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
  UNSUPPORTED: "unsupported",
};

export const TIER_MODEL_CONFIG = {
  [MODEL_TIERS.SMALL]: {
    modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Small (fastest, least capable)",
    approxDownloadSizeGB: 0.9,
    description:
      "Best for low-memory or mobile devices. Quick to download, but weaker at longer creative writing.",
  },
  [MODEL_TIERS.MEDIUM]: {
    modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Medium (balanced)",
    approxDownloadSizeGB: 2.3,
    description:
      "Good balance of quality and download size for most modern laptops and desktops.",
  },
  [MODEL_TIERS.LARGE]: {
    modelId: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    label: "Large (best quality)",
    approxDownloadSizeGB: 5.0,
    description:
      "Best narrative quality. Needs a dedicated GPU or a device with plenty of RAM (16GB+ recommended).",
  },
};
