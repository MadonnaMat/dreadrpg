import { defineConfig, devices } from "@playwright/test";

// E2E verification of the real PeerJS/WebRTC networking stack, against a
// production build (vite preview), not the dev server - deliberately
// separate from the Vitest unit suite (which mocks PeerJS entirely). Dev
// mode's <StrictMode> double-invokes mount effects, which defeats one-shot
// "fire a timer on mount" patterns in ways that never happen for real users
// hitting the actual built app, so testing against dev here would chase
// artifacts that don't reflect production behavior. Not wired into a
// deploy-blocking check: it depends on reaching the public PeerJS cloud
// signaling server, which isn't appropriate to require on every push.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173/dreadrpg/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://localhost:4173/dreadrpg/",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
