import { lazy, Suspense, useState } from "react";
import { usePeer } from "../../hooks/usePeer";
import { useAi } from "../../hooks/useAi";
import { getWheelColors } from "../../constants/themes";
import Modal from "../Modal";
import AiSettingsPanel from "./AiSettingsPanel";

// Dev-only prompt-iteration tool - lazy-loaded so its chunk is never
// fetched by a production build, where the trigger below (gated on the
// same import.meta.env.DEV flag, statically stripped by Vite) never renders
// and this factory never runs.
const PromptTestHarness = lazy(() => import("../dev/PromptTestHarness"));

// Single icon replacing the old always-visible "AI Assistant" and
// "Dev: Prompt Harness" header buttons, which took up too much space for a
// feature most players never touch. The ring/background color mirrors the
// wheel's own success/death colors for the current theme - on uses the
// "safe" color, off uses the "danger" one - so its state reads at a glance
// without a text label. Clicking it opens a modal with the rest of the
// opt-in/tier/download UI (and, in dev builds, the prompt harness).
export default function AiToggleButton() {
  const { theme, customColors } = usePeer();
  const { aiEnabled } = useAi();
  const [isOpen, setIsOpen] = useState(false);
  const [showPromptHarness, setShowPromptHarness] = useState(false);

  const { success, death } = getWheelColors(theme, customColors);
  const color = aiEnabled ? success : death;
  const label = aiEnabled ? "AI assistant (on)" : "AI assistant (off)";

  return (
    <>
      <div className="ai-toggle-bar">
        <button
          type="button"
          className="ai-toggle-button"
          style={{ "--ai-toggle-color": color }}
          onClick={() => setIsOpen(true)}
          aria-label={label}
          title={label}
        >
          🤖
        </button>
      </div>

      {isOpen && (
        <Modal title="AI Assistant" onClose={() => setIsOpen(false)}>
          <AiSettingsPanel />
          {import.meta.env.DEV && (
            <div className="ai-dev-harness-toggle">
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setShowPromptHarness((prev) => !prev)}
              >
                {showPromptHarness
                  ? "Hide Prompt Harness"
                  : "Dev: Prompt Harness"}
              </button>
              {showPromptHarness && (
                <Suspense fallback={<p>Loading prompt harness…</p>}>
                  <PromptTestHarness />
                </Suspense>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
