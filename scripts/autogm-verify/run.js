// Drives a real AutoGM session in a real browser. See README.md for why this
// can't be the Playwright suite, and for the setup it assumes.
//
//   node scripts/autogm-verify/run.js gpu      - can this machine run a tier at all
//   node scripts/autogm-verify/run.js ai       - opt in and load the SMALL model
//   node scripts/autogm-verify/run.js status   - model/AI state, for polling a load
//   node scripts/autogm-verify/run.js setup    - scenario, notes, a pinned fact, a cast, AutoGM on
//   node scripts/autogm-verify/run.js send "I force the hatch"
//   node scripts/autogm-verify/run.js stats    - per-turn pacing/context/failures
import { attach } from "./cdp.js";
import { DOM } from "./dom.js";

const APP = "http://localhost:5173/dreadrpg/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every tier is a q4f16_1 build, so a machine without shader-f16 cannot run
// AutoGM at all however healthy the rest of WebGPU looks.
async function gpu(page) {
  await page.goto(APP);
  return page.evaluate(async () => {
    if (!navigator.gpu)
      return { secureContext: isSecureContext, webgpu: false };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      return { secureContext: isSecureContext, webgpu: true, adapter: null };
    return {
      secureContext: isSecureContext,
      webgpu: true,
      shaderF16: adapter.features.has("shader-f16"),
      maxBufferSize: adapter.limits.maxBufferSize,
    };
  });
}

async function status(page) {
  return page.evaluate(() => ({
    aiEnabled: document.body.innerText.includes("AI assistance is enabled"),
    loading:
      (document.body.innerText.match(
        /(Fetching|Loading|Downloading)[^\n]{0,60}/
      ) || [])[0] || null,
    autoGmOn: document.body.innerText.includes("Disable AutoGM"),
  }));
}

async function ai(page) {
  await page.goto(APP);
  await sleep(2500);
  await page.evaluate(DOM);
  if ((await status(page)).aiEnabled) return { alreadyOn: true };
  await page.evaluate(() => window.__h.click("🤖"));
  await sleep(1000);
  await page.evaluate(DOM);
  await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) =>
      l.textContent.includes("Small")
    );
    (
      label?.querySelector("input[type=radio]") ||
      document.querySelectorAll("input[type=radio]")[0]
    ).click();
  });
  await sleep(300);
  await page.evaluate(() => window.__h.click("Enable AI Assistance"));
  // The model loads from cache in the background; poll with `status`.
  return { started: true };
}

const NOTES = [
  [
    "Locations",
    "Casting Hall",
    "Vast, half-flooded. The furnace mouth gapes at the far end.",
  ],
  [
    "Locations",
    "Pattern Shop",
    "Wooden moulds stacked to the ceiling, all mislabelled.",
  ],
  ["Locations", "Loading Yard", "Chain-link fence, cut open from the inside."],
  ["Items", "Brass Lantern", "Hangs by the yard gate. Still has oil."],
  ["Items", "Watchman's Ledger", "Entries stop mid-sentence on the 14th."],
  ["Items", "Bolt Cutters", "Left in the weeds by the fence."],
];
// Pinned by hand, so a run can check canon survives filtering on every turn.
const PINNED_ITEM = "Watchman's Ledger";

const NOTE_HELPERS = `
window.__notes = {
  section(name) {
    return [...document.querySelectorAll(".campaign-notes-section")].find((s) => {
      const t = s.querySelector(".campaign-note-row-title");
      return (t && t.textContent.trim().toLowerCase() === name.toLowerCase()) ||
        [...s.querySelectorAll(".campaign-note-row-title-input")].some(
          (i) => i.value.toLowerCase() === name.toLowerCase());
    });
  },
  async addItem(sectionName, title, description) {
    const sec = this.section(sectionName);
    [...sec.querySelectorAll("button")].find((b) => b.textContent.trim() === "Add Item").click();
    await new Promise((r) => setTimeout(r, 250));
    const rows = [...sec.querySelectorAll(".campaign-note-item")];
    const row = rows[rows.length - 1];
    row.querySelector('[aria-label="Edit item title"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const input = row.querySelector("input");
    window.__h.setV(input, title);
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const textarea = row.querySelector("textarea");
    if (textarea && description) window.__h.setV(textarea, description);
    return title;
  },
  pin(title) {
    const row = [...document.querySelectorAll(".campaign-note-item")].find(
      (r) => r.innerText.includes(title) || r.querySelector("input")?.value === title);
    row.querySelector(".campaign-note-row-bar").click();
    return new Promise((resolve) => setTimeout(() => {
      const box = row.querySelector(".campaign-note-item-pin input[type=checkbox]");
      if (box && !box.checked) box.click();
      resolve(Boolean(box && box.checked));
    }, 400));
  },
};
"ok"`;

async function tab(page, name) {
  await page.evaluate(DOM);
  await page.evaluate(
    `window.__h.click(${JSON.stringify(name)}, ".tab-button, button")`
  );
  await sleep(800);
  await page.evaluate(DOM);
}

async function setup(page) {
  await page.evaluate(DOM);
  await page.evaluate(() => {
    const close = window.__h.byText("×", "button")[0];
    if (close) close.click();
  });
  await sleep(400);
  await page.evaluate(DOM);

  await page.evaluate(() => window.__h.click("Create Game"));
  await sleep(700);
  await page.evaluate(DOM);
  await page.evaluate(() => {
    window.__h.fill("Campaign Name", "The Foundry");
    window.__h.fill("Your Name", "Vera");
    window.__h.fill("Tower Size", "54");
  });
  await sleep(300);
  await page.evaluate(() => window.__h.click("Create"));
  await sleep(2500);
  const gameId = await page.evaluate(
    () =>
      (document.querySelector(".lobby-info")?.innerText || "").split("\n")[0]
  );

  await tab(page, "Setup Scenario");
  await page.evaluate(() => {
    const buttons = window.__h.byText("Setup Scenario", "button");
    buttons[buttons.length - 1].click();
  });
  await sleep(800);
  await page.evaluate(DOM);
  await page.evaluate(() => {
    window.__h.fill("Enter scenario title", "The Foundry");
    window.__h.fill(
      "Describe the scenario overview",
      "A decommissioned iron foundry. The night watchman stopped answering his radio three days ago."
    );
    window.__h.fill(
      "Describe the time, place",
      "Rust belt, late autumn, after dark. No power. Rain on the roof."
    );
    window.__h.fill(
      "Describe the characters players",
      "Urban explorers who talked each other into coming."
    );
    window.__h.fill(
      "What are the players trying to accomplish",
      "Find out what happened to the watchman and get out before dawn."
    );
    window.__h.fill(
      "What dangers",
      "Something moves in the casting hall. The sub-level is flooded."
    );
  });
  await sleep(400);
  await page.evaluate(() => window.__h.click("Save Scenario"));
  await sleep(1200);

  await tab(page, "Campaign Notes");
  await page.evaluate(() => window.__h.click("+ Locations"));
  await sleep(500);
  await page.evaluate(() => window.__h.fill("New section name", "Items"));
  await sleep(250);
  await page.evaluate(() => window.__h.click("Add Section"));
  await sleep(600);
  await page.evaluate(NOTE_HELPERS);
  for (const [section, title, description] of NOTES) {
    await page.evaluate(
      `window.__notes.addItem(${JSON.stringify(section)}, ${JSON.stringify(title)}, ${JSON.stringify(description)})`
    );
  }
  await page.evaluate(() =>
    window.__h.blurAll(".campaign-note-row-title-input")
  );
  await sleep(500);
  const pinned = await page.evaluate(
    `window.__notes.pin(${JSON.stringify(PINNED_ITEM)})`
  );

  await tab(page, "Characters");
  await page.evaluate(() => window.__h.click("New Character"));
  await sleep(800);
  await page.evaluate(DOM);
  await page.evaluate(() => window.__h.click("Rename"));
  await sleep(500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find(
      (e) => e.value === "New Character"
    );
    window.__h.setV(el, "The Drifter");
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  await sleep(700);

  await tab(page, "Admin");
  await page.evaluate(() => window.__h.click("Start Game"));
  await sleep(2500);
  // The host claims a character, so AutoGM runs the GM role and chat
  // messages carry an identity the pull check can act on.
  await tab(page, "Characters");
  await page.evaluate(() => {
    const choose = window.__h.byText("Choose", "button")[0];
    if (choose) choose.click();
  });
  await sleep(1200);
  await tab(page, "Admin");
  await page.evaluate(() => window.__h.click("Enable AutoGM"));

  return { gameId, pinned, autoGm: "enabled" };
}

async function send(page, text) {
  await tab(page, "Game");
  await page.evaluate(
    `window.__h.fill("Type a message", ${JSON.stringify(text)})`
  );
  await sleep(250);
  await page.evaluate(() => window.__h.click("Send"));
  return { sent: text };
}

async function stats(page) {
  return page.evaluate(() => {
    const turns = [...document.querySelectorAll(".autogm-debug-turn")].map(
      (t) => t.innerText.replace(/\s+/g, " ")
    );
    return {
      busy: /GM is [a-z]/.test(document.body.innerText),
      gmLines: [...document.querySelectorAll(".chat-message")]
        .map((m) => m.innerText.replace(/\s+/g, " ").trim())
        .filter((t) => t.startsWith("GM:"))
        .slice(-3),
      turns: turns.map((t) => ({
        pacing: (t.match(/Pacing: ([a-z_]+)/) || [])[1] || null,
        context:
          (t.match(/Context: ([^P]*note items[^)]*\)?)/) || [])[1] || null,
        regenerated: /Regenerated:/.test(t),
        failed: /Failed:/.test(t)
          ? (t.match(/Failed: ([^P]{0,90})/) || [])[1]
          : null,
      })),
    };
  });
}

const COMMANDS = { gpu, ai, status, setup, send, stats };

const [command, ...args] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.error(`usage: run.js <${Object.keys(COMMANDS).join("|")}> [text]`);
  process.exit(1);
}
const page = await attach();
try {
  // Commands that drive the UI need the helpers; gpu/ai navigate first.
  if (!["gpu", "ai"].includes(command)) await page.evaluate(DOM);
  console.log(JSON.stringify(await COMMANDS[command](page, ...args), null, 2));
} finally {
  page.close();
}
