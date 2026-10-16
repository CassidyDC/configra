/**
 * Lefthook integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {import("../../../contracts.js").ToolDefinition}
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
