/**
 * WordPress baseline and formatting defaults for css.
 *
 * @type {import("../../../contracts.js").StandardDefinition}
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
