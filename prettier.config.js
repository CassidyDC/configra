/**
 * Prettier configuration.
 *
 * Configra manages .configra/prettier.js and keeps it in sync with .editorconfig. The repository adds
 * its structured-data overrides after the spread; they override Configra's.
 *
 * @see https://prettier.io/docs/configuration
 */

import configra from "./.configra/prettier.js";

/** @type {import("prettier").Config} */
export default {
  ...configra,
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
