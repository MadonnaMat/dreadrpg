import { lazy, Suspense, useState } from "react";
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

// Dev-only prompt-iteration tool - lazy-loaded so its chunk is never
// fetched by a production build, where the trigger below (gated on the
// same import.meta.env.DEV flag, statically stripped by Vite) never renders
// and this factory never runs.
const PromptTestHarness = lazy(
  () => import("./components/dev/PromptTestHarness")
);

function AppInner() {
  const { showWheel } = useWheel();
  useThemeEffect();
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showPromptHarness, setShowPromptHarness] = useState(false);

  return (
    <>
      <div className="ai-settings-toggle">
        <button
          className="btn-secondary btn-small"
          onClick={() => setShowAiSettings((prev) => !prev)}
        >
          {showAiSettings ? "Hide AI Assistant" : "AI Assistant"}
        </button>
        {import.meta.env.DEV && (
          <button
            className="btn-secondary btn-small"
            onClick={() => setShowPromptHarness((prev) => !prev)}
          >
            {showPromptHarness ? "Hide Prompt Harness" : "Dev: Prompt Harness"}
          </button>
        )}
      </div>
      {showAiSettings && <AiSettingsPanel />}
      {import.meta.env.DEV && showPromptHarness && (
        <Suspense fallback={<p>Loading prompt harness…</p>}>
          <PromptTestHarness />
        </Suspense>
      )}
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
