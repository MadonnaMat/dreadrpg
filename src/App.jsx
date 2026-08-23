import { extend } from "@pixi/react";
import { Graphics, Container } from "pixi.js";
import PreGame from "./components/PreGame";
import GameLoaded from "./components/GameLoaded";
import AiToggleButton from "./components/ai/AiToggleButton";
import { PeerProvider } from "./providers/PeerProvider";
import { WheelProvider } from "./providers/WheelProvider";
import { AiProvider } from "./providers/AiProvider";
import { AutoGmProvider } from "./providers/AutoGmProvider";
import { usePeer } from "./hooks/usePeer";
import { useWheel } from "./hooks/useWheel";
import { useThemeEffect } from "./hooks/useThemeEffect";
import "./App.css";

extend({ Graphics, Container });

function AppInner() {
  const { showWheel } = useWheel();
  useThemeEffect();

  return (
    <>
      <AiToggleButton />
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
      <AutoGmProvider>
        <AppInner />
      </AutoGmProvider>
    </WheelProvider>
  );
}
