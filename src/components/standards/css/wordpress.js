/**
 * @typedef {import("../../../contracts.js").StandardDefinition} StandardDefinition
 */

/**
 * WordPress baseline and formatting defaults for css.
 *
 * @type {StandardDefinition}
 */
export default {
  id: "wordpress",
  language: "css",
  baseline: "WordPress Coding Standards",
  formatting: {
    indentStyle: "tab",
    indentSize: 4,
  },
  settings: {
    extends: "@wordpress/stylelint-config",
  },
};
