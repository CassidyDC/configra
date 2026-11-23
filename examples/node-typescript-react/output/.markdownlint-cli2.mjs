/**
 * markdownlint-cli2 configuration.
 *
 * Configra manages .configra/markdownlint.js. Add your own rules inside `config` after the spread;
 * they override Configra's.
 *
 * @see https://github.com/DavidAnson/markdownlint-cli2#configuration
 */

import configra from "./.configra/markdownlint.js";

/** @type {import("markdownlint-cli2").Options} */
export default {
  ...configra,
  config: {
    ...configra.config,
    // "no-duplicate-heading": { siblings_only: true },
  },
};
