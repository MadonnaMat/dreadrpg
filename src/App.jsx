import { extend } from "@pixi/react";
import { Graphics, Container } from "pixi.js";
import PreGame from "./components/PreGame";
import GameLoaded from "./components/GameLoaded";
import { PeerProvider, usePeer } from "./providers/PeerProvider";
import { WheelProvider, useWheel } from "./providers/WheelProvider";
import "./App.css";

extend({ Graphics, Container });

// ...existing code...

function AppInner() {
  const { showWheel } = useWheel();
  return showWheel ? <GameLoaded /> : <PreGame />;
}

export default function App() {
  return (
    <PeerProvider>
      <WheelProviderWrapper />
    </PeerProvider>
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
