import { useContext } from "react";
import { AiContext } from "../contexts/AiContext";

export function useAi() {
  return useContext(AiContext);
}
