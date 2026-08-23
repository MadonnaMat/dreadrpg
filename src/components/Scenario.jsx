import React, { useState, useEffect } from "react";
import { usePeer } from "../hooks/usePeer";
import { useAi } from "../hooks/useAi";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import AiRefineBox from "./ai/AiRefineBox";

// Drafts a scenario via AI into the parent's editScenario for the GM to
// review and adjust - handleSaveScenario/handleCancelEdit in Scenario stay
// completely unaware of where editScenario's current values came from, so a
// draft is saved or discarded through the exact same path as a hand-typed
// one. Split out purely to keep Scenario's own complexity under lint's
// limit, mirroring how e.g. CharacterSheet.jsx splits GM/player panels out.
//
// `conversation` (the last successful result's own `messages`) lets a
// follow-up refinement ("make it scarier") continue the same conversation
// instead of starting over - see AiRefineBox and promptRunner.js's
// `history` param.
function ScenarioAiGenerator({ onGenerated }) {
  const { generateScenario, refineScenario } = useAi();
  const [premise, setPremise] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const [conversation, setConversation] = useState(null);

  const applyResult = (result) => {
    setGenerating(false);
    if (result.valid) {
      setErrors([]);
      setConversation(result.messages);
      onGenerated(result.parsed);
    } else {
      setErrors(
        result.errors.length
          ? result.errors
          : ["The AI didn't return a usable scenario. Try again."]
      );
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    applyResult(await generateScenario({ premise }));
  };

  const handleRefine = async (refinementText) => {
    setGenerating(true);
    applyResult(
      await refineScenario({ history: conversation, refinementText })
    );
  };

  return (
    <div className="ai-generate-section">
      <label>
        Premise for AI-generated scenario (optional)
        <textarea
          className="ai-textarea"
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
          rows={2}
          placeholder="e.g. A remote lighthouse keeper stops responding to radio contact."
        />
      </label>
      <button
        type="button"
        className="btn-secondary"
        disabled={generating}
        onClick={handleGenerate}
      >
        {generating
          ? "Generating…"
          : conversation
            ? "Start Over with AI"
            : "Generate with AI"}
      </button>
      {errors.length > 0 && (
        <ul className="ai-error-message">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {conversation && (
        <AiRefineBox onRefine={handleRefine} disabled={generating} />
      )}
    </div>
  );
}

// Read-only rendering of a saved scenario's fields. Split out purely to
// keep Scenario's own complexity under lint's limit - each optional field
// below is one more branch that used to live directly in Scenario.
function ScenarioDisplay({ scenario }) {
  return (
    <div>
      <h2>{scenario.title || "Untitled Scenario"}</h2>

      {scenario.description && (
        <div style={{ marginBottom: 16 }}>
          <h3>Description</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.description}</p>
        </div>
      )}

      {scenario.setting && (
        <div style={{ marginBottom: 16 }}>
          <h3>Setting</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.setting}</p>
        </div>
      )}

      {scenario.characters && (
        <div style={{ marginBottom: 16 }}>
          <h3>Characters & Roles</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.characters}</p>
        </div>
      )}

      {scenario.goals && (
        <div style={{ marginBottom: 16 }}>
          <h3>Goals & Objectives</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.goals}</p>
        </div>
      )}

      {scenario.threats && (
        <div style={{ marginBottom: 16 }}>
          <h3>Threats & Dangers</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.threats}</p>
        </div>
      )}

      {scenario.rules && (
        <div style={{ marginBottom: 16 }}>
          <h3>Special Rules & Notes</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{scenario.rules}</p>
        </div>
      )}

      {scenario.lastUpdated && (
        <div style={{ fontSize: "0.8em", color: "#666", marginTop: 16 }}>
          Last updated: {new Date(scenario.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function Scenario() {
  const {
    isGM,
    sendToPeers,
    registerScenarioEventHandler,
    scenario,
    setScenario,
  } = usePeer();
  const { aiEnabled } = useAi();

  const [isEditing, setIsEditing] = useState(false);
  const [editScenario, setEditScenario] = useState({
    title: "",
    description: "",
    setting: "",
    characters: "",
    goals: "",
    threats: "",
    rules: "",
  });

  // Initialize edit scenario with current scenario
  useEffect(() => {
    if (scenario) {
      setEditScenario(scenario);
    }
  }, [scenario]);

  // Register scenario event handler
  useEffect(() => {
    registerScenarioEventHandler((data) => {
      if (data.type === MESSAGE_TYPES.SCENARIO_UPDATE) {
        setScenario(data.scenario);
      }
    });
  }, [registerScenarioEventHandler, setScenario]);

  const handleSaveScenario = () => {
    const scenarioData = {
      ...editScenario,
      lastUpdated: new Date().toISOString(),
    };

    setScenario(scenarioData);
    setIsEditing(false);

    // Send to all connected users
    sendToPeers({
      type: MESSAGE_TYPES.SCENARIO_UPDATE,
      scenario: scenarioData,
    });
  };

  const handleCancelEdit = () => {
    setEditScenario(
      scenario || {
        title: "",
        description: "",
        setting: "",
        characters: "",
        goals: "",
        threats: "",
        rules: "",
      }
    );
    setIsEditing(false);
  };

  const handleFieldChange = (field, value) => {
    setEditScenario((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isEditing && isGM) {
    return (
      <div className="scenario-container">
        <h2>Setup Scenario</h2>

        {aiEnabled && (
          <ScenarioAiGenerator
            onGenerated={(parsed) =>
              setEditScenario((prev) => ({ ...prev, ...parsed }))
            }
          />
        )}

        <div className="scenario-field">
          <label>Scenario Title:</label>
          <input
            type="text"
            value={editScenario.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            placeholder="Enter scenario title..."
          />
        </div>

        <div className="scenario-field">
          <label>Description:</label>
          <textarea
            value={editScenario.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            placeholder="Describe the scenario overview..."
            rows={4}
          />
        </div>

        <div className="scenario-field">
          <label>Setting:</label>
          <textarea
            value={editScenario.setting}
            onChange={(e) => handleFieldChange("setting", e.target.value)}
            placeholder="Describe the time, place, and atmosphere..."
            rows={3}
          />
        </div>

        <div className="scenario-field">
          <label>Characters & Roles:</label>
          <textarea
            value={editScenario.characters}
            onChange={(e) => handleFieldChange("characters", e.target.value)}
            placeholder="Describe the characters players will portray or encounter..."
            rows={3}
          />
        </div>

        <div className="scenario-field">
          <label>Goals & Objectives:</label>
          <textarea
            value={editScenario.goals}
            onChange={(e) => handleFieldChange("goals", e.target.value)}
            placeholder="What are the players trying to accomplish?"
            rows={3}
          />
        </div>

        <div className="scenario-field">
          <label>Threats & Dangers:</label>
          <textarea
            value={editScenario.threats}
            onChange={(e) => handleFieldChange("threats", e.target.value)}
            placeholder="What dangers and obstacles will they face?"
            rows={3}
          />
        </div>

        <div className="scenario-field">
          <label>Special Rules & Notes:</label>
          <textarea
            value={editScenario.rules}
            onChange={(e) => handleFieldChange("rules", e.target.value)}
            placeholder="Any special rules, mechanics, or GM notes..."
            rows={3}
          />
        </div>

        <div className="scenario-buttons">
          <button onClick={handleSaveScenario} className="btn-success">
            Save Scenario
          </button>
          <button onClick={handleCancelEdit} className="btn-danger">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scenario-container">
      {isGM && (
        <div className="scenario-buttons" style={{ marginBottom: 16 }}>
          <button onClick={() => setIsEditing(true)} className="btn-primary">
            {scenario ? "Edit Scenario" : "Setup Scenario"}
          </button>
        </div>
      )}

      {scenario ? (
        <ScenarioDisplay scenario={scenario} />
      ) : (
        <div>
          <h2>Scenario</h2>
          <p style={{ color: "#666", fontStyle: "italic" }}>
            {isGM
              ? "Click 'Setup Scenario' to create a scenario for your players."
              : "No scenario has been set up yet."}
          </p>
        </div>
      )}
    </div>
  );
}
