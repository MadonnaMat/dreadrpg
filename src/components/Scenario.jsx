import React, { useState, useEffect } from "react";
import { usePeer } from "../providers/PeerProvider";

export default function Scenario() {
  const {
    isGM,
    sendToPeers,
    registerScenarioEventHandler,
    scenario,
    setScenario,
  } = usePeer();

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
      if (data.type === "scenario-update") {
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
      type: "scenario-update",
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
