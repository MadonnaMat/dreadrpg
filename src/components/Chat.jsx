import React, { useState, useEffect, useRef } from "react";
import { usePeer } from "../hooks/usePeer";
import { MESSAGE_TYPES } from "../constants/messageTypes";

export default function Chat() {
  const {
    users,
    userName,
    hostName,
    isGM,
    sendToPeers,
    registerChatEventHandler,
    gameId,
    characters,
  } = usePeer();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Register chat event handler
  useEffect(() => {
    registerChatEventHandler((data) => {
      if (data.type === MESSAGE_TYPES.CHAT) {
        setMessages((prev) => [...prev, { from: data.from, text: data.text }]);

        if (isGM) {
          // forward chat messages to all players
          sendToPeers({
            type: MESSAGE_TYPES.CHAT,
            from: data.from,
            text: data.text,
          });
        }
      }
    });
  }, [registerChatEventHandler, isGM, sendToPeers]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Show "<name> <CharacterName>" once the player has claimed a character,
  // so other players can tell who's speaking as whom in the transcript.
  const myCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === userName
  );
  const userDisplayName = userName
    ? myCharacter
      ? `${userName} <${myCharacter.name}>`
      : userName
    : isGM
      ? `GM (${hostName || gameId})`
      : "Player";

  const handleSend = () => {
    if (!input.trim()) return;
    sendToPeers({
      type: MESSAGE_TYPES.CHAT,
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
