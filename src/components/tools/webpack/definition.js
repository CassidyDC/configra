/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * Webpack integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "webpack",
  languages: [
    "javascript",
  ],
  capabilities: [],
  operations: [
    "build",
  ],
  scope: "package",
  requirements: [
    "npm:webpack",
    "npm:webpack-cli",
  ],
};
