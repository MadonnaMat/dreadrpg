import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AutoGmDebugPanel from "../components/autogm/AutoGmDebugPanel";

// A pure presentational consumer of useAutoGm() - mocking the hook directly
// keeps this focused on rendering logic without needing a full provider
// tree (AutoGmProvider itself is covered by AutoGmProvider.test.jsx).
const mockUseAutoGm = vi.fn();
vi.mock("../hooks/useAutoGm", () => ({
  useAutoGm: () => mockUseAutoGm(),
}));

function setState(overrides = {}) {
  mockUseAutoGm.mockReturnValue({
    autoGmError: null,
    storySummary: "",
    rawHistory: [],
    turnLog: [],
    ...overrides,
  });
}

describe("AutoGmDebugPanel", () => {
  it("shows empty-state messages with nothing tracked yet", () => {
    setState();
    render(<AutoGmDebugPanel />);

    expect(screen.getByText("No summary yet.")).toBeInTheDocument();
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
    expect(screen.getByText("No turns yet.")).toBeInTheDocument();
  });

  it("shows the current error when set", () => {
    setState({ autoGmError: "AutoGM couldn't generate a response." });
    render(<AutoGmDebugPanel />);

    expect(
      screen.getByText("AutoGM couldn't generate a response.")
    ).toBeInTheDocument();
  });

  it("renders the story summary and raw history", () => {
    setState({
      storySummary: "The party arrived at the old mill.",
      rawHistory: [{ from: "Alice <The Drifter>", text: "I check the hold." }],
    });
    render(<AutoGmDebugPanel />);

    expect(
      screen.getByText("The party arrived at the old mill.")
    ).toBeInTheDocument();
    expect(screen.getByText("I check the hold.")).toBeInTheDocument();
  });

  it("renders a turn-log entry's trigger, narration, and decisions", () => {
    setState({
      turnLog: [
        {
          id: "turn-1",
          kind: "turn",
          trigger: { from: "Alice", text: "I force the door." },
          draftNarration: "The door groans open.",
          finalNarration: "The door groans open.",
          reasoning: null,
          consistent: null,
          callForPull: true,
          targetPlayerName: "Alice",
          pullsRequired: 2,
          readyToRestack: false,
          campaignNoteUpdates: [
            { sectionName: "Locations", itemText: "Old Mill", description: "" },
          ],
          pullSkippedReason: null,
        },
      ],
    });
    render(<AutoGmDebugPanel />);

    expect(screen.getByText(/I force the door\./)).toBeInTheDocument();
    expect(screen.getByText(/The door groans open\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Called for a pull: Alice \(2 pulls\)/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Campaign notes: Old Mill/)).toBeInTheDocument();
  });

  it("shows the original draft and reasoning when the self-check revised it", () => {
    setState({
      turnLog: [
        {
          id: "turn-1",
          kind: "turn",
          trigger: { from: "Alice", text: "Marcus checks the hold." },
          draftNarration: "Marcus finds nothing.",
          finalNarration: "Selene finds nothing.",
          reasoning: "Marcus is already removed from the story.",
          consistent: false,
          callForPull: false,
          targetPlayerName: "",
          pullsRequired: 1,
          readyToRestack: false,
          campaignNoteUpdates: [],
          pullSkippedReason: null,
        },
      ],
    });
    render(<AutoGmDebugPanel />);

    expect(screen.getByText(/Selene finds nothing\./)).toBeInTheDocument();
    expect(screen.getByText(/Marcus finds nothing\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Marcus is already removed from the story\./)
    ).toBeInTheDocument();
  });

  it("labels a removal-narration entry distinctly from a regular turn", () => {
    setState({
      turnLog: [
        {
          id: "turn-1",
          kind: "removal",
          trigger: null,
          draftNarration: "Marcus vanishes into the dark.",
          finalNarration: "Marcus vanishes into the dark.",
          reasoning: null,
          consistent: null,
          callForPull: false,
          targetPlayerName: "",
          pullsRequired: 1,
          readyToRestack: false,
          campaignNoteUpdates: [],
          pullSkippedReason: null,
        },
      ],
    });
    render(<AutoGmDebugPanel />);

    expect(screen.getByText("Removal narration:")).toBeInTheDocument();
  });

  it("shows a skipped-pull reason", () => {
    setState({
      turnLog: [
        {
          id: "turn-1",
          kind: "turn",
          trigger: { from: "Alice", text: "Something happens." },
          draftNarration: "",
          finalNarration: "",
          reasoning: null,
          consistent: null,
          callForPull: true,
          targetPlayerName: "Ghost",
          pullsRequired: 1,
          readyToRestack: false,
          campaignNoteUpdates: [],
          pullSkippedReason: "target not an active player",
        },
      ],
    });
    render(<AutoGmDebugPanel />);

    expect(
      screen.getByText(/skipped: target not an active player/)
    ).toBeInTheDocument();
  });
});
