// AutoGM's busy/idle indicator (see AutoGmProvider.jsx's setThinking) is a
// status string rather than a plain boolean, so every player sees not just
// "the GM is busy" but roughly what it's doing at that moment - a turn can
// take several seconds across multiple model calls (pull check, narration,
// self-check, note consolidation), and the original single "is thinking"
// label gave no sense of progress across all of that. `false` means idle.
export const AUTOGM_STATUS = {
  THINKING: "thinking",
  CHECKING_PULL: "checking_pull",
  COMPACTING: "compacting",
  UPDATING_NOTES: "updating_notes",
  SELF_CHECKING: "self_checking",
};

const AUTOGM_STATUS_LABELS = {
  [AUTOGM_STATUS.THINKING]: "is thinking",
  [AUTOGM_STATUS.CHECKING_PULL]: "is weighing the risk of that action",
  [AUTOGM_STATUS.COMPACTING]: "is summarizing the story so far",
  [AUTOGM_STATUS.UPDATING_NOTES]: "is updating its notes",
  [AUTOGM_STATUS.SELF_CHECKING]: "is double-checking its narration",
};

// Falls back to the generic "is thinking" label for any unrecognized value,
// so an older/newer peer that doesn't share the exact same status strings
// (or a plain `true` from a stale cached build) still shows something
// sensible rather than blank text.
export function describeAutoGmStatus(status) {
  return AUTOGM_STATUS_LABELS[status] || "is thinking";
}
