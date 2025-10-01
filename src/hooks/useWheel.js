import { useContext } from "react";
import { WheelContext } from "../contexts/WheelContext";

export function useWheel() {
  return useContext(WheelContext);
}
