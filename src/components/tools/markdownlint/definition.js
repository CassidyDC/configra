/**
 * Markdownlint integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {import("../../../contracts.js").ToolDefinition}
 */
export default {
  id: "markdownlint",
  languages: [],
  capabilities: [],
  operations: [
    "lint:markdown",
  ],
  scope: "package",
  requirements: [
    "npm:markdownlint-cli2",
  ],
  alternatives: [
    ".markdownlint-cli2.yaml",
    ".markdownlint-cli2.yml",
    ".markdownlint-cli2.cjs",
    ".markdownlint-cli2.mjs",
  ],
};
