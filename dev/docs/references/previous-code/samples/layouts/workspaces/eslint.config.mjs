import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
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
      "packages/node/**",
      "packages/php/**",
      "packages/wordpress-plugin/**",
      "packages/wordpress-site/**",
      "packages/wordpress-theme/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, parserOptions: { ecmaFeatures: { jsx: false } } },
  },
  prettier,
);
