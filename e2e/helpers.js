// Shared page-object-style helpers for the Playwright E2E suite - real
// PeerJS/WebRTC end-to-end flows, not the mocked Vitest unit suite.

export async function createGameAsGM(
  page,
  hostName,
  towerSize,
  campaignName = "Test Campaign"
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page
    .locator("#create-game")
    .getByPlaceholder("Campaign Name")
    .fill(campaignName);
  await page
    .locator("#create-game")
    .getByPlaceholder("Your Name")
    .fill(hostName);
  if (towerSize !== undefined) {
    const towerSizeInput = page
      .locator("#create-game")
      .getByPlaceholder("Tower Size");
    await towerSizeInput.fill(String(towerSize));
  }
  await page
    .locator("#create-game")
    .getByRole("button", { name: "Create" })
    .click();

  const lobbyText = await page.locator(".lobby-info").innerText();
  const match = lobbyText.match(/Game ID:\s*(\S+)/);
  if (!match) throw new Error(`Could not find Game ID in: ${lobbyText}`);
  return match[1];
}

export async function joinGameAsPlayer(page, gameId, playerName) {
  await page.goto("/");
  await page.getByRole("button", { name: "Join Game" }).click();
  await page.locator("#join-game").getByPlaceholder("Game ID").fill(gameId);
  await page
    .locator("#join-game")
    .getByPlaceholder("Your Name")
    .fill(playerName);
  await page
    .locator("#join-game")
    .getByRole("button", { name: "Join" })
    .click();
}

// Waits for a joined player to land in the pre-game lobby (waiting for the
// GM to start the game) - the state between a successful join and
// waitForGameLoaded, since a joined player is no longer thrown straight into
// the wheel screen (see docs/rules/compliance-fix-plan.md item 1/3).
export async function waitForPlayerLobby(page, timeout = 20000) {
  await page
    .getByText("Waiting for the GM to start the game...")
    .waitFor({ state: "visible", timeout });
}

// GM-only: creates a new character from whichever tab currently embeds the
// character roster (the pre-game Admin tab, or the mid-game Characters tab)
// and returns its default name ("New Character") for callers to reference.
export async function createCharacter(gmPage) {
  await gmPage.getByRole("button", { name: "New Character" }).click();
}

// A joined player (in the pre-game lobby, or mid-game with no currently
// alive character) claims the named unassigned character.
export async function chooseCharacter(playerPage, characterName) {
  await playerPage
    .locator(".character-roster-row", { hasText: characterName })
    .getByRole("button", { name: "Choose" })
    .click();
}

// GM-only: starts the game from the Admin tab (works both pre-game, in
// PreGame.jsx's HostLobbyPanel, and - though there's normally no reason to
// call it again - mid-game in GameLoaded.jsx, since both render the same
// AdminPanel/Start Game button).
export async function startGame(gmPage) {
  await gmPage.getByRole("button", { name: "Admin" }).click();
  await gmPage.getByRole("button", { name: "Start Game" }).click();
  // Switch back to the Game tab - Start Game doesn't do this automatically,
  // and the wheel/spin controls only render there.
  await gmPage.getByRole("button", { name: "Game" }).click();
}

// Waits for the actual game screen (post Start Game) to be showing - the
// "Game" tab button is the earliest reliable signal, since the spin button
// itself doesn't exist until the GM designates someone to spin.
export async function waitForGameLoaded(page, timeout = 20000) {
  await page
    .getByRole("button", { name: "Game", exact: true })
    .waitFor({ state: "visible", timeout });
}

// GM-only: designates a player to spin (optionally requiring more than one
// successful pull) via the Game tab's assign picker, then clicks Request
// Pull - mirrors GameLoaded.jsx's SpinControls. The dropdown's <option>
// value is always the raw userName even though its visible label may be
// decorated with "<CharacterName>" (see formatUserWithCharacter), so
// selecting by that value is unaffected either way.
export async function assignSpinner(gmPage, userName, pullsRequired) {
  await gmPage.locator("#spin-assign-section select").selectOption(userName);
  if (pullsRequired !== undefined) {
    await gmPage.locator("#pulls-required-input").fill(String(pullsRequired));
  }
  await gmPage.locator("#request-pull-btn").click();
}

export async function sendChat(page, text) {
  await page.locator(".chat-input").fill(text);
  await page.locator(".chat-send-button").click();
}
