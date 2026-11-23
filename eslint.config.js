/**
 * ESLint Configuration
 * @file Repository ESLint configuration for TypeScript and JavaScript files.
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @see https://typescript-eslint.io/getting-started
 * @see https://github.com/un-ts/eslint-plugin-import-x
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import { fileURLToPath } from "node:url";
import { importX } from "eslint-plugin-import-x";

/**
 * @typedef {import("eslint").Linter.Config} ESLintConfig
 */

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

/**
 * Repository lint rules for source, tests, and configuration files.
 *
 * @type {ESLintConfig[]}
 */
export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  globalIgnores(["previous-code/", "**/*.min.js"]),
  {
    files: ["**/*.{js,mjs,ts,mts}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedInlineConfigs: "warn",
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "import-x/first": "warn",
      "import-x/newline-after-import": "warn",
      "import-x/no-cycle": "error",
      "import-x/no-extraneous-dependencies": "error",
      // Flags documented default imports, such as `tseslint.configs`.
      "import-x/no-named-as-default-member": "off",
      yoda: ["warn", "never"],
    },
  },
  {
    // The TypeScript compiler already reports these for TypeScript files.
    files: ["**/*.{ts,mts}"],
    rules: {
      "import-x/default": "off",
      "import-x/namespace": "off",
      "import-x/no-unresolved": "off",
    },
  },
  {
    // Published code runs without devDependencies installed.
    files: ["src/**/*.{ts,mts}"],
    rules: {
      "import-x/no-extraneous-dependencies": ["error", { devDependencies: false }],
    },
  },
]);
