import { usePeer } from "../hooks/usePeer";
import { buildRejoinUrl } from "../helpers/rejoinLink";
import { isCharacterAlive, withUpdatedAnswer } from "../helpers/characters";
import { MESSAGE_TYPES } from "../constants/messageTypes";
import CharacterPicker from "./character-sheet/CharacterPicker";
import MyCharacterSheet from "./character-sheet/MyCharacterSheet";
import Chat from "./Chat";

// Shown to a player who has joined but whom the GM hasn't started the game
// for yet - there was previously no such state at all (see
// docs/rules/compliance-fix-plan.md item 1/3): a joined player used to be
// thrown straight into GameLoaded the instant they connected. Lets them
// chat, claim one of the GM's unassigned characters, and - once assigned -
// fill out that character's questionnaire while waiting, the same as they
// could mid-game via CharacterSheet.jsx's PlayerCharacterPanel.
export default function PlayerLobby() {
  const {
    connectionStatus,
    userName,
    gameId,
    characters,
    setCharacters,
    sendToPeers,
    gameName,
  } = usePeer();

  const myCharacter = Object.values(characters || {}).find(
    (c) => c.assignedTo === userName && isCharacterAlive(c)
  );

  // Mirrors CharacterSheet.jsx's handleAnswerChange exactly (same shared
  // withUpdatedAnswer helper, same CHARACTER_UPDATE message), scoped to just
  // this player's own character since that's the only one the lobby ever
  // shows an edit form for.
  const handleAnswerChange = (questionIndex, value) => {
    if (!myCharacter) return;
    const answers = withUpdatedAnswer(myCharacter, questionIndex, value);
    setCharacters((prev) => ({
      ...prev,
      [myCharacter.id]: { ...prev[myCharacter.id], answers },
    }));
    sendToPeers({
      type: MESSAGE_TYPES.CHARACTER_UPDATE,
      id: myCharacter.id,
      answers,
    });
  };

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
        <>
          <p>
            You're playing as <strong>{myCharacter.name}</strong>.
          </p>
          <MyCharacterSheet
            questions={myCharacter.questions}
            answers={myCharacter.answers || {}}
            onAnswerChange={handleAnswerChange}
          />
        </>
      ) : (
        <CharacterPicker />
      )}

      <Chat />
    </div>
  );
}
