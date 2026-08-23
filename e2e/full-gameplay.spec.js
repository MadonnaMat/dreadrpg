import { test, expect } from "@playwright/test";
import {
  createGameAsGM,
  joinGameAsPlayer,
  waitForPlayerLobby,
  waitForGameLoaded,
  createCharacter,
  chooseCharacter,
  startGame,
  assignSpinner,
  sendChat,
} from "./helpers";

// Broader real-browser coverage of the actual Dread RPG user journeys, on
// top of p2p-hardening.spec.js's narrower connection-resilience focus - all
// still over the real PeerJS client and its public cloud signaling server.

test.describe("Full gameplay flows (real WebRTC)", () => {
  test("lobby, scenario, character sheet, and chat all sync between GM and player", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    const gameId = await createGameAsGM(
      gm,
      "GM Grace",
      undefined,
      "Coastal Horror Campaign"
    );

    // GM creates a character before anyone can claim one - characters are
    // first-class entities the GM authors, not an implicit shared sheet.
    await gm.getByRole("button", { name: "Admin" }).click();
    await createCharacter(gm);

    await joinGameAsPlayer(player, gameId, "Player Henry");
    await waitForPlayerLobby(player);
    await chooseCharacter(player, "New Character");

    // Chat already works pre-game, in the lobby - not just once the game
    // starts. The GM is still on the Admin tab from creating the character
    // above; switch back to Lobby (where Chat is shown) to see it - Chat
    // itself stays mounted the whole time regardless of tab, so the message
    // isn't lost while the GM was looking elsewhere.
    await sendChat(player, "Player Henry says hi from the lobby");
    await gm.getByRole("button", { name: "Lobby" }).click();
    await expect(
      gm.locator(".chat-message", {
        hasText: "Player Henry says hi from the lobby",
      })
    ).toBeVisible({ timeout: 10000 });

    await startGame(gm);
    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    // GM sets up a scenario - the player should see it live, no resync
    // needed since the connection is up the whole time.
    await gm.getByRole("button", { name: "Scenario" }).click();
    await gm.getByRole("button", { name: "Setup Scenario" }).click();
    await gm
      .getByPlaceholder("Enter scenario title...")
      .fill("Whispers in the Fog");
    await gm
      .getByPlaceholder("Describe the scenario overview...")
      .fill("A coastal town beset by something in the mist.");
    await gm.getByRole("button", { name: "Save Scenario" }).click();

    await player.getByRole("button", { name: "Scenario" }).click();
    await expect(
      player.getByRole("heading", { name: "Whispers in the Fog" })
    ).toBeVisible({ timeout: 10000 });

    // Player fills in their (already-claimed) character sheet - the GM
    // should see the answer show up for that character.
    await player.getByRole("button", { name: "Characters" }).click();
    await player
      .getByPlaceholder("Enter your answer...")
      .first()
      .fill("Harlan Voss");

    await gm.getByRole("button", { name: "Characters" }).click();
    await gm
      .locator(".character-roster-name", { hasText: "New Character" })
      .click();
    await expect(gm.locator(".player-sheet-display")).toContainText(
      "Harlan Voss",
      { timeout: 10000 }
    );

    // Chat still works in both directions post-start - switch both sides
    // back to the Game tab first, since it's what renders the chat panel.
    await gm.getByRole("button", { name: "Game" }).click();
    await player.getByRole("button", { name: "Game" }).click();
    await sendChat(player, "Player Henry says hello");
    await expect(
      gm.locator(".chat-message", { hasText: "Player Henry says hello" })
    ).toBeVisible({ timeout: 10000 });

    await sendChat(gm, "GM Grace welcomes Henry");
    await expect(
      player.locator(".chat-message", { hasText: "GM Grace welcomes Henry" })
    ).toBeVisible({ timeout: 10000 });

    await gmContext.close();
    await playerContext.close();
  });

  test("chat and spin results broadcast consistently to two simultaneous players", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const p1Context = await browser.newContext();
    const p2Context = await browser.newContext();
    const gm = await gmContext.newPage();
    const p1 = await p1Context.newPage();
    const p2 = await p2Context.newPage();

    const gameId = await createGameAsGM(gm, "GM Iris");
    await joinGameAsPlayer(p1, gameId, "Player Jade");
    await waitForPlayerLobby(p1);

    await joinGameAsPlayer(p2, gameId, "Player Kai");
    await waitForPlayerLobby(p2);

    // Everyone's presence roster should agree on all three participants,
    // including p1, who joined before p2 and depends on the GM's
    // presence-update broadcast to learn about the newcomer.
    for (const page of [gm, p1, p2]) {
      await expect(page.locator(".chat-users-list li")).toHaveCount(3, {
        timeout: 15000,
      });
    }

    await startGame(gm);
    await waitForGameLoaded(gm);
    await waitForGameLoaded(p1);
    await waitForGameLoaded(p2);

    // A message from one player reaches the GM, the other player, AND the
    // sender itself (players only render their own message once the GM's
    // rebroadcast echoes it back - see Chat.jsx's handleSend).
    await sendChat(p1, "Jade says hi to everyone");
    for (const page of [gm, p1, p2]) {
      await expect(
        page.locator(".chat-message", { hasText: "Jade says hi to everyone" })
      ).toHaveCount(1, { timeout: 10000 });
    }

    // The GM designates themself to spin - a GM spin resolves identically
    // for both players regardless of who was asked to pull.
    await assignSpinner(gm, "GM Iris");
    await gm.locator("#spin-btn").click();
    await expect(gm.locator("#result")).not.toHaveText("", { timeout: 8000 });
    const result = await gm.locator("#result").textContent();
    await expect(p1.locator("#result")).toHaveText(result, { timeout: 8000 });
    await expect(p2.locator("#result")).toHaveText(result, { timeout: 8000 });

    await gmContext.close();
    await p1Context.close();
    await p2Context.close();
  });

  test("a death spin freezes the wheel until the GM re-stacks and designates someone new", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    // Tower size 1 pushes danger probability to ~96% on the very first
    // pull (see computeDangerProbability's S-curve), making a death outcome
    // effectively guaranteed without needing to fake any randomness.
    const gameId = await createGameAsGM(gm, "GM Luna", 1);
    await joinGameAsPlayer(player, gameId, "Player Milo");
    await waitForPlayerLobby(player);
    await startGame(gm);
    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    // No character is assigned to the GM, so the death message falls back
    // to naming the userName directly (see characterNameFor's fallback).
    let result = "";
    for (let attempt = 0; attempt < 5 && !result.includes("Died"); attempt++) {
      await assignSpinner(gm, "GM Luna");
      await gm.locator("#spin-btn").click();
      await expect(gm.locator("#result")).not.toHaveText("", {
        timeout: 8000,
      });
      result = await gm.locator("#result").textContent();
    }
    expect(result).toBe("GM Luna Died!");

    // Both sides freeze: the spin button disappears (nobody is designated
    // any more, and the assign picker itself is hidden while awaiting
    // reset), and only the GM gets a restack control.
    await expect(gm.locator("#spin-btn")).toHaveCount(0);
    await expect(gm.locator("#spin-assign-section")).toHaveCount(0);
    await expect(player.locator("#spin-btn")).toHaveCount(0);
    await expect(gm.locator("#restack-btn")).toBeVisible();
    await expect(player.locator("#restack-btn")).toHaveCount(0);
    await expect(player.locator("#result")).toHaveText("GM Luna Died!", {
      timeout: 8000,
    });

    await gm.locator("#restack-btn").click();

    // Re-stacking unfreezes the wheel - the GM can designate someone new
    // (here, the player) and only that person sees a Spin button.
    await expect(gm.locator("#spin-assign-section")).toBeVisible({
      timeout: 8000,
    });
    await assignSpinner(gm, "Player Milo");
    await expect(player.locator("#spin-btn")).toBeVisible({ timeout: 8000 });
    await expect(gm.locator("#spin-btn")).toHaveCount(0);

    await gmContext.close();
    await playerContext.close();
  });
});
