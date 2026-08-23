import { useCallback, useRef } from "react";

// Single-slot registration for the categories of inbound network message a
// component can subscribe to (wheel/chat/scenario/character-sheet/ping
// events). Fanned out by gameSnapshot.js's dispatchToRegisteredHandlers.
// The register* functions are wrapped in useCallback so their identity never
// changes - each only ever writes to a stable ref, so there's no reason for
// consumers' registration effects (which list these as dependencies) to
// re-run on every unrelated render.
export function useRegisteredHandlers() {
  const wheel = useRef(null);
  const chat = useRef(null);
  const scenario = useRef(null);
  const characterSheet = useRef(null);
  const ping = useRef(null);
  const autoGmChat = useRef(null);
  const handlerRefs = useRef({
    wheel,
    chat,
    scenario,
    characterSheet,
    ping,
    autoGmChat,
  }).current;

  const registerWheelEventHandler = useCallback((handler) => {
    wheel.current = handler;
  }, []);
  const registerChatEventHandler = useCallback((handler) => {
    chat.current = handler;
  }, []);
  const registerScenarioEventHandler = useCallback((handler) => {
    scenario.current = handler;
  }, []);
  const registerCharacterSheetEventHandler = useCallback((handler) => {
    characterSheet.current = handler;
  }, []);
  // GM-only: receives PRESENCE_PONG replies to a ping the GM sent (see
  // PeerProvider.jsx's pingUser). Registered by the Admin Panel's presence
  // section while mounted - unlike character events, this doesn't need to
  // be always-active, since a ping only matters while the GM is actively
  // looking at the panel that triggered it.
  const registerPingEventHandler = useCallback((handler) => {
    ping.current = handler;
  }, []);
  // A second, independent observer of every CHAT message, alongside (not
  // instead of) Chat.jsx's own `chat` registration - lets AutoGmProvider see
  // the same chat stream Chat.jsx renders without contending for that single
  // slot. One owner (AutoGmProvider), so single-slot is fine here too.
  const registerAutoGmChatEventHandler = useCallback((handler) => {
    autoGmChat.current = handler;
  }, []);

  return {
    handlerRefs,
    registerWheelEventHandler,
    registerChatEventHandler,
    registerScenarioEventHandler,
    registerCharacterSheetEventHandler,
    registerPingEventHandler,
    registerAutoGmChatEventHandler,
  };
}
