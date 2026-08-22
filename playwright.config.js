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
  // These tests do real network round-trips plus deliberate multi-second
  // waits (network-drop/backoff simulation), and CI runners are slower and
  // more resource-constrained than a local machine - 30s was too tight and
  // produced spurious timeouts under CI load rather than real failures.
  timeout: process.env.CI ? 90000 : 45000,
  fullyParallel: false,
  // Only running 2 CPU cores on a standard GitHub-hosted runner: running
  // multiple full browser instances concurrently there caused enough
  // contention to blow past even the loosened timeout above. Serialize in
  // CI for consistent timing; keep the local default (parallel) for faster
  // iteration.
  workers: process.env.CI ? 1 : undefined,
  // A real network drop/reconnect over a public signaling service, on a
  // shared CI runner, warrants some retry tolerance - a test passing on
  // retry still gets flagged as "flaky" in the report rather than silently
  // hidden, so it stays visible without failing the whole job over it.
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
