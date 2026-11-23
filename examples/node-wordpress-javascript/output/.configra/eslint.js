// Managed by Configra. Put your changes in eslint.config.js.

import wordpress from "@wordpress/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/vendor/**", "**/build/**", "**/dist/**", "**/.configra/**", "**/.cache/**", "**/*.min.js", "**/*.min.css"], "Configra exclusions"),
  {
    name: "configra/wordpress",
    files: ["**/*.{js,mjs,cjs}"],
    extends: [wordpress.configs.recommended],
  },
  {
    // Prettier formats through `format` and `format:check`, so ESLint doesn't run it as a rule.
    name: "configra/prettier",
    files: ["**/*.{js,mjs,cjs}"],
    rules: { "prettier/prettier": "off" },
  },
]);
