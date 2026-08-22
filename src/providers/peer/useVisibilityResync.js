import { useEffect } from "react";
import { MESSAGE_TYPES } from "../../constants/messageTypes";

// Re-request a full state snapshot whenever a non-GM tab becomes visible
// again, on top of the one-shot mount-time refetch in GameLoaded.jsx. This is
// defense-in-depth against any message missed while the tab was backgrounded
// (background tabs throttle rAF/timers but data-channel messages can still
// arrive and interleave in ways a resync cleanly corrects).
export function useVisibilityResync({ isGM, conn, sendToPeers, peerId }) {
  useEffect(() => {
    if (isGM || !conn) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendToPeers({ type: MESSAGE_TYPES.REFETCH_REQUEST, peerId });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isGM, conn, sendToPeers, peerId]);
}
