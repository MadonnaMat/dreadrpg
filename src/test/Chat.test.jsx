import { describe, it, expect, beforeEach } from "vitest";
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

// Renders Chat as a named sender with a character already assigned to them,
// to exercise the "<name> <CharacterName>" display-name decoration.
function ChatWithCharacter() {
  const { setIsGM, setUserName, setCharacters } = usePeer();
  useEffect(() => {
    setIsGM(true);
    setUserName("Alice");
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
  }, [setIsGM, setUserName, setCharacters]);
  return <Chat />;
}

describe("Chat Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ skipPointerEventsCheck: true });
  });

  it("renders the chat heading and an empty user list", () => {
    render(
      <PeerProvider>
        <Chat />
      </PeerProvider>
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Connected Users:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeInTheDocument();
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

  it("decorates the sender's name with their assigned character", async () => {
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
});
