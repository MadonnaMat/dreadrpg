import React, { useState, useEffect, useRef } from "react";
import { usePeer } from "../providers/PeerProvider";

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
    <div
      className="chat-container"
      style={{ minWidth: 250, maxWidth: 350, marginLeft: 24 }}
    >
      <h2>Chat</h2>
      <div>
        <strong>Connected Users:</strong>
      </div>
      <ul>
        {Object.values(users).map((name, idx) => (
          <li key={idx}>
            {name}
            {name === userName ? " (You)" : ""}
          </li>
        ))}
      </ul>
      <div
        className="chat-messages"
        style={{
          height: 200,
          overflowY: "auto",
          border: "1px solid #ccc",
          marginBottom: 8,
          padding: 8,
        }}
      >
        {messages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.from}:</strong> {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        style={{ width: "80%" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      <button onClick={handleSend} style={{ width: "18%", marginLeft: 4 }}>
        Send
      </button>
    </div>
  );
}
