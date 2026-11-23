/**
 * ESLint Configuration
 * @file Repository ESLint configuration for JavaScript linting.
 *
 * @author CassidyDC <info@cassidydc.com>
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @version 1.0.0
 */

import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import { fileURLToPath, URL } from "node:url";
import { importX } from "eslint-plugin-import-x";

/**
 * @typedef {import("eslint").Linter.Config} ESLintConfig
 */

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

/**
 * Repository lint rules for implementation files, tests, and executable entry points.
 *
 * @type {ESLintConfig[]}
 */
export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  globalIgnores(["**/*.min.js", "docs", "samples"]),
  {
    plugins: {
      "import-x": importX,
      js,
    },
    extends: [
      "import-x/recommended",
      "js/recommended",
    ],
    files: ["**/*.js"],
    languageOptions: { globals: globals.node },
    linterOptions: {
      reportUnusedInlineConfigs: "warn",
    },
    rules: {
      "no-unused-vars": "warn",
      yoda: ["warn", "never"],
    },
  },
]);
