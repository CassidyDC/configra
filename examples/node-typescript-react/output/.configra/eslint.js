// Managed by Configra. Put your changes in eslint.config.js.

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/vendor/**", "**/build/**", "**/dist/**", "**/.configra/**", "**/.cache/**", "**/*.min.js", "**/*.min.css"], "Configra exclusions"),
  {
    name: "configra/typescript",
    files: ["**/*.{ts,mts,cts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    name: "configra/react-typescript",
    files: ["**/*.{ts,mts,cts,tsx}"],
    extends: [
      eslintReact.configs["recommended-typescript"],
      eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
]);
