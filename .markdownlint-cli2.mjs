/**
 * markdownlint-cli2 configuration.
 *
 * Configra manages .configra/markdownlint-cli2.js. The repository's rules inside `config` follow the spread
 * and override Configra's.
 *
 * @see https://github.com/DavidAnson/markdownlint-cli2#configuration
 */

import configra from "./.configra/markdownlint-cli2.js";

/** @type {import("markdownlint-cli2").Options} */
export default {
  ...configra,
  config: {
    ...configra.config,
    "no-duplicate-heading": { siblings_only: true },
    "no-trailing-punctuation": false,
  },
};
