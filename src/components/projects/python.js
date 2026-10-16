/**
 * Supported editor and documentation tools for a Python package.
 *
 * @type {import("../../contracts.js").ProjectDefinition}
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
