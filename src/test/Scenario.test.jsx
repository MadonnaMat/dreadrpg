import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import Scenario from "../components/Scenario";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";

// Renders Scenario as the GM by flipping isGM on mount via the real PeerProvider context.
function GmScenario() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <Scenario />;
}

describe("Scenario Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("shows a placeholder message for players when no scenario exists", () => {
    render(
      <PeerProvider>
        <Scenario />
      </PeerProvider>
    );

    expect(
      screen.getByText("No scenario has been set up yet.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Setup Scenario")).not.toBeInTheDocument();
  });

  it("shows a Setup Scenario button for the GM when no scenario exists", () => {
    render(
      <PeerProvider>
        <GmScenario />
      </PeerProvider>
    );

    expect(
      screen.getByRole("button", { name: "Setup Scenario" })
    ).toBeInTheDocument();
  });

  it("opens the editor with all fields when the GM clicks Setup Scenario", async () => {
    render(
      <PeerProvider>
        <GmScenario />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));

    expect(screen.getByText("Scenario Title:")).toBeInTheDocument();
    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("Setting:")).toBeInTheDocument();
    expect(screen.getByText("Characters & Roles:")).toBeInTheDocument();
    expect(screen.getByText("Goals & Objectives:")).toBeInTheDocument();
    expect(screen.getByText("Threats & Dangers:")).toBeInTheDocument();
    expect(screen.getByText("Special Rules & Notes:")).toBeInTheDocument();
  });

  it("saves a scenario and shows it in the read view", async () => {
    render(
      <PeerProvider>
        <GmScenario />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
    await user.type(
      screen.getByPlaceholderText("Enter scenario title..."),
      "The Haunted Manor"
    );
    await user.type(
      screen.getByPlaceholderText("Describe the scenario overview..."),
      "A night of terror."
    );
    await user.click(screen.getByRole("button", { name: "Save Scenario" }));

    expect(screen.getByText("The Haunted Manor")).toBeInTheDocument();
    expect(screen.getByText("A night of terror.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Scenario" })
    ).toBeInTheDocument();
  });

  it("discards edits when Cancel is clicked", async () => {
    render(
      <PeerProvider>
        <GmScenario />
      </PeerProvider>
    );

    await user.click(screen.getByRole("button", { name: "Setup Scenario" }));
    await user.type(
      screen.getByPlaceholderText("Enter scenario title..."),
      "Discarded Title"
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Discarded Title")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Click 'Setup Scenario' to create a scenario for your players."
      )
    ).toBeInTheDocument();
  });
});
