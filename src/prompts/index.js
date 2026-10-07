import scenarioGenerationV1 from "./scenario-generation.v1.md?raw";
import castGenerationV1 from "./cast-generation.v1.md?raw";
import sheetAnswerAssistV1 from "./sheet-answer-assist.v1.md?raw";
import campaignNotesGenerationV1 from "./campaign-notes-generation.v1.md?raw";
import autogmTurnV1 from "./autogm-turn.v1.md?raw";
import autogmTurnV2 from "./autogm-turn.v2.md?raw";
import autogmTurnV3 from "./autogm-turn.v3.md?raw";
import autogmPullCheckV1 from "./autogm-pull-check.v1.md?raw";
import autogmCampaignNotesConsolidationV1 from "./autogm-campaign-notes-consolidation.v1.md?raw";
import autogmCampaignNotesConsolidationV2 from "./autogm-campaign-notes-consolidation.v2.md?raw";
import autogmRemovalNarrationV1 from "./autogm-removal-narration.v1.md?raw";
import autogmCompactionV1 from "./autogm-compaction.v1.md?raw";
import autogmCompactionV2 from "./autogm-compaction.v2.md?raw";
import autogmSelfCheckV1 from "./autogm-self-check.v1.md?raw";
import autogmSelfCheckV2 from "./autogm-self-check.v2.md?raw";
import autogmSelfCheckV3 from "./autogm-self-check.v3.md?raw";
import autogmScenePacingV1 from "./autogm-scene-pacing.v1.md?raw";

// Versioned system-prompt registry. Product code always uses latest();
// the dev-only prompt-testing harness can pick any version to compare
// wording changes against each other.
const REGISTRY = {
  scenarioGeneration: [{ version: 1, text: scenarioGenerationV1 }],
  castGeneration: [{ version: 1, text: castGenerationV1 }],
  sheetAnswerAssist: [{ version: 1, text: sheetAnswerAssistV1 }],
  campaignNotesGeneration: [{ version: 1, text: campaignNotesGenerationV1 }],
  autogmTurn: [
    { version: 1, text: autogmTurnV1 },
    { version: 2, text: autogmTurnV2 },
    { version: 3, text: autogmTurnV3 },
  ],
  autogmPullCheck: [{ version: 1, text: autogmPullCheckV1 }],
  autogmCampaignNotesConsolidation: [
    { version: 1, text: autogmCampaignNotesConsolidationV1 },
    { version: 2, text: autogmCampaignNotesConsolidationV2 },
  ],
  autogmRemovalNarration: [{ version: 1, text: autogmRemovalNarrationV1 }],
  autogmCompaction: [
    { version: 1, text: autogmCompactionV1 },
    { version: 2, text: autogmCompactionV2 },
  ],
  autogmSelfCheck: [
    { version: 1, text: autogmSelfCheckV1 },
    { version: 2, text: autogmSelfCheckV2 },
    { version: 3, text: autogmSelfCheckV3 },
  ],
  autogmScenePacing: [{ version: 1, text: autogmScenePacingV1 }],
};

export function versionsFor(name) {
  return REGISTRY[name] || [];
}

export function latest(name) {
  const versions = versionsFor(name);
  return versions[versions.length - 1];
}
