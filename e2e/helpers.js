// Shared page-object-style helpers for the Playwright E2E suite - real
// PeerJS/WebRTC end-to-end flows, not the mocked Vitest unit suite.

export async function createGameAsGM(page, hostName, towerSize) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
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

export async function waitForGameLoaded(page, timeout = 20000) {
  await page.locator("#spin-btn").waitFor({ state: "visible", timeout });
}

export async function sendChat(page, text) {
  await page.locator(".chat-input").fill(text);
  await page.locator(".chat-send-button").click();
}
