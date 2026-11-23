/**
 * markdownlint-cli2 configuration.
 *
 * Configra manages .configra/markdownlint.js. The repository's rules inside `config` follow the spread
 * and override Configra's.
 *
 * @see https://github.com/DavidAnson/markdownlint-cli2#configuration
 */

import configra from "./.configra/markdownlint.js";

/** @type {import("markdownlint-cli2").Options} */
export default {
  ...configra,
  config: {
    ...configra.config,
    "no-duplicate-heading": { siblings_only: true },
    "no-trailing-punctuation": false,
  },
};
