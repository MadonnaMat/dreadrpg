import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.js"],
    css: true,
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest
    // ones - exclude it so Vitest's default *.spec.js glob doesn't collide
    // with @playwright/test's own test.describe/test runner.
    exclude: [...configDefaults.exclude, "e2e/**"],
    // Add pool and environment options for better CI compatibility
    pool: "forks",
    // Isolate tests to prevent interference
    isolate: true,
    // Handle unhandled rejections and suppress webidl-conversions errors
    onConsoleLog(log, type) {
      if (type === "stderr" && log.includes("webidl-conversions")) {
        return false;
      }
    },
  },
  esbuild: {
    target: "node14",
  },
});
