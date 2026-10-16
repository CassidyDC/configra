/**
 * @file PEP 8 Python standard settings and shared formatting defaults.
 */

/**
 * @typedef {import("../../../contracts.js").StandardDefinition} StandardDefinition
 */

/**
 * PEP 8 baseline and formatting defaults for python.
 *
 * @type {StandardDefinition}
 */
export default {
  id: "community",
  language: "python",
  baseline: "PEP 8",
  formatting: {
    indentStyle: "space",
    indentSize: 4,
  },
  settings: {},
};
