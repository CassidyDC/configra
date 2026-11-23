/**
 * Prettier Configuration
 * @file Repository Prettier configuration and structured-data formatting overrides.
 *
 * @see https://prettier.io/docs/configuration
 */

/**
 * @typedef {import("prettier").Config} PrettierConfig
 */

/**
 * Prettier configuration.
 *
 * @type {PrettierConfig}
 */
const config = {
  printWidth: 120,
  plugins: ["prettier-plugin-multiline-arrays"], // Keeps arrays formatted as written
  overrides: [
    {
      files: "*.{json,jsonc,json5}",
      options: {
        // Always put object properties and array items on a new line
        printWidth: 1,
        bracketSpacing: false,
        trailingComma: "none",
      },
    },
  ],
};

export default config;
