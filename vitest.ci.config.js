import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// CI-specific configuration with extra safeguards
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
    // Force forks pool for maximum isolation in CI
    pool: "forks",
    // Prevent hanging tests in CI
    testTimeout: 10000,
    hookTimeout: 10000,
    // Isolate each test file
    isolate: true,
    // Suppress common CI warnings
    onConsoleLog(log, type) {
      // Suppress webidl-conversions errors
      if (type === "stderr" && log.includes("webidl-conversions")) {
        return false;
      }
      // Suppress React prop warnings in tests
      if (type === "stderr" && log.includes("backgroundAlpha")) {
        return false;
      }
      return true;
    },
    // Additional CI-specific options
    reporter: "verbose",
    // Retry failed tests once in CI
    retry: 1,
  },
  esbuild: {
    target: "node14",
  },
});
