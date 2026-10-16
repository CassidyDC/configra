/**
 * @file Prettier integration metadata, supported operations, and configuration ownership.
 */

/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * Prettier integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "prettier",
  languages: [],
  capabilities: [],
  operations: [
    "format:check",
    "format",
  ],
  scope: "package",
  requirements: [
    "npm:prettier",
  ],
  alternatives: [
    "prettier.config.js",
    "prettier.config.mjs",
    "prettier.config.ts",
    "prettier.config.mts",
    "prettier.config.cts",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.json5",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc.toml",
  ],
};
