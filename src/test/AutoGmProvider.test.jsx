import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { AutoGmProvider } from "../providers/AutoGmProvider";
import { useAutoGm } from "../hooks/useAutoGm";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";
import { latest } from "../prompts/index";

// AutoGmProvider deliberately crosses the network/AI boundary AiProvider
// avoids, so it needs a real usePeer() (never mocked - see other providers'
// test files) but only controllable stand-ins for useAi() and useWheel(),
// since real inference and real wheel mechanics aren't under test here.
const mockUseAi = vi.fn();
vi.mock("../hooks/useAi", () => ({
  useAi: () => mockUseAi(),
}));

const mockUseWheel = vi.fn();
vi.mock("../hooks/useWheel", () => ({
  useWheel: () => mockUseWheel(),
}));

function defaultWheel(overrides = {}) {
  return {
    awaitingReset: false,
    dangerProbability: 0.2,
    designatedSpinner: null,
    assignSpinner: vi.fn(),
    handleRestack: vi.fn(),
    ...overrides,
  };
}

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
      <div data-testid="turn-log-count">{autoGm.turnLog.length}</div>
      <div data-testid="raw-history-count">{autoGm.rawHistory.length}</div>
      <div data-testid="story-summary">{autoGm.storySummary}</div>
      <div data-testid="campaign-notes">
        {JSON.stringify(peer.campaignNotes)}
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

function renderAsGm({
  aiEnabled = true,
  gameId,
  hostName,
  extraChildren = null,
} = {}) {
  mockUseAi.mockReturnValue({ aiEnabled, runPrompt: vi.fn() });
  return render(
    <PeerProvider>
      <AutoGmProvider>
        <GmSetup gameId={gameId} hostName={hostName}>
          <Probe />
          {extraChildren}
        </GmSetup>
      </AutoGmProvider>
    </PeerProvider>
  );
}

describe("AutoGmProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAi.mockReset();
    mockUseWheel.mockReset();
    mockUseWheel.mockReturnValue(defaultWheel());
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

    renderAsGm({ extraChildren: <ChatSpy /> });

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
    mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt: vi.fn() });
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

    mockUseAi.mockReturnValue({ aiEnabled: false, runPrompt: vi.fn() });
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

    renderAsGm({ extraChildren: <SeedCharacter /> });

    // Disabled by default - the seeded answer stays untouched.
    expect(screen.getByTestId("answer-0-approved")).toHaveTextContent("false");

    await user.click(screen.getByText("enable"));

    expect(screen.getByTestId("answer-0-approved")).toHaveTextContent("true");
  });

  it("persists autoGmEnabled across a remount for the same game", async () => {
    const user = userEvent.setup({ skipPointerEventsCheck: true });
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

  function validTurnResult(overrides = {}) {
    return {
      valid: true,
      parsed: {
        narration: "The floor creaks beneath your feet.",
        callForPull: false,
        targetPlayerName: "",
        pullsRequired: 1,
        readyToRestack: false,
        campaignNoteUpdates: [],
        ...overrides,
      },
    };
  }

  async function enable() {
    await userEvent
      .setup({ skipPointerEventsCheck: true })
      .click(screen.getByText("enable"));
  }

  describe("turn loop", () => {
    // AutoGmProvider itself is the sole registrant on the single-slot
    // autoGmChat handler, so tests can't register their own competing
    // listener there - instead, drive messages the exact way Chat.jsx does
    // for the GM's own sends, via usePeer()'s notifyAutoGmChat.
    function AutoGmChatDriver({ onReady }) {
      const { notifyAutoGmChat } = usePeer();
      useEffect(() => {
        onReady.current = notifyAutoGmChat;
      }, [notifyAutoGmChat, onReady]);
      return null;
    }

    // Also captures Chat.jsx's own slot, so tests can observe AutoGM's
    // posted narration the same way sendSystemChatMessage's real consumer
    // would receive it.
    function ChatSpy({ onMessage }) {
      const { registerChatEventHandler } = usePeer();
      useEffect(() => {
        registerChatEventHandler((data) => onMessage.current?.(data));
      }, [registerChatEventHandler, onMessage]);
      return null;
    }

    function setupEnabled({ runPromptImpl, wheelOverrides, seed = null } = {}) {
      const runPrompt = vi.fn(runPromptImpl);
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      const wheel = defaultWheel(wheelOverrides);
      mockUseWheel.mockReturnValue(wheel);
      const deliver = { current: null };
      const chatMessages = [];
      const onMessage = { current: (data) => chatMessages.push(data) };

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
              <AutoGmChatDriver onReady={deliver} />
              <ChatSpy onMessage={onMessage} />
              {seed}
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );
      return { runPrompt, deliver, chatMessages, wheel };
    }

    it("posts narration from a valid turn result, using the turn prompt", async () => {
      const { runPrompt, deliver, chatMessages } = setupEnabled({
        runPromptImpl: async () => validTurnResult(),
      });

      await enable();
      await deliver.current({ from: "Alice", text: "I check the hold." });

      expect(runPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPromptText: latest("autogmTurn").text,
        })
      );
      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "The floor creaks beneath your feet.",
            fromBot: true,
          })
        )
      );
      await waitFor(() =>
        expect(screen.getByTestId("turn-log-count")).toHaveTextContent("1")
      );
    });

    it("assigns a pull to a valid active target", async () => {
      const seed = (() => {
        function SeedCharacter() {
          const { setCharacters, setPresence } = usePeer();
          useEffect(() => {
            setCharacters({
              "char-1": {
                id: "char-1",
                name: "The Drifter",
                assignedTo: "Alice",
              },
            });
            setPresence({ Alice: { connected: true } });
          }, [setCharacters, setPresence]);
          return null;
        }
        return <SeedCharacter />;
      })();

      const { deliver, wheel } = setupEnabled({
        runPromptImpl: async () =>
          validTurnResult({
            callForPull: true,
            targetPlayerName: "Alice",
            pullsRequired: 2,
          }),
        seed,
      });

      await enable();
      await deliver.current({ from: "Alice", text: "I force the door." });

      await waitFor(() =>
        expect(wheel.assignSpinner).toHaveBeenCalledWith("Alice", 2)
      );
    });

    it("skips calling for a pull when the named target isn't an active player", async () => {
      const { deliver, wheel } = setupEnabled({
        runPromptImpl: async () =>
          validTurnResult({ callForPull: true, targetPlayerName: "Ghost" }),
      });

      await enable();
      await deliver.current({ from: "Alice", text: "Something happens." });

      await waitFor(() =>
        expect(screen.getByTestId("turn-log-count")).toHaveTextContent("1")
      );
      expect(wheel.assignSpinner).not.toHaveBeenCalled();
    });

    it("restacks when readyToRestack is true and the tower is frozen", async () => {
      const { deliver, wheel } = setupEnabled({
        runPromptImpl: async () => validTurnResult({ readyToRestack: true }),
        wheelOverrides: { awaitingReset: true },
      });

      await enable();
      await deliver.current({
        from: "Alice",
        text: "We're ready to continue.",
      });

      await waitFor(() => expect(wheel.handleRestack).toHaveBeenCalled());
    });

    it("applies campaignNoteUpdates onto campaignNotes", async () => {
      const { deliver } = setupEnabled({
        runPromptImpl: async () =>
          validTurnResult({
            campaignNoteUpdates: [
              {
                sectionName: "Locations",
                itemText: "Old Mill",
                description: "Downstream.",
              },
            ],
          }),
      });

      await enable();
      await deliver.current({ from: "Alice", text: "We find an old mill." });

      await waitFor(() =>
        expect(screen.getByTestId("campaign-notes")).toHaveTextContent(
          "Old Mill"
        )
      );
    });

    it("sets an error and skips narration when the model result is invalid", async () => {
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async () => ({ valid: false, parsed: null }),
      });

      await enable();
      chatMessages.length = 0;
      await deliver.current({ from: "Alice", text: "???" });

      await waitFor(() =>
        expect(screen.getByTestId("turn-log-count")).toHaveTextContent("0")
      );
      expect(chatMessages).toHaveLength(0);
    });

    it("compacts the raw history into storySummary once it crosses the threshold", async () => {
      const { runPrompt, deliver } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmCompaction").text) {
            return {
              valid: true,
              parsed: { summary: "The party explored the mill." },
            };
          }
          return validTurnResult();
        },
      });

      await enable();
      for (let i = 0; i < 21; i += 1) {
        await deliver.current({ from: "Alice", text: `message ${i}` });
      }

      await waitFor(() =>
        expect(screen.getByTestId("story-summary")).toHaveTextContent(
          "The party explored the mill."
        )
      );
      expect(screen.getByTestId("raw-history-count")).toHaveTextContent("1");
      expect(runPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPromptText: latest("autogmCompaction").text,
        })
      );
    });

    it("keeps the prior summary when compaction itself fails", async () => {
      const { deliver } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmCompaction").text) {
            return { valid: false, parsed: null };
          }
          return validTurnResult();
        },
      });

      await enable();
      for (let i = 0; i < 21; i += 1) {
        await deliver.current({ from: "Alice", text: `message ${i}` });
      }

      await waitFor(() =>
        expect(screen.getByTestId("raw-history-count")).toHaveTextContent("1")
      );
      expect(screen.getByTestId("story-summary")).toHaveTextContent("");
    });
  });

  describe("removal narration", () => {
    function SeedCharacter() {
      const { setCharacters } = usePeer();
      useEffect(() => {
        setCharacters({
          "char-1": {
            id: "char-1",
            name: "Marcus",
            assignedTo: "Alice",
            alive: true,
          },
        });
      }, [setCharacters]);
      return null;
    }

    // Kills the character and flips awaitingReset (via the already-updated
    // wheel mock) in the same click - a single React commit, matching how
    // WheelProvider's real handleSpinEnd batches both changes together.
    // Staging them as two separate commits would let the removal-detection
    // effect's ref bookkeeping run in between and miss the transition.
    function KillCharacter() {
      const { setCharacters } = usePeer();
      return (
        <button
          onClick={() =>
            setCharacters((prev) => ({
              ...prev,
              "char-1": { ...prev["char-1"], alive: false },
            }))
          }
        >
          kill
        </button>
      );
    }

    it("posts additional narration when a character's death flips awaitingReset true", async () => {
      const runPrompt = vi.fn(async ({ systemPromptText }) => {
        if (systemPromptText === latest("autogmRemovalNarration").text) {
          return {
            valid: true,
            parsed: { narration: "Marcus vanishes into the dark." },
          };
        }
        return validTurnResult();
      });
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      mockUseWheel.mockReturnValue(defaultWheel({ awaitingReset: false }));

      const chatMessages = [];
      function ChatSpy() {
        const { registerChatEventHandler } = usePeer();
        useEffect(() => {
          registerChatEventHandler((data) => chatMessages.push(data));
        }, [registerChatEventHandler]);
        return null;
      }

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
              <SeedCharacter />
              <ChatSpy />
              <KillCharacter />
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );

      await enable();
      mockUseWheel.mockReturnValue(defaultWheel({ awaitingReset: true }));
      await userEvent
        .setup({ skipPointerEventsCheck: true })
        .click(screen.getByText("kill"));

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "Marcus vanishes into the dark.",
            fromBot: true,
          })
        )
      );
      expect(runPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPromptText: latest("autogmRemovalNarration").text,
        })
      );
    });

    it("does not narrate a removal while AutoGM is disabled", async () => {
      const runPrompt = vi.fn(async () => ({
        valid: true,
        parsed: { narration: "Should not be called." },
      }));
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      mockUseWheel.mockReturnValue(defaultWheel({ awaitingReset: false }));

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
              <SeedCharacter />
              <KillCharacter />
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );

      // AutoGM never enabled here.
      mockUseWheel.mockReturnValue(defaultWheel({ awaitingReset: true }));
      await userEvent
        .setup({ skipPointerEventsCheck: true })
        .click(screen.getByText("kill"));

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(runPrompt).not.toHaveBeenCalled();
    });
  });
});
