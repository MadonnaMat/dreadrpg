import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { useAutoGm } from "../hooks/useAutoGm";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";

// AutoGmProvider deliberately crosses the network/AI boundary AiProvider
// avoids, so it needs a real usePeer() (never mocked - see other providers'
// test files) but only a controllable stand-in for useAi(), since real
// inference isn't under test here.
const mockUseAi = vi.fn();
vi.mock("../hooks/useAi", () => ({
  useAi: () => mockUseAi(),
}));

function Probe() {
  const peer = usePeer();
  const autoGm = useAutoGm();
  return (
    <div>
      <div data-testid="autogm-enabled">{String(autoGm.autoGmEnabled)}</div>
      <button onClick={autoGm.enableAutoGm}>enable</button>
      <button onClick={autoGm.disableAutoGm}>disable</button>
      <div data-testid="answer-0-approved">
        {String(peer.characters?.["char-1"]?.answers?.[0]?.approved)}
      </div>
    </div>
  );
}

function GmSetup({ children, gameId = "game-1", hostName = "GM Vera" }) {
  const { setIsGM, setGameId, setHostName } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setGameId(gameId);
    setHostName(hostName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsGM, setGameId, setHostName]);
  return children;
}

function renderAsGm({ aiEnabled = true, gameId, hostName } = {}) {
  mockUseAi.mockReturnValue({ aiEnabled });
  return render(
    <PeerProvider>
      <AutoGmProvider>
        <GmSetup gameId={gameId} hostName={hostName}>
          <Probe />
        </GmSetup>
      </AutoGmProvider>
    </PeerProvider>
  );
}

describe("AutoGmProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAi.mockReset();
  });

  it("does not enable when the AI assistant isn't enabled", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
    renderAsGm({ aiEnabled: false });

    await user.click(screen.getByText("enable"));

    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("false");
  });

  it("enables and disables, posting a chat announcement each time", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
    let capturedChatHandler = null;
    function ChatSpy() {
      const { registerChatEventHandler } = usePeer();
      useEffect(() => {
        registerChatEventHandler((data) => {
          capturedChatHandler = data;
        });
      }, [registerChatEventHandler]);
      return null;
    }

    mockUseAi.mockReturnValue({ aiEnabled: true });
    render(
      <PeerProvider>
        <AutoGmProvider>
          <GmSetup>
            <ChatSpy />
            <Probe />
          </GmSetup>
        </AutoGmProvider>
      </PeerProvider>
    );

    await user.click(screen.getByText("enable"));
    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("true");
    expect(capturedChatHandler).toEqual(
      expect.objectContaining({ fromBot: true })
    );

    capturedChatHandler = null;
    await user.click(screen.getByText("disable"));
    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("false");
    expect(capturedChatHandler).toEqual(
      expect.objectContaining({ fromBot: true })
    );
  });

  it("auto-disables if the AI assistant is turned off while AutoGM is running", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
    mockUseAi.mockReturnValue({ aiEnabled: true });
    const { rerender } = render(
      <PeerProvider>
        <AutoGmProvider>
          <GmSetup>
            <Probe />
          </GmSetup>
        </AutoGmProvider>
      </PeerProvider>
    );

    await user.click(screen.getByText("enable"));
    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("true");

    mockUseAi.mockReturnValue({ aiEnabled: false });
    rerender(
      <PeerProvider>
        <AutoGmProvider>
          <GmSetup>
            <Probe />
          </GmSetup>
        </AutoGmProvider>
      </PeerProvider>
    );

    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("false");
  });

  it("auto-approves an unapproved answer while enabled, and never touches it while disabled", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
    function SeedCharacter() {
      const { setCharacters } = usePeer();
      useEffect(() => {
        setCharacters({
          "char-1": {
            id: "char-1",
            name: "The Drifter",
            answers: { 0: { text: "I was a sailor.", approved: false } },
          },
        });
      }, [setCharacters]);
      return null;
    }

    mockUseAi.mockReturnValue({ aiEnabled: true });
    render(
      <PeerProvider>
        <AutoGmProvider>
          <GmSetup>
            <SeedCharacter />
            <Probe />
          </GmSetup>
        </AutoGmProvider>
      </PeerProvider>
    );

    // Disabled by default - the seeded answer stays untouched.
    expect(screen.getByTestId("answer-0-approved")).toHaveTextContent("false");

    await user.click(screen.getByText("enable"));

    expect(screen.getByTestId("answer-0-approved")).toHaveTextContent("true");
  });

  it("persists autoGmEnabled across a remount for the same game", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
    mockUseAi.mockReturnValue({ aiEnabled: true });
    const { unmount } = renderAsGm({
      gameId: "persist-game",
      hostName: "GM Vera",
    });

    await user.click(screen.getByText("enable"));
    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("true");
    unmount();

    renderAsGm({ gameId: "persist-game", hostName: "GM Vera" });
    expect(screen.getByTestId("autogm-enabled")).toHaveTextContent("true");
  });
});
