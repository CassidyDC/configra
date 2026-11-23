// Managed by Configra. Put your changes in eslint.config.js.

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/vendor/**", "**/build/**", "**/dist/**", "**/.configra/**", "**/.cache/**", "**/*.min.js", "**/*.min.css"], "Configra exclusions"),
  {
    name: "configra/javascript",
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
]);
