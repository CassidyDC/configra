/**
 * @file PSR-12 PHP standard settings and shared formatting defaults.
 */

/**
 * @typedef {import("../../../contracts.js").StandardDefinition} StandardDefinition
 */

/**
 * PSR-12 baseline and formatting defaults for php.
 *
 * @type {StandardDefinition}
 */
export default {
  id: "community",
  language: "php",
  baseline: "PSR-12",
  formatting: {
    indentStyle: "space",
    indentSize: 4,
  },
  settings: {
    ruleset: "PSR12",
  },
};
