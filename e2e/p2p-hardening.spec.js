import { test, expect } from "@playwright/test";
import {
  createGameAsGM,
  joinGameAsPlayer,
  waitForGameLoaded,
  sendChat,
} from "./helpers";

// Verifies the P2P connection hardening (see src/providers/peer/) against
// the real PeerJS client and its public cloud signaling server - the Vitest
// unit suite mocks PeerJS entirely, so none of this (real WebRTC handshake,
// real network drop/reconnect, real visibility-triggered resync) is
// otherwise exercised end-to-end.

test.describe("P2P connection hardening (real WebRTC)", () => {
  test("GM and player connect, and the GM's spin resolution is authoritative for both", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    const gameId = await createGameAsGM(gm, "GM Alice");
    await joinGameAsPlayer(player, gameId, "Player Bob");

    // Both sides transition from the lobby/join screen to the wheel screen
    // once the join handshake + welcome snapshot round-trip completes.
    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    await gm.locator("#spin-btn").click();
    await expect(gm.locator("#spin-btn")).toBeDisabled();

    // Spin duration is 5s (WheelGraphics.jsx) - wait past it for both sides
    // to resolve/receive the outcome.
    await expect(gm.locator("#result")).not.toHaveText("", { timeout: 8000 });
    const gmResult = await gm.locator("#result").textContent();
    expect(["Success!", "You Died!"]).toContain(gmResult);

    // The player must show the SAME result - it comes from the GM's
    // broadcast, not the player's own (untrusted) local resolution.
    await expect(player.locator("#result")).toHaveText(gmResult, {
      timeout: 8000,
    });

    await gmContext.close();
    await playerContext.close();
  });

  test("player reconnects after a real network drop and does not receive duplicate broadcasts", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    const gameId = await createGameAsGM(gm, "GM Carol");
    await joinGameAsPlayer(player, gameId, "Player Dave");

    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    // Simulate the player's network dropping out from under them, then
    // coming back - long enough for a real connection-level failure to be
    // detected, not just a brief blip.
    await playerContext.setOffline(true);
    await player.waitForTimeout(4000);
    await playerContext.setOffline(false);

    // Give the reconnect-with-backoff logic (connectionManager.js) time to
    // redial - real reconnect timing after a genuine network drop is
    // inherently variable, so this is generous.
    await player.waitForTimeout(8000);

    // Sent exactly once, after reconnecting - the GM's peerId-keyed
    // connection map should have deduped the reconnect (replacing the stale
    // entry) rather than accumulating a stale duplicate alongside the live
    // one, so this must arrive on the player's side exactly once, not twice.
    await sendChat(gm, "hello after reconnect");

    const matchingMessages = player.locator(".chat-message", {
      hasText: "hello after reconnect",
    });
    await expect(matchingMessages).toHaveCount(1, { timeout: 15000 });
    await player.waitForTimeout(1500); // a stray duplicate would land within this window
    await expect(matchingMessages).toHaveCount(1);

    await gmContext.close();
    await playerContext.close();
  });

  test("player picks up state it missed while backgrounded+offline, once visible again", async ({
    browser,
  }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    const gameId = await createGameAsGM(gm, "GM Erin");
    await joinGameAsPlayer(player, gameId, "Player Frank");

    await waitForGameLoaded(gm);
    await waitForGameLoaded(player);

    // Background AND disconnect the player's tab at once, the way a real
    // tab-switch that also drops WiFi would - a live connection wouldn't
    // actually miss anything (data-channel delivery isn't visibility-gated),
    // so proving a genuine "missed while away" recovery needs both.
    await player.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await playerContext.setOffline(true);

    // While the player is away, the GM sets up a scenario - part of the
    // synced snapshot (see gameSnapshot.js's buildGameSnapshot), unlike a
    // chat message. The player never receives this broadcast live.
    await gm.getByRole("button", { name: "Scenario" }).click();
    await gm.getByRole("button", { name: "Setup Scenario" }).click();
    await gm
      .getByPlaceholder("Enter scenario title...")
      .fill("The Lighthouse Keeper");
    await gm.getByRole("button", { name: "Save Scenario" }).click();

    // Bring the player back: reconnect, then become visible again.
    await playerContext.setOffline(false);
    await player.waitForTimeout(8000);
    await player.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Either the reconnect's redial or useVisibilityResync's refetch-request
    // should have pulled a fresh game-data-sync snapshot - the player should
    // see the GM's scenario despite having missed the live broadcast.
    await player.getByRole("button", { name: "Scenario" }).click();
    await expect(
      player.getByRole("heading", { name: "The Lighthouse Keeper" })
    ).toBeVisible({ timeout: 15000 });

    await gmContext.close();
    await playerContext.close();
  });
});
