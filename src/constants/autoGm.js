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

// Section the compaction pass files its key beats under (see
// autogm-compaction.v2.md). Named like a GM's own prep heading so it reads
// naturally in the Campaign Notes UI alongside hand-written sections, and
// shared so AutoGmProvider and any future consumer agree on the one name -
// the notes helpers match sections by normalized name, so a second spelling
// would quietly create a duplicate section.
export const CANON_SECTION_NAME = "Established Facts";

// Beats are stored as item text, which the notes helpers don't truncate the
// way they do descriptions - so bound it here instead, since a rambling
// model can otherwise undo the context savings pinning is meant to protect.
export const MAX_KEY_BEAT_LENGTH = 240;

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
