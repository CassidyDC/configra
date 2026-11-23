import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import prettier from "eslint-config-prettier/flat";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/vendor/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.phpstan-cache/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
    ],
    languageOptions: { globals: globals.node, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: "detect" } },
  },
  { files: ["**/*.{ts,mts,cts,tsx}"], extends: [tseslint.configs.recommended] },
  prettier,
);
