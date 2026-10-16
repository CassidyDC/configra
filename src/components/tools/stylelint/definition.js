/**
 * @file Stylelint integration metadata, supported operations, and configuration ownership.
 */

/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * Stylelint integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "stylelint",
  languages: [
    "css",
  ],
  capabilities: [],
  operations: [
    "lint:css",
  ],
  scope: "package",
  requirements: [
    "npm:stylelint",
  ],
  alternatives: [
    "stylelint.config.js",
    "stylelint.config.cjs",
    ".stylelintrc",
    ".stylelintrc.json",
    ".stylelintrc.js",
    ".stylelintrc.cjs",
    ".stylelintrc.yaml",
    ".stylelintrc.yml",
  ],
};
