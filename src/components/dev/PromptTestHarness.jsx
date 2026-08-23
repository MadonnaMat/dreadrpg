import { useEffect, useRef, useState } from "react";
import { useAi } from "../../hooks/useAi";
import { versionsFor } from "../../prompts/index";
import { DEV_FIXTURES } from "../../ai/devFixtures";
import { runStructuredPrompt } from "../../ai/promptRunner";
import { MODEL_TIERS, TIER_MODEL_CONFIG } from "../../constants/aiModels";
import {
  buildScenarioGenerationContext,
  buildCastGenerationContext,
  buildSheetAnswerContext,
} from "../../ai/promptContexts";
import {
  scenarioSchema,
  validate as validateScenario,
} from "../../ai/schemas/scenarioSchema";
import {
  castSchema,
  validate as validateCast,
} from "../../ai/schemas/castSchema";
import {
  sheetAnswerSchema,
  validate as validateSheetAnswer,
} from "../../ai/schemas/sheetAnswerSchema";

const PROMPT_KINDS = [
  {
    name: "scenarioGeneration",
    label: "Scenario generation",
    buildContext: buildScenarioGenerationContext,
    schema: scenarioSchema,
    validate: validateScenario,
  },
  {
    name: "castGeneration",
    label: "Cast generation",
    buildContext: buildCastGenerationContext,
    schema: castSchema,
    validate: validateCast,
  },
  {
    name: "sheetAnswerAssist",
    label: "Sheet answer assist",
    buildContext: buildSheetAnswerContext,
    schema: sheetAnswerSchema,
    validate: validateSheetAnswer,
  },
];

const OVERRIDE_TIERS = [
  MODEL_TIERS.SMALL,
  MODEL_TIERS.MEDIUM,
  MODEL_TIERS.LARGE,
];

// Dev-only tool for iterating on src/prompts/*.md wording: run a canned or
// custom input against a chosen prompt version and inspect the raw/parsed
// output, without needing to reach that flow through the real GM/player UI.
// Never shipped - see the import.meta.env.DEV gate wherever this is loaded.
export default function PromptTestHarness() {
  const { runPrompt, aiEnabled, modelTier } = useAi();

  const [kindName, setKindName] = useState(PROMPT_KINDS[0].name);
  const kind = PROMPT_KINDS.find((k) => k.name === kindName);
  const versions = versionsFor(kindName);
  const [version, setVersion] = useState(
    versions[versions.length - 1]?.version
  );
  const fixtures = DEV_FIXTURES[kindName] || [];
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [overrideInput, setOverrideInput] = useState("");
  const [harnessTier, setHarnessTier] = useState(null);
  const [harnessStatus, setHarnessStatus] = useState("idle");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);

  const harnessEngineRef = useRef(null);
  const harnessEngineTierRef = useRef(null);

  useEffect(() => {
    return () => {
      harnessEngineRef.current?.dispose();
    };
  }, []);

  const handleKindChange = (name) => {
    setKindName(name);
    const newVersions = versionsFor(name);
    setVersion(newVersions[newVersions.length - 1]?.version);
    setFixtureIndex(0);
    setOverrideInput("");
  };

  // Reuses the shared AiProvider engine when the harness's tier selector is
  // left on "use active engine" (or matches it), and otherwise spins up its
  // own independent engine at the chosen tier - a deliberate memory-cost
  // tradeoff this dev-only tool accepts so wording can be compared across
  // tiers without disabling the real opt-in engine.
  async function getEngineForRun() {
    if (!harnessTier || harnessTier === modelTier) {
      return null;
    }
    if (harnessEngineTierRef.current === harnessTier) {
      return harnessEngineRef.current;
    }
    harnessEngineRef.current?.dispose();
    setHarnessStatus("loading");
    const { createLlmEngine } = await import("../../ai/engine/webllmEngine");
    const engine = await createLlmEngine({
      modelId: TIER_MODEL_CONFIG[harnessTier].modelId,
      onProgress: () => {},
    });
    harnessEngineRef.current = engine;
    harnessEngineTierRef.current = harnessTier;
    setHarnessStatus("ready");
    return engine;
  }

  const handleRun = async () => {
    setRunning(true);
    const promptEntry =
      versions.find((v) => v.version === version) ||
      versions[versions.length - 1];

    let input;
    try {
      input = overrideInput.trim()
        ? JSON.parse(overrideInput)
        : fixtures[fixtureIndex]?.input;
    } catch {
      setHistory((prev) => [
        {
          at: Date.now(),
          kindName,
          version,
          errors: ["Override input is not valid JSON."],
        },
        ...prev,
      ]);
      setRunning(false);
      return;
    }

    const userContent = kind.buildContext(input || {});
    let result;
    try {
      const independentEngine = await getEngineForRun();
      result = independentEngine
        ? await runStructuredPrompt({
            engine: independentEngine,
            systemPromptText: promptEntry?.text || "",
            userContent,
            schema: kind.schema,
            validate: kind.validate,
          })
        : await runPrompt({
            systemPromptText: promptEntry?.text || "",
            userContent,
            schema: kind.schema,
            validate: kind.validate,
          });
    } catch (err) {
      result = {
        valid: false,
        errors: [err.message || "Failed to run prompt."],
      };
    }

    setHistory((prev) => [
      { at: Date.now(), kindName, version, userContent, ...result },
      ...prev,
    ]);
    setRunning(false);
  };

  const canRun = running === false && (aiEnabled || Boolean(harnessTier));

  return (
    <div className="prompt-test-harness">
      <h3>Prompt test harness (dev only)</h3>

      <label>
        Prompt
        <select
          value={kindName}
          onChange={(e) => handleKindChange(e.target.value)}
        >
          {PROMPT_KINDS.map((k) => (
            <option key={k.name} value={k.name}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Version
        <select
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version}
            </option>
          ))}
        </select>
      </label>

      <label>
        Fixture
        <select
          value={fixtureIndex}
          onChange={(e) => setFixtureIndex(Number(e.target.value))}
        >
          {fixtures.map((fixture, index) => (
            <option key={fixture.label} value={index}>
              {fixture.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Model
        <select
          value={harnessTier || ""}
          onChange={(e) => setHarnessTier(e.target.value || null)}
        >
          <option value="">
            Use active engine
            {modelTier
              ? ` (${TIER_MODEL_CONFIG[modelTier]?.label})`
              : " (none enabled)"}
          </option>
          {OVERRIDE_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {TIER_MODEL_CONFIG[tier].label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Override input (JSON, optional)
        <textarea
          className="ai-textarea"
          value={overrideInput}
          onChange={(e) => setOverrideInput(e.target.value)}
          placeholder={JSON.stringify(fixtures[fixtureIndex]?.input, null, 2)}
          rows={4}
        />
      </label>

      {harnessStatus === "loading" && <p>Loading override-tier model…</p>}

      <button onClick={handleRun} disabled={!canRun}>
        {running ? "Running…" : "Run"}
      </button>

      <div className="prompt-test-history">
        {history.map((entry) => (
          <div key={entry.at} className="prompt-test-entry">
            <div>
              <strong>{entry.kindName}</strong> v{entry.version} -{" "}
              {entry.valid ? "valid" : "invalid"}
              {typeof entry.latencyMs === "number" && ` - ${entry.latencyMs}ms`}
              {typeof entry.attempts === "number" &&
                ` - ${entry.attempts} attempt(s)`}
            </div>
            {entry.raw && <pre>{entry.raw}</pre>}
            {entry.parsed && <pre>{JSON.stringify(entry.parsed, null, 2)}</pre>}
            {entry.errors?.length > 0 && <pre>{entry.errors.join("\n")}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
}
