/**
 * ESLint configuration.
 *
 * Configra manages .configra/eslint.js and loads it first. The repository adds import checks and its
 * own rules after it; later entries override earlier ones.
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @see https://typescript-eslint.io/getting-started
 * @see https://github.com/un-ts/eslint-plugin-import-x
 */

import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import { defineConfig } from "eslint/config";
import configra from "./.configra/eslint.js";

export default defineConfig([
  configra,
  {
    files: ["**/*.{js,mjs,ts,mts}"],
    extends: [importX.flatConfigs.recommended, importX.flatConfigs.typescript],
    linterOptions: {
      reportUnusedInlineConfigs: "warn",
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
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
    // The TypeScript compiler already reports the import-x rules turned off here.
    files: ["**/*.{ts,mts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, varsIgnorePattern: "^_" }],
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
