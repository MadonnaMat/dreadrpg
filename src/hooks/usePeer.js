import { useContext } from "react";
import { PeerContext } from "../contexts/PeerContext";

export function usePeer() {
  return useContext(PeerContext);
}
