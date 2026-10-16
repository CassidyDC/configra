/**
 * Stylelint standard baseline and formatting defaults for css.
 *
 * @type {import("../../../contracts.js").StandardDefinition}
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
