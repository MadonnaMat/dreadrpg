import { usePeer } from "../../hooks/usePeer";
import { MESSAGE_TYPES } from "../../constants/messageTypes";
import { isCharacterAlive, myIdentity } from "../../helpers/characters";

// Lets a player with no currently-alive assigned character - either they
// never chose one, or their previous character died - claim one of the GM's
// unassigned, still-alive characters. Shared between the pre-game
// PlayerLobby (joined but game not started yet) and the mid-game
// CharacterSheet tab (a death, or a character the GM adds after the game
// already started), so a death mid-game doesn't strand a player with no way
// back into play. Also reachable by the GM themselves in AutoGM mode (see
// CharacterSheet.jsx), so identity resolves via hostName in that case
// rather than the always-empty userName.
export default function CharacterPicker() {
  const { isGM, userName, hostName, characters, setCharacters, sendToPeers } =
    usePeer();
  const identity = myIdentity({ isGM, hostName, userName });
  const characterList = Object.values(characters || {});
  const unassigned = characterList.filter(
    (c) => !c.assignedTo && isCharacterAlive(c)
  );
  const taken = characterList.filter(
    (c) => c.assignedTo && isCharacterAlive(c)
  );

  const chooseCharacter = (id) => {
    setCharacters((prev) => ({
      ...prev,
      [id]: { ...prev[id], assignedTo: identity },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id,
      assignedTo: identity,
    });
  };

  return (
    <div className="lobby-character-picker">
      <h3>Choose a Character</h3>
      {unassigned.length === 0 && (
        <p className="no-character-assigned">
          The GM hasn't added any characters yet.
        </p>
      )}
      <ul className="character-roster-list">
        {unassigned.map((character) => (
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
      {taken.length > 0 && (
        <p>
          Already chosen:{" "}
          {taken.map((c) => `${c.name} (${c.assignedTo})`).join(", ")}
        </p>
      )}
    </div>
  );
}
