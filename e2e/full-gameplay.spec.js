import { test, expect } from "@playwright/test";
import {
  createGameAsGM,
  joinGameAsPlayer,
  waitForGameLoaded,
  sendChat,
} from "./helpers";

// Broader real-browser coverage of the actual Dread RPG user journeys, on
// top of p2p-hardening.spec.js's narrower connection-resilience focus - all
// still over the real PeerJS client and its public cloud signaling server.

test.describe("Full gameplay flows (real WebRTC)", () => {
  test("scenario, character sheet, and chat all sync between GM and player", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    const gameId = await createGameAsGM(gm, "GM Grace");
    await joinGameAsPlayer(player, gameId, "Player Henry");

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

    // Player fills in their character sheet - the GM should see the answer
    // show up for that player.
    await player.getByRole("button", { name: "Characters" }).click();
    await player
      .getByPlaceholder("Enter your answer...")
      .first()
      .fill("Harlan Voss");

    await gm.getByRole("button", { name: "Characters" }).click();
    await gm.locator(".player-select").selectOption("Player Henry");
    await expect(gm.locator(".player-sheet-display")).toContainText(
      "Harlan Voss",
      { timeout: 10000 }
    );

    // Chat works in both directions - switch both sides back to the Game
    // tab first, since it's what renders the chat panel.
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
    await waitForGameLoaded(gm);
    await waitForGameLoaded(p1);

    await joinGameAsPlayer(p2, gameId, "Player Kai");
    await waitForGameLoaded(gm);
    await waitForGameLoaded(p2);

    // Everyone's user list should agree on all three participants,
    // including p1, who joined before p2 and depends on the GM's
    // user-list-update broadcast to learn about the newcomer.
    for (const page of [gm, p1, p2]) {
      await expect(page.locator(".chat-users-list li")).toHaveCount(3, {
        timeout: 15000,
      });
    }

    // A message from one player reaches the GM, the other player, AND the
    // sender itself (players only render their own message once the GM's
    // rebroadcast echoes it back - see Chat.jsx's handleSend).
    await sendChat(p1, "Jade says hi to everyone");
    for (const page of [gm, p1, p2]) {
      await expect(
        page.locator(".chat-message", { hasText: "Jade says hi to everyone" })
      ).toHaveCount(1, { timeout: 10000 });
    }

    // A GM spin resolves identically for both players.
    await gm.locator("#spin-btn").click();
    await expect(gm.locator("#result")).not.toHaveText("", { timeout: 8000 });
    const result = await gm.locator("#result").textContent();
    await expect(p1.locator("#result")).toHaveText(result, { timeout: 8000 });
    await expect(p2.locator("#result")).toHaveText(result, { timeout: 8000 });

    await gmContext.close();
    await p1Context.close();
    await p2Context.close();
  });

  test("a death spin freezes the wheel for everyone until the GM re-stacks", async ({
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
    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    let result = "";
    for (let attempt = 0; attempt < 5 && result !== "You Died!"; attempt++) {
      await gm.locator("#spin-btn").click();
      await expect(gm.locator("#result")).not.toHaveText("", {
        timeout: 8000,
      });
      result = await gm.locator("#result").textContent();
    }
    expect(result).toBe("You Died!");

    // Both sides freeze: the spin button disappears, and only the GM gets
    // a restack control.
    await expect(gm.locator("#spin-btn")).toHaveCount(0);
    await expect(player.locator("#spin-btn")).toHaveCount(0);
    await expect(gm.locator("#restack-btn")).toBeVisible();
    await expect(player.locator("#restack-btn")).toHaveCount(0);
    await expect(player.locator("#result")).toHaveText("You Died!", {
      timeout: 8000,
    });

    await gm.locator("#restack-btn").click();

    // Re-stacking unfreezes the wheel for both the GM and the player.
    await expect(gm.locator("#spin-btn")).toBeVisible({ timeout: 8000 });
    await expect(player.locator("#spin-btn")).toBeVisible({ timeout: 8000 });

    await gmContext.close();
    await playerContext.close();
  });
});
