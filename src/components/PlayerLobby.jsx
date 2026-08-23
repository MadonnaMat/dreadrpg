import { usePeer } from "../hooks/usePeer";
import { buildRejoinUrl } from "../helpers/rejoinLink";
import { isCharacterAlive } from "../helpers/characters";
import CharacterPicker from "./character-sheet/CharacterPicker";
import Chat from "./Chat";

// Shown to a player who has joined but whom the GM hasn't started the game
// for yet - there was previously no such state at all (see
// docs/rules/compliance-fix-plan.md item 1/3): a joined player used to be
// thrown straight into GameLoaded the instant they connected. Lets them
// chat and claim one of the GM's unassigned characters while waiting.
export default function PlayerLobby() {
  const { connectionStatus, userName, gameId, characters, gameName } =
    usePeer();

  const myCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === userName && isCharacterAlive(c)
  );

  return (
    <div id="player-lobby">
      {gameName && <h2>{gameName}</h2>}
      <div id="connection-status" style={{ padding: 8, fontWeight: "bold" }}>
        {connectionStatus}
      </div>
      <p>Waiting for the GM to start the game...</p>

      <div className="rejoin-link-section">
        <button
          className="btn-primary"
          onClick={() =>
            navigator.clipboard.writeText(buildRejoinUrl(gameId, userName))
          }
        >
          Copy my rejoin link
        </button>
        <span className="rejoin-link-hint">
          Use this link if you get disconnected - it'll bring you back as{" "}
          {userName}.
        </span>
      </div>

      {myCharacter ? (
        <p>
          You're playing as <strong>{myCharacter.name}</strong>.
        </p>
      ) : (
        <CharacterPicker />
      )}

      <Chat />
    </div>
  );
}
