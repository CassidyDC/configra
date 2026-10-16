/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * ESLint integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "eslint",
  languages: [
    "javascript",
  ],
  capabilities: [
    "react",
    "typescript",
  ],
  operations: [
    "lint:js",
  ],
  scope: "package",
  requirements: [
    "npm:eslint",
  ],
  alternatives: [
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    ".eslintignore",
  ],
};
