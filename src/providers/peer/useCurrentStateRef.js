import { useRef, useEffect } from "react";

// Keeps a ref mirror of whatever state object it's given, read from inside
// PeerJS event-handler closures set up once at connect time (join/
// refetch-request handling in PeerProvider) - reading through this ref
// rather than the state values directly means those closures always see
// current values instead of whatever the state was on the render that
// created them.
//
// Deliberately takes the whole state object rather than destructuring named
// fields: this hook once silently dropped a field (gameStarted) that
// PeerProvider passed in but the destructured parameter list didn't list,
// so it never reached buildGameSnapshot. Mirroring the object wholesale on
// every render (the effect has no dependency array - its body is a plain
// assignment, cheap enough to run unconditionally) makes that class of bug
// impossible: a new field just needs to be added to the object literal
// PeerProvider builds, nothing here.
export function useCurrentStateRef(state) {
  const currentStateRef = useRef(state);

  useEffect(() => {
    currentStateRef.current = state;
  });

  return currentStateRef;
}
