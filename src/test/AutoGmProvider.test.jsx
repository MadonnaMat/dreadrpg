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
      <div data-testid="autogm-error">{autoGm.autoGmError}</div>
      <div data-testid="autogm-thinking">{String(peer.autoGmThinking)}</div>
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

    it("broadcasts a thinking indicator that's true during the turn and false once it settles", async () => {
      const { deliver } = setupEnabled({
        // Long enough that waitFor's polling can actually observe the
        // intermediate "true" state before it flips back - a same-tick
        // true->false toggle risks React 18 batching the two updates
        // together and never committing the intermediate render at all.
        runPromptImpl: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return validTurnResult();
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "I check the hold." });

      await waitFor(() =>
        expect(screen.getByTestId("autogm-thinking")).toHaveTextContent("true")
      );
      await waitFor(() =>
        expect(screen.getByTestId("autogm-thinking")).toHaveTextContent("false")
      );
    });

    it("posts the draft narration unchanged when the self-check finds it consistent", async () => {
      const { runPrompt, deliver, chatMessages } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmSelfCheck").text) {
            return {
              valid: true,
              parsed: {
                consistent: true,
                reasoning: "Matches established facts.",
                revisedNarration: "",
              },
            };
          }
          return validTurnResult();
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "I check the hold." });

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "The floor creaks beneath your feet.",
            fromBot: true,
          })
        )
      );
      expect(runPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPromptText: latest("autogmSelfCheck").text,
        })
      );
    });

    it("posts the revised narration when the self-check finds an inconsistency", async () => {
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmSelfCheck").text) {
            return {
              valid: true,
              parsed: {
                consistent: false,
                reasoning: "Marcus is already removed from the story.",
                revisedNarration: "Selene presses forward alone.",
              },
            };
          }
          return validTurnResult();
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "Marcus checks the hold." });

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "Selene presses forward alone.",
            fromBot: true,
          })
        )
      );
      expect(chatMessages).not.toContainEqual(
        expect.objectContaining({ text: "The floor creaks beneath your feet." })
      );
    });

    it("falls back to the draft narration when the self-check call itself is invalid", async () => {
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmSelfCheck").text) {
            return { valid: false, parsed: null };
          }
          return validTurnResult();
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "I check the hold." });

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "The floor creaks beneath your feet.",
            fromBot: true,
          })
        )
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

    it("skips narration, logs the failure, and posts a fallback line when the model result is invalid", async () => {
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async () => ({
          valid: false,
          parsed: null,
          errors: ["Response was not valid JSON: Unexpected token"],
        }),
      });

      await enable();
      chatMessages.length = 0;
      await deliver.current({ from: "Alice", text: "???" });

      await waitFor(() =>
        expect(screen.getByTestId("turn-log-count")).toHaveTextContent("1")
      );
      // No real narration - just an "error" kind of turnLog entry - but the
      // player still sees something instead of total silence (see the
      // dedicated fallback test below for the exact chat wording).
      expect(chatMessages).toHaveLength(1);
      expect(screen.getByTestId("autogm-error")).toHaveTextContent(
        "Response was not valid JSON: Unexpected token"
      );
    });

    it("recovers from a failed turn by compacting and retrying once, when there's history to shrink", async () => {
      // A turn call failing with existing history most likely means the
      // context has grown too large/complex for the model - rather than
      // repeating the identical failure forever (the same oversized
      // context would otherwise be sent again on every future message),
      // AutoGM should proactively compact and immediately retry once.
      let turnCallCount = 0;
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmCompaction").text) {
            return { valid: true, parsed: { summary: "Recovered summary." } };
          }
          if (systemPromptText === latest("autogmSelfCheck").text) {
            return {
              valid: true,
              parsed: {
                consistent: true,
                reasoning: "fine",
                revisedNarration: "",
              },
            };
          }
          // Only autogmTurn calls reach here - counted separately from
          // compaction/self-check so the "second call fails" below means
          // the second *turn*, not whichever call happens to land second.
          turnCallCount += 1;
          if (turnCallCount === 2) {
            return { valid: false, parsed: null };
          }
          return validTurnResult({ narration: `Response ${turnCallCount}` });
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "first message" });
      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({ text: "Response 1" })
        )
      );

      chatMessages.length = 0;
      await deliver.current({ from: "Alice", text: "second message" });

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({ text: "Response 3" })
        )
      );
      expect(screen.getByTestId("story-summary")).toHaveTextContent(
        "Recovered summary."
      );
    });

    it("does not bother compacting-and-retrying a failed first-ever message with no history to shrink", async () => {
      const runPrompt = vi.fn(async () => ({ valid: false, parsed: null }));
      const { deliver } = setupEnabled({ runPromptImpl: runPrompt });

      await enable();
      runPrompt.mockClear();
      await deliver.current({ from: "Alice", text: "???" });

      await new Promise((resolve) => setTimeout(resolve, 10));
      // Only the one failed turn call - no compaction call was wasted on a
      // single-message window with nothing meaningful to shrink.
      expect(runPrompt).toHaveBeenCalledTimes(1);
    });

    it("posts a fallback chat line when both the original and recompacted attempts fail", async () => {
      const { deliver, chatMessages } = setupEnabled({
        runPromptImpl: async ({ systemPromptText }) => {
          if (systemPromptText === latest("autogmCompaction").text) {
            return { valid: true, parsed: { summary: "A short recap." } };
          }
          // Every turn attempt fails, however small the context gets.
          return { valid: false, parsed: null };
        },
      });

      await enable();
      await deliver.current({ from: "Alice", text: "first message" });
      chatMessages.length = 0;
      await deliver.current({ from: "Alice", text: "second message" });

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            fromBot: true,
            text: expect.stringContaining("AutoGM had trouble responding"),
          })
        )
      );
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
      // Bounded, not an exact count - each turn also appends AutoGM's own
      // narration to the window (see AutoGmProvider's runTurn), so the
      // precise remainder after 21 messages depends on how many compaction
      // cycles fit in, not just "one message left over."
      expect(
        Number(screen.getByTestId("raw-history-count").textContent)
      ).toBeLessThan(5);
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
        expect(
          Number(screen.getByTestId("raw-history-count").textContent)
        ).toBeLessThan(5)
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

  describe("opening narration", () => {
    function GameStartToggle() {
      const { setGameStarted } = usePeer();
      return <button onClick={() => setGameStarted(true)}>start game</button>;
    }

    function makeChatSpy() {
      const chatMessages = [];
      function ChatSpy() {
        const { registerChatEventHandler } = usePeer();
        useEffect(() => {
          registerChatEventHandler((data) => chatMessages.push(data));
        }, [registerChatEventHandler]);
        return null;
      }
      return { ChatSpy, chatMessages };
    }

    it("posts an opening narration once the game starts while AutoGM is already enabled", async () => {
      const runPrompt = vi.fn(async () =>
        validTurnResult({ narration: "Welcome to the mill." })
      );
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      mockUseWheel.mockReturnValue(defaultWheel());
      const { ChatSpy, chatMessages } = makeChatSpy();

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
              <ChatSpy />
              <GameStartToggle />
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );

      await enable();
      await userEvent
        .setup({ skipPointerEventsCheck: true })
        .click(screen.getByText("start game"));

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "Welcome to the mill.",
            fromBot: true,
          })
        )
      );
      expect(runPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPromptText: latest("autogmTurn").text,
        })
      );
    });

    it("posts an opening narration when AutoGM is enabled after the game already started", async () => {
      const runPrompt = vi.fn(async () =>
        validTurnResult({ narration: "Welcome to the mill." })
      );
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      mockUseWheel.mockReturnValue(defaultWheel());
      const { ChatSpy, chatMessages } = makeChatSpy();

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
              <ChatSpy />
              <GameStartToggle />
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );

      await userEvent
        .setup({ skipPointerEventsCheck: true })
        .click(screen.getByText("start game"));
      await enable();

      await waitFor(() =>
        expect(chatMessages).toContainEqual(
          expect.objectContaining({
            text: "Welcome to the mill.",
            fromBot: true,
          })
        )
      );
    });

    it("never fires the opening narration for a game that hasn't started", async () => {
      const runPrompt = vi.fn(async () => validTurnResult());
      mockUseAi.mockReturnValue({ aiEnabled: true, runPrompt });
      mockUseWheel.mockReturnValue(defaultWheel());

      render(
        <PeerProvider>
          <AutoGmProvider>
            <GmSetup>
              <Probe />
            </GmSetup>
          </AutoGmProvider>
        </PeerProvider>
      );

      await enable();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(runPrompt).not.toHaveBeenCalled();
    });
  });
});
