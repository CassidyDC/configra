/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * Lefthook integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "lefthook",
  languages: [],
  capabilities: [],
  operations: [
    "hooks:install",
  ],
  scope: "git",
  requirements: [
    "npm:lefthook",
  ],
};
