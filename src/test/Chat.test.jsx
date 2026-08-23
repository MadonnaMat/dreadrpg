import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import Chat from "../components/Chat";
import { PeerProvider } from "../providers/PeerProvider";
import { usePeer } from "../hooks/usePeer";

// Renders Chat as the GM by flipping isGM on mount via the real PeerProvider context.
function GmChat() {
  const { setIsGM } = usePeer();
  useEffect(() => {
    setIsGM(true);
  }, [setIsGM]);
  return <Chat />;
}

// Renders Chat as the GM with a character already claimed (AutoGM mode's
// self-play case), to exercise the "<name> <CharacterName>" display-name
// decoration. Uses the GM's local-echo path (see handleSend) since a lone
// player has no real connection to round-trip through in this test setup.
function ChatWithCharacter() {
  const { setIsGM, setHostName, setCharacters } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setHostName("Alice");
    setCharacters({
      "char-1": {
        id: "char-1",
        name: "The Detective",
        defaultName: "The Detective",
        assignedTo: "Alice",
        questions: [],
        answers: {},
      },
    });
  }, [setIsGM, setHostName, setCharacters]);
  return <Chat />;
}

describe("Chat Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders the chat heading and an empty player list", () => {
    render(
      <PeerProvider>
        <Chat />
      </PeerProvider>
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Players:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeInTheDocument();
  });

  it("shows each known player's online/offline status", async () => {
    function ChatWithPresence() {
      const { setPresence } = usePeer();
      useEffect(() => {
        setPresence({
          Alice: { connected: true },
          Bob: { connected: false },
        });
      }, [setPresence]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <ChatWithPresence />
      </PeerProvider>
    );

    expect(screen.getByText("Alice (online)")).toBeInTheDocument();
    expect(screen.getByText("Bob (offline)")).toBeInTheDocument();
  });

  it("clears the input after sending a message as a player", async () => {
    render(
      <PeerProvider>
        <Chat />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Hello there");
    await user.click(screen.getByText("Send"));

    expect(input).toHaveValue("");
  });

  it("does not send an empty message", async () => {
    const { container } = render(
      <PeerProvider>
        <Chat />
      </PeerProvider>
    );

    await user.click(screen.getByText("Send"));

    // No message rows should have been added
    expect(container.querySelector(".chat-message")).not.toBeInTheDocument();
  });

  it("sends a message on Enter key press", async () => {
    render(
      <PeerProvider>
        <Chat />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Hi!{Enter}");

    expect(input).toHaveValue("");
  });

  it("echoes the GM's own message into the message list immediately", async () => {
    render(
      <PeerProvider>
        <GmChat />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Welcome players");
    await user.click(screen.getByText("Send"));

    expect(
      screen.getByText("Welcome players", { exact: false })
    ).toBeInTheDocument();
  });

  it("decorates the GM's own message with their claimed character once they have one", async () => {
    render(
      <PeerProvider>
        <ChatWithCharacter />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Found a clue");
    await user.click(screen.getByText("Send"));

    expect(screen.getByText("Alice <The Detective>:")).toBeInTheDocument();
  });

  it("tags the GM's own row in the Players list with <GM> instead of a character", () => {
    function GmChatWithPresence() {
      const { setIsGM, setHostName, setPresence } = usePeer();
      useEffect(() => {
        setIsGM(true);
        setHostName("GM Vera");
        setPresence({ "GM Vera": { connected: true } });
      }, [setIsGM, setHostName, setPresence]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <GmChatWithPresence />
      </PeerProvider>
    );

    expect(screen.getByText("GM Vera <GM> (online) (You)")).toBeInTheDocument();
  });

  it("shows (You) next to a player's own row in the Players list", () => {
    function PlayerChatWithPresence() {
      const { setUserName, setPresence } = usePeer();
      useEffect(() => {
        setUserName("Bob");
        setPresence({
          Bob: { connected: true },
          Alice: { connected: true },
        });
      }, [setUserName, setPresence]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <PlayerChatWithPresence />
      </PeerProvider>
    );

    expect(screen.getByText("Bob (online) (You)")).toBeInTheDocument();
    expect(screen.getByText("Alice (online)")).toBeInTheDocument();
  });

  it("labels the GM's own chat message with <GM> instead of GM (hostName)", async () => {
    function GmChatWithHostName() {
      const { setIsGM, setHostName } = usePeer();
      useEffect(() => {
        setIsGM(true);
        setHostName("GM Vera");
      }, [setIsGM, setHostName]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <GmChatWithHostName />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Welcome");
    await user.click(screen.getByText("Send"));

    expect(screen.getByText("GM Vera <GM>:")).toBeInTheDocument();
  });

  it("notifies the AutoGM chat observer when the GM sends a message", async () => {
    const spy = vi.fn();
    function GmChatWithAutoGmObserver() {
      const { setIsGM, registerAutoGmChatEventHandler } = usePeer();
      useEffect(() => {
        setIsGM(true);
        registerAutoGmChatEventHandler(spy);
      }, [setIsGM, registerAutoGmChatEventHandler]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <GmChatWithAutoGmObserver />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Roll for initiative");
    await user.click(screen.getByText("Send"));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Roll for initiative" })
    );
  });

  it("notifies the AutoGM chat observer when a player sends a message", async () => {
    const spy = vi.fn();
    function PlayerChatWithAutoGmObserver() {
      const { setUserName, registerAutoGmChatEventHandler } = usePeer();
      useEffect(() => {
        setUserName("Bob");
        registerAutoGmChatEventHandler(spy);
      }, [setUserName, registerAutoGmChatEventHandler]);
      return <Chat />;
    }

    render(
      <PeerProvider>
        <PlayerChatWithAutoGmObserver />
      </PeerProvider>
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "I search the room");
    await user.click(screen.getByText("Send"));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ text: "I search the room" })
    );
  });

  it("renders a bot-attributed message with distinct styling", () => {
    function ChatWithBotMessage() {
      const { sendSystemChatMessage } = usePeer();
      useEffect(() => {
        sendSystemChatMessage("The tower groans ominously.", {
          from: "GM",
          fromBot: true,
        });
      }, [sendSystemChatMessage]);
      return <Chat />;
    }

    const { container } = render(
      <PeerProvider>
        <ChatWithBotMessage />
      </PeerProvider>
    );

    expect(
      screen.getByText("The tower groans ominously.", { exact: false })
    ).toBeInTheDocument();
    expect(container.querySelector(".chat-message-bot")).toBeInTheDocument();
  });
});
