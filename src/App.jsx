import { useState } from "react";
import { extend } from "@pixi/react";
import { Graphics, Container } from "pixi.js";
import PreGame from "./components/PreGame";
import GameLoaded from "./components/GameLoaded";
import AiSettingsPanel from "./components/ai/AiSettingsPanel";
import { PeerProvider } from "./providers/PeerProvider";
import { WheelProvider } from "./providers/WheelProvider";
import { AiProvider } from "./providers/AiProvider";
import { usePeer } from "./hooks/usePeer";
import { useWheel } from "./hooks/useWheel";
import { useThemeEffect } from "./hooks/useThemeEffect";
import "./App.css";

extend({ Graphics, Container });

function AppInner() {
  const { showWheel } = useWheel();
  useThemeEffect();
  const [showAiSettings, setShowAiSettings] = useState(false);

  return (
    <>
      <div className="ai-settings-toggle">
        <button
          className="btn-secondary btn-small"
          onClick={() => setShowAiSettings((prev) => !prev)}
        >
          {showAiSettings ? "Hide AI Assistant" : "AI Assistant"}
        </button>
      </div>
      {showAiSettings && <AiSettingsPanel />}
      {showWheel ? <GameLoaded /> : <PreGame />}
    </>
  );
}

export default function App() {
  return (
    <AiProvider>
      <PeerProvider>
        <WheelProviderWrapper />
      </PeerProvider>
    </AiProvider>
  );
}

function WheelProviderWrapper() {
  const { conn, isGM } = usePeer();
  return (
    <WheelProvider conn={conn} isGM={isGM}>
      <AppInner />
    </WheelProvider>
  );
}
