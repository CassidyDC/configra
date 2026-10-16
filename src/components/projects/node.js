/**
 * Default development tools and source paths for a Node.js package.
 *
 * @type {import("../../contracts.js").ProjectDefinition}
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
