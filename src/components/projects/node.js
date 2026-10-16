/**
 * @typedef {import("../../contracts.js").ProjectDefinition} ProjectDefinition
 */

/**
 * Default development tools and source paths for a Node.js package.
 *
 * @type {ProjectDefinition}
 */
export default {
  id: "node",
  languages: [
    "javascript",
  ],
  tools: [
    "editorconfig",
    "gitignore",
    "lefthook",
    "markdownlint",
    "prettier",
    "vscode",
    "eslint",
  ],
  environment: "node",
  paths: [
    "src",
  ],
};
