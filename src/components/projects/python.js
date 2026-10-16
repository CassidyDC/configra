/**
 * @file Default languages, editor tools, and source paths for Python packages.
 */

/**
 * @typedef {import("../../contracts.js").ProjectDefinition} ProjectDefinition
 */

/**
 * Supported editor and documentation tools for a Python package.
 *
 * @type {ProjectDefinition}
 */
export default {
  id: "python",
  languages: [
    "python",
  ],
  tools: [
    "editorconfig",
    "gitignore",
    "markdownlint",
    "vscode",
  ],
  environment: "python",
  paths: [
    "src",
    "tests",
  ],
};
