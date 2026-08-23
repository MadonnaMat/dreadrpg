import React, { useState, useEffect, useRef } from "react";
import { usePeer } from "../hooks/usePeer";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import { formatNameForList, myIdentity } from "../helpers/characters";

export default function Chat() {
  const {
    userName,
    hostName,
    isGM,
    sendToPeers,
    registerChatEventHandler,
    notifyAutoGmChat,
    gameId,
    characters,
    presence,
    autoGmThinking,
  } = usePeer();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Register chat event handler
  useEffect(() => {
    registerChatEventHandler((data) => {
      if (data.type === MESSAGE_TYPES.CHAT) {
        setMessages((prev) => [
          ...prev,
          { from: data.from, text: data.text, fromBot: !!data.fromBot },
        ]);

        if (isGM) {
          // forward chat messages to all players
          sendToPeers({
            type: MESSAGE_TYPES.CHAT,
            from: data.from,
            text: data.text,
            fromBot: data.fromBot,
          });
        }
      }
    });
  }, [registerChatEventHandler, isGM, sendToPeers]);

  // Scroll to bottom on new message, or when the thinking indicator
  // appears/disappears (it occupies a line in the same scroll area).
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoGmThinking]);

  // Show "<name> <CharacterName>" once the user has claimed a character, so
  // other players can tell who's speaking as whom in the transcript - this
  // now applies to the GM too (AutoGM mode lets the host play a character),
  // via the same identity resolution used everywhere else (see
  // helpers/characters.js). A GM with no claimed character still gets the
  // "<GM>" bracket instead, for a consistent look.
  const identity = myIdentity({ isGM, hostName, userName });
  const userDisplayName = identity
    ? formatNameForList(characters, identity, hostName)
    : isGM
      ? `${gameId} <GM>`
      : "Player";

  const handleSend = () => {
    if (!input.trim()) return;
    sendToPeers({
      type: MESSAGE_TYPES.CHAT,
      from: userDisplayName,
      text: input,
    });
    if (isGM) {
      setMessages((prev) => [
        ...prev,
        { from: userDisplayName, text: input, fromBot: false },
      ]);
    }
    // The GM's own send never round-trips through any handler (there's
    // nothing to send it *to* on the GM's own client) - notify AutoGM's
    // observer directly so a GM playing a character (AutoGM mode) still has
    // their own lines reach it. A no-op on a player's client, and on the
    // GM's client whenever nothing has registered on autoGmChat.
    notifyAutoGmChat({
      type: MESSAGE_TYPES.CHAT,
      from: userDisplayName,
      text: input,
    });
    setInput("");
  };

  return (
    <div className="chat-container">
      <h2>Chat</h2>

      <div className="chat-users-section">
        <div className="chat-users-title">Players:</div>
        <ul className="chat-users-list">
          {Object.entries(presence || {}).map(([name, info]) => (
            <li key={name}>
              {formatNameForList(characters, name, hostName)} (
              {info.connected ? "online" : "offline"})
              {(isGM ? name === hostName : name === userName) ? " (You)" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={
              msg.fromBot ? "chat-message chat-message-bot" : "chat-message"
            }
          >
            <strong>{msg.from}:</strong> {msg.text}
          </div>
        ))}
        {autoGmThinking && (
          <div className="chat-message chat-message-bot chat-thinking-indicator">
            <strong>GM:</strong> is thinking
            <span className="chat-thinking-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button onClick={handleSend} className="chat-send-button">
          Send
        </button>
      </div>
    </div>
  );
}
