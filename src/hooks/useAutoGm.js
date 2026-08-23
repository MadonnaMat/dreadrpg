import { useContext } from "react";
import { AutoGmContext } from "../contexts/AutoGmContext";

export function useAutoGm() {
  return useContext(AutoGmContext);
}
