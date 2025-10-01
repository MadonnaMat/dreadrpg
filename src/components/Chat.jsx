import React, { useState, useEffect, useRef } from "react";
import { usePeer } from "../hooks/usePeer";

export default function Chat() {
  const {
    users,
    userName,
    hostName,
    isGM,
    sendToPeers,
    registerChatEventHandler,
    gameId,
  } = usePeer();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Register chat event handler
  useEffect(() => {
    registerChatEventHandler((data) => {
      if (data.type === "chat") {
        setMessages((prev) => [...prev, { from: data.from, text: data.text }]);

        if (isGM) {
          // forward chat messages to all players
          sendToPeers({
            type: "chat",
            from: data.from,
            text: data.text,
          });
        }
      }
    });
  }, [registerChatEventHandler]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const userDisplayName =
    userName || (isGM ? `GM (${hostName || gameId})` : "Player");

  const handleSend = () => {
    if (!input.trim()) return;
    sendToPeers({
      type: "chat",
      from: userDisplayName,
      text: input,
    });
    if (isGM) {
      setMessages((prev) => [...prev, { from: userDisplayName, text: input }]);
    }
    setInput("");
  };

  return (
    <div className="chat-container">
      <h2>Chat</h2>

      <div className="chat-users-section">
        <div className="chat-users-title">Connected Users:</div>
        <ul className="chat-users-list">
          {Object.values(users).map((name, idx) => (
            <li key={idx}>
              {name}
              {name === userName ? " (You)" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chat-message">
            <strong>{msg.from}:</strong> {msg.text}
          </div>
        ))}
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
