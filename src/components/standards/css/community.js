/**
 * Community CSS Standard
 * @file Community CSS standard settings and shared formatting defaults.
 */

/**
 * @typedef {import("../../../contracts.js").StandardDefinition} StandardDefinition
 */

/**
 * Stylelint standard baseline and formatting defaults for css.
 *
 * @type {StandardDefinition}
 */
export default {
  id: "community",
  language: "css",
  baseline: "Stylelint standard",
  formatting: {
    indentStyle: "space",
    indentSize: 2,
  },
  settings: {
    extends: "stylelint-config-standard",
  },
};
