import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// CI-specific configuration with extra safeguards
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.js"],
    css: true,
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
