import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["*.config.js"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      complexity: ["error", 15],
    },
  },
  // Root-level tool config files (vite/vitest/playwright/eslint) run under
  // Node, not the browser, and don't need the app's react-hooks/react-refresh
  // rules.
  {
    files: ["*.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
  // Web Worker entry files run in WorkerGlobalScope, not window - `self` is
  // the worker itself here (not an alias for `window`), and globals.browser
  // doesn't declare the worker-only APIs these files use.
  {
    files: ["**/*.worker.js"],
    languageOptions: {
      globals: globals.worker,
    },
  },
]);
