/**
 * @file WordPress PHP standard settings and shared formatting defaults.
 */

/**
 * @typedef {import("../../../contracts.js").StandardDefinition} StandardDefinition
 */

/**
 * WordPress baseline and formatting defaults for php.
 *
 * @type {StandardDefinition}
 */
export default {
  id: "wordpress",
  language: "php",
  baseline: "WordPress Coding Standards",
  formatting: {
    indentStyle: "tab",
    indentSize: 4,
  },
  settings: {
    ruleset: "WordPress",
  },
};
