import { usePeer } from "../hooks/usePeer";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import Chat from "./Chat";

// Shown to a player who has joined but whom the GM hasn't started the game
// for yet - there was previously no such state at all (see
// docs/rules/compliance-fix-plan.md item 1/3): a joined player used to be
// thrown straight into GameLoaded the instant they connected. Lets them
// chat and claim one of the GM's unassigned characters while waiting.
export default function PlayerLobby() {
  const {
    connectionStatus,
    userName,
    characters,
    setCharacters,
    sendToPeers,
    gameName,
  } = usePeer();

  const characterList = Object.values(characters || {});
  const myCharacter = characterList.find((c) => c.assignedTo === userName);
  const unassignedCharacters = characterList.filter((c) => !c.assignedTo);

  const chooseCharacter = (id) => {
    setCharacters((prev) => ({
      ...prev,
      [id]: { ...prev[id], assignedTo: userName },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id,
      assignedTo: userName,
    });
  };

  return (
    <div id="player-lobby">
      {gameName && <h2>{gameName}</h2>}
      <div id="connection-status" style={{ padding: 8, fontWeight: "bold" }}>
        {connectionStatus}
      </div>
      <p>Waiting for the GM to start the game...</p>

      {myCharacter ? (
        <p>
          You're playing as <strong>{myCharacter.name}</strong>.
        </p>
      ) : (
        <div className="lobby-character-picker">
          <h3>Choose a Character</h3>
          {unassignedCharacters.length === 0 && (
            <p className="no-character-assigned">
              The GM hasn't added any characters yet.
            </p>
          )}
          <ul className="character-roster-list">
            {unassignedCharacters.map((character) => (
              <li key={character.id} className="character-roster-row">
                <span className="character-roster-name">{character.name}</span>
                <button
                  className="btn-primary"
                  onClick={() => chooseCharacter(character.id)}
                >
                  Choose
                </button>
              </li>
            ))}
          </ul>
          {characterList.some((c) => c.assignedTo) && (
            <p>
              Already chosen:{" "}
              {characterList
                .filter((c) => c.assignedTo)
                .map((c) => `${c.name} (${c.assignedTo})`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      <Chat />
    </div>
  );
}
