/**
 * Webpack integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {import("../../../contracts.js").ToolDefinition}
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
